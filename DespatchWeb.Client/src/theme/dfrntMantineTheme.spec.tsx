import React from 'react';
import {screen} from '@testing-library/react';
import {Button} from '@mantine/core';
import {renderWithMantine} from '../test/utils';
import {
    dfrntTheme,
    dfrntBrand,
    dfrntCssVariablesResolver,
    createDfrntTheme,
} from './dfrntMantineTheme';
import {GlassDropdownRoot, glassClassNames} from '@deliver-different/glass';
import {contrastRatio, getMd3Scheme} from './md3';
import {dfrntPrimaryPalette, inkBluePalette} from './palettes';

describe('dfrntTheme glass dropdowns', () => {
    it('gives Menu and Popover dropdowns the glass and panel classes', () => {
        for (const name of ['Menu', 'Popover'] as const) {
            expect(dfrntTheme.components?.[name]?.classNames).toEqual({dropdown: `${glassClassNames.glass} ${glassClassNames.panel}`});
        }
    });

    it('routes PopoverDropdown through GlassDropdownRoot', () => {
        expect(dfrntTheme.components?.PopoverDropdown?.defaultProps?.component).toBe(GlassDropdownRoot);
    });
});

describe('dfrntTheme', () => {
    it('uses the DFRNT brand ramp as primary with the Cyan seed at the primary shade', () => {
        expect(dfrntTheme.primaryColor).toBe('brand');
        expect(dfrntTheme.primaryShade).toEqual({light: 5, dark: 4});
        expect(dfrntTheme.colors?.brand?.[5]).toBe(dfrntBrand.cyan);
    });

    it('shares the brand hexes with the MUI/Angular palette source of truth', () => {
        // Mantine needs a 10-tuple, so the ramps are declared separately from
        // palettes.ts — but the anchor hexes must never drift apart.
        expect(dfrntBrand.cyan).toBe(dfrntPrimaryPalette[500]);
        expect(dfrntBrand.inkBlue).toBe(inkBluePalette[900]);
    });

    it('anchors the brand identity on Ink Blue and Plus Jakarta Sans', () => {
        expect(dfrntTheme.black).toBe(dfrntBrand.inkBlue);
        expect(dfrntTheme.colors?.ink?.[9]).toBe(dfrntBrand.inkBlue);
        expect(dfrntTheme.fontFamily).toContain('Plus Jakarta Sans');
        expect(dfrntTheme.headings?.fontFamily).toContain('Plus Jakarta Sans');
    });

    it('carries the semantic ramps at the shade the brand hexes are anchored on', () => {
        expect(dfrntTheme.colors?.grape?.[5]).toBe(dfrntBrand.purple);
        expect(dfrntTheme.colors?.green?.[5]).toBe(dfrntBrand.green);
        expect(dfrntTheme.colors?.orange?.[5]).toBe(dfrntBrand.orange);
        expect(dfrntTheme.colors?.red?.[5]).toBe(dfrntBrand.red);
        expect(dfrntTheme.colors?.reflex?.[5]).toBe(dfrntBrand.reflexBlue);
    });

    it('gives buttons and action icons the squared-off radius, not a lozenge', () => {
        expect(dfrntTheme.components?.Button?.defaultProps).toMatchObject({radius: 'sm'});
        expect(dfrntTheme.components?.ActionIcon?.defaultProps).toMatchObject({radius: 'sm'});
    });

    it('maps Mantine dark roles onto the DFRNT charcoal ladder', () => {
        const dark = getMd3Scheme('dark');
        // dark[7] backs the page, dark[6] the default component surface.
        expect(dfrntTheme.colors?.dark?.[7]).toBe(dark.surface);
        expect(dfrntTheme.colors?.dark?.[6]).toBe(dark.surfaceContainerHigh);
    });
});

describe('createDfrntTheme — built-in brand', () => {
    it('is DFRNT Cyan on the Ink Blue shell for every tenant, with the reversed wordmark', () => {
        const theme = createDfrntTheme();
        expect(theme.colors?.brand?.[5]).toBe(dfrntBrand.cyan);
        expect(theme.other?.shell?.appBar).toBe(dfrntBrand.inkBlue);
        expect(theme.other?.scrim?.text).toBe('#fff');
        expect(theme.other?.shell?.logoSrc).toBe('images/dfrnt_logo_reversed.png');
        expect(theme.colors?.ink?.[9]).toBe(dfrntBrand.inkBlue);
        expect(theme.colors?.red?.[5]).toBe(dfrntBrand.red);
        expect(theme.black).toBe(dfrntBrand.inkBlue);
    });
});

describe('dfrntCssVariablesResolver', () => {
    it('publishes the Ink shell chrome as CSS variables', () => {
        const vars = dfrntCssVariablesResolver(createDfrntTheme() as never);

        expect(vars.variables['--dd-shell-bar']).toBe(dfrntBrand.inkBlue);
        expect(vars.variables['--dd-on-shell']).toBe('#fff');
    });

    it('paints page and card surfaces a tone apart in each colour scheme', () => {
        const vars = dfrntCssVariablesResolver(dfrntTheme as never);
        const light = getMd3Scheme('light');
        const dark = getMd3Scheme('dark');

        expect(vars.light['--mantine-color-body']).toBe(light.surface);
        expect(vars.light['--dd-surface-container']).toBe(light.surfaceContainerLowest);
        expect(vars.dark['--mantine-color-body']).toBe(dark.surface);
        expect(vars.dark['--dd-surface-container']).toBe(dark.surfaceContainer);

        // Elevation by tone (plus a soft shadow, set separately): the card tone must differ from the page.
        expect(vars.light['--dd-surface-container']).not.toBe(vars.light['--mantine-color-body']);
        expect(vars.dark['--dd-surface-container']).not.toBe(vars.dark['--mantine-color-body']);
    });
});

describe('dfrntCssVariablesResolver — fixed Mantine grays in dark mode', () => {
    const vars = dfrntCssVariablesResolver(dfrntTheme as never);
    const dark = getMd3Scheme('dark');

    it('remaps the subtle grays onto the dark tonal ladder so gray-backed fills stop being light', () => {
        expect(vars.dark['--mantine-color-gray-0']).toBe(dark.surfaceContainerLow);
        expect(vars.dark['--mantine-color-gray-1']).toBe(dark.surfaceContainerHigh);
        expect(vars.dark['--mantine-color-gray-2']).toBe(dark.surfaceContainerHighest);
    });

    it('remaps the border grays onto the outline tones', () => {
        expect(vars.dark['--mantine-color-gray-3']).toBe(dark.outlineVariant);
        expect(vars.dark['--mantine-color-gray-4']).toBe(dark.outline);
    });

    it('keeps every remapped fill distinct from the card tone, so a fill on a card stays visible', () => {
        for (const key of ['gray-0', 'gray-1', 'gray-2']) {
            expect(vars.dark[`--mantine-color-${key}`]).not.toBe(vars.dark['--dd-surface-container']);
        }
    });

    it('leaves light mode and white (used as text on fills) untouched', () => {
        expect(vars.light['--mantine-color-gray-0']).toBeUndefined();
        expect(vars.light['--mantine-color-gray-3']).toBeUndefined();
        expect(vars.dark['--mantine-color-white']).toBeUndefined();
        expect(vars.light['--mantine-color-white']).toBeUndefined();
    });

    it('keeps body text readable on every remapped fill at AA', () => {
        for (const key of ['gray-0', 'gray-1', 'gray-2']) {
            expect(contrastRatio(dark.onSurface, vars.dark[`--mantine-color-${key}`])).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe('dfrntCssVariablesResolver — gray component roles in dark mode', () => {
    const vars = dfrntCssVariablesResolver(dfrntTheme as never);
    const dark = getMd3Scheme('dark');

    it('gives color="gray" glyphs and labels a readable tone instead of the remapped surface tone', () => {
        for (const role of ['light-color', 'text', 'outline']) {
            const tone = vars.dark[`--mantine-color-gray-${role}`];
            expect(tone).toBe(dark.onSurfaceVariant);
            expect(contrastRatio(tone, dark.surface)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps the gray tinted and filled roles distinct from the page and legible', () => {
        expect(vars.dark['--mantine-color-gray-filled']).toBe(dark.surfaceContainerHighest);
        expect(contrastRatio('#ffffff', vars.dark['--mantine-color-gray-filled'])).toBeGreaterThanOrEqual(4.5);
        expect(vars.dark['--mantine-color-gray-light']).toContain('color-mix');
        expect(vars.dark['--mantine-color-gray-light-hover']).toContain('color-mix');
    });

    it('leaves the light scheme roles to Mantine', () => {
        expect(vars.light['--mantine-color-gray-light-color']).toBeUndefined();
        expect(vars.light['--mantine-color-gray-filled']).toBeUndefined();
    });
});

describe('dfrntCssVariablesResolver — dialog planes', () => {
    const vars = dfrntCssVariablesResolver(dfrntTheme as never);
    const dark = getMd3Scheme('dark');

    it('lifts dialog sections above the header/footer bars, and the bars above the body, in both schemes', () => {
        expect(vars.dark['--dd-dialog-section']).toBe(dark.surfaceContainerHigh);
        expect(vars.dark['--dd-dialog-bar']).toBe(dark.surfaceContainer);
        expect(vars.dark['--dd-dialog-body']).toBe(dark.surfaceContainerLow);
        expect(vars.light['--dd-dialog-section']).toBe('var(--mantine-color-white)');
        expect(vars.light['--dd-dialog-bar']).toBe('var(--mantine-color-gray-1)');
        expect(vars.light['--dd-dialog-body']).toBe('var(--mantine-color-gray-2)');
    });
});

describe('DFRNT brand contrast', () => {
    it.each([
        ['Cyan', dfrntBrand.cyan],
        ['gold', dfrntBrand.gold],
    ])('puts dark ink on the light %s fill, meeting WCAG AA for body text', (_name, fill) => {
        // Both brand hues are light — a filled brand surface must carry Ink text.
        expect(contrastRatio(dfrntBrand.inkBlue, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#ffffff', fill)).toBeLessThan(4.5);
    });

    it('reads the gold glyph accent against paper at the 3:1 non-text threshold', () => {
        expect(contrastRatio(dfrntBrand.goldDeep, '#ffffff')).toBeGreaterThanOrEqual(3);
    });

    it('reads body text against the light page background at AA', () => {
        const light = getMd3Scheme('light');
        expect(contrastRatio(light.onSurface, light.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('reads body text against the dark page background at AA', () => {
        const dark = getMd3Scheme('dark');
        expect(contrastRatio(dark.onSurface, dark.surface)).toBeGreaterThanOrEqual(4.5);
    });
});

describe('Mantine rendering through the provider', () => {
    it('renders a themed Mantine component', () => {
        renderWithMantine(<Button>Dispatch</Button>);
        expect(screen.getByRole('button', {name: 'Dispatch'})).toBeInTheDocument();
    });
});

describe('createDfrntTheme — user appearance', () => {
    const light = getMd3Scheme('light');
    const dk = getMd3Scheme('dark');

    it('generates the brand and secondary ramps from the chosen colours, keeping the status ramps fixed', () => {
        const theme = createDfrntTheme({highContrast: false, primary: '#13b964', secondary: '#dc3246'});
        expect(theme.colors?.brand?.[5]).toBe('#13b964');
        expect(theme.colors?.reflex?.[5]).toBe('#dc3246');
        expect(theme.colors?.red).toEqual(dfrntTheme.colors?.red);
        expect(theme.colors?.green).toEqual(dfrntTheme.colors?.green);
    });

    it('leaves the Ink shell alone when a custom primary is chosen', () => {
        const theme = createDfrntTheme({highContrast: false, primary: '#f4c430'});
        expect(theme.other?.shell?.appBar).toBe(dfrntBrand.inkBlue);
        expect(theme.other?.scrim?.text).toBe('#fff');
    });

    it('sets the body text colour per scheme only when one is chosen', () => {
        const standard = dfrntCssVariablesResolver(dfrntTheme as never);
        expect(standard.light['--mantine-color-text']).toBeUndefined();
        const custom = dfrntCssVariablesResolver(
            createDfrntTheme({highContrast: false, textLight: '#222222', textDark: '#eeeeee'}) as never,
        );
        expect(custom.light['--mantine-color-text']).toBe('#222222');
        expect(custom.dark['--mantine-color-text']).toBe('#eeeeee');
    });

    it('publishes the job-list indicator colours at shade 5 by default', () => {
        const vars = dfrntCssVariablesResolver(dfrntTheme as never);
        expect(vars.variables['--dd-indicator-error']).toBe('var(--mantine-color-red-5)');
        expect(vars.light['--dd-indicator-error']).toBeUndefined();
    });

    it('in high contrast, lifts dimmed text, borders and every coloured text role to 7:1 in both schemes', () => {
        for (const primary of [undefined, '#f4c430']) {
            const vars = dfrntCssVariablesResolver(createDfrntTheme({highContrast: true, primary}) as never);
            for (const [mode, surfaces] of [
                ['light', [light.surface, light.surfaceContainerLowest]],
                ['dark', [dk.surface, dk.surfaceContainer, dk.surfaceContainerHigh]],
            ] as const) {
                const scheme = vars[mode];
                for (const role of ['dimmed', 'brand-light-color', 'red-light-color', 'gold-text', 'reflex-text', 'gray-light-color']) {
                    const color = scheme[`--mantine-color-${role}`];
                    for (const bg of surfaces) {
                        expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(7);
                    }
                }
                for (const bg of surfaces) {
                    expect(contrastRatio(scheme['--dd-indicator-warning'], bg)).toBeGreaterThanOrEqual(4.5);
                }
                expect(scheme['--dd-outline-variant']).toBe(scheme['--mantine-color-default-border']);
            }
        }
    });
});
