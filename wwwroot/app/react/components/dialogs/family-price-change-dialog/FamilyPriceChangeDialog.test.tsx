/**
 * FamilyPriceChangeDialog Tests
 *
 * The whole point of this dialog is that no price moves without the user saying so, and that
 * a manually-set price can never be swept up in a bulk accept.
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {FamilyPriceChangeDialog, type FamilyPriceChangeRow} from './FamilyPriceChangeDialog';
import {setupUser} from '../../../__testUtils__/setupUser';

const theme = createTheme();

const rows: FamilyPriceChangeRow[] = [
    {jobId: 1, jobNo: 'E8938MC', oldPrice: 120, newPrice: 135, ratedManually: false},
    {jobId: 2, jobNo: 'E8938MCLHP', oldPrice: 45, newPrice: 50, ratedManually: false},
    {jobId: 3, jobNo: 'E8938MCDEL', oldPrice: 45, newPrice: 60, ratedManually: true},
];

function renderDialog(overrides?: {
    rows?: FamilyPriceChangeRow[];
    selectedIds?: Set<number>;
    isApplying?: boolean;
}) {
    const handlers = {
        onToggle: jest.fn(),
        onToggleAll: jest.fn(),
        onAcceptSelected: jest.fn(),
        onKeepAll: jest.fn(),
    };
    render(
        <ThemeProvider theme={theme}>
            <FamilyPriceChangeDialog
                open
                rows={overrides?.rows ?? rows}
                selectedIds={overrides?.selectedIds ?? new Set([1, 2])}
                isApplying={overrides?.isApplying}
                {...handlers}
            />
        </ThemeProvider>,
    );
    return handlers;
}

describe('FamilyPriceChangeDialog', () => {
    it('shows every affected job with its old and new price', () => {
        renderDialog();

        expect(screen.getByText('3 jobs affected')).toBeInTheDocument();
        expect(screen.getByText('E8938MC')).toBeInTheDocument();
        expect(screen.getByText('$120.00 → $135.00')).toBeInTheDocument();
        expect(screen.getByText('$45.00 → $50.00')).toBeInTheDocument();
    });

    it('labels the confirm button with the number selected', () => {
        renderDialog();

        expect(screen.getByRole('button', {name: /Accept selected \(2\)/})).toBeInTheDocument();
    });

    it('never lets a manually-priced job be selected', () => {
        renderDialog();

        expect(screen.getByText('Manual price')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'Update price for E8938MCDEL'})).toBeDisabled();
    });

    it('toggles a single row', async () => {
        const user = setupUser();
        const {onToggle} = renderDialog();

        await user.click(screen.getByRole('checkbox', {name: 'Update price for E8938MCLHP'}));

        expect(onToggle).toHaveBeenCalledWith(2);
    });

    it('toggles all selectable rows at once', async () => {
        const user = setupUser();
        const {onToggleAll} = renderDialog();

        await user.click(screen.getByRole('checkbox', {name: 'Select all price changes'}));

        expect(onToggleAll).toHaveBeenCalled();
    });

    it('keeps every price when the user declines', async () => {
        const user = setupUser();
        const {onKeepAll, onAcceptSelected} = renderDialog();

        await user.click(screen.getByRole('button', {name: 'Keep all'}));

        expect(onKeepAll).toHaveBeenCalled();
        expect(onAcceptSelected).not.toHaveBeenCalled();
    });

    it('disables accept when nothing is selected', () => {
        renderDialog({selectedIds: new Set()});

        expect(screen.getByRole('button', {name: /Accept selected \(0\)/})).toBeDisabled();
    });
});
