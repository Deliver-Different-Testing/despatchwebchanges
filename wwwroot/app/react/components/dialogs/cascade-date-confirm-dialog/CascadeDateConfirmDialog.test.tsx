/**
 * CascadeDateConfirmDialog Tests
 *
 * The dialog is the only thing standing between a one-job date edit and moving ten linked
 * jobs, so the counts, the opt-out, and the locked/partner exclusions are all load-bearing.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine as render} from '../../../__testUtils__';
import {CascadeDateConfirmDialog} from './CascadeDateConfirmDialog';
import type {DateCascadeFamilyMember} from '../../../services/jobDetailApi';
import {setupUser} from '../../../__testUtils__/setupUser';


function member(overrides: Partial<DateCascadeFamilyMember> & {jobId: number}): DateCascadeFamilyMember {
    return {
        jobNo: `JOB-${overrides.jobId}`,
        date: '2024-03-13T00:00:00',
        time: null,
        amount: 25,
        ratedManually: false,
        locked: false,
        isPartnerJob: false,
        cascadable: true,
        ...overrides,
    };
}

function renderDialog(overrides?: {
    members?: DateCascadeFamilyMember[];
    onChoose?: jest.Mock;
    onCancel?: jest.Mock;
    submitting?: boolean;
}) {
    const onChoose = overrides?.onChoose ?? jest.fn();
    const onCancel = overrides?.onCancel ?? jest.fn();
    render(
            <CascadeDateConfirmDialog
                open
                jobNumber="E8938MC"
                newDateLabel="12 March 2024"
                members={overrides?.members ?? [member({jobId: 101}), member({jobId: 102})]}
                submitting={overrides?.submitting}
                onCancel={onCancel}
                onChoose={onChoose}
            />
    );
    return {onChoose, onCancel};
}

describe('CascadeDateConfirmDialog', () => {
    it('lists every linked job and offers to move the whole family', async () => {
        const user = setupUser();
        const {onChoose} = renderDialog();

        expect(screen.getByText('JOB-101')).toBeInTheDocument();
        expect(screen.getByText('JOB-102')).toBeInTheDocument();
        expect(screen.getByText('12 March 2024')).toBeInTheDocument();

        // Parent + 2 children.
        await user.click(screen.getByRole('button', {name: 'Apply to all 3 jobs'}));

        expect(onChoose).toHaveBeenCalledWith('all');
    });

    it('lets the user move only the parent', async () => {
        const user = setupUser();
        const {onChoose} = renderDialog();

        await user.click(screen.getByRole('button', {name: 'This job only'}));

        expect(onChoose).toHaveBeenCalledWith('self');
    });

    it('cancels without choosing', async () => {
        const user = setupUser();
        const {onCancel, onChoose} = renderDialog();

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onCancel).toHaveBeenCalled();
        expect(onChoose).not.toHaveBeenCalled();
    });

    it('shows locked and partner legs as excluded and leaves them out of the count', () => {
        renderDialog({
            members: [
                member({jobId: 101}),
                member({jobId: 102, locked: true, cascadable: false}),
                member({jobId: 103, isPartnerJob: true, cascadable: false}),
            ],
        });

        expect(screen.getByText('Locked')).toBeInTheDocument();
        expect(screen.getByText('Managed by partner')).toBeInTheDocument();
        // Only the parent plus the one cascadable leg.
        expect(screen.getByRole('button', {name: 'Apply to all 2 jobs'})).toBeInTheDocument();
        expect(screen.getByText('2 linked jobs will not be changed.')).toBeInTheDocument();
    });

    it('disables both actions while submitting', () => {
        renderDialog({submitting: true});

        expect(screen.getByRole('button', {name: 'This job only'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });
});
