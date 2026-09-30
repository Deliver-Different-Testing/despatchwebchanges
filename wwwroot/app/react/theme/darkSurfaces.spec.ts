/**
 * Guards the surfaces that were hand-fixed to follow the colour scheme.
 * `--mantine-color-white` and literal white never flip in dark mode, so a
 * background built from them paints a light rectangle on a dark page.
 */
import * as fs from 'fs';
import * as path from 'path';

const react = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(react, rel), 'utf-8');

const SURFACE_FILES = [
    'components/dialogs/accessorial-charges-dialog/AccessorialChargesDialog.tsx',
    'components/dialogs/split-pricing-breakdown-dialog/SplitPricingBreakdownDialog.tsx',
    'components/common/dispatch-map/DispatchMap.module.css',
    'pages/overview/components/MapDialog.tsx',
];

const LIGHT_SURFACE = /background(-color|Color)?\s*:\s*['"]?(var\(--mantine-color-white\)|rgba\(255,\s*255,\s*255|white|#fff)/;

describe('hand-fixed surfaces follow the colour scheme', () => {
    it.each(SURFACE_FILES)('%s paints no fixed-white background', (file) => {
        expect(read(file)).not.toMatch(LIGHT_SURFACE);
    });

    it('keeps the toolbar selection indicator on the shell text colour, which the gray remap would otherwise flip', () => {
        expect(read('components/common/app-toolbar/ToolbarActions.tsx')).not.toMatch(/color="gray\.0"/);
    });

    it('paints the page loader from the scheme, not a fixed light grey', () => {
        const layout = fs.readFileSync(path.resolve(react, '../../../Views/Shared/_Layout.cshtml'), 'utf-8');

        expect(layout).toMatch(/data-dd-boot-scheme=['"]dark['"]\]\s*\.app-loader/);
        expect(layout).toMatch(/dd-color-mode/);
    });
});

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.(tsx?|css)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [full] : [];
    });
}

describe('tinted surfaces use Mantine scheme-aware variants', () => {
    // `--mantine-color-<hue>-0..2` are fixed pale tints; they stay pale in dark mode.
    // `-light` / `-light-hover` / `-light-color` flip with the scheme.
    const PALE_TINT = /--mantine-color-(brand|blue|green|red|orange|yellow|grape|reflex|cyan|teal|violet|pink|indigo|lime)-[0-2]/;

    it('has no fixed pale-tint variable left in non-test source', () => {
        const offenders = sourceFiles(react).filter((file) => PALE_TINT.test(fs.readFileSync(file, 'utf-8')));

        expect(offenders.map((f) => path.relative(react, f))).toEqual([]);
    });
});

describe('dialog planes follow the scheme', () => {
    const styles = read('components/dialogs/shared/mantine/styles.ts');

    it.each([
        ['dialogHeaderBg', 'var(--dd-dialog-bar)'],
        ['dialogContentBg', 'var(--dd-dialog-body)'],
    ])('%s is the scheme-aware token', (name, value) => {
        expect(styles).toContain(`export const ${name} = '${value}'`);
    });

    it('paints section papers from the section token, not white', () => {
        expect(styles).toMatch(/bg: 'var\(--dd-dialog-section\)'/);
    });
});
