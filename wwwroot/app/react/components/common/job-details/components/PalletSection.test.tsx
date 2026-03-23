/** @jest-environment jest-environment-jsdom */
/**
 * PalletSection Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {PalletSection} from './PalletSection';
import {createMockPallet} from '../__testUtils__/mockJob';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PalletSection', () => {
    it('renders nothing when pallets array is empty or null', () => {
        const {container: c1} = renderWithTheme(<PalletSection pallets={[]} isUsCustomer={false} />);
        expect(c1.firstChild).toBeNull();

        const {container: c2} = renderWithTheme(<PalletSection pallets={null as any} isUsCustomer={false} />);
        expect(c2.firstChild).toBeNull();
    });

    it('renders pallet table with data', () => {
        const pallets = [createMockPallet()];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText('Pallet Information')).toBeInTheDocument();
        expect(screen.getByText('(1)')).toBeInTheDocument();
        expect(screen.getByText('120 x 80 x 100')).toBeInTheDocument();
        expect(screen.getByText('Fragile')).toBeInTheDocument();
    });

    it('uses metric units for non-US customers', () => {
        const pallets = [createMockPallet()];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText(/Weight \(kg\)/)).toBeInTheDocument();
        expect(screen.getByText(/Dimensions \(cm\)/)).toBeInTheDocument();
    });

    it('uses imperial units for US customers', () => {
        const pallets = [createMockPallet()];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={true} />);

        expect(screen.getByText(/Weight \(lbs\)/)).toBeInTheDocument();
        expect(screen.getByText(/Dimensions \(in\)/)).toBeInTheDocument();
    });

    it('calculates totals correctly', () => {
        const pallets = [
            createMockPallet({quantity: 2, weight: 25, length: 100, depth: 80, height: 50}),
            createMockPallet({id: 2, quantity: 3, weight: 10, length: 60, depth: 40, height: 30}),
        ];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('80.0')).toBeInTheDocument();
    });

    it('shows PU and DO chips', () => {
        const pallets = [createMockPallet({pu: true, do: true})];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText('PU')).toBeInTheDocument();
        expect(screen.getByText('DO')).toBeInTheDocument();
    });
});
