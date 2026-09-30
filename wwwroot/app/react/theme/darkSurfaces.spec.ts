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
