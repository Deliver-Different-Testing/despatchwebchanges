/** @jest-environment jest-environment-jsdom */
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

import * as api from '../../services/jobListApi';
import {executeSplitJobFlow} from '../../services/splitJobFlow';
import {openAddEventDialog} from '../dialogs/add-event-dialog';
import {openEventGroupDialog} from '../dialogs/event-group-dialog';
import {isAiEnabled} from '../../../functions/aiSettings';

const mockedApi = api as jest.Mocked<typeof api>;
const mockedExecuteSplitJobFlow = executeSplitJobFlow as jest.Mock;
const mockedOpenAddEventDialog = openAddEventDialog as jest.Mock;
const mockedOpenEventGroupDialog = openEventGroupDialog as jest.Mock;
const mockedIsAiEnabled = isAiEnabled as jest.Mock;

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
    mockedApi.getEventGroups.mockResolvedValue(mockEventGroups);
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

// ── Tests ─────────────────────────────────────────────────────────────

describe('JobListContextMenu', () => {
    describe('Rendering & Visibility', () => {
        it('does not render when job or position is null', () => {
            const {container: c1, unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: null})} />);
            expect(c1.innerHTML).toBe('');
            unmount();

            const {container: c2} = renderWithTheme(<JobListContextMenu {...createDefaultProps({position: null})} />);
            expect(c2.innerHTML).toBe('');
        });

        it('renders menu with expected items for Dispatch page and correct read status toggle', () => {
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(screen.getByText('Mark as Unread')).toBeInTheDocument();
            expect(screen.getByText('Late Pickup')).toBeInTheDocument();
            expect(screen.getByText('Late Delivery')).toBeInTheDocument();
            expect(screen.getByText('Add Task - Other')).toBeInTheDocument();
            expect(screen.getByText('Task Groups')).toBeInTheDocument();
            expect(screen.getByText('Void Job')).toBeInTheDocument();
            expect(screen.getByText('Set First Job')).toBeInTheDocument();
            expect(screen.getByText('Restore')).toBeInTheDocument();
            expect(screen.getByText('Mark Missing')).toBeInTheDocument();
            expect(screen.queryByText('Add Pickup Stop')).not.toBeInTheDocument();
            expect(screen.queryByText('Add Delivery Stop')).not.toBeInTheDocument();
            expect(screen.queryByText('AI Late Alert Analysis (Beta)')).not.toBeInTheDocument();
            unmount();

            // Mark as Read when hasBeenRead is false
            renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({hasBeenRead: false})})} />);
            expect(screen.getByText('Mark as Read')).toBeInTheDocument();
        });

        it('shows/hides Late Pickup/Delivery based on page type', () => {
            // JobSearch shows them
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.JobSearch})} />);
            expect(screen.getByText('Late Pickup')).toBeInTheDocument();
            expect(screen.getByText('Late Delivery')).toBeInTheDocument();
            unmount();

            // Domestic hides them
            renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic})} />);
            expect(screen.queryByText('Late Pickup')).not.toBeInTheDocument();
            expect(screen.queryByText('Late Delivery')).not.toBeInTheDocument();
        });

        it('shows/hides Unassign Flight and Unassign Agent based on page and job props', () => {
            const flightJob = createMockJob({
                isFlightJob: true,
                assignedFlight: {flightNumber: 'NZ123', departureTimeZone: 'NZST', arrivalTimeZone: 'AEST', notes: ''},
            });
            const agentJob = createMockJob({
                assignedAgent: {agentId: 1, agentName: 'Agent Smith', agentRate: 50, agentRanking: 'A', agentNotes: ''},
            });

            // Domestic shows Unassign Flight
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic, job: flightJob})} />);
            expect(screen.getByText('Unassign Flight')).toBeInTheDocument();
            u1();

            // Dispatch hides Unassign Flight
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Dispatch, job: flightJob})} />);
            expect(screen.queryByText('Unassign Flight')).not.toBeInTheDocument();
            u2();

            // Domestic shows Unassign Agent
            const {unmount: u3} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic, job: agentJob})} />);
            expect(screen.getByText('Unassign Agent')).toBeInTheDocument();
            u3();

            // Dispatch hides Unassign Agent
            renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Dispatch, job: agentJob})} />);
            expect(screen.queryByText('Unassign Agent')).not.toBeInTheDocument();
        });

        it('shows Add Stop for agent jobs based on airport IDs', () => {
            const {unmount} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({isAgentJob: true})})} />);
            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();
            unmount();

            renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({isAgentJob: true, toAirportId: 5, fromAirportId: undefined})})} />);
            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
        });

        it('shows conditional items: AI Late Alert, Reprice, Send to Live, Swap PODs, Split Job, Re-Dispatch', () => {
            // AI Late Alert when enabled
            mockedIsAiEnabled.mockReturnValue(true);
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Dispatch})} />);
            expect(screen.getByText('AI Late Alert Analysis (Beta)')).toBeInTheDocument();
            u1();
            mockedIsAiEnabled.mockReturnValue(false);

            // Reprice for nationwide speed
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false})})} />);
            expect(screen.getByText('Reprice Job')).toBeInTheDocument();
            expect(screen.queryByText('Price Breakdown')).not.toBeInTheDocument();
            u2();

            // No Reprice when internalStatusId is 4
            const {unmount: u3} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({speedId: 415, internalStatusId: 4, preBook: false})})} />);
            expect(screen.queryByText('Reprice Job')).not.toBeInTheDocument();
            u3();

            // Send to Live for bulk not done
            const {unmount: u4} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({isBulkJob: true, done: false})})} />);
            expect(screen.getByText('Send to Live')).toBeInTheDocument();
            u4();

            // No Send to Live when done
            const {unmount: u5} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({isBulkJob: true, done: true})})} />);
            expect(screen.queryByText('Send to Live')).not.toBeInTheDocument();
            u5();

            // Swap PODs when done
            const {unmount: u6} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({done: true, isBulkJob: false, preBook: false})})} />);
            expect(screen.getByText('Swap PODs')).toBeInTheDocument();
            u6();

            // No Swap PODs when not done
            const {unmount: u7} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({done: false})})} />);
            expect(screen.queryByText('Swap PODs')).not.toBeInTheDocument();
            u7();

            // Split Job when allowSplit and no group children
            const {unmount: u8} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({allowSplit: true, _groupChildren: []})})} />);
            expect(screen.getByText('Split Job')).toBeInTheDocument();
            u8();

            // No Split Job when _groupChildren has items
            const {unmount: u9} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({allowSplit: true, _groupChildren: [createMockJob({id: 2})]})})} />);
            expect(screen.queryByText('Split Job')).not.toBeInTheDocument();
            u9();

            // Re-Dispatch when assignedCourier exists
            const {unmount: u10} = renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}})})} />);
            expect(screen.getByText('Re-Dispatch')).toBeInTheDocument();
            u10();

            // No Re-Dispatch when no assignedCourier
            renderWithTheme(<JobListContextMenu {...createDefaultProps({job: createMockJob({assignedCourier: undefined})})} />);
            expect(screen.queryByText('Re-Dispatch')).not.toBeInTheDocument();
        });
    });

    describe('Action Handlers — Direct API Calls', () => {
        it('Mark as Read/Unread calls API with correct params and handles errors', async () => {
            const user = userEvent.setup();

            // Mark as Unread
            const props1 = createDefaultProps({job: createMockJob({hasBeenRead: true})});
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Mark as Unread'));
            await waitFor(() => expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, false));
            expect(props1.showToast).toHaveBeenCalledWith('Job marked as unread', 'success');
            expect(props1.onRefresh).toHaveBeenCalled();
            u1();

            // Mark as Read
            mockedApi.updateJobReadStatus.mockClear();
            const props2 = createDefaultProps({job: createMockJob({hasBeenRead: false})});
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...props2} />);
            await user.click(screen.getByText('Mark as Read'));
            await waitFor(() => expect(mockedApi.updateJobReadStatus).toHaveBeenCalledWith(1, true));
            expect(props2.showToast).toHaveBeenCalledWith('Job marked as read', 'success');
            u2();

            // Error case
            mockedApi.updateJobReadStatus.mockRejectedValueOnce(new Error('Network error'));
            const props3 = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props3} />);
            await user.click(screen.getByText('Mark as Unread'));
            await waitFor(() => expect(props3.showToast).toHaveBeenCalledWith('Error marking job as read/unread', 'error'));
        });

        it('Reprice, Re-Dispatch, Restore, Mark Missing, and Add Task call correct APIs', async () => {
            const user = userEvent.setup();

            // Reprice
            const propsReprice = createDefaultProps({job: createMockJob({speedId: 415, internalStatusId: 1, preBook: false})});
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...propsReprice} />);
            await user.click(screen.getByText('Reprice Job'));
            await waitFor(() => expect(mockedApi.moveJobToReprice).toHaveBeenCalledWith(1));
            expect(propsReprice.showToast).toHaveBeenCalledWith('Job J001 marked as Reprice', 'success');
            expect(propsReprice.onRefresh).toHaveBeenCalled();
            u1();

            // Re-Dispatch
            const propsRedispatch = createDefaultProps({job: createMockJob({assignedCourier: {id: 5, text: 'Courier A'}})});
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...propsRedispatch} />);
            await user.click(screen.getByText('Re-Dispatch'));
            await waitFor(() => expect(mockedApi.reAllocateJobs).toHaveBeenCalledWith(5, [1]));
            expect(propsRedispatch.showToast).toHaveBeenCalledWith('Job J001 re-dispatched successfully', 'success');
            u2();

            // Restore
            const propsRestore = createDefaultProps();
            const {unmount: u3} = renderWithTheme(<JobListContextMenu {...propsRestore} />);
            await user.click(screen.getByText('Restore'));
            await waitFor(() => expect(mockedApi.restoreJobs).toHaveBeenCalledWith([1]));
            expect(propsRestore.onRefresh).toHaveBeenCalled();
            u3();

            // Mark Missing
            const propsMissing = createDefaultProps();
            const {unmount: u4} = renderWithTheme(<JobListContextMenu {...propsMissing} />);
            await user.click(screen.getByText('Mark Missing'));
            await waitFor(() => expect(mockedApi.markJobMissing).toHaveBeenCalledWith(1));
            expect(propsMissing.showToast).toHaveBeenCalledWith('Job successfully marked as missing.', 'success');
            u4();

            // Add Task Other
            const propsTask = createDefaultProps({job: createMockJob({id: 42, jobNo: 'J042', client: 'Acme', clientId: 200})});
            renderWithTheme(<JobListContextMenu {...propsTask} />);
            await user.click(screen.getByText('Add Task - Other'));
            await waitFor(() => expect(mockedOpenAddEventDialog).toHaveBeenCalledWith({
                job: {id: 42, jobNo: 'J042', client: 'Acme', clientId: 200},
                toastService: {showToast: propsTask.showToast},
            }));
            expect(propsTask.onRefresh).toHaveBeenCalled();
        });
    });

    describe('Late Call Dialog', () => {
        it('submits late pickup with correct lateType and shows success toast', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);
            await user.click(screen.getByText('Late Pickup'));
            expect(screen.getByText('Late Pickup', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
            await user.click(screen.getByLabelText('Minutes'));
            await user.paste('15');
            await user.click(screen.getByText('Save'));
            await waitFor(() => expect(mockedApi.lateCall).toHaveBeenCalledWith({jobId: 1, lateType: 1, lateTime: 15, calculationRequired: true}));
            expect(props.showToast).toHaveBeenCalledWith('Late call applied successfully', 'success');
            expect(props.onRefresh).toHaveBeenCalled();
        });

        it('submits late delivery with correct lateType', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);
            await user.click(screen.getByText('Late Delivery'));
            expect(screen.getByText('Late Delivery', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
            await user.click(screen.getByLabelText('Minutes'));
            await user.paste('30');
            await user.click(screen.getByText('Save'));
            await waitFor(() => expect(mockedApi.lateCall).toHaveBeenCalledWith({jobId: 1, lateType: 2, lateTime: 30, calculationRequired: true}));
        });

        it('submits via Enter key, cancels without API call, and disables Save when empty', async () => {
            const user = userEvent.setup();

            // Enter key submission
            const props1 = createDefaultProps();
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Late Pickup'));
            await user.click(screen.getByLabelText('Minutes'));
            await user.paste('10');
            await user.keyboard('{Enter}');
            await waitFor(() => expect(mockedApi.lateCall).toHaveBeenCalledWith(expect.objectContaining({lateTime: 10})));
            u1();

            // Cancel closes without API call
            mockedApi.lateCall.mockClear();
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);
            await user.click(screen.getByText('Late Pickup'));
            expect(screen.getByLabelText('Minutes')).toBeInTheDocument();
            await user.click(screen.getByText('Cancel'));
            await waitFor(() => expect(screen.queryByLabelText('Minutes')).not.toBeInTheDocument());
            expect(mockedApi.lateCall).not.toHaveBeenCalled();
            u2();

            // Empty minutes disables Save
            renderWithTheme(<JobListContextMenu {...createDefaultProps()} />);
            await user.click(screen.getByText('Late Pickup'));
            expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        });

        it('shows error toast on API failure', async () => {
            const user = userEvent.setup();
            mockedApi.lateCall.mockRejectedValueOnce(new Error('Server error'));
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);
            await user.click(screen.getByText('Late Pickup'));
            await user.click(screen.getByLabelText('Minutes'));
            await user.paste('5');
            await user.click(screen.getByText('Save'));
            await waitFor(() => expect(props.showToast).toHaveBeenCalledWith('Error applying late pickup', 'error'));
        });
    });

    describe('Confirmation Dialogs', () => {
        it('Unassign Flight/Agent: confirms and calls API, cancel skips API', async () => {
            const user = userEvent.setup();
            const flightJob = createMockJob({
                isFlightJob: true,
                assignedFlight: {flightNumber: 'NZ123', departureTimeZone: 'NZST', arrivalTimeZone: 'AEST', notes: ''},
            });
            const agentJob = createMockJob({
                assignedAgent: {agentId: 1, agentName: 'Agent Smith', agentRate: 50, agentRanking: 'A', agentNotes: ''},
            });

            // Unassign Flight — OK
            const props1 = createDefaultProps({appPage: AppPageEnum.Domestic, job: flightJob});
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Unassign Flight'));
            expect(screen.getByText('Unassign Flight?')).toBeInTheDocument();
            await user.click(screen.getByText('OK'));
            await waitFor(() => expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1));
            expect(props1.showToast).toHaveBeenCalledWith('NZ123 unassigned successfully', 'success');
            expect(props1.onRefresh).toHaveBeenCalled();
            u1();

            // Unassign Flight — Cancel
            mockedApi.restoreNationwideJob.mockClear();
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...createDefaultProps({appPage: AppPageEnum.Domestic, job: flightJob})} />);
            await user.click(screen.getByText('Unassign Flight'));
            await user.click(screen.getByText('Cancel'));
            expect(mockedApi.restoreNationwideJob).not.toHaveBeenCalled();
            u2();

            // Unassign Agent — OK
            const props3 = createDefaultProps({appPage: AppPageEnum.Domestic, job: agentJob});
            renderWithTheme(<JobListContextMenu {...props3} />);
            await user.click(screen.getByText('Unassign Agent'));
            expect(screen.getByText('Unassign Agent?')).toBeInTheDocument();
            await user.click(screen.getByText('OK'));
            await waitFor(() => expect(mockedApi.restoreNationwideJob).toHaveBeenCalledWith(1));
            expect(props3.showToast).toHaveBeenCalledWith('Agent Smith unassigned successfully', 'success');
        });

        it('Send to Live and Set First Job: confirms and calls API', async () => {
            const user = userEvent.setup();

            // Send to Live
            const props1 = createDefaultProps({job: createMockJob({isBulkJob: true, done: false})});
            const {unmount} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Send to Live'));
            expect(screen.getByText('Send to Live?')).toBeInTheDocument();
            await user.click(screen.getByText('OK'));
            await waitFor(() => expect(mockedApi.releaseBulkJob).toHaveBeenCalledWith(1));
            expect(props1.showToast).toHaveBeenCalledWith('Bulk job J001 sent to live successfully', 'success');
            unmount();

            // Set First Job
            const props2 = createDefaultProps({job: createMockJob({courierData: {courierId: 77, courierNumber: 'C77', courier: 'Test'} as any})});
            renderWithTheme(<JobListContextMenu {...props2} />);
            await user.click(screen.getByText('Set First Job'));
            expect(screen.getByText('Set First Job?')).toBeInTheDocument();
            await user.click(screen.getByText('OK'));
            await waitFor(() => expect(mockedApi.setFirstJob).toHaveBeenCalledWith(1, 77));
            expect(props2.showToast).toHaveBeenCalledWith('Job set as first job successfully', 'success');
        });
    });

    describe('Callback-Based Actions', () => {
        it('Add Stop calls onAddStop, Split Job calls executeSplitJobFlow on confirm and skips on cancel', async () => {
            const user = userEvent.setup();

            // Add Stop
            const job = createMockJob({isAgentJob: true});
            const props1 = createDefaultProps({job});
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Add Delivery Stop'));
            expect(props1.onAddStop).toHaveBeenCalledWith(job);
            u1();

            // Split Job — OK
            const splitJob = createMockJob({allowSplit: true, _groupChildren: []});
            const props2 = createDefaultProps({job: splitJob});
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...props2} />);
            await user.click(screen.getByText('Split Job'));
            expect(screen.getByText('Split Job', {selector: '[class*="DialogTitle"]'})).toBeInTheDocument();
            expect(screen.getByText('Are you sure you wish to split this job?')).toBeInTheDocument();
            await user.click(screen.getByText('OK'));
            await waitFor(() => expect(mockedExecuteSplitJobFlow).toHaveBeenCalledWith(expect.objectContaining({job: splitJob, showToast: props2.showToast})));
            u2();

            // Split Job — Cancel
            mockedExecuteSplitJobFlow.mockClear();
            const props3 = createDefaultProps({job: createMockJob({allowSplit: true, _groupChildren: []})});
            renderWithTheme(<JobListContextMenu {...props3} />);
            await user.click(screen.getByText('Split Job'));
            await user.click(screen.getByText('Cancel'));
            expect(mockedExecuteSplitJobFlow).not.toHaveBeenCalled();
        });
    });

    describe('Window Global Dialogs', () => {
        it('Void Job and Swap PODs call window globals and refresh', async () => {
            const user = userEvent.setup();

            // Void Job
            const props1 = createDefaultProps();
            const {unmount} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Void Job'));
            await waitFor(() => expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalledWith(
                {id: 1, jobNo: 'J001', isBulkJob: false, isArchived: false},
                {showToast: props1.showToast},
            ));
            expect(props1.onRefresh).toHaveBeenCalled();
            unmount();

            // Swap PODs
            const props2 = createDefaultProps({job: createMockJob({done: true, isBulkJob: false, preBook: false})});
            renderWithTheme(<JobListContextMenu {...props2} />);
            await user.click(screen.getByText('Swap PODs'));
            await waitFor(() => expect((window as any).ReactSwapPodsDialog.open).toHaveBeenCalledWith('J001', {showToast: props2.showToast}));
            expect(props2.onRefresh).toHaveBeenCalled();
        });
    });

    describe('Event Groups Submenu', () => {
        it('opens submenu with groups and clicking a group calls openEventGroupDialog', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListContextMenu {...props} />);
            await act(async () => {});

            await user.click(screen.getByText('Task Groups'));
            await waitFor(() => {
                expect(screen.getByText('Pickup Events')).toBeInTheDocument();
                expect(screen.getByText('Delivery Events')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Pickup Events'));
            await waitFor(() => expect(mockedOpenEventGroupDialog).toHaveBeenCalledWith({
                eventGroupId: 10,
                jobId: 1,
                toastService: {showToast: props.showToast},
            }));
            expect(props.onRefresh).toHaveBeenCalled();
        });
    });

    describe('Menu Closing', () => {
        it('action handlers and callback-based actions call onClose', async () => {
            const user = userEvent.setup();

            // Direct action
            const props1 = createDefaultProps();
            const {unmount: u1} = renderWithTheme(<JobListContextMenu {...props1} />);
            await user.click(screen.getByText('Mark as Unread'));
            expect(props1.onClose).toHaveBeenCalled();
            u1();

            // Callback action
            const props2 = createDefaultProps({job: createMockJob({isAgentJob: true})});
            const {unmount: u2} = renderWithTheme(<JobListContextMenu {...props2} />);
            await user.click(screen.getByText('Add Delivery Stop'));
            expect(props2.onClose).toHaveBeenCalled();
            u2();

            // Confirmation dialog action
            const props3 = createDefaultProps({job: createMockJob({isBulkJob: true, done: false})});
            renderWithTheme(<JobListContextMenu {...props3} />);
            await user.click(screen.getByText('Send to Live'));
            expect(props3.onClose).toHaveBeenCalled();
        });
    });
});
