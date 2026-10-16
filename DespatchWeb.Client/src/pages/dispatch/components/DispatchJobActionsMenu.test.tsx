import React from 'react';
import { setupUser } from '../../../test/utils/setupUser';
import {render, screen} from '@testing-library/react';
import {DispatchJobActionsMenu} from './DispatchJobActionsMenu';
import type {DispatchJob} from '../../../types/dispatchJob';
import {MantineTestProvider} from '../../../test/utils';

// Minimal job: no flags set, so the always-available + lockable actions show.
const job = {jobId: 55, jobNo: 'J55'} as unknown as DispatchJob;

function renderMenu(overrides: Partial<React.ComponentProps<typeof DispatchJobActionsMenu>> = {}) {
    return render(
        <MantineTestProvider>
            <DispatchJobActionsMenu currentJob={job} onAction={jest.fn()} {...overrides} />
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
        const onAction = jest.fn();
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

    // Accessorials are tenant pricing to manage, not something a partner needs - and the dialog
    // renders raw tenant amounts with no NP masking, so the action must not even be reachable.
    it('hides Accessorial Charges for a network partner session, shows it otherwise', async () => {
        const user = setupUser();
        const jobWithAccessorials = {...job, accessorialChargeGroupId: 9} as unknown as DispatchJob;

        renderMenu({currentJob: jobWithAccessorials});
        await user.click(screen.getByRole('button', {name: 'Job actions'}));
        expect(screen.getByRole('menuitem', {name: 'Accessorial charges'})).toBeInTheDocument();

        (window as any).IsNetworkPartner = true;
        try {
            renderMenu({currentJob: jobWithAccessorials});
            const [, npMenuButton] = screen.getAllByRole('button', {name: 'Job actions'});
            await user.click(npMenuButton);
            expect(screen.queryByRole('menuitem', {name: 'Accessorial charges'})).not.toBeInTheDocument();
        } finally {
            (window as any).IsNetworkPartner = undefined;
        }
    });
});
