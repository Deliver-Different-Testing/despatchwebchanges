import React from 'react';
import {render} from '@testing-library/react';
import {SymbolIcon} from './SymbolIcon';

describe('SymbolIcon', () => {
    it('renders an MUI SvgIcon (not the Material Symbols font span) for a known glyph', () => {
        const {container} = render(<SymbolIcon name="tune" data-testid="glyph" />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        // The old font-based approach rendered the literal glyph name as text.
        expect(container.textContent).toBe('');
    });

    it('forwards SvgIcon props (sx / aria) through to the icon', () => {
        const {container} = render(<SymbolIcon name="map" aria-label="map icon" />);
        expect(container.querySelector('svg[aria-label="map icon"]')).toBeInTheDocument();
    });

    it('falls back to a neutral glyph and warns for an unknown name', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const {container} = render(<SymbolIcon name="definitely_not_a_glyph" />);
        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('definitely_not_a_glyph'),
        );
        warn.mockRestore();
    });
});
