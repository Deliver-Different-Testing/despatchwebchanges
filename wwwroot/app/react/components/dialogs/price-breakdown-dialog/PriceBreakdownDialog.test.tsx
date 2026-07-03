/**
 * PriceBreakdownDialog Component Tests
 *
 * Optimised: read-only tests share a single render to cut jsdom overhead.
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {PriceBreakdown, PriceBreakdownDialog, PriceBreakdownDialogProps} from './PriceBreakdownDialog';
import {createProps, renderWithTheme} from '../../../__testUtils__';

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
        window.confirm = jest.fn().mockImplementation(() => true);
    });

    // ── Read-only: default props (single render) ─────────────────────
    describe('Default render', () => {
        it('renders dialog structure, summary cards, price items table and footer', () => {
            const props = createMockProps();
            renderWithTheme(<PriceBreakdownDialog {...props} />);

            // Dialog chrome
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Price Breakdown')).toBeInTheDocument();
            expect(screen.getByText('Manage pricing components for this job')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save & close/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /add item/i})).toBeInTheDocument();

            // Summary cards
            expect(screen.getByText('Total Revenue')).toBeInTheDocument();
            expect(screen.getByText('Total Cost')).toBeInTheDocument();
            expect(screen.getByText('Gross Profit')).toBeInTheDocument();
            // 100 + 25 + 15 = 140
            expect(screen.getAllByText('$140.00').length).toBeGreaterThanOrEqual(1);
            // 60 + 10 + 5 = 75
            expect(screen.getByText('$75.00')).toBeInTheDocument();
            // 140 - 75 = 65
            expect(screen.getByText('$65.00')).toBeInTheDocument();
            // (65/140) * 100 = 46.4%
            expect(screen.getByText(/46\.4% margin/)).toBeInTheDocument();

            // Price items table
            expect(screen.getByText('Price Items')).toBeInTheDocument();
            expect(screen.getByText('3 items')).toBeInTheDocument();
            expect(screen.getByText('Item Name')).toBeInTheDocument();
            expect(screen.getByText('Revenue')).toBeInTheDocument();
            expect(screen.getByText('Cost')).toBeInTheDocument();
            expect(screen.getByText('Profit')).toBeInTheDocument();
            expect(screen.getByText('Margin')).toBeInTheDocument();
            expect(screen.getByText('Actions')).toBeInTheDocument();
            expect(screen.getByText('Base Charge')).toBeInTheDocument();
            expect(screen.getByText('Rush Fee')).toBeInTheDocument();
            expect(screen.getByText('Weekend Surcharge')).toBeInTheDocument();
            expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$25.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$15.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$60.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$10.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('$5.00').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByTestId('EditIcon')).toHaveLength(3);
            expect(screen.getAllByTestId('DeleteIcon')).toHaveLength(3);

            // Margin percentages
            // Base Charge: (100-60)/100 = 40%
            expect(screen.getByText('40%')).toBeInTheDocument();

            // Footer
            const itemCountElements = screen.getAllByText(/3 items/);
            expect(itemCountElements.length).toBeGreaterThanOrEqual(1);
            expect(screen.getByRole('dialog')).toHaveTextContent('total');
        });
    });

    it('does not render dialog when open is false', () => {
        renderWithTheme(<PriceBreakdownDialog {...createMockProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // ── Read-only: empty state (single render) ──────────────────────
    describe('Empty State', () => {
        it('displays empty state UI without summary cards', () => {
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({priceBreakdowns: []})} />);

            expect(screen.getByText('No price items yet')).toBeInTheDocument();
            expect(screen.getByText('Start by adding your first price breakdown item')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /add first item/i})).toBeInTheDocument();
            expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
        });
    });

    // ── Read-only: margin colours (single render) ───────────────────
    describe('Margin Colors', () => {
        it('displays success color for high margin', () => {
            const highMarginBreakdowns: PriceBreakdown[] = [
                {chargeId: 1, name: 'High Margin', amount: 100, costAmount: 50, jobId: 100},
            ];
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({priceBreakdowns: highMarginBreakdowns})} />);
            expect(screen.getByText('50%')).toBeInTheDocument();
        });
    });

    // ── This Job Indicator ───────────────────────────────────────────
    describe('This Job Indicator', () => {
        it('displays This Job chip when childJobId matches jobId', () => {
            const breakdowns: PriceBreakdown[] = [
                {chargeId: 1, name: 'Base Charge', amount: 100, costAmount: 60, jobId: 100, childJobId: 100},
            ];
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({priceBreakdowns: breakdowns})} />);
            expect(screen.getByText('This Job')).toBeInTheDocument();
        });

        it('does not display This Job chip when childJobId differs', () => {
            const breakdowns: PriceBreakdown[] = [
                {chargeId: 1, name: 'Base Charge', amount: 100, costAmount: 60, jobId: 100, childJobId: 999},
            ];
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({priceBreakdowns: breakdowns})} />);
            expect(screen.queryByText('This Job')).not.toBeInTheDocument();
        });
    });

    // ── Add Item ─────────────────────────────────────────────────────
    describe('Add Item', () => {
        it('shows add form with fields when Add Item is clicked', async () => {
            renderWithTheme(<PriceBreakdownDialog {...createMockProps()} />);

            fireEvent.click(screen.getByRole('button', {name: /add item/i}));

            expect(screen.getByText('Add New Price Item')).toBeInTheDocument();
            expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/revenue amount/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/cost amount/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /^cancel$/i})).toBeInTheDocument();
            expect(screen.getAllByRole('button', {name: /add item/i}).length).toBeGreaterThan(0);
        });

        it('calls onAddItem when form is submitted', async () => {
            const onAddItem = jest.fn().mockResolvedValue(4);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onAddItem, priceBreakdowns: []})} />);

            fireEvent.click(screen.getByRole('button', {name: /add first item/i}));
            fireEvent.change(screen.getByLabelText(/item name/i), {target: {value: 'New Charge'}});
            fireEvent.change(screen.getByLabelText(/revenue amount/i), {target: {value: '50'}});
            fireEvent.change(screen.getByLabelText(/cost amount/i), {target: {value: '30'}});
            fireEvent.click(screen.getByRole('button', {name: /add item/i}));

            await waitFor(() => {
                expect(onAddItem).toHaveBeenCalled();
            });
        });

        it('cancels add mode when Cancel is clicked', async () => {
            renderWithTheme(<PriceBreakdownDialog {...createMockProps()} />);

            fireEvent.click(screen.getByRole('button', {name: /add item/i}));
            expect(screen.getByText('Add New Price Item')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: /^cancel$/i}));
            expect(screen.queryByText('Add New Price Item')).not.toBeInTheDocument();
        });
    });

    // ── Edit Item ────────────────────────────────────────────────────
    describe('Edit Item', () => {
        it('shows edit form populated with item values', async () => {
            renderWithTheme(<PriceBreakdownDialog {...createMockProps()} />);

            fireEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);

            expect(screen.getByText('Edit Price Item')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Base Charge')).toBeInTheDocument();
            expect(screen.getByDisplayValue('100')).toBeInTheDocument();
            expect(screen.getByDisplayValue('60')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('calls onUpdateItem when form is submitted', async () => {
            const onUpdateItem = jest.fn().mockResolvedValue(undefined);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onUpdateItem})} />);

            fireEvent.click(screen.getAllByTestId('EditIcon')[0].closest('button')!);
            const nameInput = screen.getByDisplayValue('Base Charge');
            fireEvent.change(nameInput, {target: {value: 'Updated Charge'}});
            fireEvent.click(screen.getByRole('button', {name: /save changes/i}));

            await waitFor(() => {
                expect(onUpdateItem).toHaveBeenCalled();
            });
        });
    });

    // ── Delete Item ──────────────────────────────────────────────────
    describe('Delete Item', () => {
        it('opens in-dialog confirmation and calls onDeleteItem when confirmed', async () => {
            const onDeleteItem = jest.fn().mockResolvedValue(undefined);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onDeleteItem})} />);

            fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

            expect(screen.getByText('Delete price item?')).toBeInTheDocument();
            expect(screen.getByText(/Base Charge.*will be removed/)).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(onDeleteItem).toHaveBeenCalledWith(1, 100, false);
            });
        });

        it('does not delete when Cancel is clicked on the confirmation', async () => {
            const onDeleteItem = jest.fn();
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onDeleteItem})} />);

            fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);
            expect(screen.getByText('Delete price item?')).toBeInTheDocument();

            const cancelButtons = screen.getAllByRole('button', {name: /^cancel$/i});
            fireEvent.click(cancelButtons[cancelButtons.length - 1]);

            expect(onDeleteItem).not.toHaveBeenCalled();
            await waitFor(() => {
                expect(screen.queryByText('Delete price item?')).not.toBeInTheDocument();
            });
        });

        it('passes isArchived to onDeleteItem', async () => {
            const onDeleteItem = jest.fn().mockResolvedValue(undefined);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onDeleteItem, isArchived: true})} />);

            fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);
            fireEvent.click(screen.getByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(onDeleteItem).toHaveBeenCalledWith(1, 100, true);
            });
        });
    });

    // ── Toast Notifications ──────────────────────────────────────────
    describe('Toast Notifications', () => {
        it('fires success toast on delete', async () => {
            const showToast = jest.fn();
            const onDeleteItem = jest.fn().mockResolvedValue(undefined);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onDeleteItem, showToast})} />);

            fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);
            fireEvent.click(screen.getByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/Deleted.*Base Charge/), 'success');
            });
        });

        it('fires error toast on delete failure', async () => {
            const showToast = jest.fn();
            const onDeleteItem = jest.fn().mockRejectedValue(new Error('boom'));
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onDeleteItem, showToast})} />);

            fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);
            fireEvent.click(screen.getByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('boom', 'error');
            });
        });

        it('fires success toast on add', async () => {
            const showToast = jest.fn();
            const onAddItem = jest.fn().mockResolvedValue(99);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onAddItem, showToast, priceBreakdowns: []})} />);

            fireEvent.click(screen.getByRole('button', {name: /add first item/i}));
            fireEvent.change(screen.getByLabelText(/item name/i), {target: {value: 'New Charge'}});
            fireEvent.click(screen.getByRole('button', {name: /add item/i}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/Added.*New Charge/), 'success');
            });
        });

        it('fires error toast on add failure', async () => {
            const showToast = jest.fn();
            const onAddItem = jest.fn().mockRejectedValue(new Error('nope'));
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onAddItem, showToast, priceBreakdowns: []})} />);

            fireEvent.click(screen.getByRole('button', {name: /add first item/i}));
            fireEvent.change(screen.getByLabelText(/item name/i), {target: {value: 'New Charge'}});
            fireEvent.click(screen.getByRole('button', {name: /add item/i}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('nope', 'error');
            });
        });
    });

    // ── Close / Save ─────────────────────────────────────────────────
    describe('Close Functionality', () => {
        it('calls onClose when close button or Cancel is clicked', async () => {
            const onClose = jest.fn();
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onClose})} />);

            fireEvent.click(screen.getByTestId('CloseIcon').closest('button')!);
            expect(onClose).toHaveBeenCalledTimes(1);

            onClose.mockClear();
            fireEvent.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave with total revenue when Save & Close is clicked', async () => {
            const onSave = jest.fn();
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onSave})} />);

            fireEvent.click(screen.getByRole('button', {name: /save & close/i}));
            expect(onSave).toHaveBeenCalledWith(140);
        });
    });

    // ── Live Preview ─────────────────────────────────────────────────
    describe('Live Preview', () => {
        it('displays live preview with calculated profit', async () => {
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({priceBreakdowns: []})} />);

            fireEvent.click(screen.getByRole('button', {name: /add first item/i}));
            fireEvent.change(screen.getByLabelText(/revenue amount/i), {target: {value: '100'}});
            fireEvent.change(screen.getByLabelText(/cost amount/i), {target: {value: '60'}});

            expect(screen.getByText('Live Preview')).toBeInTheDocument();
            // Profit should be 100 - 60 = 40
            expect(screen.getByText('$40.00')).toBeInTheDocument();
        });
    });

    // ── Form Validation ──────────────────────────────────────────────
    describe('Form Validation', () => {
        it('requires only item name; cost defaults to 0', async () => {
            const onAddItem = jest.fn().mockResolvedValue(99);
            renderWithTheme(<PriceBreakdownDialog {...createMockProps({onAddItem, priceBreakdowns: []})} />);

            fireEvent.click(screen.getByRole('button', {name: /add first item/i}));

            // Submit button disabled when name is missing, even with cost filled
            fireEvent.change(screen.getByLabelText(/cost amount/i), {target: {value: '30'}});
            expect(screen.getByRole('button', {name: /add item/i})).toBeDisabled();

            // With a name filled and cost cleared, submit becomes enabled
            fireEvent.change(screen.getByLabelText(/cost amount/i), {target: {value: ''}});
            fireEvent.change(screen.getByLabelText(/item name/i), {target: {value: 'Only Name'}});
            const submit = screen.getByRole('button', {name: /add item/i});
            expect(submit).toBeEnabled();

            fireEvent.click(submit);
            await waitFor(() => {
                expect(onAddItem).toHaveBeenCalledWith(expect.objectContaining({
                    name: 'Only Name',
                    costAmount: 0,
                }));
            });
        });
    });
});
