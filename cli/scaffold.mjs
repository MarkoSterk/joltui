export function scaffold({ name, vite, plugin, packageName, version }) {
    // Aliases keep examples and the plugin's default frameworkPackage consistent
    // with both public and scoped registry distributions.
    const dependency = packageName === 'joltui' ? `^${version}` : `npm:${packageName}@^${version}`;
    const pluginPackage = packageName.replace(/joltui$/, 'joltui-vite-plugin');
    const json = value => JSON.stringify(value, null, 2) + '\n';
    const files = {
        'package.json': json({ name, version: '0.0.0', private: true, type: 'module',
            scripts: { typecheck: 'tsc --noEmit', ...(vite ? { dev: 'vite', build: 'tsc --noEmit && vite build', preview: 'vite preview' } : {}) },
            dependencies: { joltui: dependency },
            devDependencies: { typescript: '^5.9.3', ...(vite ? { vite: '^8.0.0' } : {}), ...(plugin ? { 'joltui-vite-plugin': pluginPackage === 'joltui-vite-plugin' ? `^${version}` : `npm:${pluginPackage}@^${version}` } : {}) },
        }),
        'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2022', 'DOM', 'DOM.Iterable'], strict: true, skipLibCheck: true, noEmit: true, experimentalDecorators: false, useDefineForClassFields: true }, include: ['src'] }),
        '.gitignore': 'node_modules/\ndist/\n.env.local\n',
        'index.html': `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${name}</title></head>
<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>\n`,
        'src/main.ts': `import Application from './app/app.js';
import './style.css';

const app = new Application({ appName: ${JSON.stringify(name)} });
await app.init('#app');
`,
        'src/app/app.ts': `import { App } from 'joltui';
import ApplicationRouter from './router.js';
import MainLayout from './layouts/mainLayout.js';
${plugin ? '' : "import HomePage from './pages/homePage.js';\n"}
export default class Application extends App<Application> {
    protected override routerGenerator(): ApplicationRouter {
        return new ApplicationRouter({
            app: this,
            baseLayout: MainLayout,
            defaultTarget: '#page',
${plugin ? '' : '            pages: [HomePage],\n'}        });
    }
}
`,
        'src/app/router.ts': `import { Router } from 'joltui';
import type Application from './app.js';

export default class ApplicationRouter extends Router<Application> {}
`,
        'src/app/layouts/mainLayout.ts': `import { CustomElement, component, html, layout } from 'joltui';
import type Application from '../app.js';

@layout
@component({ tagName: 'main-layout' })
export default class MainLayout extends CustomElement<Application> {
    override markup = () => html\`<header><a href="/">Home</a></header><main id="page"></main>\`;
}
`,
        'src/app/pages/homePage.ts': `import { CustomElement, component, html, page, react } from 'joltui';
import type Application from '../app.js';

@page({ path: '/', title: 'Home' })
@component({ tagName: 'home-page' })
export default class HomePage extends CustomElement<Application> {
    @react(0)
    accessor count!: number;

    override markup = () => html\`
        <h1>Hello from JoltUI</h1>
        <p data-bind="count">Count: {{= this.count }}</p>
        <button type="button" @click="increment">Increment</button>
    \`;

    increment(): void { this.count++; }
}
`,
        'src/style.css': ':root { font-family: system-ui, sans-serif; color-scheme: light dark; }\nbody { max-width: 60rem; margin: 3rem auto; padding: 0 1rem; }\nbutton { padding: .5rem 1rem; cursor: pointer; }\n',
        'README.md': `# ${name}\n\nRun \`npm install\` and \`npm run typecheck\`.\n\n${vite ? 'Run `npm run dev` to start development, `npm run build` for production, and `npm run preview` to preview the build.' : 'Vite was omitted. Configure a TypeScript-capable bundler with standard decorator support, CSS imports, and src/main.ts as its entry before serving index.html.'}\n\n${plugin ? 'The Vite plugin discovers default-exported pages in src.' : 'Register pages explicitly in src/app/app.ts.'}\n\nFor agent instructions run \`npx joltui agents\` (or \`npx joltui agents claude\`).\n`,
    };
    if (vite) files['vite.config.ts'] = `import { defineConfig } from 'vite';
${plugin ? "import joltui from 'joltui-vite-plugin';\n" : ''}
export default defineConfig({
${plugin ? '    plugins: [joltui()],\n' : ''}    build: { target: 'es2022' },
});
`;
    return files;
}

