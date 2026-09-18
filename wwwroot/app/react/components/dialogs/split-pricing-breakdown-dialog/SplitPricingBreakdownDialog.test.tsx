import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {SplitPricingBreakdownDialog, type EditModeProps, type SplitModeProps} from './SplitPricingBreakdownDialog';
import type {SplitPriceBreakdown, SplitPricingPreview} from '../../../interfaces/splitJobs';
import {createProps, renderWithMantine} from '../../../__testUtils__';

const workedExample: SplitPriceBreakdown = {
    jobId: 4071,
    totalRevenue: 73.00,
    totalCost: 38.00,
    grossProfit: 35.00,
    marginPercent: 47.95,
    items: [
        {
            pricingBreakdownId: 1,
            name: 'Base',
            revenue: 64.00,
            isAccessorial: false,
            allocations: [
                {legJobId: 201, sharePercent: 80, revenue: 51.20, cost: 25.60, costOverride: null, derivedCost: 25.60},
                {legJobId: 202, sharePercent: 20, revenue: 12.80, cost: 6.40, costOverride: null, derivedCost: 6.40},
            ],
        },
        {
            pricingBreakdownId: 2,
            name: 'Congestion',
            revenue: 9.00,
            isAccessorial: false,
            allocations: [
                {legJobId: 201, sharePercent: 80, revenue: 7.20, cost: 4.80, costOverride: null, derivedCost: 4.80},
                {legJobId: 202, sharePercent: 20, revenue: 1.80, cost: 1.20, costOverride: null, derivedCost: 1.20},
            ],
        },
    ],
    legs: [
        {
            jobId: 201, jobNumber: 'KT4071VA', driverName: 'Sam Driver', sharePercent: 80,
            revenue: 58.40, cost: 30.40, marginPercent: 47.9, costLocked: false, costLockReason: null,
        },
        {
            jobId: 202, jobNumber: 'KT4071VB', driverName: null, sharePercent: 20,
            revenue: 14.60, cost: 7.60, marginPercent: 47.9, costLocked: false, costLockReason: null,
        },
    ],
    locks: {revenueLocked: false, revenueLockReason: null, shareLocked: false, shareLockReason: null},
};

const defaultProps: EditModeProps = {
    mode: 'edit',
    open: true,
    breakdown: workedExample,
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    onAddItem: jest.fn().mockResolvedValue(workedExample),
    onDeleteItem: jest.fn().mockResolvedValue(workedExample),
};

const createMockProps = (overrides?: Partial<EditModeProps>) =>
    createProps(defaultProps, overrides);

describe('SplitPricingBreakdownDialog', () => {
    it('renders the worked example: header totals, leg strip, and item rows', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        expect(screen.getAllByText('$73.00').length).toBeGreaterThan(0); // summary card + footer total
        expect(screen.getByText('$38.00')).toBeInTheDocument();
        expect(screen.getByText('$35.00')).toBeInTheDocument();

        expect(screen.getByText('KT4071VA')).toBeInTheDocument();
        expect(screen.getAllByText('Sam Driver').length).toBeGreaterThan(0); // leg card + grid column header
        expect(screen.getByText('KT4071VB')).toBeInTheDocument();
        expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);

        expect(screen.getByDisplayValue('Base')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Congestion')).toBeInTheDocument();
    });

    it('shows the "Legs" heading and a 100%-shares indicator', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        expect(screen.getByText('Legs')).toBeInTheDocument();
        expect(screen.getByText('Shares total 100%')).toBeInTheDocument();
    });

    it('shows a colored leg-identity badge with the job number next to it', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        expect(screen.getByText('Leg A').parentElement).toHaveAttribute(
            'style', expect.stringContaining('background-color: var(--mantine-color-reflex-6)'),
        );
        expect(screen.getByText('Leg B').parentElement).toHaveAttribute(
            'style', expect.stringContaining('background-color: var(--mantine-color-green-7)'),
        );
        expect(screen.getByText('KT4071VA')).toBeInTheDocument();
        expect(screen.getByText('KT4071VB')).toBeInTheDocument();
    });

    it('shows the read-only-on-children banner', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        expect(screen.getByText(/managed here, on the parent job/i)).toBeInTheDocument();
    });

    it('Save & Close is disabled until something changes', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);
        expect(screen.getByRole('button', {name: /save & close/i})).toBeDisabled();
    });

    it('editing an item revenue sends the new amount on save', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.change(screen.getByLabelText('Revenue for Base'), {target: {value: '200'}});
        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0]).toMatchObject({
            jobId: 4071,
            itemRevenues: [{pricingBreakdownId: 1, revenue: 200}],
        });
    });

    it('overriding a leg cost shows "was X" with a reset, and reset clears it', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.change(screen.getByLabelText('Cost for Base, leg 201'), {target: {value: '5'}});
        expect(screen.getByText('was $25.60')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
        expect(screen.queryByText(/was \$25\.60/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0].allocations).toContainEqual(
            expect.objectContaining({pricingBreakdownId: 1, legJobId: 201, resetCostOverride: true}),
        );
    });

    it('saves a cost override without a reset when never reset', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.change(screen.getByLabelText('Cost for Base, leg 201'), {target: {value: '5'}});
        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0].allocations).toContainEqual(
            expect.objectContaining({pricingBreakdownId: 1, legJobId: 201, costOverride: 5}),
        );
    });

    it('editing a share renormalizes the other leg to sum to 100 and sends every leg', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.click(screen.getAllByRole('button', {name: '80 / 20'})[0]); // Base row
        fireEvent.change(screen.getByLabelText('KT4071VA'), {target: {value: '60'}});

        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

        const allocations = onSave.mock.calls[0][0].allocations;
        expect(allocations).toContainEqual(
            expect.objectContaining({pricingBreakdownId: 1, legJobId: 201, sharePercent: 60}),
        );
        expect(allocations).toContainEqual(
            expect.objectContaining({pricingBreakdownId: 1, legJobId: 202, sharePercent: 40}),
        );
    });

    it('"Reset to overall split" clears a per-item share override', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        fireEvent.click(screen.getAllByRole('button', {name: '80 / 20'})[0]); // Base row
        fireEvent.change(screen.getByLabelText('KT4071VA'), {target: {value: '60'}});
        expect(screen.getByRole('button', {name: /reset to overall split/i})).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /reset to overall split/i}));

        expect(screen.getByLabelText('KT4071VA')).toHaveValue('80');
        expect(screen.queryByRole('button', {name: /reset to overall split/i})).not.toBeInTheDocument();
    });

    it('renaming an item sends the new name on save', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.change(screen.getByLabelText('Name for Base'), {target: {value: 'Freight'}});
        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0].itemRevenues).toContainEqual(
            {pricingBreakdownId: 1, revenue: 64, name: 'Freight'},
        );
    });

    it('editing a leg\'s overall share rebalances its sibling and defaults every untouched item on save', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onSave})} />);

        fireEvent.change(screen.getByLabelText('Share % for KT4071VA'), {target: {value: '60'}});
        expect(screen.getByLabelText('Share % for KT4071VB')).toHaveValue('40');
        expect(screen.getByText('Shares total 100%')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /save & close/i}));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

        const allocations = onSave.mock.calls[0][0].allocations;
        [1, 2].forEach((pricingBreakdownId) => {
            expect(allocations).toContainEqual(expect.objectContaining({pricingBreakdownId, legJobId: 201, sharePercent: 60}));
            expect(allocations).toContainEqual(expect.objectContaining({pricingBreakdownId, legJobId: 202, sharePercent: 40}));
        });
    });

    it('locks revenue and Add Item when the parent is invoiced', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({
            breakdown: {
                ...workedExample,
                locks: {revenueLocked: true, revenueLockReason: 'Invoiced', shareLocked: true, shareLockReason: 'Invoiced'},
            },
        })} />);

        expect(screen.getByLabelText('Revenue for Base')).toBeDisabled();
        expect(screen.getByRole('button', {name: /add item/i})).toBeDisabled();
        expect(screen.getByLabelText('Share % for KT4071VA')).toBeDisabled();
    });

    it('locks only the settled leg\'s cost, leaving its sibling editable', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({
            breakdown: {
                ...workedExample,
                legs: [
                    {...workedExample.legs[0], costLocked: true, costLockReason: 'Settled 12 Sep'},
                    workedExample.legs[1],
                ],
            },
        })} />);

        expect(screen.getByLabelText('Cost for Base, leg 201')).toBeDisabled();
        expect(screen.getByLabelText('Cost for Base, leg 202')).not.toBeDisabled();
        expect(screen.getByText('Settled 12 Sep')).toBeInTheDocument();
    });

    it('adds an item immediately (not batched) and refreshes the grid', async () => {
        const refreshed: SplitPriceBreakdown = {
            ...workedExample,
            items: [...workedExample.items, {
                pricingBreakdownId: 3, name: 'New Item', revenue: 10, isAccessorial: false,
                allocations: [
                    {legJobId: 201, sharePercent: 80, revenue: 8, cost: 0, costOverride: null, derivedCost: 0},
                    {legJobId: 202, sharePercent: 20, revenue: 2, cost: 0, costOverride: null, derivedCost: 0},
                ],
            }],
        };
        const onAddItem = jest.fn().mockResolvedValue(refreshed);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onAddItem})} />);

        fireEvent.click(screen.getByRole('button', {name: /add item/i}));
        fireEvent.change(screen.getByLabelText(/item name/i), {target: {value: 'New Item'}});
        fireEvent.change(screen.getByLabelText(/^revenue$/i), {target: {value: '10'}});
        fireEvent.click(screen.getByRole('button', {name: 'Add'}));

        await waitFor(() => expect(onAddItem).toHaveBeenCalledWith('New Item', 10));
        expect(await screen.findByDisplayValue('New Item')).toBeInTheDocument();
    });

    it('deletes an item via confirm and refreshes the grid', async () => {
        const refreshed: SplitPriceBreakdown = {...workedExample, items: [workedExample.items[0]]};
        const onDeleteItem = jest.fn().mockResolvedValue(refreshed);
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps({onDeleteItem})} />);

        fireEvent.click(screen.getByRole('button', {name: 'Delete Congestion'}));
        fireEvent.click(screen.getByRole('button', {name: 'Delete'}));

        await waitFor(() => expect(onDeleteItem).toHaveBeenCalledWith(2));
        await waitFor(() => expect(screen.queryByDisplayValue('Congestion')).not.toBeInTheDocument());
    });

    it('footer reconciles legs back to the total', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...createMockProps()} />);

        expect(screen.getByText(/legs re-sum to/i).parentElement).toHaveTextContent('legs re-sum to $73.00 ✓');
    });
});

describe('SplitPricingBreakdownDialog — split mode', () => {
    function createPreview(overrides?: Partial<SplitPricingPreview>): SplitPricingPreview {
        return {
            basis: 'RoadMiles',
            distanceUnit: 'mi',
            parentTotalRevenue: 73,
            parentTotalCost: 38,
            isSynthesised: false,
            parentLines: [
                {pricingBreakdownId: 1, name: 'Base', revenue: 64, cost: 32, isAccessorial: false},
                {pricingBreakdownId: 3, name: 'Congestion', revenue: 9, cost: 6, isAccessorial: true},
            ],
            legs: [
                {
                    sequence: 1, letterSuffix: 'A', jobNumber: 'KT1314VA', distance: 5.6, sharePercent: 70,
                    totalRevenue: 51.1, totalCost: 27,
                    lines: [
                        {pricingBreakdownId: 1, name: 'Base Part A', revenue: 44.8, cost: 22.4},
                        {pricingBreakdownId: 3, name: 'Congestion Part A', revenue: 6.3, cost: 4.2},
                    ],
                },
                {
                    sequence: 2, letterSuffix: 'B', jobNumber: 'KT1314VB', distance: 2.4, sharePercent: 30,
                    totalRevenue: 21.9, totalCost: 11,
                    lines: [
                        {pricingBreakdownId: 1, name: 'Base Part B', revenue: 19.2, cost: 9.6},
                        {pricingBreakdownId: 3, name: 'Congestion Part B', revenue: 2.7, cost: 1.8},
                    ],
                },
            ],
            ...overrides,
        };
    }

    const splitProps = (
        preview: SplitPricingPreview,
        onClose = jest.fn(),
        legCourierNames?: (string | null)[],
    ): SplitModeProps =>
        ({mode: 'split', open: true, jobNo: 'KT1314V', preview, legCourierNames, onClose});

    it('renders the preview: header, basis banner, leg strip, and item revenue', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview())} />);

        expect(screen.getByRole('heading', {name: 'Confirm Split Pricing'})).toBeInTheDocument();
        expect(screen.getByText(/split by road distance per leg/i)).toBeInTheDocument();
        expect(screen.getByText(/splitting does not change what the client is invoiced/i)).toBeInTheDocument();

        expect(screen.getByText('Legs')).toBeInTheDocument(); // heading is always "Legs", never "Overall split"
        expect(screen.getByText('Leg A')).toBeInTheDocument();
        expect(screen.getAllByText('5.6 mi').length).toBeGreaterThan(0); // leg card + grid column header
        expect(screen.getByText('Leg B')).toBeInTheDocument();
        expect(screen.getAllByText('2.4 mi').length).toBeGreaterThan(0);

        expect(screen.getByLabelText('Revenue for Base')).toHaveValue('64');
        expect(screen.getByLabelText('Revenue for Congestion')).toHaveValue('9');
        expect(screen.getByText('rev $44.80')).toBeInTheDocument();
        expect(screen.getByText('rev $19.20')).toBeInTheDocument();
    });

    it('has no Add Item button or per-row delete — nothing to add/remove before the job exists', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview())} />);

        expect(screen.queryByRole('button', {name: /add item/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /delete/i})).not.toBeInTheDocument();
    });

    it('confirms with the previewed shares and no line overrides', () => {
        const onClose = jest.fn();
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview(), onClose)} />);

        fireEvent.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 70},
                {sequence: 2, sharePercent: 30},
            ],
            lineAllocation: [],
        });
    });

    it('cancels with {action: "cancel"}', () => {
        const onClose = jest.fn();
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview(), onClose)} />);

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledWith({action: 'cancel'});
    });

    it('gives a single line its own share, sending both legs’ shares for that line only', () => {
        const onClose = jest.fn();
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview(), onClose)} />);

        fireEvent.click(screen.getAllByRole('button', {name: '70 / 30'})[1]); // Congestion
        fireEvent.change(screen.getByLabelText('Leg A'), {target: {value: '100'}});

        expect(screen.getByText('rev $9.00')).toBeInTheDocument(); // Congestion now wholly on leg A
        expect(screen.getByText('rev $0.00')).toBeInTheDocument();
        expect(screen.getByText('rev $44.80')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 70},
                {sequence: 2, sharePercent: 30},
            ],
            lineAllocation: [
                {pricingBreakdownId: 3, sequence: 1, sharePercent: 100},
                {pricingBreakdownId: 3, sequence: 2, sharePercent: 0},
            ],
        });
    });

    it('sets a per-leg cost override at split time and carries it in the Confirm & Split payload', () => {
        const onClose = jest.fn();
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview(), onClose)} />);

        fireEvent.change(screen.getByLabelText('Cost for Base, leg 1'), {target: {value: '5'}});
        expect(screen.getByText('was $22.40')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: expect.any(Array),
            lineAllocation: [
                {pricingBreakdownId: 1, sequence: 1, sharePercent: 70, costOverride: 5},
                {pricingBreakdownId: 1, sequence: 2, sharePercent: 30},
            ],
        });
    });

    it('editing the leg-card overall share rebalances the sibling and is sent as the confirmed split', () => {
        const onClose = jest.fn();
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview(), onClose)} />);

        fireEvent.change(screen.getByLabelText('Share % for Leg A'), {target: {value: '90'}});
        expect(screen.getByLabelText('Share % for Leg B')).toHaveValue('10');

        fireEvent.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 90},
                {sequence: 2, sharePercent: 10},
            ],
            lineAllocation: [],
        });
    });

    it('shows the courier next to road distance, and "Unassigned" when none is assigned', () => {
        renderWithMantine(
            <SplitPricingBreakdownDialog {...splitProps(createPreview(), jest.fn(), ['Sam Driver', null])} />,
        );

        expect(screen.getAllByText(/road distance 5\.6 mi.*Sam Driver/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/road distance 2\.4 mi.*Unassigned/).length).toBeGreaterThan(0);
    });

    it('warns when no distance was available, for a synthesised single-line job', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview({
            basis: 'EvenSplit',
            isSynthesised: true,
            parentLines: [{pricingBreakdownId: 0, name: 'Manually Rated', revenue: 89, cost: 50, isAccessorial: false}],
            legs: createPreview().legs.map((leg) => ({
                ...leg,
                lines: [{pricingBreakdownId: 0, name: `Manually Rated Part ${leg.letterSuffix}`, revenue: 0, cost: 0}],
            })),
        }))} />);

        expect(screen.getByText(/no distance available for either leg/i)).toBeInTheDocument();
        expect(screen.getByText(/no itemised price lines/i)).toBeInTheDocument();
    });

    it('labels leg distances in the tenant’s own unit', () => {
        renderWithMantine(<SplitPricingBreakdownDialog {...splitProps(createPreview({
            distanceUnit: 'km',
            legs: createPreview().legs.map((leg) => ({...leg, distance: leg.sequence === 1 ? 9.01 : 3.86})),
        }))} />);

        expect(screen.getAllByText('9.01 km').length).toBeGreaterThan(0); // leg card + grid column header
        expect(screen.getAllByText('3.86 km').length).toBeGreaterThan(0);
        expect(screen.queryByText(/\bmi\b/)).not.toBeInTheDocument();
    });
});
