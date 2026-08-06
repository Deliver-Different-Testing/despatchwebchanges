/**
 * JobDetailFab Tests
 *
 * Covers which speed-dial actions are offered for a given job state. The
 * focus here is the Restore action: it must never be offered for an archived
 * job (restore only operates on live tucJob rows and would silently no-op).
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {JobDetailFab} from './JobDetailFab';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

// Minimal job with just the fields the Restore action predicate reads.
const makeJob = (overrides: Partial<DispatchJob>): DispatchJob => ({
    id: 1,
    bulkJob: false,
    preBook: false,
    assignedCourier: {id: 5, text: 'Courier 5'},
    done: false,
    isArchived: false,
    ...overrides,
} as unknown as DispatchJob);

function renderAndOpen(job: DispatchJob) {
    const {container} = renderWithTheme(<JobDetailFab currentJob={job} onAction={jest.fn()} />);
    // Actions only render once the speed-dial is hovered open.
    fireEvent.mouseEnter(container.firstChild as Element);
}

describe('JobDetailFab — Restore action', () => {
    it('offers Restore for a live, courier-assigned, not-done job', () => {
        renderAndOpen(makeJob({}));
        expect(screen.getByLabelText('Restore Job')).toBeInTheDocument();
    });

    it('does not offer Restore for an archived job', () => {
        renderAndOpen(makeJob({isArchived: true}));
        expect(screen.queryByLabelText('Restore Job')).not.toBeInTheDocument();
    });
});

describe('JobDetailFab — Split action', () => {
    it('offers Split for a splittable job', () => {
        renderAndOpen(makeJob({allowSplit: true}));
        expect(screen.getByLabelText('Split Job')).toBeInTheDocument();
    });

    it('does not offer Split for a job that is already a leg', () => {
        // allowSplit is false server-side once a job has a parent (JobMappings.Core).
        renderAndOpen(makeJob({allowSplit: false}));
        expect(screen.queryByLabelText('Split Job')).not.toBeInTheDocument();
    });

    it('does not offer Split for an archived job', () => {
        // executeSplitJobFlow refuses archived jobs, so offering it would be a dead end.
        renderAndOpen(makeJob({allowSplit: true, isArchived: true}));
        expect(screen.queryByLabelText('Split Job')).not.toBeInTheDocument();
    });
});
