/**
 * AddressSection Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {AddressSection} from './AddressSection';
import {createMockJob, createMockAddress} from '../__testUtils__/mockJob';
import {renderWithMantineOverMui} from '../../../../__testUtils__';

// AddressSection reads usePendingChangeForField (React Query); the test needs
// both ThemeProvider AND QueryClientProvider — renderWithProviders bundles them.
function renderWithTheme(ui: React.ReactElement) {
    return renderWithMantineOverMui(ui, {withQueryClient: true});
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob(),
        dense: false,
        onEditPickupAddress: jest.fn(),
        onEditDeliveryAddress: jest.fn(),
        onEditFromContact: jest.fn(),
        onEditToContact: jest.fn(),
        onEditFromContactPhone: jest.fn(),
        onEditToContactPhone: jest.fn(),
        ...overrides,
    };
}

describe('AddressSection', () => {
    it('renders all address information', () => {
        renderWithTheme(<AddressSection {...createDefaultProps()} />);
        expect(screen.getByText('Pickup')).toBeInTheDocument();
        expect(screen.getByText('Delivery')).toBeInTheDocument();
        expect(screen.getByText('123 Test St, Testville TST 1234')).toBeInTheDocument();
        expect(screen.getByText('456 Delivery Rd, Deliverytown DLV 5678')).toBeInTheDocument();
        expect(screen.getByText('John Sender')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('09 555 0001')).toBeInTheDocument();
        expect(screen.getByText('04 555 1234')).toBeInTheDocument();
    });

    it('shows em dash when address is empty', () => {
        const job = createMockJob({
            pickupAddress: createMockAddress({fullAddress: ''}),
        });
        renderWithTheme(<AddressSection {...createDefaultProps({job})} />);
        const emDashes = screen.getAllByText('\u2014');
        expect(emDashes.length).toBeGreaterThan(0);
    });

    it('calls onEditPickupAddress when pickup address area is clicked', () => {
        const onEditPickupAddress = jest.fn();
        renderWithTheme(<AddressSection {...createDefaultProps({onEditPickupAddress})} />);

        fireEvent.click(screen.getByText('123 Test St, Testville TST 1234'));
        expect(onEditPickupAddress).toHaveBeenCalledTimes(1);
    });

    it('calls onEditDeliveryAddress when delivery address is clicked', () => {
        const onEditDeliveryAddress = jest.fn();
        renderWithTheme(<AddressSection {...createDefaultProps({onEditDeliveryAddress})} />);

        fireEvent.click(screen.getByText('456 Delivery Rd, Deliverytown DLV 5678'));
        expect(onEditDeliveryAddress).toHaveBeenCalledTimes(1);
    });

    it('calls onEditFromContact when pickup contact is clicked', () => {
        const onEditFromContact = jest.fn();
        renderWithTheme(<AddressSection {...createDefaultProps({onEditFromContact})} />);

        fireEvent.click(screen.getByText('John Sender'));
        expect(onEditFromContact).toHaveBeenCalledTimes(1);
    });

    it('calls onEditToContact when delivery contact is clicked', () => {
        const onEditToContact = jest.fn();
        renderWithTheme(<AddressSection {...createDefaultProps({onEditToContact})} />);

        fireEvent.click(screen.getByText('Bob Smith'));
        expect(onEditToContact).toHaveBeenCalledTimes(1);
    });

    it('keeps the address clickable when locked (opens read-only) but not the contacts', () => {
        const onEditPickupAddress = jest.fn();
        const onEditFromContact = jest.fn();
        const job = createMockJob({locked: true});
        renderWithTheme(
            <AddressSection {...createDefaultProps({job, onEditPickupAddress, onEditFromContact})} />
        );

        // Address is in the read-only subset — still opens the dialog when locked.
        fireEvent.click(screen.getByText('123 Test St, Testville TST 1234'));
        expect(onEditPickupAddress).toHaveBeenCalledTimes(1);

        // Contact editing is out of the subset — the contact card is inert while locked.
        fireEvent.click(screen.getByText('John Sender'));
        expect(onEditFromContact).not.toHaveBeenCalled();
    });

    it('shows phone source chip when provided', () => {
        const job = createMockJob({fromContactNumberSource: 'Address Book'});
        renderWithTheme(<AddressSection {...createDefaultProps({job})} />);
        expect(screen.getByText('Address Book')).toBeInTheDocument();
    });

    it('renders call link for phone numbers', () => {
        renderWithTheme(<AddressSection {...createDefaultProps()} />);
        const callLinks = screen.getAllByLabelText(/Call/);
        expect(callLinks.length).toBeGreaterThan(0);
    });

    describe('dense mode', () => {
        it('renders all address information in dense mode', () => {
            renderWithTheme(<AddressSection {...createDefaultProps({dense: true})} />);
            expect(screen.getByText('Pickup')).toBeInTheDocument();
            expect(screen.getByText('Delivery')).toBeInTheDocument();
            expect(screen.getByText('123 Test St, Testville TST 1234')).toBeInTheDocument();
            expect(screen.getByText('456 Delivery Rd, Deliverytown DLV 5678')).toBeInTheDocument();
            expect(screen.getByText('John Sender')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        });

        it('click handlers still work in dense mode', () => {
            const onEditPickupAddress = jest.fn();
            const onEditFromContact = jest.fn();
            renderWithTheme(
                <AddressSection {...createDefaultProps({dense: true, onEditPickupAddress, onEditFromContact})} />
            );
            fireEvent.click(screen.getByText('123 Test St, Testville TST 1234'));
            expect(onEditPickupAddress).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByText('John Sender'));
            expect(onEditFromContact).toHaveBeenCalledTimes(1);
        });

        it('renders call links in dense mode', () => {
            renderWithTheme(<AddressSection {...createDefaultProps({dense: true})} />);
            const callLinks = screen.getAllByLabelText(/Call/);
            expect(callLinks.length).toBeGreaterThan(0);
        });
    });
});
