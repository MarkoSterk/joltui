# /// script
# requires-python = ">=3.12"
# dependencies = ["packaging>=24,<27"]
# ///
"""Build, preview and publish the versioned JoltUI documentation (Zensical + mike).

Shell wrappers (docs.sh, docs.ps1, publish_docs.sh, publish_docs.ps1) only locate
this file and invoke uv. Tools run through ``uvx``, so nothing is installed into
the repository. See DOCS_PUBLISHING.md for the release workflow.
"""

import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

from packaging.version import InvalidVersion, Version

ROOT = Path(__file__).resolve().parent.parent

# Zensical's fork of mike (reads zensical.toml, builds with `zensical build`).
# Pin a commit (git+...mike.git@<sha>) for fully reproducible publishing.
MIKE_SOURCE = "mike @ git+https://github.com/squidfunk/mike.git"
# Extra Python packages for the build (Zensical plugins). JoltUI needs none.
DOC_PLUGINS: list[str] = []

BRANCH = "gh-pages"
# The remote that hosts GitHub Pages. Override with --remote or JOLTUI_DOCS_REMOTE
# when `origin` points somewhere else (for example an internal Gitea mirror).
DEFAULT_REMOTE = os.environ.get("JOLTUI_DOCS_REMOTE", "origin")
LATEST = "latest"
DEV = "dev"


class DocsError(Exception):
    pass


def tool(program, remote=None):
    """Command prefix that runs `zensical` or `mike` in a uvx environment."""
    with_args = [arg for plugin in DOC_PLUGINS for arg in ("--with", plugin)]
    if program == "zensical":
        return ["uvx", *with_args, "zensical"]
    return ["uvx", "--from", MIKE_SOURCE, *with_args, "mike"]


def mike(remote, *args):
    """mike command with the remote and branch made explicit."""
    command, *rest = args
    return [
        *tool("mike", remote),
        command,
        "--remote",
        remote,
        "--branch",
        BRANCH,
        *rest,
    ]


def run(cmd, dry_run=False, capture=False):
    print("$ " + shlex.join(cmd), flush=True)
    if dry_run and not capture:
        return ""
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    if result.returncode != 0:
        raise DocsError(f"Command failed (exit code {result.returncode}): {cmd[0]}")
    return result.stdout or ""


def git(*args):
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.returncode, result.stdout.strip()


def package_version():
    package = json.loads((ROOT / "package.json").read_text("utf-8"))
    name = package.get("name", "")
    if not name.endswith("joltui"):
        raise DocsError("docs.py must live in the JoltUI repository")
    try:
        return Version(package["version"])
    except (KeyError, InvalidVersion):
        raise DocsError("package.json has no valid `version`")


def docs_version(version):
    """Documentation versions are per minor release: 1.2.4 -> 1.2."""
    return f"{version.major}.{version.minor}"


def sync_docs_branch(remote):
    """Fast-forward the local docs branch to the remote one, so mike sees every version."""
    code, _ = git("ls-remote", "--exit-code", "--heads", remote, BRANCH)
    if code != 0:
        return
    code, _ = git("fetch", "--quiet", remote, f"{BRANCH}:{BRANCH}")
    if code != 0:
        print(
            f"! Could not fast-forward the local {BRANCH} branch to {remote}/{BRANCH}; "
            "it has local commits (for example from --no-push)."
        )


def deployed_versions(remote):
    """Versions on the docs branch, as (name, aliases); empty before the first deploy."""
    code, _ = git("rev-parse", "--verify", "--quiet", f"refs/heads/{BRANCH}")
    if code != 0:
        return []
    output = run(mike(remote, "list", "--json"), capture=True)
    return [
        (item["version"], item.get("aliases", []))
        for item in json.loads(output or "[]")
    ]


def newest(names):
    parsed = []
    for name in names:
        try:
            parsed.append(Version(name))
        except InvalidVersion:
            continue  # "dev" and other non-release names
    return max(parsed, default=None)


def check_repository(args, name):
    if args.allow_dirty:
        print("! Skipping the clean working tree check (--allow-dirty)")
    else:
        _, status = git("status", "--porcelain", "--untracked-files=no")
        if status:
            raise DocsError(
                "The working tree has uncommitted changes. Commit them, or pass --allow-dirty."
            )
    if args.dev:
        return
    # Release docs come from a release tag of the same minor version (v1.2.0, v1.2.1, ...).
    _, tags = git("tag", "--points-at", "HEAD")
    matching = [tag for tag in tags.split() if tag.startswith(f"v{name}.")]
    if matching:
        print(f"✓ HEAD is at release tag {matching[0]}")
        return
    problem = f"HEAD is not at a v{name}.* release tag."
    if args.allow_untagged:
        print(f"! {problem} Continuing (--allow-untagged).")
        return
    raise DocsError(
        f"{problem} Release docs are built from the release tag so they match the "
        f"published package, for example `git checkout v{name}.0`. "
        "Pass --allow-untagged to publish from the current commit anyway."
    )


def cmd_serve(args):
    run([*tool("zensical", args.remote), "serve", *args.extra])


def cmd_build(args):
    run([*tool("zensical", args.remote), "build", "--clean", *args.extra])


def cmd_list(args):
    sync_docs_branch(args.remote)
    run(mike(args.remote, "list"))


def cmd_serve_versions(args):
    run(mike(args.remote, "serve"))


def cmd_deploy(args):
    remote = args.remote
    current = package_version()
    if args.dev:
        name = DEV
    else:
        name = args.version or docs_version(current)
        try:
            requested = Version(name)
        except InvalidVersion:
            raise DocsError(
                f"Not a version: {name!r} (use --dev for the development docs)"
            )
        if not args.version:
            print(f"Package version {current} -> documentation version {name}")
        elif docs_version(requested) != name:
            raise DocsError(
                f"Use the minor version {docs_version(requested)}, not {name}"
            )

    check_repository(args, name)

    print("\nChecking that the site builds…")
    run(
        [*tool("zensical", remote), "build", "--clean", "--strict"],
        dry_run=args.dry_run,
    )

    push = [] if args.no_push else ["--push"]
    title = ["--title", args.title] if args.title else []
    sync_docs_branch(remote)

    if args.dev:
        run(mike(remote, "deploy", *push, *title, DEV), dry_run=args.dry_run)
    else:
        existing = deployed_versions(remote)
        newest_deployed = newest(version for version, _ in existing)
        is_newest = newest_deployed is None or Version(name) >= newest_deployed
        if is_newest and not args.no_latest:
            run(
                mike(remote, "deploy", *push, *title, "--update-aliases", name, LATEST),
                dry_run=args.dry_run,
            )
        else:
            if not args.no_latest:
                print(
                    f"! {name} is older than {newest_deployed}: `{LATEST}` is left unchanged"
                )
            run(mike(remote, "deploy", *push, *title, name), dry_run=args.dry_run)
        if not existing or args.set_default:
            run(mike(remote, "set-default", *push, LATEST), dry_run=args.dry_run)

    where = f"the local {BRANCH} branch" if args.no_push else f"{remote}/{BRANCH}"
    action = "Would publish" if args.dry_run else "Published"
    print(f"\n✓ {action} documentation version {name} to {where}")
    if args.no_push and not args.dry_run:
        print(
            "  Preview with `docs.sh serve-versions`, push with "
            f"`git push {remote} {BRANCH}`."
        )


def cmd_delete(args):
    if args.version == LATEST:
        raise DocsError("`latest` is an alias; delete the version it points to instead")
    push = [] if args.no_push else ["--push"]
    sync_docs_branch(args.remote)
    run(mike(args.remote, "delete", *push, args.version), dry_run=args.dry_run)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--remote",
        default=DEFAULT_REMOTE,
        help=f"git remote that hosts the {BRANCH} branch (default: {DEFAULT_REMOTE})",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    serve = commands.add_parser(
        "serve", parents=[common], help="live preview of the current docs (zensical serve)"
    )
    serve.add_argument(
        "extra", nargs=argparse.REMAINDER, help="arguments for zensical serve"
    )
    serve.set_defaults(func=cmd_serve)

    build = commands.add_parser(
        "build", parents=[common], help="build the current docs into site/")
    build.add_argument(
        "extra", nargs=argparse.REMAINDER, help="arguments for zensical build"
    )
    build.set_defaults(func=cmd_build)

    commands.add_parser(
        "list", parents=[common], help="list published versions").set_defaults(
        func=cmd_list
    )
    commands.add_parser(
        "serve-versions", parents=[common], help=f"preview the versioned site from the {BRANCH} branch"
    ).set_defaults(func=cmd_serve_versions)

    deploy = commands.add_parser(
        "deploy", parents=[common], help="publish a documentation version")
    target = deploy.add_mutually_exclusive_group()
    target.add_argument(
        "--version", help="docs version (default: minor version of package.json)"
    )
    target.add_argument(
        "--dev", action="store_true", help=f"publish the `{DEV}` docs of main"
    )
    deploy.add_argument("--title", help="title shown in the version selector")
    deploy.add_argument(
        "--no-latest", action="store_true", help=f"do not move the `{LATEST}` alias"
    )
    deploy.add_argument(
        "--set-default",
        action="store_true",
        help=f"make `{LATEST}` the default version (automatic on first deploy)",
    )
    deploy.add_argument(
        "--no-push",
        action="store_true",
        help=f"commit to the local {BRANCH} branch only",
    )
    deploy.add_argument(
        "--allow-untagged",
        action="store_true",
        help="publish a release version without being at its tag",
    )
    deploy.add_argument(
        "--allow-dirty", action="store_true", help="publish with uncommitted changes"
    )
    deploy.add_argument(
        "--dry-run", action="store_true", help="check and print the commands only"
    )
    deploy.set_defaults(func=cmd_deploy)

    delete = commands.add_parser(
        "delete", parents=[common], help="remove a published version")
    delete.add_argument("version")
    delete.add_argument("--no-push", action="store_true")
    delete.add_argument("--dry-run", action="store_true")
    delete.set_defaults(func=cmd_delete)

    args = parser.parse_args()
    try:
        args.func(args)
    except DocsError as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
