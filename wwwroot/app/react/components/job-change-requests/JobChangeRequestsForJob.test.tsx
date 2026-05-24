/** @jest-environment jest-environment-jsdom */
/**
 * JobChangeRequestsForJob Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {JobChangeRequestsForJob} from './JobChangeRequestsForJob';
import {renderWithProviders} from '../../__testUtils__';
import {jobChangeRequestApi, type JobChangeRequestDto} from '../../services/jobChangeRequestApi';

jest.mock('../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        forJob: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
        cancel: jest.fn(),
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
    requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago — fresh
};

function rowAged(hours: number, overrides: Partial<JobChangeRequestDto> = {}): JobChangeRequestDto {
    return {
        ...baseRow,
        ...overrides,
        requestedAt: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
    };
}

describe('JobChangeRequestsForJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when no requests exist for the job', async () => {
        mockApi.forJob.mockResolvedValueOnce([]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => {
            expect(screen.getByText(/No partner change requests/)).toBeInTheDocument();
        });
        expect(mockApi.forJob).toHaveBeenCalledWith(42);
    });

    it('shows the human-readable field label, delta, and reason', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => {
            expect(screen.getByText('Quantity')).toBeInTheDocument();
        });
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        // Reason is wrapped in curly quotes — use a regex match.
        expect(screen.getByText(/extra package/)).toBeInTheDocument();
    });

    it('renders the address payload as a one-line readable string instead of JSON', async () => {
        mockApi.forJob.mockResolvedValueOnce([{
            ...baseRow,
            fieldName: 'PickupAddress',
            currentValue: JSON.stringify({addressLine1: '99 Old St', addressLine4: 'Auckland'}),
            requestedValue: JSON.stringify({addressLine1: '123 New Rd', addressLine4: 'Wellington', fullAddress: '123 New Rd, Wellington'}),
        }]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => expect(screen.getByText('Pickup Address')).toBeInTheDocument());
        // Full address uses the fullAddress field when present.
        expect(screen.getByText(/123 New Rd, Wellington/)).toBeInTheDocument();
        // Old value falls back to joined lines.
        expect(screen.getByText(/99 Old St/)).toBeInTheDocument();
    });

    it('renders the agreed rate value as currency', async () => {
        mockApi.forJob.mockResolvedValueOnce([{
            ...baseRow,
            fieldName: 'PartnerAgreedRate',
            currentValue: '150',
            requestedValue: '185.50',
        }]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        await waitFor(() => expect(screen.getByText('Agreed Rate')).toBeInTheDocument());
        // formatCurrency emits a $ prefix; matcher avoids locale-specific exact text.
        expect(screen.getByText(/\$150/)).toBeInTheDocument();
        expect(screen.getByText(/\$185\.50/)).toBeInTheDocument();
    });

    it('shows Approve / Reject when local party is the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /Approve/})).toBeInTheDocument();
        });
        expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument();
    });

    it('shows "Awaiting partner" pill when local party is not the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="PartnerTenant"/>);

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

        renderWithProviders(<JobChangeRequestsForJob jobId={42} onChanged={onChanged}/>);
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

    describe('reject with reason', () => {
        it('clicking Reject opens an inline reason input instead of firing immediately', async () => {
            const user = userEvent.setup();
            mockApi.forJob.mockResolvedValueOnce([baseRow]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument());

            await user.click(screen.getByRole('button', {name: /^Reject$/}));

            expect(screen.getByLabelText(/Reason for rejection/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Confirm reject/})).toBeInTheDocument();
            // The API has NOT been called yet.
            expect(mockApi.reject).not.toHaveBeenCalled();
        });

        it('Confirm reject submits the reason and refetches', async () => {
            const user = userEvent.setup();
            mockApi.forJob.mockResolvedValueOnce([baseRow]).mockResolvedValueOnce([
                {...baseRow, status: 'Rejected'},
            ]);
            mockApi.reject.mockResolvedValueOnce({success: true});

            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument());

            await user.click(screen.getByRole('button', {name: /^Reject$/}));
            await user.type(screen.getByLabelText(/Reason for rejection/i), 'rate too low');
            await user.click(screen.getByRole('button', {name: /Confirm reject/}));

            await waitFor(() => {
                expect(mockApi.reject).toHaveBeenCalledWith({
                    requestId: 1,
                    rowVersion: undefined,
                    reason: 'rate too low',
                });
            });
        });

        it('Back returns to the row state without calling the API', async () => {
            const user = userEvent.setup();
            mockApi.forJob.mockResolvedValueOnce([baseRow]);

            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument());

            await user.click(screen.getByRole('button', {name: /^Reject$/}));
            await user.click(screen.getByRole('button', {name: /^Back$/}));

            expect(screen.queryByLabelText(/Reason for rejection/i)).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument();
            expect(mockApi.reject).not.toHaveBeenCalled();
        });
    });

    describe('modify own pending request', () => {
        it('cancels the existing row and invokes onModifyRequest with the field + value', async () => {
            const user = userEvent.setup();
            const onModifyRequest = jest.fn();
            const localRow: JobChangeRequestDto = {...baseRow, origin: 'Local', approvalPartyType: 'PartnerTenant'};
            mockApi.forJob.mockResolvedValueOnce([localRow]).mockResolvedValueOnce([]);
            mockApi.cancel.mockResolvedValueOnce({success: true});

            renderWithProviders(<JobChangeRequestsForJob jobId={42} onModifyRequest={onModifyRequest}/>);
            await waitFor(() => expect(screen.getByRole('button', {name: /Modify/})).toBeInTheDocument());

            await user.click(screen.getByRole('button', {name: /Modify/}));

            await waitFor(() => {
                expect(mockApi.cancel).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
            });
            expect(onModifyRequest).toHaveBeenCalledWith({fieldName: 'Quantity', requestedValue: '5'});
        });

        it('does not show the Modify button when onModifyRequest is not supplied', async () => {
            const localRow: JobChangeRequestDto = {...baseRow, origin: 'Local', approvalPartyType: 'PartnerTenant'};
            mockApi.forJob.mockResolvedValueOnce([localRow]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByRole('button', {name: /^Cancel$/})).toBeInTheDocument());
            expect(screen.queryByRole('button', {name: /Modify/})).not.toBeInTheDocument();
        });
    });

    describe('aging chips', () => {
        it('shows no aging chip for fresh requests (< 24h)', async () => {
            mockApi.forJob.mockResolvedValueOnce([rowAged(2)]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByText('Quantity')).toBeInTheDocument());
            expect(screen.queryByText(/Review soon/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
        });

        it('shows "Review soon" for requests aged 24h–72h', async () => {
            mockApi.forJob.mockResolvedValueOnce([rowAged(48)]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByText('Quantity')).toBeInTheDocument());
            expect(screen.getByText(/Review soon/)).toBeInTheDocument();
        });

        it('shows "Overdue" for requests aged > 72h', async () => {
            mockApi.forJob.mockResolvedValueOnce([rowAged(100)]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByText('Quantity')).toBeInTheDocument());
            expect(screen.getByText(/Overdue/)).toBeInTheDocument();
        });

        it('omits aging chips on non-Pending rows', async () => {
            mockApi.forJob.mockResolvedValueOnce([{...rowAged(100), status: 'Applied'}]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument());
            expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
        });
    });

    it('does not show actions for non-Pending rows', async () => {
        mockApi.forJob.mockResolvedValueOnce([
            {...baseRow, status: 'Applied'},
        ]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        await waitFor(() => expect(screen.getByText('Applied')).toBeInTheDocument());
        expect(screen.queryByRole('button', {name: /Approve/})).not.toBeInTheDocument();
        expect(screen.queryByText(/Awaiting partner/)).not.toBeInTheDocument();
    });
});
