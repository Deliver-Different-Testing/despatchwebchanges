/**
 * JobListContextMenu Tests
 *
 * Covers menu rendering/visibility based on job state, action handlers,
 * inline dialogs (late call + confirmation), callback props,
 * window global dialogs, event groups submenu, and menu closing.
 */

import React from 'react';
import {fireEvent, screen, waitFor, act} from '@testing-library/react';
import { renderWithMantine } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {JobListContextMenu} from './JobListContextMenu';
import type {DispatchJob, AppPage} from '../../interfaces/dispatchJob';
import {AppPage as AppPageEnum} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock('../../services/jobListApi');
jest.mock('../../services/splitJobFlow', () => ({
    executeSplitJobFlow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn().mockResolvedValue(true),
}));
jest.mock('../dialogs/event-group-dialog', () => ({
    openEventGroupDialog: jest.fn().mockResolvedValue(true),
}));

// Stub the universal dispatch dialog so tests can drive the two confirm callbacks
// directly without going through the dialog's internal radio/dropdown/rate flow
// (the dialog's own behavior is covered by DispatchDialog.test.tsx).
jest.mock('../dialogs/dispatch-dialog', () => ({
    DispatchDialog: jest.fn(({open, initialType, onDispatchCourier, onSendToPartner}: {
        open: boolean;
        initialType: string;
        onDispatchCourier: (confirmation: {
            type: 'Courier' | 'Agent' | 'NP';
            destination: {id: number; text: string};
        }) => Promise<void>;
        onSendToPartner: (partner: {id: number; text: string}, rate: number) => Promise<void>;
    }) =>
        open ? (
            <div data-testid="dispatch-dialog" data-initial-type={initialType}>
                <button onClick={() => onDispatchCourier({
                    type: 'Courier',
                    destination: {id: 99, text: 'Stub Courier'},
                })}>
                    Stub Dispatch Courier
                </button>
                <button onClick={() => onDispatchCourier({
                    type: 'NP',
                    destination: {id: 55, text: 'Stub Partner'},
                })}>
                    Stub Dispatch NP
                </button>
                <button onClick={() => onSendToPartner({id: 7, text: 'PartnerCo'}, 100)}>
                    Stub Send To Partner
                </button>
            </div>
        ) : null,
    ),
}));
jest.mock('../../services/dispatchExecutorApi', () => ({
    canAssignAgentToJob: jest.fn().mockResolvedValue(true),
    assignAgentToJob: jest.fn().mockResolvedValue({status: 'Queued', agentEmail: 'a@b.c', willEmail: true}),
    assignNpAgentToJob: jest.fn().mockResolvedValue({success: true}),
}));
jest.mock('../../services/navigationService', () => ({
    openJobInSearch: jest.fn(),
    openJobDetail: jest.fn(),
    openHubUrl: jest.fn(),
}));

import * as api from '../../services/jobListApi';
import {executeSplitJobFlow} from '../../services/splitJobFlow';
import {openAddEventDialog} from '../dialogs/add-event-dialog';
import {openEventGroupDialog} from '../dialogs/event-group-dialog';
import {openJobInSearch} from '../../services/navigationService';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const mockedApi = api as jest.Mocked<typeof api>;
const mockedExecuteSplitJobFlow = executeSplitJobFlow as jest.Mock;
const mockedOpenAddEventDialog = openAddEventDialog as jest.Mock;
const mockedOpenEventGroupDialog = openEventGroupDialog as jest.Mock;
const mockedOpenJobInSearch = openJobInSearch as jest.Mock;

// ── Mock Data Factory ─────────────────────────────────────────────────

function createMockJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        showCourierSearch: false,
        isParentOrSingle: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        statusId: 0,
        statusName: 'New',
        status: 'New',
        booked: dayjs('2025-03-15T09:00:00'),
        time: dayjs('2025-03-15T17:00:00'),
        remain: 120,
        courierSearchLoading: false,
        pickupAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '10',
            addressLine4: 'Queen St', addressLine5: 'Auckland CBD',
            addressLine6: 'Auckland', addressLine7: '1010', addressLine8: '',
            fullAddress: '10 Queen St, Auckland',
        } as any,
        deliveryAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '20',
            addressLine4: 'High St', addressLine5: 'Newmarket',
            addressLine6: 'Auckland', addressLine7: '1023', addressLine8: '',
            fullAddress: '20 High St, Auckland',
        } as any,
        speed: 'Standard',
        vehicle: {id: 1, text: 'Car'},
        client: 'Test Client',
        clientId: 100,
        pickUpTimeZone: {id: 1, text: 'NZST'},
        deliveryTimeZone: {id: 1, text: 'NZST'},
        ...overrides,
    } as DispatchJob;
}

function createDefaultProps(overrides?: Partial<React.ComponentProps<typeof JobListContextMenu>>) {
    return {
        job: createMockJob(),
        position: {mouseX: 100, mouseY: 200},
        onClose: jest.fn(),
        appPage: AppPageEnum.Dispatch as AppPage,
        showToast: jest.fn(),
        onRefresh: jest.fn(),
        onAddStop: jest.fn(),
        ...overrides,
    };
}

// ── Test Setup ────────────────────────────────────────────────────────

const mockEventGroups: api.EventGroupItem[] = [
    {id: 10, text: 'Pickup Events'},
    {id: 20, text: 'Delivery Events'},
];

beforeEach(() => {
    // Default API mocks
    mockedApi.getEventGroups.mockResolvedValue(mockEventGroups);
    mockedApi.getActivePartnerOptions.mockResolvedValue([]);
    mockedApi.sendToPartner.mockResolvedValue({success: true, trackingNumber: 'TRK-123', message: 'OK'});
    mockedApi.updateJobReadStatus.mockResolvedValue(undefined);
    mockedApi.moveJobToReprice.mockResolvedValue(undefined);
    mockedApi.reAllocateJobs.mockResolvedValue(undefined);
    mockedApi.restoreJobs.mockResolvedValue(undefined);
    mockedApi.getRestorePodImpact.mockResolvedValue([]);
    mockedApi.markJobMissing.mockResolvedValue(undefined);
    mockedApi.restoreNationwideJob.mockResolvedValue(undefined);
    mockedApi.releaseBulkJob.mockResolvedValue({jobNumbers: ['J001']});
    mockedApi.setFirstJob.mockResolvedValue(undefined);
    mockedApi.lateCall.mockResolvedValue(undefined);

    mockedExecuteSplitJobFlow.mockResolvedValue(undefined);
    mockedOpenAddEventDialog.mockResolvedValue(true);
    mockedOpenEventGroupDialog.mockResolvedValue(true);

    // Window globals
    (window as any).ReactPriceBreakdownDialog = {open: jest.fn().mockResolvedValue(undefined)};
    (window as any).ReactVoidJobConfirmationDialog = {open: jest.fn().mockResolvedValue({success: true})};
    (window as any).ReactSwapPodsDialog = {open: jest.fn().mockResolvedValue(true)};
});

afterEach(() => {
    delete (window as any).ReactPriceBreakdownDialog;
    delete (window as any).ReactVoidJobConfirmationDialog;
    delete (window as any).ReactSwapPodsDialog;
});

// Reset the module-level eventGroupsCache between tests by re-requiring
// We achieve this by having getEventGroups return fresh data each time,
// and relying on the component's useEffect to load it.

// ── Tests ─────────────────────────────────────────────────────────────

describe('JobListContextMenu', () => {
    // ── 1. Rendering & Visibility ──────────────────────────────────────

    describe('Rendering & Visibility', () => {
        it('does not render when job or position is null', () => {
            // job is null
            const props1 = createDefaultProps({job: null});
            const {unmount: unmount1} = renderWithMantine(<JobListContextMenu {...props1} />);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            unmount1();

            // position is null
            const props2 = createDefaultProps({position: null});
            renderWithMantine(<JobListContextMenu {...props2} />);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('renders menu with expected items for default props (Dispatch page)', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            // opens menu when both job and position provided
            expect(screen.getByRole('menu')).toBeInTheDocument();

            // shows "Mark as Unread" when hasBeenRead is true (default job has hasBeenRead: true)
            expect(screen.getByText('Mark as Unread')).toBeInTheDocument();

            // shows Late Pickup/Delivery on Dispatch page
            expect(screen.getByText('Late Pickup')).toBeInTheDocument();
            expect(screen.getByText('Late Delivery')).toBeInTheDocument();

            // always shows Add Task, Task Groups, Void, Set First Job, Restore, Mark Missing
            expect(screen.getByText('Add Task - Other')).toBeInTheDocument();
            expect(screen.getByText('Task Groups')).toBeInTheDocument();
            expect(screen.getByText('Void Job')).toBeInTheDocument();
            expect(screen.getByText('Set First Job')).toBeInTheDocument();
            expect(screen.getByText('Restore')).toBeInTheDocument();
            expect(screen.getByText('Mark Missing')).toBeInTheDocument();

            // does not show Add Stop when not an agent job (default job has isAgentJob: false)
            expect(screen.queryByText('Add Pickup Stop')).not.toBeInTheDocument();
            expect(screen.queryByText('Add Delivery Stop')).not.toBeInTheDocument();
        });

        it('shows "Mark as Read" when hasBeenRead is false', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({hasBeenRead: false}),
            })} />);
            expect(screen.getByText('Mark as Read')).toBeInTheDocument();
        });

        it('shows Late Pickup/Delivery on JobSearch page', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.JobSearch})} />);
            expect(screen.getByText('Late Pickup')).toBeInTheDocument();
            expect(screen.getByText('Late Delivery')).toBeInTheDocument();
        });

        it('does not show Late Pickup/Delivery on Domestic page', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic})} />);
            expect(screen.queryByText('Late Pickup')).not.toBeInTheDocument();
            expect(screen.queryByText('Late Delivery')).not.toBeInTheDocument();
        });

        it('shows/hides Unassign Flight based on page and job props', () => {
            // shows on Domestic + assignedFlight + isFlightJob
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    isFlightJob: true,
                    assignedFlight: {
                        flightNumber: 'NZ123',
                        departureTimeZone: 'NZST',
                        arrivalTimeZone: 'AEST',
                        notes: '',
                    },
                }),
            })} />);
            expect(screen.getByText('Unassign Flight')).toBeInTheDocument();
            unmount();

            // does not show on Dispatch page
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                appPage: AppPageEnum.Dispatch,
                job: createMockJob({
                    isFlightJob: true,
                    assignedFlight: {
                        flightNumber: 'NZ123',
                        departureTimeZone: 'NZST',
                        arrivalTimeZone: 'AEST',
                        notes: '',
                    },
                }),
            })} />);
            expect(screen.queryByText('Unassign Flight')).not.toBeInTheDocument();
        });

        it('shows/hides Unassign Agent based on page and job props', () => {
            // shows on Domestic + assignedAgent
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    assignedAgent: {
                        agentId: 1, agentName: 'Agent Smith', agentRate: 50,
                        agentRanking: 'A', agentNotes: '',
                    },
                }),
            })} />);
            expect(screen.getByText('Unassign Agent')).toBeInTheDocument();
            unmount();

            // does not show on Dispatch page
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                appPage: AppPageEnum.Dispatch,
                job: createMockJob({
                    assignedAgent: {
                        agentId: 1, agentName: 'Agent Smith', agentRate: 50,
                        agentRanking: 'A', agentNotes: '',
                    },
                }),
            })} />);
            expect(screen.queryByText('Unassign Agent')).not.toBeInTheDocument();
        });

        it('shows Add Delivery Stop or Add Pickup Stop for agent jobs based on airport IDs', () => {
            // shows Add Delivery Stop for agent jobs without toAirportId
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isAgentJob: true}),
            })} />);
            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();
            unmount();

            // shows Add Pickup Stop for agent jobs with toAirportId and no fromAirportId
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isAgentJob: true, toAirportId: 5, fromAirportId: undefined}),
            })} />);
            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
        });

        it('shows Reprice Job for nationwide speed + not reprice + not preBook', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false}),
            })} />);
            expect(screen.getByText('Reprice Job')).toBeInTheDocument();
            expect(screen.queryByText('Price Breakdown')).not.toBeInTheDocument();
        });

        it('does not show Reprice when internalStatusId is 4 (reprice)', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 4, preBook: false}),
            })} />);
            expect(screen.queryByText('Reprice Job')).not.toBeInTheDocument();
        });

        it('shows/hides Send to Live based on done status', () => {
            // shows when isBulkJob and not done
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            })} />);
            expect(screen.getByText('Send to Live')).toBeInTheDocument();
            unmount();

            // does not show when done
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isBulkJob: true, done: true}),
            })} />);
            expect(screen.queryByText('Send to Live')).not.toBeInTheDocument();
        });

        it('shows/hides Swap PODs based on done status', () => {
            // shows when done and not bulk and not preBook
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({done: true, isBulkJob: false, preBook: false}),
            })} />);
            expect(screen.getByText('Swap PODs')).toBeInTheDocument();
            unmount();

            // does not show when not done
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({done: false}),
            })} />);
            expect(screen.queryByText('Swap PODs')).not.toBeInTheDocument();
        });

        it('shows/hides Split Job based on _groupChildren', () => {
            // shows when allowSplit and no group children
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({allowSplit: true, _groupChildren: []}),
            })} />);
            expect(screen.getByText('Split Job')).toBeInTheDocument();
            unmount();

            // does not show when _groupChildren has items
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({allowSplit: true, _groupChildren: [createMockJob({id: 2})]}),
            })} />);
            expect(screen.queryByText('Split Job')).not.toBeInTheDocument();
        });

        it('shows/hides Re-Dispatch based on assignedCourier', () => {
            // shows when assignedCourier exists
            const {unmount} = renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            })} />);
            expect(screen.getByText('Re-Dispatch')).toBeInTheDocument();
            unmount();

            // does not show when no assignedCourier
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({assignedCourier: undefined}),
            })} />);
            expect(screen.queryByText('Re-Dispatch')).not.toBeInTheDocument();
        });
    });

    // ── 2. Action Handlers — Direct API Calls ──────────────────────────

    describe('Action Handlers — Direct API Calls', () => {
        it('Mark as Unread calls updateJobReadStatus and shows success toast', async () => {
            const props = createDefaultProps({job: createMockJob({hasBeenRead: true})});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Mark as Unread'));

            await waitFor(() => {
                expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, false);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job marked as unread', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Mark as Read calls updateJobReadStatus with true', async () => {
            const props = createDefaultProps({job: createMockJob({hasBeenRead: false})});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Mark as Read'));

            await waitFor(() => {
                expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, true);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job marked as read', 'success');
        });

        it('Mark Read/Unread error shows error toast', async () => {
            mockedApi.updateJobReadStatus.mockRejectedValueOnce(new Error('Network error'));
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Mark as Unread'));

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('Error marking job as read/unread', 'error');
            });
        });

        it('Reprice calls moveJobToReprice with toast and refresh', async () => {
            const props = createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Reprice Job'));

            await waitFor(() => {
                expect(mockedApi.moveJobToReprice).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job J001 marked as Reprice', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Re-Dispatch opens the universal dispatch dialog with Courier pre-selected', async () => {
            const props = createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Re-Dispatch'));

            const dialog = await screen.findByTestId('dispatch-dialog');
            expect(dialog).toHaveAttribute('data-initial-type', 'Courier');
            // Re-Dispatch alone shouldn't call the API — the dialog confirmation does.
            expect(mockedApi.reAllocateJobs).not.toHaveBeenCalled();
        });

        it('Re-Dispatch confirm invalidates job detail cache so detail panel refreshes', async () => {
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const props = createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Re-Dispatch'));
            fireEvent.click(await screen.findByText('Stub Dispatch Courier'));

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: ['jobs']});
            });
            invalidateSpy.mockRestore();
        });

        it('Restore (non-completed job) restores directly, logs the audit event, invalidates job detail, and refreshes', async () => {
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], false);
            });
            expect(mockedApi.addRestoreEvent).toHaveBeenCalledWith(1);
            expect(props.showToast).toHaveBeenCalledWith('Job J001 restored', 'success');
            expect(invalidateSpy).toHaveBeenCalledWith({queryKey: ['jobs']});
            expect(props.onRefresh).toHaveBeenCalled();
            invalidateSpy.mockRestore();
        });

        it('Restore (completed job) confirms first, then restores and logs the audit event', async () => {
            const props = createDefaultProps({job: createMockJob({done: true})});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            // Confirmation shown; nothing restored yet.
            expect(await screen.findByText('Restore completed job')).toBeInTheDocument();
            expect(mockedApi.restoreJobs).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], false);
            });
            expect(mockedApi.addRestoreEvent).toHaveBeenCalledWith(1);
        });

        it('Restore (completed job) archives the captured images when the checkbox is ticked', async () => {
            mockedApi.getRestorePodImpact.mockResolvedValue([
                {jobId: 1, podName: null, capturedImageCount: 1, imageCountKnown: true},
            ]);
            const props = createDefaultProps({job: createMockJob({done: true})});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            expect(await screen.findByText('Restore completed job')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('checkbox', {name: /Also remove the 1 image captured/i}));
            fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], true);
            });
        });

        it('Restore (non-completed job holding a POD name) warns that the POD will be removed', async () => {
            mockedApi.getRestorePodImpact.mockResolvedValue([
                {jobId: 1, podName: 'J. Smith', capturedImageCount: 0, imageCountKnown: true},
            ]);
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            expect(await screen.findByText(/This clears the POD — delivery time and name “J\. Smith”/i))
                .toBeInTheDocument();
            expect(mockedApi.getRestorePodImpact).toHaveBeenCalledWith([1]);
            expect(mockedApi.restoreJobs).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], false);
            });
        });

        it('Restore (non-completed job holding captured images) offers to remove them', async () => {
            mockedApi.getRestorePodImpact.mockResolvedValue([
                {jobId: 1, podName: null, capturedImageCount: 2, imageCountKnown: true},
            ]);
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            const checkbox = await screen.findByRole('checkbox', {name: /Also remove the 2 images captured/i});
            fireEvent.click(checkbox);
            fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], true);
            });
        });

        it('Restore offers Swap POD, which opens the swap dialog instead of restoring', async () => {
            mockedApi.getRestorePodImpact.mockResolvedValue([
                {jobId: 1, podName: 'J. Smith', capturedImageCount: 0, imageCountKnown: true},
            ]);
            const props = createDefaultProps({job: createMockJob({done: true})});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            fireEvent.click(await screen.findByRole('button', {name: 'Swap POD'}));

            await waitFor(() => {
                expect((window as any).ReactSwapPodsDialog.open).toHaveBeenCalledWith('J001', expect.anything());
            });
            expect(mockedApi.restoreJobs).not.toHaveBeenCalled();
        });

        it('Restore falls back to the completed-only rule when the POD pre-check fails', async () => {
            mockedApi.getRestorePodImpact.mockRejectedValue(new Error('offline'));
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Restore'));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1], false);
            });
            expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
        });

        it('Restore is disabled for archived jobs (restore only touches live jobs, so it would silently no-op)', () => {
            const props = createDefaultProps({job: createMockJob({isArchived: true, done: true})});
            renderWithMantine(<JobListContextMenu {...props} />);

            // Mantine marks a disabled Menu.Item with `data-disabled`, not `aria-disabled`.
            const restoreItem = screen.getByText('Restore').closest('[role="menuitem"]');
            expect(restoreItem).toHaveAttribute('data-disabled');

            // Clicking the disabled item must not open the confirm dialog or call the API.
            fireEvent.click(screen.getByText('Restore'));
            expect(screen.queryByText('Restore completed job')).not.toBeInTheDocument();
            expect(mockedApi.restoreJobs).not.toHaveBeenCalled();
            expect(mockedApi.addRestoreEvent).not.toHaveBeenCalled();
        });

        it('Restore stays enabled for a non-archived job', () => {
            const props = createDefaultProps({job: createMockJob({isArchived: false})});
            renderWithMantine(<JobListContextMenu {...props} />);

            const restoreItem = screen.getByText('Restore').closest('[role="menuitem"]');
            expect(restoreItem).not.toHaveAttribute('aria-disabled', 'true');
        });

        it('Mark Missing calls markJobMissing with toast and refresh', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Mark Missing'));

            await waitFor(() => {
                expect(mockedApi.markJobMissing).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job successfully marked as missing.', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Add Task Other calls openAddEventDialog with correct shape and refreshes', async () => {
            const props = createDefaultProps({
                job: createMockJob({id: 42, jobNo: 'J042', client: 'Acme', clientId: 200}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Add Task - Other'));

            await waitFor(() => {
                expect(mockedOpenAddEventDialog).toHaveBeenCalledWith({
                    job: {id: 42, jobNo: 'J042', client: 'Acme', clientId: 200},
                    toastService: {showToast: props.showToast},
                });
            });
            expect(props.onRefresh).toHaveBeenCalled();
        });
    });

    // ── 3. Late Call Dialog ─────────────────────────────────────────────

    describe('Late Call Dialog', () => {
        it('clicking Late Pickup opens dialog with "Late Pickup" title', async () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            fireEvent.click(screen.getByText('Late Pickup'));

            expect(screen.getByRole('heading', {name: 'Late Pickup'})).toBeInTheDocument();
        });

        it('clicking Late Delivery opens dialog with "Late Delivery" title', async () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            fireEvent.click(screen.getByText('Late Delivery'));

            expect(screen.getByRole('heading', {name: 'Late Delivery'})).toBeInTheDocument();
        });

        it('submitting with valid minutes calls lateCall with lateType=1 for pickup', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Late Pickup'));

            const input = screen.getByLabelText('Minutes');
            fireEvent.change(input, {target: {value: '15'}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(mockedApi.lateCall).toHaveBeenCalledWith({
                    jobId: 1,
                    lateType: 1,
                    lateTime: 15,
                    calculationRequired: true,
                });
            });
            expect(props.showToast).toHaveBeenCalledWith('Late call applied successfully', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('submitting with valid minutes calls lateCall with lateType=2 for delivery', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Late Delivery'));

            const input = screen.getByLabelText('Minutes');
            fireEvent.change(input, {target: {value: '30'}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(mockedApi.lateCall).toHaveBeenCalledWith({
                    jobId: 1,
                    lateType: 2,
                    lateTime: 30,
                    calculationRequired: true,
                });
            });
        });

        it('Enter key submits the dialog', async () => {
            // Kept as userEvent: asserts keyboard submission behaviour
            const user = setupUser();
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Late Pickup'));

            const input = screen.getByLabelText('Minutes');
            fireEvent.change(input, {target: {value: '10'}});
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(mockedApi.lateCall).toHaveBeenCalledWith(
                    expect.objectContaining({lateTime: 10}),
                );
            });
        });

        it('Cancel closes dialog without API call', async () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            fireEvent.click(screen.getByText('Late Pickup'));
            expect(screen.getByLabelText('Minutes')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Cancel'));

            await waitFor(() => {
                expect(screen.queryByLabelText('Minutes')).not.toBeInTheDocument();
            });
            expect(mockedApi.lateCall).not.toHaveBeenCalled();
        });

        it('empty minutes disables the Save button', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            fireEvent.click(screen.getByText('Late Pickup'));

            // Save button should be disabled when input is empty
            const saveButton = screen.getByRole('button', {name: 'Save'});
            expect(saveButton).toBeDisabled();
            expect(mockedApi.lateCall).not.toHaveBeenCalled();
        });

        it('API error shows error toast', async () => {
            mockedApi.lateCall.mockRejectedValueOnce(new Error('Server error'));
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Late Pickup'));
            const input = screen.getByLabelText('Minutes');
            fireEvent.change(input, {target: {value: '5'}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('Error applying late pickup', 'error');
            });
        });
    });

    // ── 4. Confirmation Dialogs ─────────────────────────────────────────

    describe('Confirmation Dialogs', () => {
        it('Unassign Flight: shows confirmation, OK calls restoreNationwideJob', async () => {
            const props = createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    isFlightJob: true,
                    assignedFlight: {
                        flightNumber: 'NZ123',
                        departureTimeZone: 'NZST',
                        arrivalTimeZone: 'AEST',
                        notes: '',
                    },
                }),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Unassign Flight'));

            // Confirmation dialog should be visible
            expect(screen.getByText('Unassign Flight?')).toBeInTheDocument();

            fireEvent.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('NZ123 unassigned successfully', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Unassign Flight: cancel does not call API', () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    isFlightJob: true,
                    assignedFlight: {
                        flightNumber: 'NZ123',
                        departureTimeZone: 'NZST',
                        arrivalTimeZone: 'AEST',
                        notes: '',
                    },
                }),
            })} />);

            fireEvent.click(screen.getByText('Unassign Flight'));
            fireEvent.click(screen.getByText('Cancel'));

            expect(mockedApi.restoreNationwideJob).not.toHaveBeenCalled();
        });

        it('Unassign Agent: shows confirmation, OK calls restoreNationwideJob', async () => {
            const props = createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    assignedAgent: {
                        agentId: 1, agentName: 'Agent Smith', agentRate: 50,
                        agentRanking: 'A', agentNotes: '',
                    },
                }),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Unassign Agent'));
            expect(screen.getByText('Unassign Agent?')).toBeInTheDocument();

            fireEvent.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Agent Smith unassigned successfully', 'success');
        });

        it('Send to Live: shows confirmation, confirm calls releaseBulkJob', async () => {
            const props = createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Live'));
            expect(screen.getByRole('heading', {name: /send to live/i})).toBeInTheDocument();
            expect(screen.getByText(/Release bulk job J001 to the live dispatch screen/)).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: /^send to live$/i}));

            await waitFor(() => {
                expect(mockedApi.releaseBulkJob).toHaveBeenCalledWith(1);
            });
            // Success toast now lists the released job numbers so the operator can paste
            // them into the search filter; the message also signals the clipboard copy.
            expect(props.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Bulk job J001 sent to live'),
                'success',
            );
            expect(props.showToast).toHaveBeenCalledWith(
                expect.stringContaining('J001'),
                'success',
            );
        });

        it('Send to Live: surfaces the server error message instead of a generic failure', async () => {
            mockedApi.releaseBulkJob.mockRejectedValueOnce({
                message: 'Bulk job 1 not found — no parent or child rows matched.',
            });
            const props = createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Live'));
            fireEvent.click(screen.getByRole('button', {name: /^send to live$/i}));

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    'Bulk job 1 not found — no parent or child rows matched.',
                    'error',
                );
            });
        });

        it('Set First Job: shows confirmation, OK calls setFirstJob with jobId and courierId', async () => {
            const props = createDefaultProps({
                job: createMockJob({courierData: {courierId: 77, courierNumber: 'C77', courier: 'Test'} as any}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Set First Job'));
            expect(screen.getByText('Set First Job?')).toBeInTheDocument();

            fireEvent.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.setFirstJob).toHaveBeenCalledWith(1, 77);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job set as first job successfully', 'success');
        });
    });

    // ── 5. Callback-Based Actions ───────────────────────────────────────

    describe('Callback-Based Actions', () => {
        it('Add Stop calls onAddStop prop with the job', () => {
            const job = createMockJob({isAgentJob: true});
            const props = createDefaultProps({job});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Add Delivery Stop'));

            expect(props.onAddStop).toHaveBeenCalledWith(job);
        });

        it('Split Job shows confirmation dialog, OK calls executeSplitJobFlow', async () => {
            const job = createMockJob({allowSplit: true, _groupChildren: []});
            const props = createDefaultProps({job});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Split Job'));

            // Confirmation dialog should be visible
            expect(screen.getByRole('heading', {name: 'Split Job'})).toBeInTheDocument();
            expect(screen.getByText('Are you sure you wish to split this job?')).toBeInTheDocument();

            fireEvent.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedExecuteSplitJobFlow).toHaveBeenCalledWith(
                    expect.objectContaining({
                        job,
                        showToast: props.showToast,
                    }),
                );
            });
        });

        it('Split Job cancel does not call executeSplitJobFlow', () => {
            const job = createMockJob({allowSplit: true, _groupChildren: []});
            const props = createDefaultProps({job});
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Split Job'));
            fireEvent.click(screen.getByText('Cancel'));

            expect(mockedExecuteSplitJobFlow).not.toHaveBeenCalled();
        });
    });

    // ── 6. Window Global Dialogs ────────────────────────────────────────

    describe('Window Global Dialogs', () => {
        it('Void Job calls window.ReactVoidJobConfirmationDialog.open and refreshes on success', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Void Job'));

            await waitFor(() => {
                expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalledWith(
                    {id: 1, jobNo: 'J001', isBulkJob: false, isArchived: false},
                    {showToast: props.showToast},
                );
            });
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Void Job invalidates job list cache so list refreshes after void', async () => {
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Void Job'));

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: ['jobs']});
            });
            invalidateSpy.mockRestore();
        });

        it('Void Job does not refresh or invalidate when dialog is cancelled', async () => {
            (window as any).ReactVoidJobConfirmationDialog = {open: jest.fn().mockResolvedValue(null)};
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Void Job'));

            await waitFor(() => {
                expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalled();
            });
            expect(props.onRefresh).not.toHaveBeenCalled();
            expect(invalidateSpy).not.toHaveBeenCalledWith({queryKey: ['jobs']});
            invalidateSpy.mockRestore();
        });

        it('Swap PODs calls window.ReactSwapPodsDialog.open and refreshes on success', async () => {
            const props = createDefaultProps({
                job: createMockJob({done: true, isBulkJob: false, preBook: false}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Swap PODs'));

            await waitFor(() => {
                expect((window as any).ReactSwapPodsDialog.open).toHaveBeenCalledWith(
                    'J001',
                    {showToast: props.showToast},
                );
            });
            expect(props.onRefresh).toHaveBeenCalled();
        });

    });

    // ── 7. Event Groups Submenu ─────────────────────────────────────────

    describe('Event Groups Submenu', () => {
        // Note: eventGroupsCache is a module-level variable that persists across tests.
        // The first render in the suite populates it via the useEffect, and subsequent
        // renders read from the cache (useState initializer). We test the observable
        // behavior: that groups appear in the submenu and clicking them works.

        it('clicking Task Groups opens submenu with group items', async () => {
            renderWithMantine(<JobListContextMenu {...createDefaultProps()} />);

            // Allow useEffect to settle (may or may not call API depending on cache)
            await act(async () => {});

            fireEvent.click(screen.getByText('Task Groups'));

            expect(await screen.findByText('Pickup Events')).toBeInTheDocument();
            expect(screen.getByText('Delivery Events')).toBeInTheDocument();
        });

        it('clicking a group calls openEventGroupDialog with correct groupId/jobId', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            await act(async () => {});

            fireEvent.click(screen.getByText('Task Groups'));
            fireEvent.click(await screen.findByText('Pickup Events'));

            await waitFor(() => {
                expect(mockedOpenEventGroupDialog).toHaveBeenCalledWith({
                    eventGroupId: 10,
                    jobId: 1,
                    toastService: {showToast: props.showToast},
                });
            });
            expect(props.onRefresh).toHaveBeenCalled();
        });
    });

    // ── 7b. Send to Partner — post-confirm side effects ─────────────────

    describe('Send to Partner (post-confirm)', () => {
        it('opens the dispatch dialog with DFRNT Partner pre-selected', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Partner'));

            const dialog = await screen.findByTestId('dispatch-dialog');
            expect(dialog).toHaveAttribute('data-initial-type', 'DfrntPartner');
        });

        it('copies the job number, surfaces an Open toast action, and opens the job in search when clicked', async () => {
            const writeTextMock = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: {writeText: writeTextMock},
                configurable: true,
            });

            mockedApi.sendToPartner.mockResolvedValue({
                success: true,
                trackingNumber: 'TRK-555',
                message: 'OK',
            });

            const props = createDefaultProps({
                job: createMockJob({id: 42, jobNo: 'J042'}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Partner'));
            fireEvent.click(await screen.findByText('Stub Send To Partner'));

            await waitFor(() => {
                expect(mockedApi.sendToPartner).toHaveBeenCalledWith(42, 7, 100);
            });
            await waitFor(() => {
                expect(writeTextMock).toHaveBeenCalledWith('J042');
            });

            // Toast was shown with an action callback that opens the job in search.
            expect(props.showToast).toHaveBeenCalledWith(
                expect.stringContaining('J042'),
                'success',
                expect.objectContaining({label: 'Open', onClick: expect.any(Function)}),
            );
            const toastCall = (props.showToast as jest.Mock).mock.calls.find(
                ([msg]) => typeof msg === 'string' && msg.includes('J042'),
            );
            const action = toastCall?.[2] as {label: string; onClick: () => void};
            action.onClick();
            expect(mockedOpenJobInSearch).toHaveBeenCalledWith(42);
        });
    });

    // ── 7c. Re-Dispatch via dispatch dialog ─────────────────────────────

    describe('Re-Dispatch (universal dialog)', () => {
        it('opens the dispatch dialog and re-allocates when a courier is picked', async () => {
            const props = createDefaultProps({
                job: createMockJob({
                    id: 11,
                    jobNo: 'J011',
                    assignedCourier: {id: 50, text: 'ABC Couriers'},
                }),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Re-Dispatch'));
            const dialog = await screen.findByTestId('dispatch-dialog');
            expect(dialog).toHaveAttribute('data-initial-type', 'Courier');

            fireEvent.click(screen.getByText('Stub Dispatch Courier'));

            await waitFor(() => {
                expect(mockedApi.reAllocateJobs).toHaveBeenCalledWith(99, [11]);
            });
        });

        it('allocates (not reallocates) when the job has no courier yet', async () => {
            const props = createDefaultProps({
                job: createMockJob({id: 22, jobNo: 'J022'}),
            });
            mockedApi.allocateJobs.mockResolvedValue(undefined);
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Partner'));

            // Switch the dialog stub to Courier dispatch using the same Stub button.
            fireEvent.click(screen.getByText('Stub Dispatch Courier'));

            await waitFor(() => {
                expect(mockedApi.allocateJobs).toHaveBeenCalledWith(99, [22]);
            });
            expect(mockedApi.reAllocateJobs).not.toHaveBeenCalled();
        });

        it('offers Assign… on every page, with no courier required, opening an unbiased dialog', async () => {
            // Re-Dispatch only appears once a courier exists, so before this item a
            // nationwide job with no courier had no route to the shared modal at all.
            for (const appPage of [AppPageEnum.Domestic, AppPageEnum.Dispatch, AppPageEnum.JobSearch]) {
                const props = createDefaultProps({
                    appPage,
                    job: createMockJob({id: 44, jobNo: 'J044', assignedCourier: undefined}),
                });
                const {unmount} = renderWithMantine(<JobListContextMenu {...props} />);

                expect(screen.queryByText('Re-Dispatch')).not.toBeInTheDocument();
                fireEvent.click(screen.getByText('Assign…'));

                const dialog = await screen.findByTestId('dispatch-dialog');
                expect(dialog).toHaveAttribute('data-initial-type', 'Courier');
                unmount();
            }
        });

        it('offers Send to Partner on Nationwide as well as dispatch and job search', () => {
            for (const appPage of [AppPageEnum.Domestic, AppPageEnum.Dispatch, AppPageEnum.JobSearch]) {
                const {unmount} = renderWithMantine(
                    <JobListContextMenu {...createDefaultProps({appPage})} />
                );
                expect(screen.getByText('Send to Partner')).toBeInTheDocument();
                unmount();
            }
        });

        it('hands a network partner pick to the dedicated endpoint instead of erroring', async () => {
            // This path used to throw "not yet wired from the job list — use the
            // job-details panel", which was a dead end because the panel's field
            // write was rejected by the server too.
            const {assignNpAgentToJob} = require('../../services/dispatchExecutorApi');
            const props = createDefaultProps({
                job: createMockJob({id: 33, jobNo: 'J033'}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Partner'));
            fireEvent.click(screen.getByText('Stub Dispatch NP'));

            await waitFor(() => {
                expect(assignNpAgentToJob).toHaveBeenCalledWith(33, 55);
            });
        });
    });

    // ── 8. Menu Closing ─────────────────────────────────────────────────

    describe('Menu Closing', () => {
        it('action handlers call onClose before their action', () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Mark as Unread'));

            // onClose should have been called
            expect(props.onClose).toHaveBeenCalled();
        });

        it('callback-based actions call onClose', () => {
            const props = createDefaultProps({
                job: createMockJob({isAgentJob: true}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Add Delivery Stop'));

            expect(props.onClose).toHaveBeenCalled();
        });

        it('confirmation dialog actions call onClose', () => {
            const props = createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            });
            renderWithMantine(<JobListContextMenu {...props} />);

            fireEvent.click(screen.getByText('Send to Live'));

            expect(props.onClose).toHaveBeenCalled();
        });
    });
});
