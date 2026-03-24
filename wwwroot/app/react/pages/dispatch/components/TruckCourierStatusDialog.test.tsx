/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {TruckCourierStatusDialog} from './TruckCourierStatusDialog';
import type {ITruckCourierStatus} from '../../../services/dispatchApi';

const mockStatus: ITruckCourierStatus = {
    courierId: 1,
    courierCode: 'C001',
    firstName: 'John',
    maxPallets: 20,
    maxPayLoad: 1000,
    currentPallets: 8,
    currentWeight: 350,
    availablePalletCapacity: 12,
    availablePallets: 12,
    lastUpdated: '2026-03-24T10:00:00Z',
};

const defaultProps = {
    open: true,
    onClose: jest.fn(),
    truckCourierStatus: mockStatus,
    isUsCustomer: false,
    onRefresh: jest.fn(),
    isRefreshing: false,
};

function renderDialog(overrides?: Partial<typeof defaultProps>) {
    return renderWithTheme(<TruckCourierStatusDialog {...defaultProps} {...overrides} />);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('TruckCourierStatusDialog', () => {
    it('does not render when open is false', () => {
        renderDialog({open: false});
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog with courier info in header', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Truck Loading Status')).toBeInTheDocument();
        expect(screen.getByText('C001 John')).toBeInTheDocument();
    });

    it('shows kg for non-US customers', () => {
        renderDialog({isUsCustomer: false});
        expect(screen.getByLabelText('Max Weight (kg)')).toBeInTheDocument();
        expect(screen.getByLabelText('Current Weight (kg)')).toBeInTheDocument();
        expect(screen.getByLabelText('Available Weight (kg)')).toBeInTheDocument();
    });

    it('shows lbs for US customers', () => {
        renderDialog({isUsCustomer: true});
        expect(screen.getByLabelText('Max Weight (lbs)')).toBeInTheDocument();
        expect(screen.getByLabelText('Current Weight (lbs)')).toBeInTheDocument();
        expect(screen.getByLabelText('Available Weight (lbs)')).toBeInTheDocument();
    });

    it('displays all truck metrics', () => {
        renderDialog();
        expect(screen.getByLabelText('Max Pallets')).toHaveDisplayValue('20');
        expect(screen.getByLabelText('Max Weight (kg)')).toHaveDisplayValue('1000');
        expect(screen.getByLabelText('Available Pallets')).toHaveDisplayValue('12');
        expect(screen.getByLabelText('Current Pallets')).toHaveDisplayValue('8');
        expect(screen.getByLabelText('Current Weight (kg)')).toHaveDisplayValue('350');
    });

    it('calculates and shows available weight', () => {
        renderDialog();
        // availableWeight = maxPayLoad (1000) - currentWeight (350) = 650
        expect(screen.getByLabelText('Available Weight (kg)')).toHaveDisplayValue('650');
    });

    it('calls onRefresh when refresh button clicked', () => {
        const onRefresh = jest.fn();
        renderDialog({onRefresh});

        const refreshBtn = screen.getByRole('button', {name: 'Refresh'});
        expect(refreshBtn).toBeEnabled();
        fireEvent.click(refreshBtn);
        expect(onRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when isRefreshing', () => {
        renderDialog({isRefreshing: true});
        expect(screen.getByRole('button', {name: 'Refresh'})).toBeDisabled();
    });

    it('calls onClose when close button clicked', () => {
        const onClose = jest.fn();
        renderDialog({onClose});

        fireEvent.click(screen.getByRole('button', {name: 'Close'}));
        expect(onClose).toHaveBeenCalled();
    });
});
