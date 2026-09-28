/**
 * JobChangeRequestsForJob Tests
 */

import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import {JobChangeRequestsForJob} from './JobChangeRequestsForJob';
import { renderWithMantineProviders as renderWithProviders } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';
import type {JobChangeRequestDto} from '../../interfaces/jobChangeRequest';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

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

/** A locally-originated pending row the current tenant owns — i.e. one it can Modify or Cancel. */
const localPendingRow: JobChangeRequestDto = {...baseRow, origin: 'Local', approvalPartyType: 'PartnerTenant'};

type PanelProps = Partial<React.ComponentProps<typeof JobChangeRequestsForJob>>;

/**
 * Renders the panel and clicks the named action button (e.g. Cancel, Reject)
 * to open its inline prompt/input. Queue any `forJob` / `cancel` / `reject`
 * mocks (and pass `onChanged` etc. via `props`) before calling — the render
 * happens here. Returns the userEvent instance for follow-up interactions.
 */
async function renderAndClick(buttonName: RegExp, props: PanelProps = {}): Promise<ReturnType<typeof userEvent.setup>> {
    const user = setupUser();
    renderWithProviders(<JobChangeRequestsForJob jobId={42} {...props}/>);
    expect(await screen.findByRole('button', {name: buttonName})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: buttonName}));
    return user;
}

/** Opens the inline "Confirm cancel" prompt for a cancelable row. */
const openCancelPrompt = (props: PanelProps = {}) => renderAndClick(/^Cancel$/, props);

/** Opens the inline rejection-reason input for an approvable row. */
const openRejectInput = (props: PanelProps = {}) => renderAndClick(/^Reject$/, props);

describe('JobChangeRequestsForJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when no requests exist for the job', async () => {
        mockApi.forJob.mockResolvedValueOnce([]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        expect(await screen.findByText(/No partner change requests/)).toBeInTheDocument();
        expect(mockApi.forJob).toHaveBeenCalledWith(42);
    });

    it('shows the human-readable field label, delta, and reason', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        expect(await screen.findByText('Quantity')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        // Reason is wrapped in curly quotes — use a regex match.
        expect(screen.getByText(/extra package/)).toBeInTheDocument();
    });

    it('renders an address row as side-by-side Current and Requested cards with multi-line addresses', async () => {
        mockApi.forJob.mockResolvedValueOnce([{
            ...baseRow,
            fieldName: 'PickupAddress',
            currentValue: JSON.stringify({addressLine1: '99 Old St', addressLine4: 'Auckland'}),
            requestedValue: JSON.stringify({addressLine1: '123 New Rd', addressLine4: 'Wellington'}),
        }]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        expect(await screen.findByText('Pickup Address')).toBeInTheDocument();

        // Two address blocks render side-by-side with overline labels.
        const currentBlock = screen.getByLabelText('Current address');
        const requestedBlock = screen.getByLabelText('Requested address');
        expect(currentBlock).toBeInTheDocument();
        expect(requestedBlock).toBeInTheDocument();

        // Each line of the address renders as its own row inside the relevant card.
        expect(within(currentBlock).getByText('99 Old St')).toBeInTheDocument();
        expect(within(currentBlock).getByText('Auckland')).toBeInTheDocument();
        expect(within(requestedBlock).getByText('123 New Rd')).toBeInTheDocument();
        expect(within(requestedBlock).getByText('Wellington')).toBeInTheDocument();
    });

    it('renders the agreed rate value as currency', async () => {
        mockApi.forJob.mockResolvedValueOnce([{
            ...baseRow,
            fieldName: 'PartnerAgreedRate',
            currentValue: '150',
            requestedValue: '185.50',
        }]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

        expect(await screen.findByText('Agreed Rate')).toBeInTheDocument();
        // formatCurrency emits a $ prefix; matcher avoids locale-specific exact text.
        expect(screen.getByText(/\$150/)).toBeInTheDocument();
        expect(screen.getByText(/\$185\.50/)).toBeInTheDocument();
    });

    it('shows Approve / Reject when local party is the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        expect(await screen.findByRole('button', {name: /Approve/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument();
    });

    it('shows "Awaiting partner" pill when local party is not the approver', async () => {
        mockApi.forJob.mockResolvedValueOnce([baseRow]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="PartnerTenant"/>);

        expect(await screen.findByText(/Awaiting partner/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Approve/})).not.toBeInTheDocument();
    });

    it('clicking Approve calls the API, reloads, and fires onChanged', async () => {
        const user = setupUser();
        const onChanged = jest.fn();
        mockApi.forJob.mockResolvedValueOnce([baseRow]).mockResolvedValueOnce([]);
        mockApi.approve.mockResolvedValueOnce({success: true});

        renderWithProviders(<JobChangeRequestsForJob jobId={42} onChanged={onChanged}/>);
        expect(await screen.findByRole('button', {name: /Approve/})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Approve/}));

        await waitFor(() => {
            expect(mockApi.approve).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
        });
        expect(await screen.findByText(/No partner change requests/)).toBeInTheDocument();
        expect(onChanged).toHaveBeenCalled();
    });

    describe('reject with reason', () => {
        it('clicking Reject opens an inline reason input instead of firing immediately', async () => {
            mockApi.forJob.mockResolvedValueOnce([baseRow]);
            await openRejectInput();

            expect(screen.getByLabelText(/Reason for rejection/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Confirm reject/})).toBeInTheDocument();
            // The API has NOT been called yet.
            expect(mockApi.reject).not.toHaveBeenCalled();
        });

        it('Confirm reject submits the reason and refetches', async () => {
            mockApi.forJob.mockResolvedValueOnce([baseRow]).mockResolvedValueOnce([
                {...baseRow, status: 'Rejected'},
            ]);
            mockApi.reject.mockResolvedValueOnce({success: true});

            const user = await openRejectInput();
            await user.click(screen.getByLabelText(/Reason for rejection/i));
            await user.paste('rate too low');
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
            mockApi.forJob.mockResolvedValueOnce([baseRow]);

            const user = await openRejectInput();
            await user.click(screen.getByRole('button', {name: /^Back$/}));

            expect(screen.queryByLabelText(/Reason for rejection/i)).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /^Reject$/})).toBeInTheDocument();
            expect(mockApi.reject).not.toHaveBeenCalled();
        });
    });

    describe('modify own pending request', () => {
        it('cancels the existing row and invokes onModifyRequest with the field + value', async () => {
            const user = setupUser();
            const onModifyRequest = jest.fn();
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]).mockResolvedValueOnce([]);
            mockApi.cancel.mockResolvedValueOnce({success: true});

            renderWithProviders(<JobChangeRequestsForJob jobId={42} onModifyRequest={onModifyRequest}/>);
            expect(await screen.findByRole('button', {name: /Modify/})).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: /Modify/}));

            await waitFor(() => {
                expect(mockApi.cancel).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
            });
            expect(onModifyRequest).toHaveBeenCalledWith({fieldName: 'Quantity', requestedValue: '5'});
        });

        it('does not show the Modify button when onModifyRequest is not supplied', async () => {
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByRole('button', {name: /^Cancel$/})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /Modify/})).not.toBeInTheDocument();
        });
    });

    describe('cancel own pending request', () => {
        it('clicking Cancel opens an inline "Confirm cancel" prompt instead of firing immediately', async () => {
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]);
            await openCancelPrompt();

            expect(screen.getByText(/Cancel this change request\?/)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Confirm cancel/})).toBeInTheDocument();
            // API not yet called — the click only opened the prompt.
            expect(mockApi.cancel).not.toHaveBeenCalled();
        });

        it('Keep request returns to the row state without calling the API', async () => {
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]);
            const user = await openCancelPrompt();

            await user.click(screen.getByRole('button', {name: /Keep request/}));

            expect(screen.queryByText(/Cancel this change request\?/)).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /^Cancel$/})).toBeInTheDocument();
            expect(mockApi.cancel).not.toHaveBeenCalled();
        });

        it('Confirm cancel calls the API, refetches, fires onChanged, and surfaces a success banner', async () => {
            const onChanged = jest.fn();
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]).mockResolvedValueOnce([
                {...localPendingRow, status: 'Cancelled'},
            ]);
            mockApi.cancel.mockResolvedValueOnce({success: true});

            const user = await openCancelPrompt({onChanged});
            await user.click(screen.getByRole('button', {name: /Confirm cancel/}));

            await waitFor(() => {
                expect(mockApi.cancel).toHaveBeenCalledWith({requestId: 1, rowVersion: undefined});
            });
            expect(onChanged).toHaveBeenCalled();
            // Explicit visible feedback so the dispatcher knows the cancel landed.
            expect(await screen.findByText(/Change request cancelled/)).toBeInTheDocument();
        });

        it('surfaces an error message when the cancel API rejects', async () => {
            mockApi.forJob.mockResolvedValueOnce([localPendingRow]);
            mockApi.cancel.mockRejectedValueOnce(new Error('Network down'));

            const user = await openCancelPrompt();
            await user.click(screen.getByRole('button', {name: /Confirm cancel/}));

            expect(await screen.findByText(/Network down/)).toBeInTheDocument();
        });
    });

    describe('aging chips', () => {
        // Nothing under the 72h "Overdue" threshold renders an aging chip — the
        // amber "Review soon" (24–72h) tier was removed, so fresh and stale rows
        // both show no chip.
        it.each<[string, number]>([
            ['fresh requests (< 24h)', 2],
            ['requests aged 24h–72h (former "Review soon" tier)', 48],
        ])('shows no aging chip for %s', async (_label, hours) => {
            mockApi.forJob.mockResolvedValueOnce([rowAged(hours)]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByText('Quantity')).toBeInTheDocument();
            expect(screen.queryByText('Review soon')).not.toBeInTheDocument();
            expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        });

        it('shows "Overdue" for requests aged > 72h', async () => {
            mockApi.forJob.mockResolvedValueOnce([rowAged(100)]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByText('Quantity')).toBeInTheDocument();
            expect(screen.getByText('Overdue')).toBeInTheDocument();
        });

        it('omits aging chips on non-Pending rows', async () => {
            mockApi.forJob.mockResolvedValueOnce([{...rowAged(100), status: 'Applied'}]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByText('Applied')).toBeInTheDocument();
            expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        });
    });

    describe('reason callout', () => {
        it('renders the reason in a labelled callout (no surrounding quote characters)', async () => {
            mockApi.forJob.mockResolvedValueOnce([
                {...baseRow, reason: 'Customer needs same-day delivery'},
            ]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

            // The "REASON" label is uppercased via CSS, so the DOM text is "Reason".
            expect(await screen.findByText('Reason')).toBeInTheDocument();
            const body = screen.getByText('Customer needs same-day delivery');
            expect(body).toBeInTheDocument();
            // The old treatment wrapped the reason in literal “smart quotes” — ensure that's gone.
            expect(body.textContent).toBe('Customer needs same-day delivery');
        });

        it('renders no reason callout when the row has no reason', async () => {
            mockApi.forJob.mockResolvedValueOnce([
                {...baseRow, reason: undefined},
            ]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByText('Quantity')).toBeInTheDocument();
            expect(screen.queryByText('Reason')).not.toBeInTheDocument();
        });
    });

    it('does not show actions for non-Pending rows', async () => {
        mockApi.forJob.mockResolvedValueOnce([
            {...baseRow, status: 'Applied'},
        ]);
        renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);

        expect(await screen.findByText('Applied')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Approve/})).not.toBeInTheDocument();
        expect(screen.queryByText(/Awaiting partner/)).not.toBeInTheDocument();
    });

    describe('timezone-aware date display', () => {
        const isoAt = '2025-03-15T14:30:00+13:00';

        it('appends the pickup timezone abbreviation to PuTime values', async () => {
            mockApi.forJob.mockResolvedValueOnce([{
                ...baseRow,
                fieldName: 'PuTime',
                currentValue: isoAt,
                requestedValue: '2025-03-15T16:00:00+13:00',
            }]);
            renderWithProviders(
                <JobChangeRequestsForJob
                    jobId={42}
                    pickUpTimezoneText="Pacific Standard Time"
                    deliveryTimezoneText="Eastern Standard Time"
                />,
            );

            expect(await screen.findByText('Pickup Time')).toBeInTheDocument();
            // Pickup-side TZ wins for PuTime — both Current and Requested chips
            // carry the pacific abbreviation (PST in winter, PDT in summer).
            const pacificChips = screen.getAllByText(/\(P[SD]T\)/);
            expect(pacificChips.length).toBeGreaterThanOrEqual(2);
            expect(screen.queryByText(/\(E[SD]T\)/)).not.toBeInTheDocument();
        });

        it('appends the delivery timezone abbreviation to DeliverBy values', async () => {
            mockApi.forJob.mockResolvedValueOnce([{
                ...baseRow,
                fieldName: 'DeliverBy',
                currentValue: isoAt,
                requestedValue: '2025-03-15T16:00:00+13:00',
            }]);
            renderWithProviders(
                <JobChangeRequestsForJob
                    jobId={42}
                    pickUpTimezoneText="Pacific Standard Time"
                    deliveryTimezoneText="Eastern Standard Time"
                />,
            );

            expect(await screen.findByText('Deliver By')).toBeInTheDocument();
            // Delivery-side TZ wins for DeliverBy — both chips carry the
            // eastern abbreviation (EST in winter, EDT in summer).
            const easternChips = screen.getAllByText(/\(E[SD]T\)/);
            expect(easternChips.length).toBeGreaterThanOrEqual(2);
            expect(screen.queryByText(/\(P[SD]T\)/)).not.toBeInTheDocument();
        });

        it('renders the requestedAt tooltip with a timezone abbreviation', async () => {
            const user = setupUser();
            mockApi.forJob.mockResolvedValueOnce([baseRow]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);

            expect(await screen.findByText(/ago$/)).toBeInTheDocument();
            await user.hover(screen.getByText(/ago$/));

            // window.TimeZone = 'Europe/London' in setup.ts — abbreviation is
            // runtime-dependent (GMT / BST / GMT+1). We only assert the slot
            // is populated, not which spelling ICU picked.
            const tip = await screen.findByRole('tooltip');
            expect(tip.textContent).toMatch(/\([^)]+\)/);
        });
    });

    /**
     * The badges carry their meaning as a data attribute rather than a palette
     * class, so the colours can be re-tuned without rewriting these.
     */
    describe('badge coding', () => {
        it('distinguishes a locally-raised request from a partner-raised one', async () => {
            mockApi.forJob.mockResolvedValueOnce([
                {...baseRow, origin: 'Local', approvalPartyType: 'PartnerTenant'},
            ]);
            const {unmount} = renderWithProviders(<JobChangeRequestsForJob jobId={42}/>);
            expect(await screen.findByText('You requested')).toBeInTheDocument();
            expect(screen.getByText('You requested').closest('[data-origin]'))
                .toHaveAttribute('data-origin', 'local');
            unmount();

            mockApi.forJob.mockResolvedValueOnce([
                {...baseRow, origin: 'Peer', approvalPartyType: 'OwnerTenant'},
            ]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="OwnerTenant"/>);
            expect(await screen.findByText('Partner requested')).toBeInTheDocument();
            expect(screen.getByText('Partner requested').closest('[data-origin]'))
                .toHaveAttribute('data-origin', 'partner');
        });

        it('marks the status badge with the row lifecycle and the wait with its own tone', async () => {
            mockApi.forJob.mockResolvedValueOnce([baseRow]);
            renderWithProviders(<JobChangeRequestsForJob jobId={42} localPartyType="PartnerTenant"/>);

            expect(await screen.findByText('Awaiting partner')).toBeInTheDocument();
            expect(screen.getByText('Awaiting partner').closest('[data-tone]'))
                .toHaveAttribute('data-tone', 'awaiting');
            expect(screen.getByText('Pending').closest('[data-tone]'))
                .toHaveAttribute('data-tone', 'pending');
        });
    });
});
