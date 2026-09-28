/**
 * Shared factories and helpers for NationwideController tests.
 *
 * Every test file should:
 *   1. import './nationwide.controller.test-setup';
 *   2. import { createController, ... } from './nationwide.controller.test-helpers';
 */

import NationwideComponent from '../nationwide.controller';
import JobDataType from '../enums/JobDataType';
import {STATUS_TO_LIST_MAP} from '../../../react/pages/nationwide/lib/statusListMap';

export { JobDataType };

export const ControllerClass = NationwideComponent.controller as any;

type Ctrl = InstanceType<any>;
export type { Ctrl };

/** Creates a minimal NationwideControl instance, bypassing the constructor. */
export function createController(overrides: Partial<Ctrl> = {}): Ctrl {
    const ctrl: Ctrl = Object.create(ControllerClass.prototype);

    // Properties
    ctrl.currentJob = undefined;
    ctrl.flightAgentWidgetJob = undefined;
    ctrl.currentSelection = undefined;
    ctrl.jobList = [];
    ctrl.jobListPOD = [];
    ctrl.jobListReprice = [];
    ctrl.isSelectingJob = false;
    ctrl.isDeliveryJobType = false;
    ctrl.isDataLoading = false;
    ctrl.isUsCustomer = false;

    // Flight state
    ctrl.flightOptions = [];
    ctrl.filteredFlightOptions = [];
    ctrl.flightMessage = undefined;
    ctrl.flightsLoading = false;
    ctrl.flightSearchText = '';
    ctrl.lastDepartureTime = undefined;
    ctrl.selectedAirline = undefined;
    ctrl.selectedOutboundAirport = undefined;
    ctrl.selectedInboundAirport = undefined;
    ctrl.outboundAirportOptions = [];
    ctrl.inboundAirportOptions = [];
    ctrl.flightListPromise = undefined;

    // Agent state
    ctrl.agentOptions = [];
    ctrl.agentMessage = undefined;
    ctrl.agentsLoading = false;
    ctrl.agentListPromise = undefined;

    // UI state flags
    ctrl.showNoJobSelectedMessage = false;
    ctrl.showJobHasAssignedFlightMessage = false;
    ctrl.showMissingAirportInfoMessage = false;
    ctrl.showNoFlightsAvailableMessage = false;
    ctrl.showFlightList = false;
    ctrl.showNoAgentJobSelectedMessage = false;
    ctrl.showJobHasAssignedAgentMessage = false;
    ctrl.showNoAgentsAvailableMessage = false;
    ctrl.showAgentList = false;

    // Tasks
    ctrl.tasks = [];
    ctrl.filteredTasks = [];
    ctrl.tasksLoading = false;
    ctrl.tasksLoadingInBackground = false;
    ctrl.tasksFilter = 'all';
    ctrl.staffFilter = undefined;
    ctrl.eventTypeFilter = undefined;
    ctrl.staffList = [];
    ctrl.eventTypesList = [];
    ctrl.currentSupport = undefined;

    // Views/filters
    ctrl.views = [];
    ctrl.selectedViews = [];
    ctrl.viewsInitialized = false;
    ctrl.dateFilterData = {startDate: {format: () => ''}, endDate: {format: () => ''}};
    ctrl.jobFilters = {order: '-time', orderDirection: 'desc', page: 0, pageSize: 50};
    ctrl.jobPodFilters = {order: '-time', orderDirection: 'desc', page: 0, pageSize: 50};
    ctrl.jobRepriceFilters = {order: '-time', orderDirection: 'desc', page: 0, pageSize: 50};

    // Map
    ctrl.mapConfig = undefined;
    ctrl.cachedMapConfig = undefined;
    ctrl.lastMapJobId = undefined;
    ctrl.timeZone = 'Pacific/Auckland';

    // Layout
    ctrl.boxes = {};
    ctrl.currentLayoutName = 'Default';

    // Config
    ctrl.appConfig = {
        US_Customer: false,
        US_Coordinates_Center: {lat: 39.8, lng: -98.5},
        NZ_Coordinates_Center: {lat: -41.2, lng: 174.7},
    };
    ctrl.nationwidePageId = 2;

    // The real map from the shared lib -- this used to be a hand-written fiction
    // (it invented statuses 0 and 2 and omitted 4 -> REPRICE), so any test
    // asserting on the derived list set was validating behaviour that does not
    // exist in production.
    ctrl.STATUS_TO_LIST_MAP = STATUS_TO_LIST_MAP;

    // Mocked services
    ctrl.nationwideService = {
        getNearbyAirports: jest.fn().mockResolvedValue([]),
        getFlightOptions: jest.fn().mockResolvedValue({flights: [], message: undefined}),
        assignFlightToJob: jest.fn().mockResolvedValue(undefined),
        getAgentOptions: jest.fn().mockResolvedValue({agents: [], message: undefined}),
        assignAgentToJob: jest.fn().mockResolvedValue(undefined),
        restoreJob: jest.fn().mockResolvedValue(undefined),
    };
    ctrl.DispatchData = {
        getDispatchJobDetail: jest.fn().mockResolvedValue(null),
        updateJobDetail: jest.fn().mockResolvedValue(undefined),
        getCourierById: jest.fn().mockResolvedValue(null),
        canAssignAgentToJob: jest.fn().mockResolvedValue(true),
    };
    ctrl.dispatchJobService = {
        reassignJob: jest.fn().mockResolvedValue(undefined),
        dispatchJobs: jest.fn().mockResolvedValue(undefined),
    };
    ctrl.toastrService = {
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showWarningToast: jest.fn(),
        showInfoToast: jest.fn(),
    };
    ctrl.tasksService = {
        cancelJobTaskLoading: jest.fn(),
        validateTaskJobId: jest.fn().mockReturnValue(true),
        findTaskJobInLists: jest.fn().mockReturnValue(null),
        buildFilterRequest: jest.fn().mockReturnValue({}),
        loadTasksInBackground: jest.fn(),
        loadTasks: jest.fn().mockResolvedValue([]),
        getActiveFilterNames: jest.fn().mockReturnValue(''),
        getTasksStatusCount: jest.fn().mockReturnValue(0),
        saveStaffFilter: jest.fn(),
        saveEventTypeFilter: jest.fn(),
    };
    ctrl.jobAddStopService = {addNewStop: jest.fn().mockResolvedValue(undefined)};
    ctrl.dispatchDialogService = {
        openDispatchDialog: jest.fn().mockResolvedValue(null),
    };
    ctrl.flightAgentConfirmationDialogService = {
        flightConfirmationDialog: jest.fn().mockResolvedValue({shouldAssign: false}),
    };
    ctrl.$mdDialog = {
        show: jest.fn().mockResolvedValue(undefined),
        alert: jest.fn().mockReturnValue({
            parent: jest.fn().mockReturnThis(),
            clickOutsideToClose: jest.fn().mockReturnThis(),
            title: jest.fn().mockReturnThis(),
            textContent: jest.fn().mockReturnThis(),
            ariaLabel: jest.fn().mockReturnThis(),
            ok: jest.fn().mockReturnThis(),
            targetEvent: jest.fn().mockReturnThis(),
        }),
    };
    ctrl.$document = {parent: jest.fn().mockReturnValue({})};

    // Mocked controller methods
    ctrl.applyScope = jest.fn();
    ctrl.markJobReadStatus = jest.fn();
    ctrl.updateUIState = jest.fn();
    ctrl.updateCurrentSelection = jest.fn();
    ctrl.handleJobSelectionRelatedData = jest.fn().mockResolvedValue(undefined);
    ctrl.loadTasksInBackground = jest.fn();
    ctrl.displayJobOnMap = jest.fn();
    ctrl.selectJob = jest.fn().mockResolvedValue(undefined);
    ctrl.getData = jest.fn().mockResolvedValue(undefined);
    ctrl.getJobList = jest.fn().mockResolvedValue(undefined);
    ctrl.loadTasks = jest.fn().mockResolvedValue(undefined);
    ctrl.loadFlights = jest.fn().mockResolvedValue(undefined);
    ctrl.processAgents = jest.fn().mockResolvedValue(undefined);
    ctrl.findJobInLocalLists = jest.fn().mockReturnValue(undefined);
    ctrl.handleError = jest.fn();
    ctrl.resetAllFlags = jest.fn();
    ctrl.isDeliveryJob = jest.fn().mockReturnValue(false);
    ctrl.filterFlights = jest.fn();
    ctrl.loadViewsFromStorage = jest.fn().mockReturnValue([]);
    ctrl.saveViewsToStorage = jest.fn();
    ctrl.updateDateFilters = jest.fn();
    ctrl.calculateMapBounds = jest.fn().mockReturnValue({center: {lat: 0, lng: 0}, zoom: 7});
    ctrl.saveDateFilterToStorage = jest.fn();
    ctrl.restoreJob = jest.fn().mockResolvedValue(undefined);
    ctrl.reAllocateJobs = jest.fn().mockResolvedValue(undefined);
    ctrl.isDefaultLayout = jest.fn().mockReturnValue(false);
    ctrl.saveBoxVisibility = jest.fn();
    ctrl.remountNationwideReactJobList = jest.fn();
    ctrl.validateJobId = jest.fn().mockReturnValue(true);

    Object.assign(ctrl, overrides);
    return ctrl;
}

// ── Job factories ─────────────────────────────────────────────────────

export function makeFlightJob(id: number, opts: Partial<any> = {}) {
    return {
        id, jobNo: `J${id}`, isFlightJob: true, isAgentJob: false,
        assignedFlight: undefined, assignedAgent: undefined,
        fromAirportId: 10, toAirportId: 20, speedId: 415,
        booked: {add: jest.fn().mockReturnThis(), startOf: jest.fn().mockReturnThis()},
        pickupAddress: {latitude: -36.8, longitude: 174.7},
        deliveryAddress: {latitude: -41.2, longitude: 174.7},
        pickUpTimeZone: {id: 1, text: 'Pacific/Auckland'},
        hasBeenRead: false, searchText: '',
        ...opts,
    };
}

export function makeDeliveryJob(id: number, opts: Partial<any> = {}) {
    return {
        id, jobNo: `J${id}`, isFlightJob: false, isAgentJob: true,
        assignedFlight: undefined, assignedAgent: undefined,
        fromAirportId: undefined, toAirportId: 20,
        pickupAddress: {latitude: -36.8, longitude: 174.7},
        deliveryAddress: {latitude: -41.2, longitude: 174.7},
        hasBeenRead: false, searchText: '',
        ...opts,
    };
}

export function makeJob(id: number, opts: Partial<any> = {}) {
    return {
        id, jobNo: `J${id}`, isFlightJob: false, isAgentJob: false,
        assignedFlight: undefined, assignedAgent: undefined,
        pickupAddress: {latitude: -36.8, longitude: 174.7},
        deliveryAddress: {latitude: -41.2, longitude: 174.7},
        hasBeenRead: false, searchText: '',
        ...opts,
    };
}

// ── Window mock lifecycle ─────────────────────────────────────────────

export function setupWindowMocks(): void {
    beforeEach(() => {
        (window as any).ReactNationwideJobList = {
            selectJob: jest.fn(),
            refresh: jest.fn(),
            updateSearchParams: jest.fn(),
        };
        (window as any).ReactJobDetails = {refresh: jest.fn()};
    });
    afterEach(() => {
        delete (window as any).ReactNationwideJobList;
        delete (window as any).ReactJobDetails;
    });
}
