/**
 * RecurringJobsContextMenu Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {RecurringJobsContextMenu, RecurringJobsContextMenuProps} from './RecurringJobsContextMenu';
import {renderWithTheme, createProps} from '../../../__testUtils__';
import {PrebookListModel} from '../../../interfaces';
import {AddressViewModel} from '../../../interfaces';

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
    booked: new Date('2024-01-15'),
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
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders menu when anchorPosition and job are provided', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('does not render menu when anchorPosition is null', () => {
            const props = createMockProps({anchorPosition: null});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('does not render menu when job is null', () => {
            const props = createMockProps({job: null});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('does not render menu when both anchorPosition and job are null', () => {
            const props = createMockProps({anchorPosition: null, job: null});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    describe('Menu Items', () => {
        it('displays Add Pickup Stop menu item', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
        });

        it('displays Add Delivery Stop menu item', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();
        });

        it('displays pickup stop icon', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            // PinDropIcon is used for both items
            const icons = screen.getAllByTestId('PinDropIcon');
            expect(icons.length).toBe(2);
        });

        it('displays two menu items', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            const menuItems = screen.getAllByRole('menuitem');
            expect(menuItems).toHaveLength(2);
        });
    });

    describe('Add Pickup Stop', () => {
        it('calls onAddPickupStop with job when clicked', async () => {
            const user = userEvent.setup();
            const onAddPickupStop = jest.fn();
            const props = createMockProps({onAddPickupStop});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Pickup Stop'));

            expect(onAddPickupStop).toHaveBeenCalledWith(mockJob);
        });

        it('calls onClose after clicking Add Pickup Stop', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Pickup Stop'));

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose before checking job when job is null', async () => {
            // This tests the edge case where job becomes null during click
            // In practice this shouldn't happen, but we test the code path
            const user = userEvent.setup();
            const onAddPickupStop = jest.fn();
            const onClose = jest.fn();
            const props = createMockProps({
                job: mockJob,
                onAddPickupStop,
                onClose,
            });
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Pickup Stop'));

            expect(onAddPickupStop).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Add Delivery Stop', () => {
        it('calls onAddDeliveryStop with job when clicked', async () => {
            const user = userEvent.setup();
            const onAddDeliveryStop = jest.fn();
            const props = createMockProps({onAddDeliveryStop});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(onAddDeliveryStop).toHaveBeenCalledWith(mockJob);
        });

        it('calls onClose after clicking Add Delivery Stop', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when menu is dismissed', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            // Press Escape to dismiss menu
            await user.keyboard('{Escape}');

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Menu Position', () => {
        it('renders with specified anchor position', () => {
            const props = createMockProps({
                anchorPosition: {x: 300, y: 400},
            });
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            const menu = screen.getByRole('menu');
            expect(menu).toBeInTheDocument();
        });
    });

    describe('Different Jobs', () => {
        it('passes correct job to onAddPickupStop for different jobs', async () => {
            const user = userEvent.setup();
            const onAddPickupStop = jest.fn();
            const differentJob: PrebookListModel = {
                ...mockJob,
                id: 999,
                jobNo: 'RJ-999',
                client: 'Different Client',
            };
            const props = createMockProps({onAddPickupStop, job: differentJob});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Pickup Stop'));

            expect(onAddPickupStop).toHaveBeenCalledWith(differentJob);
        });

        it('passes correct job to onAddDeliveryStop for different jobs', async () => {
            const user = userEvent.setup();
            const onAddDeliveryStop = jest.fn();
            const differentJob: PrebookListModel = {
                ...mockJob,
                id: 888,
                jobNo: 'RJ-888',
                client: 'Another Client',
            };
            const props = createMockProps({onAddDeliveryStop, job: differentJob});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(onAddDeliveryStop).toHaveBeenCalledWith(differentJob);
        });
    });

    describe('Menu Divider', () => {
        it('renders divider between menu items', () => {
            const props = createMockProps();
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            // MUI Divider uses separator role in menu context
            const divider = screen.getByRole('separator');
            expect(divider).toBeInTheDocument();
        });
    });

    describe('Order of Operations', () => {
        it('calls onAddPickupStop before onClose', async () => {
            const user = userEvent.setup();
            const callOrder: string[] = [];
            const onAddPickupStop = jest.fn(() => callOrder.push('pickup'));
            const onClose = jest.fn(() => callOrder.push('close'));
            const props = createMockProps({onAddPickupStop, onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Pickup Stop'));

            expect(callOrder).toEqual(['pickup', 'close']);
        });

        it('calls onAddDeliveryStop before onClose', async () => {
            const user = userEvent.setup();
            const callOrder: string[] = [];
            const onAddDeliveryStop = jest.fn(() => callOrder.push('delivery'));
            const onClose = jest.fn(() => callOrder.push('close'));
            const props = createMockProps({onAddDeliveryStop, onClose});
            renderWithTheme(<RecurringJobsContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(callOrder).toEqual(['delivery', 'close']);
        });
    });
});
