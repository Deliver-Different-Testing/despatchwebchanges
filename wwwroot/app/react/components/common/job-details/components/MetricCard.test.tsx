/** @jest-environment jest-environment-jsdom */
/**
 * MetricCard Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {MetricCard} from './MetricCard';

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
});
