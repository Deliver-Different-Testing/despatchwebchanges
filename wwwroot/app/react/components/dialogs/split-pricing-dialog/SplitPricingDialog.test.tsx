/**
 * SplitPricingDialog is now a thin wrapper around SplitPricingBreakdownDialog (mode="split") —
 * the deep behavioural coverage (share/cost editing, Confirm & Split payload shape, locks,
 * synthesised-line handling, unit labelling) lives in that shared component's own test file.
 * These tests only pin the wrapper's mapping: it renders the shared grid in split mode with the
 * given props, and passes the grid's result straight through to onClose.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {SplitPricingDialog} from './SplitPricingDialog';
import type {SplitPricingPreview} from '../../../interfaces/splitJobs';

function createPreview(overrides?: Partial<SplitPricingPreview>): SplitPricingPreview {
    return {
        basis: 'RoadMiles',
        distanceUnit: 'mi',
        parentTotalRevenue: 89,
        parentTotalCost: 50,
        isSynthesised: false,
        parentLines: [
            {pricingBreakdownId: 1, name: 'Base', revenue: 64, cost: 32, isAccessorial: false},
        ],
        legs: [
            {
                sequence: 1, letterSuffix: 'A', jobNumber: 'KT1314VA', distance: 5.6, sharePercent: 70,
                totalRevenue: 44.8, totalCost: 22.4,
                lines: [{pricingBreakdownId: 1, name: 'Base Part A', revenue: 44.8, cost: 22.4}],
            },
            {
                sequence: 2, letterSuffix: 'B', jobNumber: 'KT1314VB', distance: 2.4, sharePercent: 30,
                totalRevenue: 19.2, totalCost: 9.6,
                lines: [{pricingBreakdownId: 1, name: 'Base Part B', revenue: 19.2, cost: 9.6}],
            },
        ],
        ...overrides,
    };
}

describe('SplitPricingDialog', () => {
    it('renders the shared grid in split mode with the given job number and preview', () => {
        renderWithMantine(
            <SplitPricingDialog open jobNo="KT1314V" preview={createPreview()} onClose={jest.fn()}/>,
        );

        expect(screen.getByRole('heading', {name: 'Confirm Split Pricing'})).toBeInTheDocument();
        expect(screen.getByText(/KT1314V/)).toBeInTheDocument();
        expect(screen.getByText('Base')).toBeInTheDocument();
        expect(screen.getByText('Leg A')).toBeInTheDocument();
    });

    it('passes the shared grid’s result straight through to onClose', () => {
        const onClose = jest.fn();
        renderWithMantine(
            <SplitPricingDialog open jobNo="KT1314V" preview={createPreview()} onClose={onClose}/>,
        );

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledWith({action: 'cancel'});
    });
});
