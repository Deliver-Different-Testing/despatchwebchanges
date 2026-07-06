/**
 * MetricCard Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {MetricCard} from './MetricCard';
import {monoFontFamily} from '../../../../theme/muiTheme';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('MetricCard', () => {
    it('renders label and value', () => {
        renderWithTheme(<MetricCard label="Pricing" value="$45.50" />);
        expect(screen.getByText('Pricing')).toBeInTheDocument();
        expect(screen.getByText('$45.50')).toBeInTheDocument();
    });

    it('renders em dash for empty value', () => {
        renderWithTheme(<MetricCard label="POD Name" value="" />);
        expect(screen.getByText('\u2014')).toBeInTheDocument();
    });

    it('renders the value with tabular figures so numbers align', () => {
        renderWithTheme(<MetricCard label="Pricing" value="$45.50" />);
        expect(screen.getByText('$45.50')).toHaveStyle({fontVariantNumeric: 'tabular-nums'});
    });

    it('sets numeric (pricing/time) values in the mono face', () => {
        renderWithTheme(<MetricCard label="Pricing" value="$45.50" category="pricing" />);
        expect(screen.getByText('$45.50')).toHaveStyle({fontFamily: monoFontFamily});
    });

    it('leaves name/text (pod/info) values in the proportional UI face', () => {
        renderWithTheme(<MetricCard label="POD Name" value="Jane Smith" category="pod" />);
        expect(screen.getByText('Jane Smith')).not.toHaveStyle({fontFamily: monoFontFamily});
    });

    it('renders a clickable button when onClick is provided and not disabled', () => {
        const onClick = jest.fn();
        renderWithTheme(<MetricCard label="Ready" value="09:00 NZDT" onClick={onClick} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not render a button when disabled or no onClick handler', () => {
        const onClick = jest.fn();
        const {unmount} = renderWithTheme(<MetricCard label="Ready" value="09:00" onClick={onClick} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        unmount();

        renderWithTheme(<MetricCard label="Created" value="09:00" />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows dash as non-value', () => {
        renderWithTheme(<MetricCard label="Follow Up" value="-" />);
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    describe('dense mode', () => {
        it('renders label and value in dense mode', () => {
            renderWithTheme(<MetricCard label="Pricing" value="$45.50" dense />);
            expect(screen.getByText('Pricing')).toBeInTheDocument();
            expect(screen.getByText('$45.50')).toBeInTheDocument();
        });

        it('remains clickable in dense mode', () => {
            const onClick = jest.fn();
            renderWithTheme(<MetricCard label="Ready" value="09:00" onClick={onClick} dense />);
            fireEvent.click(screen.getByRole('button'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('renders em dash for empty value in dense mode', () => {
            renderWithTheme(<MetricCard label="POD Name" value="" dense />);
            expect(screen.getByText('\u2014')).toBeInTheDocument();
        });
    });
});
