import React from 'react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';
import {NationwideJobActionsMenu} from './NationwideJobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import {MantineTestProvider} from '../../../__testUtils__';

// Minimal job: no flags set, so the always-available + lockable actions show.
const job = {jobId: 55, jobNo: 'J55'} as unknown as DispatchJob;

function renderMenu(overrides: Partial<React.ComponentProps<typeof NationwideJobActionsMenu>> = {}) {
    return render(
        <MantineTestProvider>
            <NationwideJobActionsMenu currentJob={job} onAction={jest.fn()} {...overrides} />
        </MantineTestProvider>,
    );
}

describe('NationwideJobActionsMenu', () => {
    it('renders nothing when no job is selected', () => {
        renderMenu({currentJob: undefined});
        expect(screen.queryByRole('button', {name: 'Job actions'})).not.toBeInTheDocument();
    });

    it('has no generic "Dispatch to Courier" action, unlike Dispatch\'s menu', async () => {
        const user = setupUser();
        renderMenu();

        await user.click(screen.getByRole('button', {name: 'Job actions'}));
        expect(screen.queryByRole('menuitem', {name: 'Dispatch to Courier'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Split Job'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Swap POD'})).not.toBeInTheDocument();
    });

    it('opens the available actions and fires onAction with the action id and job', async () => {
        const user = setupUser();
        const onAction = jest.fn();
        renderMenu({onAction});

        await user.click(screen.getByRole('button', {name: 'Job actions'}));

        // Add Stop requires an agent (delivery) job, so it is hidden for a bare job.
        expect(screen.queryByRole('menuitem', {name: 'Add Stop'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Attachments'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Add Task'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Lock Job'})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Unlock Job'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('menuitem', {name: 'Lock Job'}));
        expect(onAction).toHaveBeenCalledWith('lock', job);
    });

    it('shows Add Stop for an agent job and Unlock for a locked job', async () => {
        const user = setupUser();
        const agentJob = {...job, isAgentJob: true, locked: true, invoiced: false} as unknown as DispatchJob;
        renderMenu({currentJob: agentJob});

        await user.click(screen.getByRole('button', {name: 'Job actions'}));
        expect(screen.getByRole('menuitem', {name: 'Add Stop'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Unlock Job'})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Lock Job'})).not.toBeInTheDocument();
    });
});
