import React from 'react';
import {screen} from '@testing-library/react';
import {Button} from '@mantine/core';
import {renderWithMantine} from '../__testUtils__';
import {dfrntTheme, dfrntBrand, dfrntCssVariablesResolver} from './dfrntMantineTheme';
import {contrastRatio, getMd3Scheme} from './md3';
import {dfrntPrimaryPalette, inkBluePalette} from './palettes';

describe('dfrntTheme', () => {
    it('uses the DFRNT brand ramp as primary with the Cyan seed at the primary shade', () => {
        expect(dfrntTheme.primaryColor).toBe('brand');
        expect(dfrntTheme.primaryShade).toEqual({light: 5, dark: 4});
        expect(dfrntTheme.colors?.brand?.[5]).toBe(dfrntBrand.cyan);
    });

    it('shares the brand hexes with the MUI/Angular palette source of truth', () => {
        // Mantine needs a 10-tuple, so the ramp is declared separately from
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

    it('gives buttons and action icons the brand lozenge radius', () => {
        expect(dfrntTheme.components?.Button?.defaultProps).toMatchObject({radius: 9999});
        expect(dfrntTheme.components?.ActionIcon?.defaultProps).toMatchObject({radius: 9999});
    });

    it('maps Mantine dark roles onto the DFRNT charcoal ladder', () => {
        const dark = getMd3Scheme('dark');
        // dark[7] backs the page, dark[6] the default component surface.
        expect(dfrntTheme.colors?.dark?.[7]).toBe(dark.surface);
        expect(dfrntTheme.colors?.dark?.[6]).toBe(dark.surfaceContainerHigh);
    });
});

describe('dfrntCssVariablesResolver', () => {
    it('paints page and card surfaces a tone apart in each colour scheme', () => {
        const vars = dfrntCssVariablesResolver(dfrntTheme as never);
        const light = getMd3Scheme('light');
        const dark = getMd3Scheme('dark');

        expect(vars.light['--mantine-color-body']).toBe(light.surface);
        expect(vars.light['--dd-surface-container']).toBe(light.surfaceContainerLowest);
        expect(vars.dark['--mantine-color-body']).toBe(dark.surface);
        expect(vars.dark['--dd-surface-container']).toBe(dark.surfaceContainer);

        // Elevation by tone, not shadow: the card tone must differ from the page.
        expect(vars.light['--dd-surface-container']).not.toBe(vars.light['--mantine-color-body']);
        expect(vars.dark['--dd-surface-container']).not.toBe(vars.dark['--mantine-color-body']);
    });
});

describe('DFRNT brand contrast', () => {
    it('puts dark ink on the light Cyan fill, meeting WCAG AA for body text', () => {
        // Cyan is a light hue — filled Cyan must carry Ink text, not white.
        expect(contrastRatio(dfrntBrand.inkBlue, dfrntBrand.cyan)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio('#ffffff', dfrntBrand.cyan)).toBeLessThan(4.5);
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
