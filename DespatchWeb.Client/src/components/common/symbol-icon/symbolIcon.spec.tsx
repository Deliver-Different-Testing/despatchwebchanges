/**
 * SymbolIcon resolves a *data-supplied* string to an icon. The keys are a data
 * contract rather than anything the compiler sees at the call site, so only a
 * test can prove every mapped name actually renders.
 */
import React from 'react';
import {render, screen} from '@testing-library/react';
import {SymbolIcon, SYMBOL_MAP} from './SymbolIcon';

describe('SymbolIcon', () => {
    it('every SYMBOL_MAP entry carries a real component and a valid lib', () => {
        const broken = Object.entries(SYMBOL_MAP)
            .filter(([, e]) => !e?.component || (e.lib !== 'lucide' && e.lib !== 'tabler'))
            .map(([name]) => name);
        expect(broken).toEqual([]);
    });

    it('renders an svg for every known glyph name', () => {
        const failed: string[] = [];
        for (const name of Object.keys(SYMBOL_MAP)) {
            const {container, unmount} = render(<SymbolIcon name={name} />);
            if (!container.querySelector('svg')) failed.push(name);
            unmount();
        }
        expect(failed).toEqual([]);
    });

    it('falls back to a rendered icon and warns for an unknown name', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const {container} = render(<SymbolIcon name="not_a_real_glyph" />);

        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Unknown glyph "not_a_real_glyph"'),
        );
        warn.mockRestore();
    });

    it('forwards size, colour and accessibility props', () => {
        render(<SymbolIcon name="pin_drop" size={32} color="rebeccapurple" aria-label="Pickup" />);

        const svg = screen.getByLabelText('Pickup');
        expect(svg).toHaveAttribute('width', '32');
        expect(svg).toHaveAttribute('height', '32');
        expect(svg).toHaveAttribute('stroke', 'rebeccapurple');
    });

    it('carries the brand 1.25 stroke through the Icon wrapper', () => {
        render(<SymbolIcon name="search" aria-label="Search" />);

        expect(screen.getByLabelText('Search')).toHaveAttribute('stroke-width', '1.25');
    });
});
