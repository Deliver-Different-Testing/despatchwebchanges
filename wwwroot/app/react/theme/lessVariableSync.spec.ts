/**
 * LESS ↔ theme variable sync.
 *
 * The three surviving AngularJS pages are styled from `css/variables.less`,
 * which hardcodes the same brand colours, radii and elevations the React theme
 * carries. Nothing makes them agree at build time, so this compares them.
 *
 * It used to live in `muiTheme.spec.ts` and read its values off the MUI theme.
 * That file is gone; the colours now come from `palettes.ts` — the framework-free
 * source both theme systems were always meant to share — and the radius and
 * shadow scales from the Mantine theme, which is the live one. The point of the
 * check is unchanged: LESS must not drift from whatever React actually renders.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    sharedColors,
} from './palettes';
import {tokens} from './dfrntMantineTheme';

// Read the LESS variables file once for all sync tests
const lessPath = path.resolve(__dirname, '../../../css/variables.less');
const lessContent = fs.readFileSync(lessPath, 'utf-8');

/** Extract a LESS variable value like `@foo: #abc123;` → `#abc123` */
function getLessVar(name: string): string {
    const re = new RegExp(`${name}:\\s*([^;]+);`);
    const match = lessContent.match(re);
    if (!match) throw new Error(`LESS variable ${name} not found`);
    return match[1].trim();
}

describe('LESS ↔ theme variable sync', () => {
    describe('primary colors', () => {
        it('@primary-blue matches the US primary', () => {
            expect(getLessVar('@primary-blue')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@primary-color matches the US primary', () => {
            expect(getLessVar('@primary-color')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@nz-primary matches the non-US gold primary', () => {
            expect(getLessVar('@nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary-dark matches the gold 700 step', () => {
            expect(getLessVar('@nz-primary-dark')).toBe(urgentPrimaryPalette[700]);
        });
    });

    describe('semantic colors', () => {
        it('@error-red matches error.main', () => {
            expect(getLessVar('@error-red')).toBe(sharedColors.error.main);
        });

        it('@primary-green matches success.main', () => {
            expect(getLessVar('@primary-green')).toBe(sharedColors.success.main);
        });

        it('@primary-warning matches warning.main', () => {
            expect(getLessVar('@primary-warning')).toBe(sharedColors.warning.main);
        });
    });

    describe('surface and background', () => {
        it('@main-background-color matches surface.default', () => {
            expect(getLessVar('@main-background-color').toLowerCase())
                .toBe(sharedColors.surface.default.toLowerCase());
        });

        it('@card-background matches surface.paper', () => {
            expect(getLessVar('@card-background')).toBe(sharedColors.surface.paper.toLowerCase());
        });
    });

    describe('interactive states', () => {
        it('@hover-color uses neutral rgba(0,0,0) base', () => {
            expect(getLessVar('@hover-color')).toBe('rgba(0, 0, 0, 0.04)');
        });

        it('@active-color uses neutral rgba(0,0,0) base', () => {
            expect(getLessVar('@active-color')).toBe('rgba(0, 0, 0, 0.12)');
        });
    });

    describe('design tokens', () => {
        it('@radius-sm matches tokens.radius.sm', () => {
            expect(getLessVar('@radius-sm')).toBe(`${tokens.radius.sm}px`);
        });

        it('@radius-md matches tokens.radius.md', () => {
            expect(getLessVar('@radius-md')).toBe(`${tokens.radius.md}px`);
        });

        it('@radius-lg matches tokens.radius.lg', () => {
            expect(getLessVar('@radius-lg')).toBe(`${tokens.radius.lg}px`);
        });

        it('@elevation-1 matches tokens.shadow.sm', () => {
            expect(getLessVar('@elevation-1')).toBe(tokens.shadow.sm);
        });

        it('@elevation-2 matches tokens.shadow.md', () => {
            expect(getLessVar('@elevation-2')).toBe(tokens.shadow.md);
        });

        it('@elevation-3 matches tokens.shadow.lg', () => {
            expect(getLessVar('@elevation-3')).toBe(tokens.shadow.lg);
        });
    });

    describe('text hierarchy', () => {
        it('@text-dark matches text.primary', () => {
            expect(getLessVar('@text-dark')).toBe(sharedColors.text.primary);
        });

        it('@text-muted matches text.secondary', () => {
            expect(getLessVar('@text-muted')).toBe(sharedColors.text.secondary);
        });
    });
});
