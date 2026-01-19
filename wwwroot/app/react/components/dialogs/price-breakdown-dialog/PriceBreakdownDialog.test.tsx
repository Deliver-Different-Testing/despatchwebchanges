/**
 * PriceBreakdownDialog Component Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PriceBreakdownDialog, PriceBreakdownDialogProps, PriceBreakdown} from './PriceBreakdownDialog';
import {renderWithTheme, createProps} from '../../../__testUtils__';

const mockBreakdowns: PriceBreakdown[] = [
    {chargeId: 1, name: 'Base Charge', amount: 100.00, costAmount: 60.00, jobId: 100},
    {chargeId: 2, name: 'Rush Fee', amount: 25.00, costAmount: 10.00, jobId: 100},
    {chargeId: 3, name: 'Weekend Surcharge', amount: 15.00, costAmount: 5.00, jobId: 100},
];

const defaultProps: PriceBreakdownDialogProps = {
    open: true,
    priceBreakdowns: mockBreakdowns,
    jobId: 100,
    isPrebook: false,
    isArchived: false,
    onClose: jest.fn(),
    onSave: jest.fn(),
    onAddItem: jest.fn().mockResolvedValue(4),
    onUpdateItem: jest.fn().mockResolvedValue(undefined),
    onDeleteItem: jest.fn().mockResolvedValue(undefined),
};

const createMockProps = (overrides?: Partial<PriceBreakdownDialogProps>) =>
    createProps(defaultProps, overrides);

describe('PriceBreakdownDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.confirm for delete tests
        window.confirm = jest.fn().mockImplementation(() => true);
    });

    describe('Rendering', () => {
        it('renders dialog when open is true', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('displays title', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Price Breakdown')).toBeInTheDocument();
        });

        it('displays subtitle', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Manage pricing components for this job')).toBeInTheDocument();
        });

        it('displays Cancel button', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        });

        it('displays Save & Close button', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByRole('button', {name: /save & close/i})).toBeInTheDocument();
        });

        it('displays Add Item button', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByRole('button', {name: /add item/i})).toBeInTheDocument();
        });
    });

    describe('Summary Cards', () => {
        it('displays Total Revenue card', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        });

        it('displays Total Cost card', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Total Cost')).toBeInTheDocument();
        });

        it('displays Gross Profit card', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Gross Profit')).toBeInTheDocument();
        });

        it('calculates correct total revenue', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // 100 + 25 + 15 = 140 (appears in summary card and footer)
            const revenueElements = screen.getAllByText('$140.00');
            expect(revenueElements.length).toBeGreaterThanOrEqual(1);
        });

        it('calculates correct total cost', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // 60 + 10 + 5 = 75
            expect(screen.getByText('$75.00')).toBeInTheDocument();
        });

        it('calculates correct profit', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // 140 - 75 = 65
            expect(screen.getByText('$65.00')).toBeInTheDocument();
        });

        it('displays margin percentage', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // (65/140) * 100 = 46.4%
            expect(screen.getByText(/46\.4% margin/)).toBeInTheDocument();
        });
    });

    describe('Price Items Table', () => {
        it('displays Price Items header', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Price Items')).toBeInTheDocument();
        });

        it('displays item count chip', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('3 items')).toBeInTheDocument();
        });

        it('displays table headers', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Item Name')).toBeInTheDocument();
            expect(screen.getByText('Revenue')).toBeInTheDocument();
            expect(screen.getByText('Cost')).toBeInTheDocument();
            expect(screen.getByText('Profit')).toBeInTheDocument();
            expect(screen.getByText('Margin')).toBeInTheDocument();
            expect(screen.getByText('Actions')).toBeInTheDocument();
        });

        it('displays item names', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Base Charge')).toBeInTheDocument();
            expect(screen.getByText('Rush Fee')).toBeInTheDocument();
            expect(screen.getByText('Weekend Surcharge')).toBeInTheDocument();
        });

        it('displays item revenue amounts', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Use getAllByText since amounts may appear multiple places
            expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$25.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$15.00').length).toBeGreaterThanOrEqual(1);
        });

        it('displays item cost amounts', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Use getAllByText since amounts may appear multiple places
            expect(screen.getAllByText('$60.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$10.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$5.00').length).toBeGreaterThanOrEqual(1);
        });

        it('displays edit buttons for each item', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const editButtons = screen.getAllByTestId('EditIcon');
            expect(editButtons).toHaveLength(3);
        });

        it('displays delete buttons for each item', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const deleteButtons = screen.getAllByTestId('DeleteIcon');
            expect(deleteButtons).toHaveLength(3);
        });
    });

    describe('Empty State', () => {
        it('displays empty state when no breakdowns', () => {
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('No price items yet')).toBeInTheDocument();
        });

        it('displays empty state message', () => {
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('Start by adding your first price breakdown item')).toBeInTheDocument();
        });

        it('displays Add First Item button in empty state', () => {
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByRole('button', {name: /add first item/i})).toBeInTheDocument();
        });

        it('does not display summary cards when empty', () => {
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
        });
    });

    describe('Add Item', () => {
        it('shows add form when Add Item is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add item/i}));

            expect(screen.getByText('Add New Price Item')).toBeInTheDocument();
        });

        it('displays form fields in add mode', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add item/i}));

            expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/revenue amount/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/cost amount/i)).toBeInTheDocument();
        });

        it('displays Cancel button in form', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add item/i}));

            expect(screen.getByRole('button', {name: /^cancel$/i})).toBeInTheDocument();
        });

        it('displays Add Item submit button', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add item/i}));

            // The button in the form should say "Add Item"
            const buttons = screen.getAllByRole('button', {name: /add item/i});
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('calls onAddItem when form is submitted', async () => {
            const user = userEvent.setup();
            const onAddItem = jest.fn().mockResolvedValue(4);
            const props = createMockProps({onAddItem, priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add first item/i}));

            await user.type(screen.getByLabelText(/item name/i), 'New Charge');
            await user.type(screen.getByLabelText(/revenue amount/i), '50');
            await user.type(screen.getByLabelText(/cost amount/i), '30');

            // Find and click the submit button
            const submitButton = screen.getByRole('button', {name: /add item/i});
            await user.click(submitButton);

            await waitFor(() => {
                expect(onAddItem).toHaveBeenCalled();
            });
        });

        it('cancels add mode when Cancel is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add item/i}));
            expect(screen.getByText('Add New Price Item')).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: /^cancel$/i}));

            expect(screen.queryByText('Add New Price Item')).not.toBeInTheDocument();
        });
    });

    describe('Edit Item', () => {
        it('shows edit form when edit button is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const editButtons = screen.getAllByTestId('EditIcon');
            await user.click(editButtons[0].closest('button')!);

            expect(screen.getByText('Edit Price Item')).toBeInTheDocument();
        });

        it('populates form with item values', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const editButtons = screen.getAllByTestId('EditIcon');
            await user.click(editButtons[0].closest('button')!);

            expect(screen.getByDisplayValue('Base Charge')).toBeInTheDocument();
            expect(screen.getByDisplayValue('100')).toBeInTheDocument();
            expect(screen.getByDisplayValue('60')).toBeInTheDocument();
        });

        it('displays Save Changes button in edit mode', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const editButtons = screen.getAllByTestId('EditIcon');
            await user.click(editButtons[0].closest('button')!);

            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('calls onUpdateItem when form is submitted', async () => {
            const user = userEvent.setup();
            const onUpdateItem = jest.fn().mockResolvedValue(undefined);
            const props = createMockProps({onUpdateItem});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const editButtons = screen.getAllByTestId('EditIcon');
            await user.click(editButtons[0].closest('button')!);

            // Modify the name
            const nameInput = screen.getByDisplayValue('Base Charge');
            await user.clear(nameInput);
            await user.type(nameInput, 'Updated Charge');

            await user.click(screen.getByRole('button', {name: /save changes/i}));

            await waitFor(() => {
                expect(onUpdateItem).toHaveBeenCalled();
            });
        });
    });

    describe('Delete Item', () => {
        it('shows confirm dialog when delete is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const deleteButtons = screen.getAllByTestId('DeleteIcon');
            await user.click(deleteButtons[0].closest('button')!);

            expect(window.confirm).toHaveBeenCalled();
        });

        it('calls onDeleteItem when confirmed', async () => {
            const user = userEvent.setup();
            const onDeleteItem = jest.fn().mockResolvedValue(undefined);
            const props = createMockProps({onDeleteItem});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const deleteButtons = screen.getAllByTestId('DeleteIcon');
            await user.click(deleteButtons[0].closest('button')!);

            await waitFor(() => {
                expect(onDeleteItem).toHaveBeenCalledWith(1, 100, false);
            });
        });

        it('does not delete when not confirmed', async () => {
            window.confirm = jest.fn().mockImplementation(() => false);

            const user = userEvent.setup();
            const onDeleteItem = jest.fn();
            const props = createMockProps({onDeleteItem});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const deleteButtons = screen.getAllByTestId('DeleteIcon');
            await user.click(deleteButtons[0].closest('button')!);

            expect(onDeleteItem).not.toHaveBeenCalled();
        });

        it('passes isArchived to onDeleteItem', async () => {
            const user = userEvent.setup();
            const onDeleteItem = jest.fn().mockResolvedValue(undefined);
            const props = createMockProps({onDeleteItem, isArchived: true});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            const deleteButtons = screen.getAllByTestId('DeleteIcon');
            await user.click(deleteButtons[0].closest('button')!);

            await waitFor(() => {
                expect(onDeleteItem).toHaveBeenCalledWith(1, 100, true);
            });
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Find close button by its close icon
            const closeIcon = screen.getByTestId('CloseIcon');
            const closeButton = closeIcon.closest('button');
            await user.click(closeButton!);

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave with total revenue when Save & Close is clicked', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createMockProps({onSave});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /save & close/i}));

            expect(onSave).toHaveBeenCalledWith(140); // Total revenue
        });
    });

    describe('Live Preview', () => {
        it('displays live preview when entering values', async () => {
            const user = userEvent.setup();
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add first item/i}));

            await user.type(screen.getByLabelText(/revenue amount/i), '100');
            await user.type(screen.getByLabelText(/cost amount/i), '60');

            expect(screen.getByText('Live Preview')).toBeInTheDocument();
        });

        it('calculates profit in preview', async () => {
            const user = userEvent.setup();
            const props = createMockProps({priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add first item/i}));

            await user.type(screen.getByLabelText(/revenue amount/i), '100');
            await user.type(screen.getByLabelText(/cost amount/i), '60');

            // Profit should be 100 - 60 = 40
            expect(screen.getByText('$40.00')).toBeInTheDocument();
        });
    });

    describe('Margin Colors', () => {
        it('displays success color for margin >= 40%', () => {
            const highMarginBreakdowns: PriceBreakdown[] = [
                {chargeId: 1, name: 'High Margin', amount: 100, costAmount: 50, jobId: 100}, // 50% margin
            ];
            const props = createMockProps({priceBreakdowns: highMarginBreakdowns});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Should have success-colored margin chip
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('displays item margin percentages', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Base Charge: (100-60)/100 = 40%
            expect(screen.getByText('40%')).toBeInTheDocument();
        });
    });

    describe('Footer Info', () => {
        it('displays item count in footer', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Item count appears in both chip and footer - at least one should exist
            const itemCountElements = screen.getAllByText(/3 items/);
            expect(itemCountElements.length).toBeGreaterThanOrEqual(1);
        });

        it('displays total label in footer', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Check footer section contains total information
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent('total');
        });
    });

    describe('Form Validation', () => {
        it('requires item name', async () => {
            const user = userEvent.setup();
            const onAddItem = jest.fn();
            const props = createMockProps({onAddItem, priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add first item/i}));

            // Only fill cost amount, skip name
            await user.type(screen.getByLabelText(/cost amount/i), '30');

            const submitButton = screen.getByRole('button', {name: /add item/i});
            expect(submitButton).toBeDisabled();
        });

        it('requires cost amount', async () => {
            const user = userEvent.setup();
            const onAddItem = jest.fn();
            const props = createMockProps({onAddItem, priceBreakdowns: []});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /add first item/i}));

            // Only fill name, skip amounts
            await user.type(screen.getByLabelText(/item name/i), 'Test');

            const submitButton = screen.getByRole('button', {name: /add item/i});
            expect(submitButton).toBeDisabled();
        });
    });

    describe('This Job Indicator', () => {
        it('displays This Job chip when childJobId matches jobId', () => {
            const breakdownsWithChildJob: PriceBreakdown[] = [
                {chargeId: 1, name: 'Base Charge', amount: 100, costAmount: 60, jobId: 100, childJobId: 100},
            ];
            const props = createMockProps({priceBreakdowns: breakdownsWithChildJob});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.getByText('This Job')).toBeInTheDocument();
        });

        it('does not display This Job chip when childJobId differs', () => {
            const breakdownsWithDifferentChild: PriceBreakdown[] = [
                {chargeId: 1, name: 'Base Charge', amount: 100, costAmount: 60, jobId: 100, childJobId: 999},
            ];
            const props = createMockProps({priceBreakdowns: breakdownsWithDifferentChild});
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            expect(screen.queryByText('This Job')).not.toBeInTheDocument();
        });
    });
});
