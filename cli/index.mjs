#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { scaffold } from './scaffold.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const help = `Usage: joltui agents [codex|claude|generic]
       joltui init [app-name] [--yes] [--no-vite] [--no-plugin] [--no-install]

agents installs local framework instructions (default: generic).
init scaffolds the current directory, reusing its package.json.
--yes accepts defaults: existing project name, Vite, plugin, install dependencies.
Use npx joltui or npm exec -- joltui to run these commands.`;

async function exists(path) {
    try { await lstat(path); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function agents(name = 'generic') {
    if (!['generic', 'codex', 'claude'].includes(name.toLowerCase())) {
        throw new Error(`Unknown agent: ${name}. Choose generic, codex, or claude.`);
    }
    const claude = name.toLowerCase() === 'claude';
    const folder = `${claude ? '.claude' : '.agents'}/skills/joltui`;
    const instruction = claude ? 'CLAUDE.md' : 'AGENTS.md';
    // Never follow an existing skill directory or overwrite user-edited references.
    if (await exists(folder)) throw new Error(`${folder} already exists; move it aside before reinstalling.`);
    for (const path of [dirname(dirname(folder)), dirname(folder), instruction]) {
        if (await exists(path) && (await lstat(path)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path}`);
    }
    const files = {};
    async function collect(relative = '') {
        for (const entry of await readdir(join(root, 'docs', relative), { withFileTypes: true })) {
            const path = join(relative, entry.name);
            if (entry.isDirectory()) await collect(path);
            else if (entry.name.endsWith('.md')) files[`references/${path.replaceAll('\\', '/')}`] = await readFile(join(root, 'docs', path), 'utf8');
        }
    }
    await collect();
    files['SKILL.md'] = `---
name: joltui
description: Build and maintain JoltUI TypeScript applications using custom elements, routing, templates, and reactive state.
---

# JoltUI ${pkg.version}

Read only the references relevant to the task. Follow the project's installed package name and existing conventions.
Use standard TypeScript decorators, not experimentalDecorators. Place @component closest to the class.
Prefer @react accessors and data-bind for state changes. Custom element names require a hyphen.
With the Vite plugin, pages must be named default-exported classes; without it, register pages explicitly.

## References

${Object.keys(files).sort().map(path => `- [${path.slice(11, -3)}](${path})`).join('\n')}
`;
    const previous = await exists(instruction) ? await readFile(instruction, 'utf8') : '';
    const marker = '<!-- joltui -->';
    for (const [path, contents] of Object.entries(files)) {
        const target = join(folder, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, contents, { flag: 'wx' });
    }
    if (!previous.includes(marker)) await writeFile(instruction, `${previous}${previous.endsWith('\n') || !previous ? '' : '\n'}\n${marker}\n## JoltUI\n\nFor JoltUI work, read [the JoltUI skill](${folder}/SKILL.md) and the relevant framework references.\n`);
    console.log(`Added ${folder} and configured ${instruction}.`);
}

async function init(args) {
    const flags = new Set(args.filter(arg => arg.startsWith('--')));
    for (const flag of flags) if (!['--yes', '--no-vite', '--no-plugin', '--no-install'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const names = args.filter(arg => !arg.startsWith('--'));
    if (names.length > 1) throw new Error('Provide only one app name.');
    if (!flags.has('--yes') && !process.stdin.isTTY) throw new Error('Interactive input requires a terminal. Use --yes to accept defaults.');
    const target = process.cwd();
    const manifestPath = join(target, 'package.json');
    const hasManifest = await exists(manifestPath);
    if (hasManifest && (await lstat(manifestPath)).isSymbolicLink()) throw new Error('Refusing symbolic link: package.json');
    const existing = hasManifest ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) throw new Error('package.json must contain an object.');
    const defaultName = existing.name ?? (basename(target).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'my-joltui-app');
    const rl = flags.has('--yes') ? null : createInterface({ input: process.stdin, output: process.stdout });
    async function ask(question, fallback) { return rl ? (await rl.question(`${question} (${fallback}): `)).trim() || fallback : fallback; }
    async function confirm(question) {
        while (true) {
            const answer = (await ask(question, 'Y/n')).toLowerCase();
            if (['y/n', 'y', 'yes'].includes(answer)) return true;
            if (['n', 'no'].includes(answer)) return false;
            console.log('Please answer yes or no.');
        }
    }
    let name, vite, plugin, install;
    try {
        name = names[0] ?? await ask('Application name', defaultName);
        if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214 || ['node_modules', 'favicon.ico'].includes(name)) throw new Error('Use a lowercase npm app name (optionally scoped).');
        vite = !flags.has('--no-vite') && await confirm('Install Vite?');
        plugin = vite && !flags.has('--no-plugin') && await confirm('Install joltui-vite-plugin for page discovery?');
        install = !flags.has('--no-install') && await confirm('Install dependencies now?');
    } finally { rl?.close(); }
    const files = scaffold({ name, vite, plugin, packageName: pkg.name, version: pkg.version });
    const generated = JSON.parse(files['package.json']);
    const merged = { ...generated, ...existing, scripts: { ...generated.scripts, ...existing.scripts }, dependencies: { ...existing.dependencies }, devDependencies: { ...existing.devDependencies } };
    // Respect existing versions and dependency sections, including scoped installs.
    const installed = { ...existing.devDependencies, ...existing.dependencies };
    const framework = installed.joltui ? 'joltui' : installed[pkg.name] ? pkg.name : 'joltui';
    for (const section of ['dependencies', 'devDependencies']) {
        for (const [dependency, version] of Object.entries(generated[section])) {
            if (dependency === 'joltui' && framework !== 'joltui') continue;
            if (!(dependency in installed)) merged[section][dependency] = version;
        }
    }
    files['package.json'] = JSON.stringify(merged, null, 2) + '\n';
    if (framework !== 'joltui') {
        for (const path of Object.keys(files).filter(path => path.endsWith('.ts'))) {
            files[path] = files[path].replaceAll("from 'joltui'", `from '${framework}'`);
        }
        if (plugin) files['vite.config.ts'] = files['vite.config.ts'].replace('joltui()', `joltui({ frameworkPackage: '${framework}' })`);
    }
    if (vite && merged.type === 'commonjs') {
        files['vite.config.mts'] = files['vite.config.ts'];
        delete files['vite.config.ts'];
    }
    if (vite) {
        for (const extension of ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']) {
            if (await exists(join(target, `vite.config.${extension}`))) throw new Error(`vite.config.${extension} already exists; initialization stopped without changing files.`);
        }
    }
    // Preflight every generated path before modifying any project files.
    for (const path of Object.keys(files)) {
        let parent = dirname(path);
        while (parent !== '.') {
            if (await exists(join(target, parent))) {
                const stat = await lstat(join(target, parent));
                if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Cannot scaffold through ${parent}.`);
            }
            parent = dirname(parent);
        }
        if (path === 'package.json' || !await exists(join(target, path))) continue;
        if (['README.md', '.gitignore'].includes(path)) {
            delete files[path];
            continue;
        }
        throw new Error(`${path} already exists; initialization stopped without changing files.`);
    }
    for (const [path, contents] of Object.entries(files)) {
        await mkdir(dirname(join(target, path)), { recursive: true });
        await writeFile(join(target, path), contents, { flag: path === 'package.json' && hasManifest ? 'w' : 'wx' });
    }
    console.log(`Initialized JoltUI in ${target}`);
    if (install) {
        // npm's JS entry avoids shell quoting and npm.cmd differences on Windows.
        const npm = process.env.npm_execpath;
        const result = npm
            ? spawnSync(process.execPath, [npm, 'install'], { cwd: target, stdio: 'inherit' })
            : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
        if (result.error || result.status !== 0) throw new Error('Files were created, but npm install failed. Run npm install in the current directory to retry.');
    }
    console.log(`Next:${install ? '' : '\n  npm install'}\n  npm run ${vite ? 'dev' : 'typecheck'}`);
}

try {
    const [command, ...args] = process.argv.slice(2);
    if (!command || ['--help', '-h', 'help'].includes(command) || args.includes('--help')) console.log(help);
    else if (['--version', '-v'].includes(command)) console.log(pkg.version);
    else if (command === 'agents') {
        if (args.length > 1) throw new Error('agents accepts one optional agent name.');
        await agents(args[0]);
    } else if (command === 'init') await init(args);
    else throw new Error(`Unknown command: ${command}\n${help}`);
} catch (error) {
    console.error(`joltui: ${error.message}`);
    process.exitCode = 1;
}
