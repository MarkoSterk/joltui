import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../cli/index.mjs', import.meta.url));
function fixture(t) {
    const cwd = mkdtempSync(join(tmpdir(), 'joltui-cli-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    return { cwd, run: (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }) };
}

for (const agent of ['generic', 'codex', 'claude']) test(`installs ${agent} instructions safely`, t => {
    const { cwd, run } = fixture(t);
    const instruction = agent === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
    const folder = join(cwd, agent === 'claude' ? '.claude' : '.agents', 'skills', 'joltui');
    writeFileSync(join(cwd, instruction), '# Existing rules\nKeep these.\n');
    const result = run('agents', ...(agent === 'generic' ? [] : [agent]));
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(cwd, instruction), 'utf8'), /^# Existing rules\nKeep these\./);
    assert.ok(existsSync(join(folder, 'references/reference/exports.md')));
    assert.ok(existsSync(join(folder, 'references/guide/cancellation.md')));
    const skill = readFileSync(join(folder, 'SKILL.md'), 'utf8');
    for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(existsSync(join(folder, match[1])));
    writeFileSync(join(folder, 'SKILL.md'), 'custom edits');
    assert.equal(run('agents', agent).status, 1);
    assert.equal(readFileSync(join(folder, 'SKILL.md'), 'utf8'), 'custom edits');
});

for (const flags of [[], ['--no-plugin'], ['--no-vite']]) test(`scaffolds ${flags.join(' ') || 'defaults'}`, t => {
    const { cwd, run } = fixture(t);
    const result = run('init', 'example-app', '--yes', '--no-install', ...flags);
    assert.equal(result.status, 0, result.stderr);
    const target = cwd;
    assert.equal(existsSync(join(cwd, 'example-app')), false);
    const pkg = JSON.parse(readFileSync(join(target, 'package.json')));
    assert.ok(pkg.dependencies.joltui);
    assert.equal(Boolean(pkg.devDependencies.vite), !flags.includes('--no-vite'));
    assert.equal(Boolean(pkg.devDependencies['joltui-vite-plugin']), flags.length === 0);
    assert.equal(existsSync(join(target, 'vite.config.ts')), !flags.includes('--no-vite'));
    assert.equal(readFileSync(join(target, 'src/app/app.ts'), 'utf8').includes('pages: [HomePage]'), flags.length !== 0);
    assert.equal(run('init', 'example-app', '--yes', '--no-install').status, 1);
});

test('rejects invalid requests without creating files', t => {
    const { cwd, run } = fixture(t);
    for (const args of [['agents', 'unknown'], ['init', '../escape', '--yes'], ['init', 'app', '--wat'], ['unknown'], ['init']]) {
        assert.equal(run(...args).status, 1);
    }
    writeFileSync(join(cwd, 'index.html'), 'existing content');
    assert.equal(run('init', 'existing', '--yes', '--no-install').status, 1);
    assert.equal(existsSync(join(cwd, '.agents')), false);
});

test('generated starters typecheck and build with local framework packages', t => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const cwd = mkdtempSync(join(root, '.cli-smoke-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    for (const [name, flags] of [['discovery', []], ['explicit', ['--no-plugin']], ['bare', ['--no-vite']]]) {
        if (name === 'discovery' && !existsSync(join(root, '../joltui-vite-plugin/dist/index.js'))) {
            t.diagnostic('Discovery build requires the sibling joltui-vite-plugin checkout to be built; skipping that variant.');
            continue;
        }
        const app = join(cwd, name);
        mkdirSync(app);
        let result = spawnSync(process.execPath, [cli, 'init', name, '--yes', '--no-install', ...flags], { cwd: app, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        mkdirSync(join(app, 'node_modules'));
        mkdirSync(join(app, 'node_modules/joltui'));
        cpSync(join(root, 'dist'), join(app, 'node_modules/joltui/dist'), { recursive: true });
        cpSync(join(root, 'package.json'), join(app, 'node_modules/joltui/package.json'));
        if (name === 'discovery') {
            const source = join(root, '../joltui-vite-plugin');
            mkdirSync(join(app, 'node_modules/joltui-vite-plugin'));
            cpSync(join(source, 'dist'), join(app, 'node_modules/joltui-vite-plugin/dist'), { recursive: true });
            cpSync(join(source, 'package.json'), join(app, 'node_modules/joltui-vite-plugin/package.json'));
        }
        result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'], { cwd: app, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        if (name !== 'bare') {
            result = spawnSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: app, encoding: 'utf8' });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            assert.ok(existsSync(join(app, 'dist/index.html')));
        }
    }
});

test('initializes an existing npm project in place and preserves project settings', t => {
    const { cwd, run } = fixture(t);
    const original = { name: 'existing-project', version: '2.3.4', license: 'MIT',
        scripts: { test: 'custom-test', dev: 'custom-dev' },
        dependencies: { joltui: '^0.8.0', other: '1.2.3' }, devDependencies: { typescript: '~5.9.3' } };
    writeFileSync(join(cwd, 'package.json'), JSON.stringify(original));
    writeFileSync(join(cwd, 'README.md'), 'Keep readme');
    writeFileSync(join(cwd, '.gitignore'), 'custom-ignore');
    writeFileSync(join(cwd, 'package-lock.json'), 'existing lock');
    mkdirSync(join(cwd, 'node_modules'));
    writeFileSync(join(cwd, 'node_modules/sentinel'), 'installed dependency');
    const result = run('init', '--yes', '--no-install');
    assert.equal(result.status, 0, result.stderr);
    const updated = JSON.parse(readFileSync(join(cwd, 'package.json')));
    assert.equal(updated.name, original.name);
    assert.equal(updated.version, original.version);
    assert.equal(updated.license, original.license);
    assert.deepEqual(updated.dependencies, original.dependencies);
    assert.equal(updated.devDependencies.typescript, '~5.9.3');
    assert.equal(updated.scripts.dev, 'custom-dev');
    assert.equal(updated.scripts.test, 'custom-test');
    assert.ok(updated.scripts.build);
    assert.ok(existsSync(join(cwd, 'src/main.ts')));
    assert.equal(existsSync(join(cwd, original.name)), false);
    for (const [path, content] of [['README.md', 'Keep readme'], ['.gitignore', 'custom-ignore'], ['package-lock.json', 'existing lock'], ['node_modules/sentinel', 'installed dependency']]) {
        assert.equal(readFileSync(join(cwd, path), 'utf8'), content);
    }
});

test('file conflicts leave the existing manifest and source untouched', t => {
    const { cwd, run } = fixture(t);
    const original = '{"name":"existing"}\n';
    writeFileSync(join(cwd, 'package.json'), original);
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src/main.ts'), 'user source');
    assert.equal(run('init', '--yes', '--no-install').status, 1);
    assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), original);
    assert.equal(readFileSync(join(cwd, 'src/main.ts'), 'utf8'), 'user source');
    assert.equal(existsSync(join(cwd, 'index.html')), false);
});

test('reuses an existing scoped framework dependency without adding an alias', t => {
    const { cwd, run } = fixture(t);
    const framework = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).name;
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: '@example/app', dependencies: { [framework]: '^0.9.0' } }));
    const result = run('init', '--yes', '--no-install');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(cwd, 'package.json'))).dependencies, { [framework]: '^0.9.0' });
    assert.ok(readFileSync(join(cwd, 'src/app/app.ts'), 'utf8').includes(`from '${framework}'`));
});

