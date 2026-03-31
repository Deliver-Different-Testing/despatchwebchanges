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
