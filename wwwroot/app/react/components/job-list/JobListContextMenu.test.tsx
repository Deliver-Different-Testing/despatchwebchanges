/**
 * JobListContextMenu Tests
 *
 * Covers menu rendering/visibility based on job state, action handlers,
 * inline dialogs (late call + confirmation), callback props,
 * window global dialogs, event groups submenu, and menu closing.
 */

import React from 'react';
import {screen, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithTheme} from '../../__testUtils__';
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
jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn().mockReturnValue(false),
}));
// Stub the send-to-partner dialog so we can drive `onConfirm` directly from a test
// without going through the dialog's rate-fetching flow (covered by its own test file).
jest.mock('../dialogs/send-to-partner-dialog', () => ({
    SendToPartnerDialog: jest.fn(({open, onConfirm}: {open: boolean; onConfirm: (rate: number) => Promise<void>}) =>
        open ? (
            <div data-testid="send-to-partner-dialog">
                <button onClick={() => onConfirm(100)}>Stub Confirm</button>
            </div>
        ) : null,
    ),
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
import {isAiEnabled} from '../../../functions/aiSettings';
import {openJobInSearch} from '../../services/navigationService';

const mockedApi = api as jest.Mocked<typeof api>;
const mockedExecuteSplitJobFlow = executeSplitJobFlow as jest.Mock;
const mockedOpenAddEventDialog = openAddEventDialog as jest.Mock;
const mockedOpenEventGroupDialog = openEventGroupDialog as jest.Mock;
const mockedIsAiEnabled = isAiEnabled as jest.Mock;
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
    mockedApi.markJobMissing.mockResolvedValue(undefined);
    mockedApi.restoreNationwideJob.mockResolvedValue(undefined);
    mockedApi.releaseBulkJob.mockResolvedValue(undefined);
    mockedApi.setFirstJob.mockResolvedValue(undefined);
    mockedApi.lateCall.mockResolvedValue(undefined);

    mockedIsAiEnabled.mockReturnValue(false);
    mockedExecuteSplitJobFlow.mockResolvedValue(undefined);
    mockedOpenAddEventDialog.mockResolvedValue(true);
    mockedOpenEventGroupDialog.mockResolvedValue(true);

    // Window globals
    (window as any).ReactPriceBreakdownDialog = {open: jest.fn().mockResolvedValue(undefined)};
    (window as any).ReactVoidJobConfirmationDialog = {open: jest.fn().mockResolvedValue({success: true})};
    (window as any).ReactSwapPodsDialog = {open: jest.fn().mockResolvedValue(true)};
    (window as any).ReactAiAssistant = {analyzeLateAlert: jest.fn().mockResolvedValue({summary: 'AI analysis'})};
});

afterEach(() => {
    delete (window as any).ReactPriceBreakdownDialog;
    delete (window as any).ReactVoidJobConfirmationDialog;
    delete (window as any).ReactSwapPodsDialog;
    delete (window as any).ReactAiAssistant;
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
            const {container: c1, unmount: unmount1} = renderWithTheme(<JobListContextMenu {...props1} />);
            expect(c1.innerHTML).toBe('');
            unmount1();

            // position is null
            const props2 = createDefaultProps({position: null});
            const {container: c2} = renderWithTheme(<JobListContextMenu {...props2} />);
            expect(c2.innerHTML).toBe('');
        });

        it('renders menu with expected items for default props (Dispatch page)', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

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

            // does not show AI Late Alert when isAiEnabled returns false (default mock returns false)
            expect(screen.queryByText('AI Late Alert Analysis (Beta)')).not.toBeInTheDocument();
        });

        it('shows "Mark as Read" when hasBeenRead is false', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({hasBeenRead: false}),
            })} />);
            expect(screen.getByText('Mark as Read')).toBeInTheDocument();
        });

        it('shows Late Pickup/Delivery on JobSearch page', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.JobSearch})} />);
            expect(screen.getByText('Late Pickup')).toBeInTheDocument();
            expect(screen.getByText('Late Delivery')).toBeInTheDocument();
        });

        it('does not show Late Pickup/Delivery on Domestic page', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic})} />);
            expect(screen.queryByText('Late Pickup')).not.toBeInTheDocument();
            expect(screen.queryByText('Late Delivery')).not.toBeInTheDocument();
        });

        it('shows/hides Unassign Flight based on page and job props', () => {
            // shows on Domestic + assignedFlight + isFlightJob
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
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
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
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
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
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
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
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
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isAgentJob: true}),
            })} />);
            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();
            unmount();

            // shows Add Pickup Stop for agent jobs with toAirportId and no fromAirportId
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isAgentJob: true, toAirportId: 5, fromAirportId: undefined}),
            })} />);
            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
        });

        it('shows AI Late Alert only when isAiEnabled returns true', () => {
            mockedIsAiEnabled.mockReturnValue(true);
            renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Dispatch})} />);
            expect(screen.getByText('AI Late Alert Analysis (Beta)')).toBeInTheDocument();
        });

        it('shows Reprice Job for nationwide speed + not reprice + not preBook', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false}),
            })} />);
            expect(screen.getByText('Reprice Job')).toBeInTheDocument();
            expect(screen.queryByText('Price Breakdown')).not.toBeInTheDocument();
        });

        it('does not show Reprice when internalStatusId is 4 (reprice)', () => {
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 4, preBook: false}),
            })} />);
            expect(screen.queryByText('Reprice Job')).not.toBeInTheDocument();
        });

        it('shows/hides Send to Live based on done status', () => {
            // shows when isBulkJob and not done
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            })} />);
            expect(screen.getByText('Send to Live')).toBeInTheDocument();
            unmount();

            // does not show when done
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({isBulkJob: true, done: true}),
            })} />);
            expect(screen.queryByText('Send to Live')).not.toBeInTheDocument();
        });

        it('shows/hides Swap PODs based on done status', () => {
            // shows when done and not bulk and not preBook
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({done: true, isBulkJob: false, preBook: false}),
            })} />);
            expect(screen.getByText('Swap PODs')).toBeInTheDocument();
            unmount();

            // does not show when not done
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({done: false}),
            })} />);
            expect(screen.queryByText('Swap PODs')).not.toBeInTheDocument();
        });

        it('shows/hides Split Job based on _groupChildren', () => {
            // shows when allowSplit and no group children
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({allowSplit: true, _groupChildren: []}),
            })} />);
            expect(screen.getByText('Split Job')).toBeInTheDocument();
            unmount();

            // does not show when _groupChildren has items
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({allowSplit: true, _groupChildren: [createMockJob({id: 2})]}),
            })} />);
            expect(screen.queryByText('Split Job')).not.toBeInTheDocument();
        });

        it('shows/hides Re-Dispatch based on assignedCourier', () => {
            // shows when assignedCourier exists
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            })} />);
            expect(screen.getByText('Re-Dispatch')).toBeInTheDocument();
            unmount();

            // does not show when no assignedCourier
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
                job: createMockJob({assignedCourier: undefined}),
            })} />);
            expect(screen.queryByText('Re-Dispatch')).not.toBeInTheDocument();
        });
    });

    // ── 2. Action Handlers — Direct API Calls ──────────────────────────

    describe('Action Handlers — Direct API Calls', () => {
        it('Mark as Unread calls updateJobReadStatus and shows success toast', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({job: createMockJob({hasBeenRead: true})});
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Mark as Unread'));

            await waitFor(() => {
                expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, false);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job marked as unread', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Mark as Read calls updateJobReadStatus with true', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({job: createMockJob({hasBeenRead: false})});
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Mark as Read'));

            await waitFor(() => {
                expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, true);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job marked as read', 'success');
        });

        it('Mark Read/Unread error shows error toast', async () => {
            mockedApi.updateJobReadStatus.mockRejectedValueOnce(new Error('Network error'));
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Mark as Unread'));

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('Error marking job as read/unread', 'error');
            });
        });

        it('Reprice calls moveJobToReprice with toast and refresh', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Reprice Job'));

            await waitFor(() => {
                expect(mockedApi.moveJobToReprice).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job J001 marked as Reprice', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Re-Dispatch calls reAllocateJobs with courierId and jobId', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Re-Dispatch'));

            await waitFor(() => {
                expect(mockedApi.reAllocateJobs).toHaveBeenCalledWith(5, [1]);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job J001 re-dispatched successfully', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Re-Dispatch invalidates job detail cache so detail panel refreshes', async () => {
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Re-Dispatch'));

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: ['jobs']});
            });
            invalidateSpy.mockRestore();
        });

        it('Restore calls restoreJobs with jobId array and refreshes', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Restore'));

            await waitFor(() => {
                expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1]);
            });
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Mark Missing calls markJobMissing with toast and refresh', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Mark Missing'));

            await waitFor(() => {
                expect(mockedApi.markJobMissing).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job successfully marked as missing.', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Add Task Other calls openAddEventDialog with correct shape and refreshes', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({id: 42, jobNo: 'J042', client: 'Acme', clientId: 200}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Add Task - Other'));

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
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            await user.click(screen.getByText('Late Pickup'));

            expect(screen.getByText('Late Pickup', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
        });

        it('clicking Late Delivery opens dialog with "Late Delivery" title', async () => {
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            await user.click(screen.getByText('Late Delivery'));

            expect(screen.getByText('Late Delivery', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
        });

        it('submitting with valid minutes calls lateCall with lateType=1 for pickup', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Late Pickup'));

            const input = screen.getByLabelText('Minutes');
            await user.click(input);
            await user.paste('15');
            await user.click(screen.getByText('Save'));

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
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Late Delivery'));

            const input = screen.getByLabelText('Minutes');
            await user.click(input);
            await user.paste('30');
            await user.click(screen.getByText('Save'));

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
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Late Pickup'));

            const input = screen.getByLabelText('Minutes');
            await user.click(input);
            await user.paste('10');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(mockedApi.lateCall).toHaveBeenCalledWith(
                    expect.objectContaining({lateTime: 10}),
                );
            });
        });

        it('Cancel closes dialog without API call', async () => {
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            await user.click(screen.getByText('Late Pickup'));
            expect(screen.getByLabelText('Minutes')).toBeInTheDocument();

            await user.click(screen.getByText('Cancel'));

            await waitFor(() => {
                expect(screen.queryByLabelText('Minutes')).not.toBeInTheDocument();
            });
            expect(mockedApi.lateCall).not.toHaveBeenCalled();
        });

        it('empty minutes disables the Save button', async () => {
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            await user.click(screen.getByText('Late Pickup'));

            // Save button should be disabled when input is empty
            const saveButton = screen.getByRole('button', {name: 'Save'});
            expect(saveButton).toBeDisabled();
            expect(mockedApi.lateCall).not.toHaveBeenCalled();
        });

        it('API error shows error toast', async () => {
            mockedApi.lateCall.mockRejectedValueOnce(new Error('Server error'));
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Late Pickup'));
            const input = screen.getByLabelText('Minutes');
            await user.click(input);
            await user.paste('5');
            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('Error applying late pickup', 'error');
            });
        });
    });

    // ── 4. Confirmation Dialogs ─────────────────────────────────────────

    describe('Confirmation Dialogs', () => {
        it('Unassign Flight: shows confirmation, OK calls restoreNationwideJob', async () => {
            const user = userEvent.setup();
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
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Unassign Flight'));

            // Confirmation dialog should be visible
            expect(screen.getByText('Unassign Flight?')).toBeInTheDocument();

            await user.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('NZ123 unassigned successfully', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('Unassign Flight: cancel does not call API', async () => {
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps({
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

            await user.click(screen.getByText('Unassign Flight'));
            await user.click(screen.getByText('Cancel'));

            expect(mockedApi.restoreNationwideJob).not.toHaveBeenCalled();
        });

        it('Unassign Agent: shows confirmation, OK calls restoreNationwideJob', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                appPage: AppPageEnum.Domestic,
                job: createMockJob({
                    assignedAgent: {
                        agentId: 1, agentName: 'Agent Smith', agentRate: 50,
                        agentRanking: 'A', agentNotes: '',
                    },
                }),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Unassign Agent'));
            expect(screen.getByText('Unassign Agent?')).toBeInTheDocument();

            await user.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Agent Smith unassigned successfully', 'success');
        });

        it('Send to Live: shows confirmation, OK calls releaseBulkJob', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Send to Live'));
            expect(screen.getByText('Send to Live?')).toBeInTheDocument();

            await user.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.releaseBulkJob).toHaveBeenCalledWith(1);
            });
            expect(props.showToast).toHaveBeenCalledWith('Bulk job J001 sent to live successfully', 'success');
        });

        it('Set First Job: shows confirmation, OK calls setFirstJob with jobId and courierId', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({courierData: {courierId: 77, courierNumber: 'C77', courier: 'Test'} as any}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Set First Job'));
            expect(screen.getByText('Set First Job?')).toBeInTheDocument();

            await user.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedApi.setFirstJob).toHaveBeenCalledWith(1, 77);
            });
            expect(props.showToast).toHaveBeenCalledWith('Job set as first job successfully', 'success');
        });
    });

    // ── 5. Callback-Based Actions ───────────────────────────────────────

    describe('Callback-Based Actions', () => {
        it('Add Stop calls onAddStop prop with the job', async () => {
            const user = userEvent.setup();
            const job = createMockJob({isAgentJob: true});
            const props = createDefaultProps({job});
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(props.onAddStop).toHaveBeenCalledWith(job);
        });

        it('Split Job shows confirmation dialog, OK calls executeSplitJobFlow', async () => {
            const user = userEvent.setup();
            const job = createMockJob({allowSplit: true, _groupChildren: []});
            const props = createDefaultProps({job});
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Split Job'));

            // Confirmation dialog should be visible
            expect(screen.getByText('Split Job', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
            expect(screen.getByText('Are you sure you wish to split this job?')).toBeInTheDocument();

            await user.click(screen.getByText('OK'));

            await waitFor(() => {
                expect(mockedExecuteSplitJobFlow).toHaveBeenCalledWith(
                    expect.objectContaining({
                        job,
                        showToast: props.showToast,
                    }),
                );
            });
        });

        it('Split Job cancel does not call executeSplitJobFlow', async () => {
            const user = userEvent.setup();
            const job = createMockJob({allowSplit: true, _groupChildren: []});
            const props = createDefaultProps({job});
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Split Job'));
            await user.click(screen.getByText('Cancel'));

            expect(mockedExecuteSplitJobFlow).not.toHaveBeenCalled();
        });
    });

    // ── 6. Window Global Dialogs ────────────────────────────────────────

    describe('Window Global Dialogs', () => {
        it('Void Job calls window.ReactVoidJobConfirmationDialog.open and refreshes on success', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Void Job'));

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
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Void Job'));

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: ['jobs']});
            });
            invalidateSpy.mockRestore();
        });

        it('Void Job does not refresh or invalidate when dialog is cancelled', async () => {
            (window as any).ReactVoidJobConfirmationDialog = {open: jest.fn().mockResolvedValue(null)};
            const {queryClient: qc} = await import('../../query/queryClient');
            const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Void Job'));

            await waitFor(() => {
                expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalled();
            });
            expect(props.onRefresh).not.toHaveBeenCalled();
            expect(invalidateSpy).not.toHaveBeenCalledWith({queryKey: ['jobs']});
            invalidateSpy.mockRestore();
        });

        it('Swap PODs calls window.ReactSwapPodsDialog.open and refreshes on success', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({done: true, isBulkJob: false, preBook: false}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Swap PODs'));

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
            const user = userEvent.setup();
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            // Allow useEffect to settle (may or may not call API depending on cache)
            await act(async () => {});

            await user.click(screen.getByText('Task Groups'));

            await waitFor(() => {
                expect(screen.getByText('Pickup Events')).toBeInTheDocument();
                expect(screen.getByText('Delivery Events')).toBeInTheDocument();
            });
        });

        it('clicking a group calls openEventGroupDialog with correct groupId/jobId', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await act(async () => {});

            await user.click(screen.getByText('Task Groups'));

            await waitFor(() => {
                expect(screen.getByText('Pickup Events')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Pickup Events'));

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
        it('copies the job number, surfaces an Open toast action, and opens the job in search when clicked', async () => {
            const user = userEvent.setup();
            const writeTextMock = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: {writeText: writeTextMock},
                configurable: true,
            });

            mockedApi.getActivePartnerOptions.mockResolvedValue([{id: 7, text: 'PartnerCo'}]);
            mockedApi.sendToPartner.mockResolvedValue({
                success: true,
                trackingNumber: 'TRK-555',
                message: 'OK',
            });

            const props = createDefaultProps({
                job: createMockJob({id: 42, jobNo: 'J042'}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Send to DFRNT Partner'));
            const partnerItem = await screen.findByText('PartnerCo');
            await user.click(partnerItem);

            await user.click(await screen.findByText('Stub Confirm'));

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

    // ── 8. Menu Closing ─────────────────────────────────────────────────

    describe('Menu Closing', () => {
        it('action handlers call onClose before their action', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Mark as Unread'));

            // onClose should have been called
            expect(props.onClose).toHaveBeenCalled();
        });

        it('callback-based actions call onClose', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({isAgentJob: true}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Add Delivery Stop'));

            expect(props.onClose).toHaveBeenCalled();
        });

        it('confirmation dialog actions call onClose', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({
                job: createMockJob({isBulkJob: true, done: false}),
            });
            renderWithTheme(<JobListContextMenu {...props} />);

            await user.click(screen.getByText('Send to Live'));

            expect(props.onClose).toHaveBeenCalled();
        });
    });
});
