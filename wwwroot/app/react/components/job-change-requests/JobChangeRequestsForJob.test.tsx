/** @jest-environment jest-environment-jsdom */
/**
 * JobChangeRequestsForJob Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {JobChangeRequestsForJob} from './JobChangeRequestsForJob';
import {renderWithTheme} from '../../__testUtils__';
import {jobChangeRequestApi, type JobChangeRequestDto} from '../../services/jobChangeRequestApi';

jest.mock('../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        forJob: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
    },
}));

const mockApi = jobChangeRequestApi as jest.Mocked<typeof jobChangeRequestApi>;

const baseRow: JobChangeRequestDto = {
    id: 1,
    jobId: 42,
    sourceRequestUuid: 'a1',
    origin: 'Peer',
    requestingPartyType: 'PartnerTenant',
    approvalPartyType: 'OwnerTenant',
    fieldName: 'Quantity',
    currentValue: '3',
    requestedValue: '5',
    reason: 'extra package',
    status: 'Pending',
    approvalMode: 'Manual',
    requiresCommercialRefresh: true,
    requestedAt: '2026-05-12T00:00:00Z',
};

describe('JobChangeRequestsForJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when no requests exist for the job', async () => {
        mockApi.forJob.mockResolvedValueOnce([]);
        renderWithTheme(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => {
            expect(screen.getByText(/No partner change requests/)).toBeInTheDocument();
        });
        expect(mockApi.forJob).toHaveBeenCalledWith(42);
    });

    it('shows the from → to delta and reason for each row', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithTheme(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => {
            expect(screen.getByText('Quantity')).toBeInTheDocument();
        });
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('extra package')).toBeInTheDocument();
    });

    it('shows Approve / Reject when local party is the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithTheme(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /Approve/})).toBeInTheDocument();
        });
        expect(screen.getByRole('button', {name: /Reject/})).toBeInTheDocument();
    });

    it('shows "Awaiting partner" pill when local party is not the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithTheme(<JobChangeRequestsForJob jobId={42} localPartyType="PartnerTenant"/>);

        await waitFor(() => {
            expect(screen.getByText(/Awaiting partner/)).toBeInTheDocument();
        });
        expect(screen.queryByRole('button', {name: /Approve/})).not.toBeInTheDocument();
    });

    it('clicking Approve calls the API, reloads, and fires onChanged', async () => {
        const user = userEvent.setup();
        const onChanged = jest.fn();
        mockApi.forJob.mockResolvedValueOnce([baseRow]).mockResolvedValueOnce([]);
        mockApi.approve.mockResolvedValueOnce({success: true});

        renderWithTheme(<JobChangeRequestsForJob jobId={42} onChanged={onChanged}/>);
        await waitFor(() => expect(screen.getByRole('button', {name: /Approve/})).toBeInTheDocument());

        await user.click(screen.getByRole('button', {name: /Approve/}));

        await waitFor(() => {
            expect(mockApi.approve).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
        });
        await waitFor(() => {
            expect(screen.getByText(/No partner change requests/)).toBeInTheDocument();
        });
        expect(onChanged).toHaveBeenCalled();
    });

    it('does not show actions for non-Pending rows', async () => {
        mockApi.forJob.mockResolvedValueOnce([
            {...baseRow, status: 'Applied'},
        ]);
        renderWithTheme(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument());
        expect(screen.queryByRole('button', {name: /Approve/})).not.toBeInTheDocument();
        expect(screen.queryByText(/Awaiting partner/)).not.toBeInTheDocument();
    });
});
