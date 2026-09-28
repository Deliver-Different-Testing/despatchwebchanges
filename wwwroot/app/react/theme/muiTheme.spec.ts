import * as fs from 'fs';
import * as path from 'path';
import {
    createAppTheme,
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    accentPalette,
    tokens,
    sharedColors,
} from './muiTheme';

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

describe('MUI theme palettes', () => {
    it('US theme uses blue primary', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.primary.main).toBe('#2196f3');
    });

    it('NZ theme uses warm amber primary', () => {
        const theme = createAppTheme(false);
        expect(theme.palette.primary.main).toBe('#f4c430');
    });

    it('US theme has white contrast text on primary', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.primary.contrastText).toBe('#FFFFFF');
    });

    it('NZ theme has dark contrast text on primary', () => {
        const theme = createAppTheme(false);
        expect(theme.palette.primary.contrastText).toBe('rgba(0, 0, 0, 0.87)');
    });

    it('both themes share the same secondary (accent) palette', () => {
        const us = createAppTheme(true);
        const nz = createAppTheme(false);
        expect(us.palette.secondary.main).toBe(accentPalette[500]);
        expect(nz.palette.secondary.main).toBe(accentPalette[500]);
    });

    it('both themes share the same semantic colors', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.success.main).toBe('#4CAF50');
        expect(theme.palette.warning.main).toBe('#FF9800');
        expect(theme.palette.error.main).toBe('#F44336');
        expect(theme.palette.info.main).toBe('#2196F3');
    });

    it('background colors match expected values', () => {
        const theme = createAppTheme(true);
        expect(theme.palette.background.default).toBe('#FAFAFA');
        expect(theme.palette.background.paper).toBe('#FFFFFF');
    });
});

describe('MUI ↔ LESS variable sync', () => {
    describe('primary colors', () => {
        it('@primary-blue matches MUI US primary', () => {
            expect(getLessVar('@primary-blue')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@primary-color matches MUI US primary', () => {
            expect(getLessVar('@primary-color')).toBe(dfrntPrimaryPalette[500]);
        });

        it('@theme-us-primary matches MUI US primary', () => {
            expect(getLessVar('@theme-us-primary')).toBe(dfrntPrimaryPalette[500]);
        });
    });

    describe('NZ/non-US colors', () => {
        it('@theme-nz-primary matches MUI urgent palette 500', () => {
            expect(getLessVar('@theme-nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary matches MUI urgent palette 500', () => {
            expect(getLessVar('@nz-primary')).toBe(urgentPrimaryPalette[500]);
        });

        it('@nz-primary-dark matches MUI urgent palette 700', () => {
            expect(getLessVar('@nz-primary-dark')).toBe(urgentPrimaryPalette[700]);
        });
    });

    describe('semantic colors', () => {
        it('@error-red matches MUI error.main', () => {
            expect(getLessVar('@error-red')).toBe(sharedColors.error.main);
        });

        it('@primary-green matches MUI success.main', () => {
            expect(getLessVar('@primary-green')).toBe(sharedColors.success.main);
        });

        it('@primary-warning matches MUI warning.main', () => {
            expect(getLessVar('@primary-warning')).toBe(sharedColors.warning.main);
        });
    });

    describe('surface and background', () => {
        it('@main-background-color matches MUI surface.default', () => {
            expect(getLessVar('@main-background-color').toUpperCase())
                .toBe(sharedColors.surface.default);
        });

        it('@card-background matches MUI surface.paper', () => {
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
        it('@radius-sm matches MUI tokens.radius.sm', () => {
            expect(getLessVar('@radius-sm')).toBe(`${tokens.radius.sm}px`);
        });

        it('@radius-md matches MUI tokens.radius.md', () => {
            expect(getLessVar('@radius-md')).toBe(`${tokens.radius.md}px`);
        });

        it('@radius-lg matches MUI tokens.radius.lg', () => {
            expect(getLessVar('@radius-lg')).toBe(`${tokens.radius.lg}px`);
        });

        it('@elevation-1 matches MUI tokens.shadow.sm', () => {
            expect(getLessVar('@elevation-1')).toBe(tokens.shadow.sm);
        });

        it('@elevation-2 matches MUI tokens.shadow.md', () => {
            expect(getLessVar('@elevation-2')).toBe(tokens.shadow.md);
        });

        it('@elevation-3 matches MUI tokens.shadow.lg', () => {
            expect(getLessVar('@elevation-3')).toBe(tokens.shadow.lg);
        });
    });

    describe('text hierarchy', () => {
        it('@text-dark matches MUI text.primary', () => {
            expect(getLessVar('@text-dark')).toBe(sharedColors.text.primary);
        });

        it('@text-muted matches MUI text.secondary', () => {
            expect(getLessVar('@text-muted')).toBe(sharedColors.text.secondary);
        });
    });
});
