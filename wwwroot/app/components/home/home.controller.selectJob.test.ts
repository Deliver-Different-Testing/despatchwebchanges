/**
 * HomeController.selectJob Tests
 *
 * Focused tests for the selectJob method, specifically verifying that
 * clicking a job from the current work list does not needlessly
 * reload the list when the courier hasn't changed.
 */

// ── Mocks for heavy/AngularJS dependencies ────────────────────────────

// Mock AngularJS module system and angular.copy
jest.mock('angular', () => ({
    copy: jest.fn((obj: any) => ({...obj})),
    module: jest.fn().mockReturnValue({
        component: jest.fn(),
        provider: jest.fn(),
        factory: jest.fn(),
        service: jest.fn(),
        config: jest.fn(),
        run: jest.fn(),
    }),
}));

// Mock services that home.controller.ts imports at module level
jest.mock('../../services/dispatch-core.service', () => ({}));
jest.mock('../../services/dispatch-executor.service', () => ({}));
jest.mock('../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service', () => ({}));
jest.mock('../dialogs/job-file-upload-dialog/job-file-upload-dialog.service', () => ({}));
jest.mock('../dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service', () => ({}));
jest.mock('../../services/job-add-stop.service', () => ({}));
jest.mock('../dialogs/messaging-dialog/messaging-dialog.service', () => ({}));
jest.mock('../../services/tasks.service', () => ({}));
jest.mock('../dialogs/create-job-dialog/create-job-dialog.service', () => ({}));
jest.mock('../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service', () => ({}));
jest.mock('../../react/components/dialogs/add-event-dialog', () => ({openAddEventDialog: jest.fn()}));
jest.mock('../../react/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module', () => ({
    openInterCourierChargeDialog: jest.fn(),
}));
jest.mock('../../react/services/jobSearchApi', () => ({
    fetchDispatchJobs: jest.fn(),
    fetchClearListJobs: jest.fn(),
}));
jest.mock('../../react/query/queryClient', () => ({queryKeys: {}}));
jest.mock('../../functions/setDateFilterDefaults', () => jest.fn().mockReturnValue({
    startDate: {format: () => ''}, endDate: {format: () => ''},
}));

import HomeComponent from './home.controller';
import CurrentWorkLists from './enums/CurrentWorkLists';

// Type alias for the controller (not exported directly)
type HomeControllerInstance = InstanceType<any>;

/**
 * Creates a minimal HomeController instance (bypassing the constructor)
 * with mocked methods that selectJob depends on.
 */
function createController(overrides: Partial<HomeControllerInstance> = {}): HomeControllerInstance {
    const ControllerClass = HomeComponent.controller as any;
    const ctrl: HomeControllerInstance = Object.create(ControllerClass.prototype);

    // Properties selectJob reads
    ctrl.currentWorkViewMode = CurrentWorkLists.SelectedDriver;
    ctrl.currentCourier = undefined;
    ctrl.currentJobId = undefined;
    ctrl.currentJob = undefined;
    ctrl.currentSelection = undefined;
    ctrl.currentWorkSelection = undefined;
    ctrl.potentialCouriers = undefined;
    ctrl.mapJobList = [];
    ctrl.jobsCurrentList = [];

    // Methods selectJob calls — all mocked
    ctrl.tasksService = {cancelJobTaskLoading: jest.fn()};
    ctrl.markJobReadStatus = jest.fn().mockResolvedValue(undefined);
    ctrl.loadSupportsInBackground = jest.fn();
    ctrl.getCurrentJobs = jest.fn().mockResolvedValue(undefined);
    ctrl.getPotentialCouriers = jest.fn().mockResolvedValue(undefined);
    ctrl.mapToDispatchMapItem = jest.fn().mockReturnValue({jobId: 1});
    ctrl.focusDispatchField = jest.fn();
    ctrl.applyScope = jest.fn();
    ctrl.DispatchData = {truckCourierStatus: jest.fn().mockResolvedValue({})};

    Object.assign(ctrl, overrides);
    return ctrl;
}

/** Helper to build a minimal job with courier data */
function makeJob(id: number, courierId: number, courierName = 'Test Courier') {
    return {
        id,
        jobNo: `J${id}`,
        courier: `C${courierId}`,
        assignedCourier: {id: courierId, text: courierName},
        courierData: {
            courierId,
            courierName,
            courier: `C${courierId}`,
            courierNumber: `${courierId}`,
        },
    };
}

/** Helper to build a job with no courier assigned */
function makeUnassignedJob(id: number) {
    return {
        id,
        jobNo: `J${id}`,
        courier: undefined,
        assignedCourier: undefined,
        courierData: undefined,
    };
}

describe('HomeController.selectJob — current work list refresh', () => {
    beforeEach(() => {
        // Provide a minimal window.ReactJobList so selectJob doesn't error
        (window as any).ReactJobList = {selectJob: jest.fn()};
    });

    afterEach(() => {
        delete (window as any).ReactJobList;
    });

    it('does NOT call getCurrentJobs when the job belongs to the already-loaded courier', async () => {
        const ctrl = createController({
            currentCourier: {id: 42, text: 'Courier 42'},
        });

        const job = makeJob(100, 42);
        await ctrl.selectJob(job);

        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
    });

    it('DOES call getCurrentJobs when the job belongs to a different courier', async () => {
        const ctrl = createController({
            currentCourier: {id: 42, text: 'Courier 42'},
        });

        const job = makeJob(100, 99, 'Other Courier');
        await ctrl.selectJob(job);

        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(99);
    });

    it('DOES call getCurrentJobs when no courier was previously loaded', async () => {
        const ctrl = createController({
            currentCourier: undefined,
        });

        const job = makeJob(100, 42);
        await ctrl.selectJob(job);

        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('updates currentCourier even when the courier has not changed', async () => {
        const ctrl = createController({
            currentCourier: {id: 42, text: 'Old Name'},
        });

        const job = makeJob(100, 42, 'Updated Name');
        await ctrl.selectJob(job);

        expect(ctrl.currentCourier).toEqual({id: 42, text: 'Updated Name'});
    });

    it('preserves currentCourier and jobsCurrentList for unassigned jobs', async () => {
        const originalCourier = {id: 42, text: 'Courier 42'};
        const originalJobs = [{id: 1}, {id: 2}];

        const ctrl = createController({
            currentCourier: originalCourier,
            jobsCurrentList: originalJobs,
        });

        const job = makeUnassignedJob(200);
        await ctrl.selectJob(job);

        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
        expect(ctrl.currentCourier).toEqual(originalCourier);
        expect(ctrl.jobsCurrentList).toBe(originalJobs);
    });

    it('updates currentWorkSelection even when the courier has not changed', async () => {
        const ctrl = createController({
            currentCourier: {id: 42, text: 'Courier 42'},
        });

        const job = makeJob(100, 42, 'Courier Forty-Two');
        await ctrl.selectJob(job);

        expect(ctrl.currentWorkSelection).toBe(' for Courier C42: Courier Forty-Two');
    });

    it('still fetches truck courier status even when skipping getCurrentJobs', async () => {
        const ctrl = createController({
            currentCourier: {id: 42, text: 'Courier 42'},
        });

        const job = makeJob(100, 42);
        await ctrl.selectJob(job);

        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
        expect(ctrl.DispatchData.truckCourierStatus).toHaveBeenCalledWith(42);
    });
});
