# Versioning and releases

## Package versions

JoltUI and `joltui-vite-plugin` follow [semantic versioning](https://semver.org):
`major.minor.patch`.

- **Before 1.0**, a minor release may contain breaking changes.
- The Vite plugin has **its own version**, independent of the framework.

Pin versions in applications and read the release notes before upgrading a minor version.

## Documentation versions

The documentation is versioned per **minor release** of the `joltui` package (`0.9`, `1.0`,
`1.1`, ...). Patch releases update the documentation of their minor version.

| Version | Content |
| --- | --- |
| `latest` (alias, default) | the newest stable release |
| `X.Y` | the documentation as it was released with that version |
| `dev` | the `main` branch, for the next unreleased version |

Use the version selector in the header to switch. Older versions stay available, so the
documentation matches the version you have installed.

How versions are published is described in
[Writing the documentation](documentation.md#publishing-versions).
