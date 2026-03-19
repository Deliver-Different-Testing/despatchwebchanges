/** @jest-environment jest-environment-jsdom */
/**
 * RecurringJobsContextMenu Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {RecurringJobsContextMenu, RecurringJobsContextMenuProps} from './RecurringJobsContextMenu';
import {renderWithTheme, createProps} from '../../../__testUtils__';
import {PrebookListModel} from '../../../interfaces';
import {AddressViewModel} from '../../../interfaces';
import dayjs from 'dayjs';

const mockAddress: AddressViewModel = {
    addressLine1: 'Test Company',
    addressLine2: 'Suite 100',
    addressLine3: '123',
    addressLine4: 'Main Street',
    addressLine5: 'Auckland',
    addressLine6: '',
    addressLine7: '1010',
    addressLine8: '',
    fullAddress: '123 Main Street, Auckland 1010',
};

const mockJob: PrebookListModel = {
    id: 100,
    booked: dayjs('2024-01-15'),
    client: 'Test Client',
    jobNo: 'RJ-001',
    clientId: 1,
    courier: 'Test Courier',
    speed: 'Standard',
    pickupAddress: mockAddress,
    deliveryAddress: {...mockAddress, fullAddress: '456 Oak Avenue, Auckland 2010'},
};

const defaultProps: RecurringJobsContextMenuProps = {
    anchorPosition: {x: 100, y: 200},
    job: mockJob,
    onClose: jest.fn(),
    onAddPickupStop: jest.fn(),
    onAddDeliveryStop: jest.fn(),
};

const createMockProps = (overrides?: Partial<RecurringJobsContextMenuProps>) =>
    createProps(defaultProps, overrides);

describe('RecurringJobsContextMenu', () => {
    describe('Rendering', () => {
        it('renders menu with correct items, icons, divider, and position when anchorPosition and job are provided', () => {
            const props = createMockProps({
                anchorPosition: {x: 300, y: 400},
            });
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            const menu = screen.getByRole('menu');
            expect(menu).toBeInTheDocument();

            // Menu items
            const menuItems = screen.getAllByRole('menuitem');
            expect(menuItems).toHaveLength(2);
            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();

            // Icons (PinDropIcon for both items)
            const icons = screen.getAllByTestId('PinDropIcon');
            expect(icons.length).toBe(2);

            // Divider between menu items
            const divider = screen.getByRole('separator');
            expect(divider).toBeInTheDocument();
        });

        it('does not render menu when anchorPosition is null, job is null, or both are null', () => {
            const { unmount: u1 } = renderWithTheme(
                <RecurringJobsContextMenu {...createMockProps({anchorPosition: null})} />
            );
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            u1();

            const { unmount: u2 } = renderWithTheme(
                <RecurringJobsContextMenu {...createMockProps({job: null})} />
            );
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            u2();

            renderWithTheme(
                <RecurringJobsContextMenu {...createMockProps({anchorPosition: null, job: null})} />
            );
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    describe('Add Pickup Stop', () => {
        it('calls onAddPickupStop with job and then onClose when clicked', () => {
            const callOrder: string[] = [];
            const onAddPickupStop = jest.fn(() => callOrder.push('pickup'));
            const onClose = jest.fn(() => callOrder.push('close'));
            const props = createMockProps({onAddPickupStop, onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            fireEvent.click(screen.getByText('Add Pickup Stop'));

            expect(onAddPickupStop).toHaveBeenCalledWith(mockJob);
            expect(onClose).toHaveBeenCalled();
            expect(callOrder).toEqual(['pickup', 'close']);
        });
    });

    describe('Add Delivery Stop', () => {
        it('calls onAddDeliveryStop with job and then onClose when clicked', () => {
            const callOrder: string[] = [];
            const onAddDeliveryStop = jest.fn(() => callOrder.push('delivery'));
            const onClose = jest.fn(() => callOrder.push('close'));
            const props = createMockProps({onAddDeliveryStop, onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            fireEvent.click(screen.getByText('Add Delivery Stop'));

            expect(onAddDeliveryStop).toHaveBeenCalledWith(mockJob);
            expect(onClose).toHaveBeenCalled();
            expect(callOrder).toEqual(['delivery', 'close']);
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when menu is dismissed', async () => {
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            // Press Escape to dismiss menu
            fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Different Jobs', () => {
        it('passes correct job to onAddPickupStop and onAddDeliveryStop for different jobs', () => {
            const onAddPickupStop = jest.fn();
            const pickupJob: PrebookListModel = {
                ...mockJob,
                id: 999,
                jobNo: 'RJ-999',
                client: 'Different Client',
            };
            const { unmount } = renderWithTheme(
                <RecurringJobsContextMenu {...createMockProps({onAddPickupStop, job: pickupJob})} />
            );

            fireEvent.click(screen.getByText('Add Pickup Stop'));
            expect(onAddPickupStop).toHaveBeenCalledWith(pickupJob);
            unmount();

            const onAddDeliveryStop = jest.fn();
            const deliveryJob: PrebookListModel = {
                ...mockJob,
                id: 888,
                jobNo: 'RJ-888',
                client: 'Another Client',
            };
            renderWithTheme(
                <RecurringJobsContextMenu {...createMockProps({onAddDeliveryStop, job: deliveryJob})} />
            );

            fireEvent.click(screen.getByText('Add Delivery Stop'));
            expect(onAddDeliveryStop).toHaveBeenCalledWith(deliveryJob);
        });
    });
});
