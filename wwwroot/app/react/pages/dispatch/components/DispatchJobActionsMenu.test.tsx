import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {DispatchJobActionsMenu} from './DispatchJobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

// Minimal job: no flags set, so the always-available + lockable actions show.
const job = {jobId: 55, jobNo: 'J55'} as unknown as DispatchJob;

function renderMenu(overrides: Partial<React.ComponentProps<typeof DispatchJobActionsMenu>> = {}) {
    return render(
        <ThemeProvider theme={createTheme()}>
            <DispatchJobActionsMenu currentJob={job} onAction={jest.fn()} {...overrides} />
        </ThemeProvider>,
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
        expect(screen.getByRole('menuitem', {name: 'Dispatch to Courier'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Lock Job'})).toBeInTheDocument();
        // Unlock requires a locked job, so it is hidden here.
        expect(screen.queryByRole('menuitem', {name: 'Unlock Job'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('menuitem', {name: 'Dispatch to Courier'}));
        expect(onAction).toHaveBeenCalledWith('dispatch', job);
    });
});
