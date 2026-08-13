/**
 * JobSearchJobActionsMenu Tests
 *
 * Covers which actions the kebab menu offers for a given job state. The focus
 * is Restore and Split: neither may be offered for an archived job (restore
 * only operates on live tucJob rows and would silently no-op; executeSplitJobFlow
 * refuses archived jobs).
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {JobSearchJobActionsMenu} from './JobSearchJobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

// Minimal job with just the fields the action predicates read.
const makeJob = (overrides: Partial<DispatchJob> = {}): DispatchJob => ({
    id: 1,
    bulkJob: false,
    preBook: false,
    assignedCourier: {id: 5, text: 'Courier 5'},
    done: false,
    isArchived: false,
    ...overrides,
} as unknown as DispatchJob);

function renderMenu(overrides: Partial<React.ComponentProps<typeof JobSearchJobActionsMenu>> = {}) {
    return render(
        <MantineTestProvider>
            <JobSearchJobActionsMenu currentJob={makeJob()} onAction={jest.fn()} {...overrides} />
        </MantineTestProvider>,
    );
}

async function openMenu(job: DispatchJob) {
    const user = setupUser();
    renderMenu({currentJob: job});
    await user.click(screen.getByRole('button', {name: 'Job actions'}));
}

describe('JobSearchJobActionsMenu', () => {
    it('renders nothing when no job is selected', () => {
        renderMenu({currentJob: undefined});
        expect(screen.queryByRole('button', {name: 'Job actions'})).not.toBeInTheDocument();
    });

    it('opens the available actions and fires onAction with the action id and job', async () => {
        const user = setupUser();
        const onAction = jest.fn();
        const job = makeJob();
        renderMenu({currentJob: job, onAction});

        await user.click(screen.getByRole('button', {name: 'Job actions'}));

        expect(screen.getByRole('menuitem', {name: 'Attachments'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Lock Job'})).toBeInTheDocument();
        // Unlock requires a locked job, so it is hidden here.
        expect(screen.queryByRole('menuitem', {name: 'Unlock Job'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('menuitem', {name: 'Attachments'}));
        expect(onAction).toHaveBeenCalledWith('attachments', job);
    });

    it('offers Restore for a live, courier-assigned, not-done job', async () => {
        await openMenu(makeJob());
        expect(screen.getByRole('menuitem', {name: 'Restore Job'})).toBeInTheDocument();
    });

    it('does not offer Restore for an archived job', async () => {
        await openMenu(makeJob({isArchived: true}));
        expect(screen.queryByRole('menuitem', {name: 'Restore Job'})).not.toBeInTheDocument();
    });

    it('offers Split for a splittable job', async () => {
        await openMenu(makeJob({allowSplit: true}));
        expect(screen.getByRole('menuitem', {name: 'Split Job'})).toBeInTheDocument();
    });

    it('does not offer Split for a job that is already a leg', async () => {
        // allowSplit is false server-side once a job has a parent (JobMappings.Core).
        await openMenu(makeJob({allowSplit: false}));
        expect(screen.queryByRole('menuitem', {name: 'Split Job'})).not.toBeInTheDocument();
    });

    it('does not offer Split for an archived job', async () => {
        await openMenu(makeJob({allowSplit: true, isArchived: true}));
        expect(screen.queryByRole('menuitem', {name: 'Split Job'})).not.toBeInTheDocument();
    });
});
