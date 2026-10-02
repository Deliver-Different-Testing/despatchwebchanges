import fs from 'fs';
import path from 'path';
import {contrastRatio, getMd3Scheme} from './md3';

const react = path.resolve(__dirname, '..');
const repoRoot = path.resolve(react, '../../..');
const cssFiles = [
    'node_modules/@dfrnt/glass/dist/glass.css',
    'components/dialogs/shared/mantine/DialogGlass.module.css',
    'components/common/box-shell/BoxShell.module.css',
];

const light = getMd3Scheme('light');
const dark = getMd3Scheme('dark');
const tokens = {
    light: {'--dd-surface-container-high': light.surfaceContainerLowest, '--dd-dialog-bar': '#f8f7f7'},
    dark: {'--dd-surface-container-high': dark.surfaceContainerHigh, '--dd-dialog-bar': dark.surfaceContainer},
} as const;

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (tintHex: string, alpha: number, backdropHex: string) =>
    '#' + channels(tintHex).map((c, i) => Math.round(c * alpha + channels(backdropHex)[i] * (1 - alpha))
        .toString(16).padStart(2, '0')).join('');

interface Tint {file: string; selector: string; scheme: 'light' | 'dark'; token: keyof typeof tokens.light; percent: number}

function tintsIn(file: string): Tint[] {
    const css = fs.readFileSync(path.join(file.startsWith('node_modules/') ? repoRoot : react, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const found: Tint[] = [];
    for (const [, selector, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
        // The lens backdrop layer (formerly glassLayer.module.css, never covered here) sits beneath the pane.
        if (selector.includes('dfrnt-glass-backdrop')) continue;
        const scheme = selector.includes('dark') ? 'dark' : 'light';
        for (const [, token, percent] of body.matchAll(/color-mix\(in srgb,\s*var\((--dd-[\w-]+)(?:,[^)]*)?\)\s+(\d+)%/g)) {
            found.push({file, selector: selector.trim().replace(/\s+/g, ' '), scheme, token: token as Tint['token'], percent: Number(percent)});
        }
    }
    return found;
}

const tints = cssFiles.flatMap(tintsIn);

describe('glass tint contrast', () => {
    it('finds the glass tints this guard is meant to cover', () => {
        expect(tints.length).toBeGreaterThanOrEqual(8);
    });

    // Blur averages the backdrop, so a flat black (light mode, dark text) or white (dark mode,
    // light text) backdrop is the worst case for body text on the pane.
    it.each(tints.map(t => [`${t.file} ${t.selector} (${t.scheme} ${t.percent}%)`, t] as const))(
        'keeps body text at 4.5:1 or better: %s',
        (_name, t) => {
            const scheme = t.scheme === 'light' ? light : dark;
            const backdrop = t.scheme === 'light' ? '#000000' : '#ffffff';
            const pane = mix(tokens[t.scheme][t.token], t.percent / 100, backdrop);
            expect(contrastRatio(scheme.onSurface, pane)).toBeGreaterThanOrEqual(4.5);
        },
    );
});
