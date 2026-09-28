/**
 * Shared factories and helpers for HomeController tests.
 *
 * Every test file should:
 *   1. import './home.controller.test-setup';   // jest.mock hoisting
 *   2. import { createController, ... } from './home.controller.test-helpers';
 */

import HomeComponent from '../home.controller';
import CurrentWorkLists from '../enums/CurrentWorkLists';

export { CurrentWorkLists };

// ── Controller class (not exported from source, access via component) ─

export const ControllerClass = HomeComponent.controller as any;

type Ctrl = InstanceType<any>;
export type { Ctrl };

// ── Factory ───────────────────────────────────────────────────────────

/** Creates a minimal HomeController instance, bypassing the AngularJS constructor. */
export function createController(overrides: Partial<Ctrl> = {}): Ctrl {
    const ctrl: Ctrl = Object.create(ControllerClass.prototype);

    // ── Properties ────────────────────────────────────────────────────
    ctrl.currentWorkViewMode = CurrentWorkLists.SelectedDriver;
    ctrl.currentCourier = undefined;
    ctrl.currentJobId = undefined;
    ctrl.currentJob = undefined;
    ctrl.currentSelection = undefined;
    ctrl.currentWorkSelection = undefined;
    ctrl.potentialCouriers = undefined;
    ctrl.mapJobList = [];
    ctrl.mapJobListFull = [];
    ctrl.jobList = [];
    ctrl.jobsCurrentList = [];
    ctrl.supports = [];
    ctrl.filteredSupports = [];
    ctrl.isUsCustomer = false;
    ctrl.truckCourierStatus = undefined;
    ctrl.driverLocations = undefined;
    ctrl.driverLocationsLoading = false;
    ctrl.showDriverLocationsNoData = false;
    ctrl.showDriverLocationsData = false;
    ctrl.currentListLoading = false;
    ctrl.supportsLoading = false;
    ctrl.supportsLoadingInBackground = false;
    ctrl.supportsFilter = 'all';
    ctrl.staffFilter = undefined;
    ctrl.eventTypeFilter = undefined;
    ctrl.staffList = [];
    ctrl.eventTypesList = [];
    ctrl.selectedViews = [];
    ctrl.views = [];
    ctrl.dateFilterData = {startDate: {format: () => ''}, endDate: {format: () => ''}};
    ctrl.queryParams = {order: '-time', orderDirection: 'desc', page: 0, pageSize: 50};
    ctrl.boxes = {};
    ctrl.currentLayoutName = 'Default';
    ctrl.isDataLoading = false;
    ctrl.reactCurrentWorkMounted = false;
    ctrl.currentAppPage = 1;
    ctrl.selectedClearListId = undefined;
    ctrl.clearListId = undefined;
    ctrl.defaultJobCategory = undefined;
    ctrl.exactCourierMatchSearchText = undefined;
    ctrl.courierSearchText = undefined;

    // ── Mocked services ───────────────────────────────────────────────
    ctrl.tasksService = {
        cancelJobTaskLoading: jest.fn(),
        validateTaskJobId: jest.fn().mockReturnValue(true),
        findTaskJobInLists: jest.fn().mockReturnValue(null),
        buildFilterRequest: jest.fn().mockReturnValue({}),
        loadTasksInBackground: jest.fn(),
        loadTasks: jest.fn().mockResolvedValue([]),
        getActiveFilterNames: jest.fn().mockReturnValue(''),
        getTasksStatusCount: jest.fn().mockReturnValue(0),
    };
    ctrl.DispatchData = {
        getJobsCurrent: jest.fn().mockResolvedValue({jobs: []}),
        getDispatchJobDetail: jest.fn().mockResolvedValue(null),
        truckCourierStatus: jest.fn().mockResolvedValue({}),
        getPotentialCouriers: jest.fn().mockResolvedValue([]),
        getCourierById: jest.fn().mockResolvedValue(null),
        getDriverLocations: jest.fn().mockResolvedValue({areas: []}),
        updateJobReadStatus: jest.fn().mockResolvedValue(undefined),
        getExactCourierMatch: jest.fn().mockResolvedValue(null),
        getDriverWorkOverview: jest.fn().mockResolvedValue([]),
    };
    ctrl.dispatchJobService = {
        assignSingleJobById: jest.fn().mockResolvedValue(undefined),
        reassignJob: jest.fn().mockResolvedValue(undefined),
    };
    ctrl.toastrService = {
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showWarningToast: jest.fn(),
        showInfoToast: jest.fn(),
    };
    ctrl.jobAddStopService = {
        addNewStop: jest.fn().mockResolvedValue(undefined),
    };

    // ── Mocked controller methods ─────────────────────────────────────
    ctrl.markJobReadStatus = jest.fn().mockResolvedValue(undefined);
    ctrl.loadSupportsInBackground = jest.fn();
    ctrl.getCurrentJobs = jest.fn().mockResolvedValue(undefined);
    ctrl.getPotentialCouriers = jest.fn().mockResolvedValue(undefined);
    ctrl.mapToDispatchMapItem = jest.fn((job: any) => ({
        jobId: job.id, jobNo: job.jobNo, statusId: job.statusId,
    }));
    ctrl.focusDispatchField = jest.fn();
    ctrl.applyScope = jest.fn();
    ctrl.getJobList = jest.fn().mockResolvedValue(undefined);
    ctrl.loadDriversWithJobCounts = jest.fn().mockResolvedValue(undefined);
    ctrl.getSupports = jest.fn().mockResolvedValue(undefined);
    ctrl.refreshJobDetail = jest.fn();
    ctrl.getData = jest.fn().mockResolvedValue(undefined);
    ctrl.searchCourier = jest.fn().mockResolvedValue(undefined);
    ctrl.loadSupports = jest.fn().mockResolvedValue(undefined);
    ctrl.selectJob = jest.fn().mockResolvedValue(undefined);
    ctrl.dispatchJob = jest.fn().mockResolvedValue(undefined);
    ctrl.updateReactCurrentWorkJobList = jest.fn();
    ctrl.fetchDriverLocations = jest.fn().mockResolvedValue(undefined);
    ctrl.saveDateFilterToStorage = jest.fn();
    ctrl.processClearListJobs = jest.fn().mockResolvedValue(undefined);
    ctrl.updateDriverLocationsDisplay = jest.fn();
    ctrl.onCourierSearchSelect = jest.fn().mockResolvedValue(undefined);
    ctrl.updateCourierData = jest.fn().mockResolvedValue(undefined);

    Object.assign(ctrl, overrides);
    return ctrl;
}

// ── Job factories ─────────────────────────────────────────────────────

export function makeJob(id: number, courierId: number, courierName = 'Test Courier') {
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
        statusId: 1,
        pickupAddress: {},
        deliveryAddress: {},
        searchText: '',
    };
}

export function makeUnassignedJob(id: number) {
    return {
        id,
        jobNo: `J${id}`,
        courier: undefined,
        assignedCourier: undefined,
        courierData: undefined,
        statusId: 0,
        pickupAddress: {},
        deliveryAddress: {},
        searchText: '',
    };
}

// ── Window mock lifecycle ─────────────────────────────────────────────

export function setupWindowMocks(): void {
    beforeEach(() => {
        (window as any).ReactJobList = {selectJob: jest.fn(), refresh: jest.fn()};
        (window as any).ReactCurrentWorkJobList = {unmount: jest.fn()};
        (window as any).ReactJobDetails = {refresh: jest.fn()};
    });

    afterEach(() => {
        delete (window as any).ReactJobList;
        delete (window as any).ReactCurrentWorkJobList;
        delete (window as any).ReactJobDetails;
    });
}
