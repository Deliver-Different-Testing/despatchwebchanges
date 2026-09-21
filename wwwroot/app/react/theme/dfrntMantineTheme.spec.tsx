import React from 'react';
import {screen} from '@testing-library/react';
import {Button} from '@mantine/core';
import {renderWithMantine} from '../__testUtils__';
import {
    dfrntTheme,
    dfrntBrand,
    dfrntCssVariablesResolver,
    createDfrntTheme,
} from './dfrntMantineTheme';
import {contrastRatio, getMd3Scheme} from './md3';
import {dfrntPrimaryPalette, urgentPrimaryPalette, inkBluePalette} from './palettes';

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
        expect(dfrntBrand.gold).toBe(urgentPrimaryPalette[500]);
        expect(dfrntBrand.goldDeep).toBe(urgentPrimaryPalette[900]);
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

describe('createDfrntTheme — per-tenant brand', () => {
    it('gives US tenants the Cyan ramp on the Ink Blue shell', () => {
        const theme = createDfrntTheme(true);
        expect(theme.colors?.brand?.[5]).toBe(dfrntBrand.cyan);
        expect(theme.other?.shell?.appBar).toBe(dfrntBrand.inkBlue);
        expect(theme.other?.scrim?.text).toBe('#fff');
        expect(theme.other?.shell?.logoSrc).toBe('images/dfrnt_logo_reversed.png');
    });

    it('gives non-US tenants the gold ramp with Ink content and the dark wordmark', () => {
        const theme = createDfrntTheme(false);
        expect(theme.colors?.brand?.[5]).toBe(dfrntBrand.gold);
        expect(theme.other?.shell?.appBar).toBe(dfrntBrand.gold);
        expect(theme.other?.scrim?.text).toBe(dfrntBrand.inkBlue);
        expect(theme.other?.shell?.logoSrc).toBe('images/dfrnt_logo.png');
    });

    it('keeps both tenants on the same Ink and semantic ramps', () => {
        for (const theme of [createDfrntTheme(true), createDfrntTheme(false)]) {
            expect(theme.colors?.ink?.[9]).toBe(dfrntBrand.inkBlue);
            expect(theme.colors?.red?.[5]).toBe(dfrntBrand.red);
            expect(theme.black).toBe(dfrntBrand.inkBlue);
        }
    });

});

describe('dfrntCssVariablesResolver', () => {
    it('publishes the tenant shell chrome as CSS variables', () => {
        const us = dfrntCssVariablesResolver(createDfrntTheme(true) as never);
        const nonUs = dfrntCssVariablesResolver(createDfrntTheme(false) as never);

        expect(us.variables['--dd-shell-bar']).toBe(dfrntBrand.inkBlue);
        expect(us.variables['--dd-on-shell']).toBe('#fff');
        expect(nonUs.variables['--dd-shell-bar']).toBe(dfrntBrand.gold);
        expect(nonUs.variables['--dd-on-shell']).toBe(dfrntBrand.inkBlue);
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
