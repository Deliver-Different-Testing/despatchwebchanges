import fs from 'fs';
import path from 'path';
import {contrastRatio, getMd3Scheme} from './md3';

const react = path.resolve(__dirname, '..');
const repoRoot = path.resolve(react, '..');
const cssFiles = [
    'node_modules/@deliver-different/glass/dist/glass.css',
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
        const scheme = selector.includes('dark') ? 'dark' : 'light';
        for (const [, token, percent] of body.matchAll(/color-mix\(in srgb,\s*var\((--dd-[\w-]+)(?:,[^)]*)?\)\s+(\d+)%/g)) {
            found.push({file, selector: selector.trim().replace(/\s+/g, ' '), scheme, token: token as Tint['token'], percent: Number(percent)});
        }
    }
    return found;
}

const allTints = cssFiles.flatMap(tintsIn);
// The lens backdrop layer only ever shows beneath the host's own tint, so it is checked combined with it below.
const isLensBackdrop = (t: Tint) => t.selector.includes('dfrnt-glass-backdrop');
const isLensHost = (t: Tint) => t.selector.includes("[data-liquid-glass='svg']");
const tints = allTints.filter(t => !isLensBackdrop(t));

/** The Chromium lens stacks the host tint over the backdrop layer's, so what shows through is the product of both gaps. */
function lensCoverage(scheme: Tint['scheme']): number {
    const backdrop = allTints.find(t => isLensBackdrop(t) && t.scheme === scheme);
    const host = allTints.find(t => isLensHost(t) && t.scheme === scheme);
    if (!backdrop || !host) throw new Error(`lens tints missing for ${scheme}`);
    return 1 - (1 - backdrop.percent / 100) * (1 - host.percent / 100);
}

describe('glass tint contrast', () => {
    it('finds the glass tints this guard is meant to cover', () => {
        expect(tints.length).toBeGreaterThanOrEqual(8);
    });

    it.each(['light', 'dark'] as const)('keeps body text at 4.5:1 or better on the Chromium lens pane (%s)', scheme => {
        const md3 = scheme === 'light' ? light : dark;
        const backdrop = scheme === 'light' ? '#000000' : '#ffffff';
        const pane = mix(tokens[scheme]['--dd-surface-container-high'], lensCoverage(scheme), backdrop);
        expect(contrastRatio(md3.onSurface, pane)).toBeGreaterThanOrEqual(4.5);
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
