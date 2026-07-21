import React from 'react';
import {screen} from '@testing-library/react';
import {Button} from '@mantine/core';
import {renderWithMantine} from '../__testUtils__';
import {dfrntTheme, dfrntBrand} from './dfrntMantineTheme';

describe('dfrntTheme', () => {
    it('uses Cyan as the primary brand accent, anchored at shade 6', () => {
        expect(dfrntTheme.primaryColor).toBe('cyan');
        expect(dfrntTheme.primaryShade).toBe(6);
        expect(dfrntTheme.colors?.cyan?.[6]).toBe(dfrntBrand.cyan);
    });

    it('sets Ink Blue as black and keeps Plus Jakarta Sans as the UI face', () => {
        expect(dfrntTheme.black).toBe(dfrntBrand.inkBlue);
        expect(dfrntTheme.fontFamily).toContain('Plus Jakarta Sans');
    });

    it('reproduces the brand 20% tints on shade 1 of the secondary ramps', () => {
        // Brand-published 20% tints (docs/): purple #e6dbf9, green #d0f1e0, red #f8d6da.
        expect(dfrntTheme.colors?.purple?.[1]).toBe('#e6dbf9');
        expect(dfrntTheme.colors?.green?.[1]).toBe('#d0f1e0');
        expect(dfrntTheme.colors?.red?.[1]).toBe('#f8d6da');
    });

    it('renders a Mantine component through the DFRNT provider', () => {
        renderWithMantine(<Button>Book a demo</Button>);
        expect(screen.getByRole('button', {name: 'Book a demo'})).toBeInTheDocument();
    });
});
