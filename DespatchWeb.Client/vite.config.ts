import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {precompress} from './scripts/vite/precompress.ts';

// Dev-only: the .NET host that serves the API and MVC endpoints (see Properties/launchSettings.json).
const hostTarget = process.env.DESPATCH_HOST_URL ?? 'http://despatchweb.local.deliverdifferent.com:63277';

// Every controller route prefix the SPA calls. Anchored and case-sensitive with a trailing slash so
// lower-case client routes (/overview, /settings) are never swallowed by the proxy.
const controllerPrefixes = [
    'AccessorialCharge', 'AddressAutocomplete', 'Ai', 'Config', 'Context', 'Courier', 'DispatchLayout',
    'JobChangeRequest', 'Job', 'Messages', 'NationwideJob', 'Note', 'Overview', 'StaffPreference',
    'Task', 'TenantSettings', 'Account',
];
const proxied = {target: hostTarget, changeOrigin: false};

const nodeModule = (id: string, names: string) =>
    new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`).test(id);

// https://vite.dev/config/
export default defineConfig(({command}) => ({
    // The host serves the built SPA from /dist; the dev server runs at the root so client routes match.
    base: command === 'build' ? '/dist/' : '/',
    plugins: [react(), precompress()],
    build: {
        outDir: '../wwwroot/dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (nodeModule(id, 'react|react-dom|react-router|scheduler')) return 'vendor-react';
                    if (nodeModule(id, '@mantine|@floating-ui|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|react-textarea-autosize|react-number-format|@deliver-different|clsx|tslib')) {
                        return 'vendor-mantine';
                    }
                    if (nodeModule(id, '@tanstack|axios')) return 'vendor-query';
                    if (nodeModule(id, '@tabler|lucide-react')) return 'vendor-icons';
                    if (nodeModule(id, 'dayjs|windows-iana')) return 'vendor-dayjs';
                    if (nodeModule(id, 'react-markdown|remark-gfm|remark-.*|micromark.*|unified|unist-.*|mdast-.*|hast-.*|vfile|vfile-.*|bail|trough|decode-named-character-reference|character-entities.*|trim-lines|html-url-attributes|space-separated-tokens|comma-separated-tokens|property-information|estree-.*|ccount|escape-string-regexp|devlop|longest-streak|markdown-table|zwitch')) {
                        return 'vendor-markdown';
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        allowedHosts: ['despatchweb.local.deliverdifferent.com', 'despatch.local.deliverdifferent.com'],
        proxy: {
            '/api': proxied,
            [`^/(${controllerPrefixes.join('|')})/`]: proxied,
            '^/(images/|favicon\\.(svg|ico)|dispmain\\.ico|health)': proxied,
        },
    },
}));
