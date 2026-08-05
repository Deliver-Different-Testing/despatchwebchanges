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
        parentTotalRevenue: 89,
        parentTotalCost: 50,
        isSynthesised: false,
        legs: [
            {
                sequence: 1,
                letterSuffix: 'A',
                jobNumber: 'KT1314VA',
                miles: 5.6,
                sharePercent: 70,
                totalRevenue: 62.3,
                totalCost: 35,
                lines: [
                    {name: 'Base Part A', revenue: 44.8, cost: 22.4},
                    {name: 'Base Fuel Part A', revenue: 11.2, cost: 8.4},
                    {name: 'Congestion Part A', revenue: 6.3, cost: 4.2},
                ],
            },
            {
                sequence: 2,
                letterSuffix: 'B',
                jobNumber: 'KT1314VB',
                miles: 2.4,
                sharePercent: 30,
                totalRevenue: 26.7,
                totalCost: 15,
                lines: [
                    {name: 'Base Part B', revenue: 19.2, cost: 9.6},
                    {name: 'Base Fuel Part B', revenue: 4.8, cost: 3.6},
                    {name: 'Congestion Part B', revenue: 2.7, cost: 1.8},
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

describe('SplitPricingDialog', () => {
    it('shows each leg with its own lines, miles, share and totals, plus the unchanged job total', () => {
        renderDialog(createPreview());

        expect(screen.getByRole('heading', {name: 'Confirm Split Pricing'})).toBeInTheDocument();

        // Per-leg lines — not the parent's lines repeated on both legs.
        expect(screen.getByText('Base Part A')).toBeInTheDocument();
        expect(screen.getByText('Congestion Part A')).toBeInTheDocument();
        expect(screen.getByText('Base Part B')).toBeInTheDocument();
        expect(screen.getByText('Congestion Part B')).toBeInTheDocument();

        expect(screen.getByText('KT1314VA')).toBeInTheDocument();
        expect(screen.getByText('KT1314VB')).toBeInTheDocument();
        expect(screen.getByText('5.6 mi · 70% of the trip')).toBeInTheDocument();
        expect(screen.getByText('2.4 mi · 30% of the trip')).toBeInTheDocument();

        expect(screen.getByText('Split by road miles per leg', {exact: false})).toBeInTheDocument();
        // The invoice guarantee is stated on screen.
        expect(
            screen.getByText(/splitting does not change what the client is invoiced/i),
        ).toBeInTheDocument();
    });

    it('confirms with the previewed shares', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 70},
                {sequence: 2, sharePercent: 30},
            ],
        });
    });

    it('re-derives both legs from an edited share, keeping them at 100%', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        const shareField = screen.getByLabelText('Share %');
        await user.clear(shareField);
        await user.type(shareField, '90');

        // Leg B takes the remainder, and its figures follow the new share rather than its mileage.
        expect(screen.getByText('2.4 mi · 10% of the total')).toBeInTheDocument();
        expect(screen.getByText('Base Part B').closest('tr')).toHaveTextContent('$6.40');

        await user.click(screen.getByRole('button', {name: /confirm & split/i}));

        expect(onClose).toHaveBeenCalledWith({
            action: 'confirm',
            allocation: [
                {sequence: 1, sharePercent: 90},
                {sequence: 2, sharePercent: 10},
            ],
        });
    });

    it('cancels without an allocation', async () => {
        const user = setupUser();
        const onClose = renderDialog(createPreview());

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledWith({action: 'cancel'});
    });

    it('warns when no distance was available and flags a synthesised line', () => {
        renderDialog(createPreview({basis: 'EvenSplit', isSynthesised: true}));

        expect(
            screen.getByText(/no distance available for either leg/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/no itemised price lines/i)).toBeInTheDocument();
    });
});
