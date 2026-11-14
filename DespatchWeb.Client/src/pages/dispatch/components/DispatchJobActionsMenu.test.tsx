import React from 'react';
import { setupUser } from '../../../test/utils/setupUser';
import {render, screen} from '@testing-library/react';
import {DispatchJobActionsMenu} from './DispatchJobActionsMenu';
import type {DispatchJob} from '../../../types/dispatchJob';
import {MantineTestProvider} from '../../../test/utils';
import {
    itHidesAccessorialChargesForNetworkPartner,
    itHidesActionForNetworkPartner,
} from './/accessorialChargesVisibility.testHelpers';

// Minimal job: no flags set, so the always-available + lockable actions show.
const job = {jobId: 55, jobNo: 'J55'} as unknown as DispatchJob;

function renderMenu(overrides: Partial<React.ComponentProps<typeof DispatchJobActionsMenu>> = {}) {
    return render(
        <MantineTestProvider>
            <DispatchJobActionsMenu currentJob={job} onAction={vi.fn()} {...overrides} />
        </MantineTestProvider>,
    );
}

describe('DispatchJobActionsMenu', () => {
    it('renders nothing when no job is selected', () => {
        renderMenu({currentJob: undefined});
        expect(screen.queryByRole('button', {name: 'Job actions'})).not.toBeInTheDocument();
    });

    it('opens the available actions and fires onAction with the action id and job', async () => {
        const user = setupUser();
        const onAction = vi.fn();
        renderMenu({onAction});

        await user.click(screen.getByRole('button', {name: 'Job actions'}));

        // A bare job exposes the always-available actions plus Lock.
        expect(screen.getByRole('menuitem', {name: 'Dispatch to courier'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Lock job'})).toBeInTheDocument();
        // Unlock requires a locked job, so it is hidden here.
        expect(screen.queryByRole('menuitem', {name: 'Unlock job'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('menuitem', {name: 'Dispatch to courier'}));
        expect(onAction).toHaveBeenCalledWith('dispatch', job);
    });

    itHidesAccessorialChargesForNetworkPartner(renderMenu, job);
    itHidesActionForNetworkPartner(renderMenu, {...job, allowSplit: true} as unknown as DispatchJob, 'Split job');
});
