import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {setupUser} from '../../../__testUtils__/setupUser';
import {SplitPricingDialog} from './SplitPricingDialog';
import type {SplitPricingPreview} from '../../../services/splitJobApi';

const theme = createTheme();

// Mirrors the KT1314V repro: a US$89.00 / US$50.00 parent divided 70/30 by road miles.
function createPreview(overrides?: Partial<SplitPricingPreview>): SplitPricingPreview {
    return {
        basis: 'RoadMiles',
        distanceUnit: 'mi',
        parentTotalRevenue: 89,
        parentTotalCost: 50,
        isSynthesised: false,
        parentLines: [
            {pricingBreakdownId: 1, name: 'Base', revenue: 64, cost: 32, isAccessorial: false},
            {pricingBreakdownId: 2, name: 'Base Fuel', revenue: 16, cost: 12, isAccessorial: false},
            {pricingBreakdownId: 3, name: 'Congestion', revenue: 9, cost: 6, isAccessorial: true},
        ],
        legs: [
            {
                sequence: 1,
                letterSuffix: 'A',
                jobNumber: 'KT1314VA',
                distance: 5.6,
                sharePercent: 70,
                totalRevenue: 62.3,
                totalCost: 35,
                lines: [
                    {pricingBreakdownId: 1, name: 'Base Part A', revenue: 44.8, cost: 22.4},
                    {pricingBreakdownId: 2, name: 'Base Fuel Part A', revenue: 11.2, cost: 8.4},
                    {pricingBreakdownId: 3, name: 'Congestion Part A', revenue: 6.3, cost: 4.2},
                ],
            },
            {
                sequence: 2,
                letterSuffix: 'B',
                jobNumber: 'KT1314VB',
                distance: 2.4,
                sharePercent: 30,
                totalRevenue: 26.7,
                totalCost: 15,
                lines: [
                    {pricingBreakdownId: 1, name: 'Base Part B', revenue: 19.2, cost: 9.6},
                    {pricingBreakdownId: 2, name: 'Base Fuel Part B', revenue: 4.8, cost: 3.6},
                    {pricingBreakdownId: 3, name: 'Congestion Part B', revenue: 2.7, cost: 1.8},
                ],
            },
        ],
        ...overrides,
    };
}

const renderDialog = (preview: SplitPricingPreview, onClose = jest.fn()) => {
    render(
        <ThemeProvider theme={theme}>
            <SplitPricingDialog open jobNo="KT1314V" preview={preview} onClose={onClose}/>
        </ThemeProvider>,
    );
    return onClose;
};

const rowFor = (name: string) => screen.getByText(name).closest('tr');

describe('SplitPricingDialog', () => {
    it('shows each line divided across the legs, with per-leg miles, shares and totals', () => {
        renderDialog(createPreview());

        expect(screen.getByRole('heading', {name: 'Confirm Split Pricing'})).toBeInTheDocument();

        // The undivided lines are listed once and split across a column per leg.
        expect(rowFor('Base')).toHaveTextContent('$44.80');
        expect(rowFor('Base')).toHaveTextContent('$19.20');
        expect(rowFor('Congestion')).toHaveTextContent('$6.30');
        expect(rowFor('Congestion')).toHaveTextContent('$2.70');
        // Cost rides along with the revenue on the same share.
        expect(rowFor('Base')).toHaveTextContent('cost $22.40');

        expect(screen.getByText('KT1314VA')).toBeInTheDocument();
        expect(screen.getByText('5.6 mi')).toBeInTheDocument();
        expect(screen.getByText('2.4 mi')).toBeInTheDocument();
        expect(screen.getByText('70%')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();

        expect(rowFor('Leg total')).toHaveTextContent('$62.30');
        expect(rowFor('Leg total')).toHaveTextContent('$26.70');

        expect(screen.getByText('Split by road distance per leg', {exact: false})).toBeInTheDocument();
        // The invoice guarantee is stated on screen.
        expect(
            screen.getByText(/splitting does not change what the client is invoiced/i),
        ).toBeInTheDocument();
    });

    it('labels leg distances in the tenant’s own unit', () => {
        // NZ reads distance in kilometres; the server sends the figure already converted.
        renderDialog(createPreview({
            distanceUnit: 'km',
            legs: [
                {...createPreview().legs[0], distance: 9.01},
                {...createPreview().legs[1], distance: 3.86},
            ],
        }));

        expect(screen.getByText('9.01 km')).toBeInTheDocument();
        expect(screen.getByText('3.86 km')).toBeInTheDocument();
        expect(screen.queryByText(/\bmi\b/)).not.toBeInTheDocument();
    });

    it('confirms with the previewed shares and no line overrides', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 70},
                {sequence: 2, sharePercent: 30},
            ],
            lineAllocation: [],
        });
    });

    it('re-derives every line from an edited overall share, keeping the legs at 100%', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        const shareField = screen.getByLabelText('Share %');
        await user.clear(shareField);
        await user.type(shareField, '90');

        expect(screen.getByText('10%')).toBeInTheDocument();
        expect(rowFor('Base')).toHaveTextContent('$6.40');
        expect(rowFor('Congestion')).toHaveTextContent('$0.90');

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 90},
                {sequence: 2, sharePercent: 10},
            ],
            lineAllocation: [],
        });
    });

    // The point of the feature: a charge only one leg's route incurred shouldn't follow the
    // overall split. Leg A drove through the congestion zone; leg B didn't.
    it('gives a single line its own share without disturbing the others', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        const congestionShare = screen.getByLabelText('Congestion share %');
        await user.clear(congestionShare);
        await user.type(congestionShare, '100');

        expect(rowFor('Congestion')).toHaveTextContent('$9.00');
        expect(rowFor('Congestion')).toHaveTextContent('$0.00');
        // The untouched lines still follow the overall 70/30.
        expect(rowFor('Base')).toHaveTextContent('$44.80');
        expect(rowFor('Base Fuel')).toHaveTextContent('$11.20');
        // Leg totals — and therefore the effective shares — follow the lines.
        expect(rowFor('Leg total')).toHaveTextContent('$65.00');
        expect(rowFor('Leg total')).toHaveTextContent('$24.00');
        expect(screen.getByText(/1 line set apart from the overall split/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

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

    it('puts an overridden line back on the overall split when reset', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        const congestionShare = screen.getByLabelText('Congestion share %');
        await user.clear(congestionShare);
        await user.type(congestionShare, '100');
        await user.click(screen.getByRole('button', {name: 'Reset Congestion share'}));

        expect(rowFor('Congestion')).toHaveTextContent('$6.30');
        expect(rowFor('Leg total')).toHaveTextContent('$62.30');

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith(
            expect.objectContaining({action: 'confirm', lineAllocation: []}),
        );
    });

    it('cancels without an allocation', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledWith({action: 'cancel'});
    });

    it('warns when no distance was available, and offers no per-line share for a synthesised line', () => {
        renderDialog(
            createPreview({
                basis: 'EvenSplit',
                isSynthesised: true,
                parentLines: [
                    {
                        pricingBreakdownId: 0,
                        name: 'Manually Rated',
                        revenue: 89,
                        cost: 50,
                        isAccessorial: false,
                    },
                ],
            }),
        );

        expect(screen.getByText(/no distance available for either leg/i)).toBeInTheDocument();
        expect(screen.getByText(/no itemised price lines/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Manually Rated share %')).not.toBeInTheDocument();
        // The overall share still applies.
        expect(screen.getByLabelText('Share %')).toBeInTheDocument();
    });
});
