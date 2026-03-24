/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {CourierSelectionDialog, PotentialCourierItem} from './CourierSelectionDialog';
import {searchActiveCouriers} from '../../../services/courierApi';

jest.mock('../../../services/courierApi', () => ({
    searchActiveCouriers: jest.fn(),
}));

const mockSearchActiveCouriers = searchActiveCouriers as jest.MockedFunction<typeof searchActiveCouriers>;

const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    jobNo: 'JOB-1234',
    potentialCouriers: undefined as PotentialCourierItem[] | undefined,
};

function renderDialog(overrides?: Partial<typeof defaultProps>) {
    return renderWithTheme(<CourierSelectionDialog {...defaultProps} {...overrides} />);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockSearchActiveCouriers.mockResolvedValue([]);
});

describe('CourierSelectionDialog', () => {
    it('does not render when open is false', () => {
        renderDialog({open: false});
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog with job number in subtitle', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Reallocate job JOB-1234')).toBeInTheDocument();
    });

    it('shows placeholder when no results and no suggestions', () => {
        renderDialog();
        expect(screen.getByText('Search for a courier or select from suggestions')).toBeInTheDocument();
    });

    it('shows potential couriers when provided', () => {
        const potentialCouriers: PotentialCourierItem[] = [
            {courierId: 1, code: 'C01', firstName: 'Alice', distance: 3.5},
            {courierId: 2, code: 'C02', firstName: 'Bob', reason: 'Nearest available'},
        ];
        renderDialog({potentialCouriers});

        expect(screen.getByText('C01 - Alice')).toBeInTheDocument();
        expect(screen.getByText('3.5 km away')).toBeInTheDocument();
        expect(screen.getByText('C02 - Bob')).toBeInTheDocument();
        expect(screen.getByText('Nearest available')).toBeInTheDocument();
    });

    it('disables Reallocate button when no courier selected', () => {
        renderDialog();
        expect(screen.getByRole('button', {name: 'Reallocate'})).toBeDisabled();
    });

    it('enables Reallocate button after selecting a courier and calls onSelect when clicked', () => {
        const potentialCouriers: PotentialCourierItem[] = [
            {courierId: 10, code: 'C10', firstName: 'Charlie'},
        ];
        const onSelect = jest.fn();
        renderDialog({potentialCouriers, onSelect});

        fireEvent.click(screen.getByText('C10 - Charlie'));
        const reallocateBtn = screen.getByRole('button', {name: 'Reallocate'});
        expect(reallocateBtn).toBeEnabled();

        fireEvent.click(reallocateBtn);
        expect(onSelect).toHaveBeenCalledWith({
            courierId: 10,
            courierCode: 'C10',
            courierName: 'Charlie',
        });
    });

    it('calls onClose when Cancel clicked', () => {
        const onClose = jest.fn();
        renderDialog({onClose});

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(onClose).toHaveBeenCalled();
    });

    it('searches couriers on Enter key press and displays search results', async () => {
        mockSearchActiveCouriers.mockResolvedValue([
            {id: 50, text: 'Dave (D50)'},
            {id: 51, text: 'Eve (E51)'},
        ]);
        renderDialog();

        const searchInput = screen.getByPlaceholderText('Search courier by name or code...');
        fireEvent.change(searchInput, {target: {value: 'Dave'}});
        fireEvent.keyDown(searchInput, {key: 'Enter', code: 'Enter'});

        expect(mockSearchActiveCouriers).toHaveBeenCalledWith('Dave');

        expect(await screen.findByText('Dave (D50)')).toBeInTheDocument();
        expect(screen.getByText('Eve (E51)')).toBeInTheDocument();
        expect(screen.getByText('Search Results')).toBeInTheDocument();
    });
});
