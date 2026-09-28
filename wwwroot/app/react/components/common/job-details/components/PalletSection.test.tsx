/**
 * PalletSection Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {PalletSection} from './PalletSection';
import {createMockPallet} from '../__testUtils__/mockJob';
import {renderWithMantine as renderWithTheme} from '../../../../__testUtils__';

describe('PalletSection', () => {
    it('renders nothing when pallets array is empty or null', () => {
        // `MantineProvider` injects a <style> element, so an empty container is no
        // longer the signal — assert the table is absent instead.
        const {unmount} = renderWithTheme(<PalletSection pallets={[]} isUsCustomer={false} />);
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        unmount();

        renderWithTheme(<PalletSection pallets={null as any} isUsCustomer={false} />);
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders pallet table with data', () => {
        const pallets = [createMockPallet()];
        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText('Pallet Information')).toBeInTheDocument();
        expect(screen.getByText('1 pallet')).toBeInTheDocument();
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

    it('renders correct number of rows when pallets change', () => {
        const palletsA = [
            createMockPallet({itemId: 1, quantity: 2, notes: 'Pallet A1'}),
            createMockPallet({itemId: 2, quantity: 3, notes: 'Pallet A2'}),
            createMockPallet({itemId: 3, quantity: 1, notes: 'Pallet A3'}),
        ];

        const {rerender} = renderWithTheme(<PalletSection pallets={palletsA} isUsCustomer={false} />);

        // 3 data rows + 1 header row + 1 summary row = 5 total
        const tableBody = document.querySelector('tbody')!;
        expect(tableBody.querySelectorAll('tr')).toHaveLength(4); // 3 data + 1 summary

        // Switch to a different set of pallets (fewer)
        const palletsB = [
            createMockPallet({itemId: 10, quantity: 5, notes: 'Pallet B1'}),
        ];

        // `renderWithMantine` supplies the provider as RTL's `wrapper`, so the
        // rerender must NOT re-wrap it — a second provider at that position
        // remounts the subtree and detaches the tbody captured above.
        rerender(<PalletSection pallets={palletsB} isUsCustomer={false} />);

        // Should now show only 1 data row + 1 summary row
        expect(document.querySelector('tbody')!.querySelectorAll('tr')).toHaveLength(2);
        expect(screen.getByText('Pallet B1')).toBeInTheDocument();
        expect(screen.queryByText('Pallet A1')).not.toBeInTheDocument();
        expect(screen.queryByText('Pallet A2')).not.toBeInTheDocument();
        expect(screen.queryByText('Pallet A3')).not.toBeInTheDocument();
    });

    it('renders unique keys for pallets with same id but different itemId', () => {
        // Simulates multi-stop pallets where id (JobId) is the same for all
        const pallets = [
            createMockPallet({id: 100, itemId: 1, notes: 'First'}),
            createMockPallet({id: 100, itemId: 2, notes: 'Second'}),
            createMockPallet({id: 100, itemId: 3, notes: 'Third'}),
        ];

        renderWithTheme(<PalletSection pallets={pallets} isUsCustomer={false} />);

        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
        expect(screen.getByText('3 pallets')).toBeInTheDocument();
    });
});
