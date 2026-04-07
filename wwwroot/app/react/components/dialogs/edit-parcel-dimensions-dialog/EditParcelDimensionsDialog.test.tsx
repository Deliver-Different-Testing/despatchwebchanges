/** @jest-environment jest-environment-jsdom */

import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {EditParcelDimensionsDialog} from './EditParcelDimensionsDialog';
import {renderWithTheme} from '../../../__testUtils__';
import type {ParcelDimensions} from './types';

jest.mock('../../../services/apiClient', () => ({
    apiClient: {
        get: jest.fn().mockResolvedValue(false),
        post: jest.fn().mockResolvedValue({}),
    },
}));

const mockParcel = (overrides?: Partial<ParcelDimensions>): ParcelDimensions => ({
    itemName: 'Test Parcel',
    length: 10,
    depth: 5,
    height: 3,
    dimensions: '10 × 5 × 3 cm',
    ...overrides,
});

const defaultProps = {
    open: true,
    parcels: [mockParcel()],
    jobId: 1,
    isUsCustomer: false,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    showToast: jest.fn(),
};

describe('EditParcelDimensionsDialog item count chip', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('displays a chip with plural item count', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel(), mockParcel(), mockParcel()]} />);

        const chip = document.querySelector('.MuiChip-root .MuiChip-label')!;
        expect(chip).toBeInTheDocument();
        expect(chip.textContent).toBe('3 items');
    });

    it('displays a chip with singular item count', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        const chip = document.querySelector('.MuiChip-root .MuiChip-label')!;
        expect(chip).toBeInTheDocument();
        expect(chip.textContent).toBe('1 item');
    });
});

describe('EditParcelDimensionsDialog discard changes confirmation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('closes directly when no changes have been made', async () => {
        const user = userEvent.setup();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(defaultProps.onClose).toHaveBeenCalled();
        expect(screen.queryByText('Discard unsaved changes')).not.toBeInTheDocument();
    });

    it('shows MUI confirmation dialog when cancelling with unsaved changes', async () => {
        const user = userEvent.setup();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByLabelText(/item name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(screen.getByText('Discard unsaved changes')).toBeInTheDocument();
        expect(screen.getByText(/haven't been saved and will be lost/i)).toBeInTheDocument();
        expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('closes the dialog when Discard is confirmed', async () => {
        const user = userEvent.setup();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByLabelText(/item name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        await user.click(screen.getByRole('button', {name: /discard/i}));

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('keeps the dialog open when Keep editing is clicked on the confirmation', async () => {
        const user = userEvent.setup();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByLabelText(/item name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        const confirmDialog = screen.getByText('Discard unsaved changes').closest('[role="dialog"]') as HTMLElement;
        await user.click(within(confirmDialog).getByRole('button', {name: /keep editing/i}));

        expect(defaultProps.onClose).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByText('Discard unsaved changes')).not.toBeInTheDocument();
        });
    });
});

describe('EditParcelDimensionsDialog remove parcels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('removes parcels from the end when clicking the remove button', async () => {
        const user = userEvent.setup();
        const threeParcels = [mockParcel({itemName: 'A'}), mockParcel({itemName: 'B'}), mockParcel({itemName: 'C'})];
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={threeParcels} />);

        const chip = document.querySelector('.MuiChip-root .MuiChip-label')!;
        expect(chip.textContent).toBe('3 items');

        await user.click(screen.getByRole('button', {name: /remove parcels/i}));

        const updatedChip = document.querySelector('.MuiChip-root .MuiChip-label')!;
        expect(updatedChip.textContent).toBe('2 items');
        expect(defaultProps.showToast).toHaveBeenCalledWith('Removed 1 parcel from the end', 'success');
    });

    it('shows warning when trying to remove more parcels than exist minus one', async () => {
        const user = userEvent.setup();
        const twoParcels = [mockParcel({itemName: 'A'}), mockParcel({itemName: 'B'})];
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={twoParcels} />);

        const qtyInput = screen.getByLabelText('Qty');
        await user.clear(qtyInput);
        await user.type(qtyInput, '5');

        await user.click(screen.getByRole('button', {name: /remove parcels/i}));

        expect(defaultProps.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Cannot remove'),
            'warning',
        );
        const chip = document.querySelector('.MuiChip-root .MuiChip-label')!;
        expect(chip.textContent).toBe('2 items');
    });

    it('shows warning when trying to remove all parcels (must keep at least one)', async () => {
        const user = userEvent.setup();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        await user.click(screen.getByRole('button', {name: /remove parcels/i}));

        expect(defaultProps.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Cannot remove 1 parcel'),
            'warning',
        );
    });
});
