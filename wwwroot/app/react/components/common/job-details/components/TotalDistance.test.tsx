/** @jest-environment jest-environment-jsdom */
/**
 * TotalDistance Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {TotalDistance} from './TotalDistance';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TotalDistance', () => {
    it('renders nothing when not visible or distance is 0', () => {
        const {container: c1} = renderWithTheme(
            <TotalDistance distance={12.5} isUsCustomer={false} visible={false} />
        );
        expect(c1.firstChild).toBeNull();

        const {container: c2} = renderWithTheme(
            <TotalDistance distance={0} isUsCustomer={false} visible={true} />
        );
        expect(c2.firstChild).toBeNull();
    });

    it('shows distance in km for non-US customers', () => {
        renderWithTheme(<TotalDistance distance={12.5} isUsCustomer={false} visible={true} />);
        expect(screen.getByText('12.5 km')).toBeInTheDocument();
    });

    it('shows distance in miles for US customers', () => {
        renderWithTheme(<TotalDistance distance={7.8} isUsCustomer={true} visible={true} />);
        expect(screen.getByText('7.8 miles')).toBeInTheDocument();
    });

    it('formats distance to one decimal place', () => {
        renderWithTheme(<TotalDistance distance={100.456} isUsCustomer={false} visible={true} />);
        expect(screen.getByText('100.5 km')).toBeInTheDocument();
    });
});
