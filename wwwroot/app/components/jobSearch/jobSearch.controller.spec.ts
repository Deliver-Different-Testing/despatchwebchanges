/** @jest-environment jest-environment-jsdom */
/**
 * Tests for JobSearchController
 *
 * Covers constructor initialization, date range logic, React bridge integration,
 * job selection, courier search filtering, layout management, and lifecycle cleanup.
 *
 * Uses the same mock-$http pattern as dispatch-core.service.spec.ts — we construct
 * the controller directly with mock dependencies instead of bootstrapping AngularJS DI.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock('./jobSearch.styles.less', () => ({}));

jest.mock('angular', () => ({
    default: {
        element: jest.fn((_sel: string) => ({
            length: 0,
            css: jest.fn(),
            controller: jest.fn(),
            append: jest.fn(),
        })),
        module: jest.fn(() => ({service: jest.fn(), provider: jest.fn()})),
        copy: (obj: any) => JSON.parse(JSON.stringify(obj)),
        identity: (x: any) => x,
    },
    element: jest.fn((_sel: string) => ({
        length: 0,
        css: jest.fn(),
        controller: jest.fn(),
        append: jest.fn(),
    })),
    module: jest.fn(() => ({service: jest.fn(), provider: jest.fn()})),
    copy: (obj: any) => JSON.parse(JSON.stringify(obj)),
    identity: (x: any) => x,
}));

jest.mock('../../react/utils/dateUtils', () => ({
    formatDateForApiWithTzs: (date: any) => date?.format?.('YYYY-MM-DD') ?? '',
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
}));

jest.mock('../../react/services/jobSearchApi', () => ({
    fetchPodJobs: jest.fn(),
    fetchBulkJobs: jest.fn(),
}));

jest.mock('../../react/query/queryClient', () => ({
    queryKeys: {
        jobSearch: {
            pod: jest.fn((params: any) => ['jobSearch', 'pod', params]),
            bulk: jest.fn((params: any) => ['jobSearch', 'bulk', params]),
        },
    },
}));

jest.mock('../../functions/aiSettings', () => ({
    setAiEnabled: jest.fn(),
    isAiEnabled: jest.fn(() => false),
}));

jest.mock('../../filters', () => ({
    timezoneShortFilter: jest.fn(() => 'NZST'),
}));

jest.mock('./jobSearch.template.html', () => '<div></div>', {virtual: true});
jest.mock('../../react/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module', () => ({
    openInterCourierChargeDialog: jest.fn(() => Promise.resolve()),
}));

// Set globals before module import so module-level ContactID is captured correctly
(window as any).ContactID = 42;
(window as any).TimeZone = 'New Zealand Standard Time';
(window as any).ClientInternal = false;
(window as any).Modernizr = {localstorage: true};

// ── Import after mocks ───────────────────────────────────────────────

import JobSearchComponent from './jobSearch.controller';

const JobSearchController = JobSearchComponent.controller as any;

// ── Helpers ───────────────────────────────────────────────────────────

function createMockJobSearchService() {
    return {
        getPodJobs: jest.fn().mockResolvedValue({jobs: [], totalCount: 0, hasMore: false}),
        searchBulkJobs: jest.fn().mockResolvedValue({jobs: [], totalCount: 0, hasMore: false}),
        getScanDetail: jest.fn().mockResolvedValue([]),
        getDispatchBulkJobDetail: jest.fn().mockResolvedValue({id: 1, jobNo: 'B001'}),
        getPodJobsDownloadUrl: jest.fn().mockReturnValue('/Job/PodSearchDownload?test'),
        getClientJobsReportDownloadUrl: jest.fn().mockReturnValue('/Job/ClientJobsReportDownload?test'),
        uploadJobList: jest.fn().mockResolvedValue(undefined),
        validateSwapPOD: jest.fn().mockResolvedValue(42),
        swapPOD: jest.fn().mockResolvedValue({}),
        reSendJobs: jest.fn().mockResolvedValue({}),
        reAssignJobs: jest.fn().mockResolvedValue({}),
        sendPOD: jest.fn().mockResolvedValue({}),
        unSplitJob: jest.fn().mockResolvedValue(''),
        getActiveClients: jest.fn().mockResolvedValue([]),
        getActiveCouriersSearch: jest.fn().mockResolvedValue([]),
    };
}

function createMockToastrService() {
    return {
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showWarningToast: jest.fn(),
        showInfoToast: jest.fn(),
    };
}

function createMockDispatchCoreService() {
    return {
        getDispatchJobDetail: jest.fn().mockResolvedValue({
            id: 1,
            jobNo: 'J001',
            booked: dayjs('2024-06-15'),
            pickupAddress: {latitude: -36.84, longitude: 174.76},
        }),
        addRestoreEvent: jest.fn().mockResolvedValue(undefined),
        restoreJobs: jest.fn().mockResolvedValue(undefined),
        restoreSplitJobs: jest.fn().mockResolvedValue(undefined),
        searchSpeedOptions: jest.fn().mockResolvedValue([]),
        updateJobDetail: jest.fn().mockResolvedValue(undefined),
    };
}

function createMockDispatchExecutor() {
    return {
        dispatchJobs: jest.fn().mockResolvedValue(undefined),
        assignSingleJobToCourier: jest.fn().mockResolvedValue(undefined),
    };
}

function createMockMdDialog() {
    const promptChain = {
        title: jest.fn().mockReturnThis(),
        textContent: jest.fn().mockReturnThis(),
        placeholder: jest.fn().mockReturnThis(),
        ariaLabel: jest.fn().mockReturnThis(),
        initialValue: jest.fn().mockReturnThis(),
        targetEvent: jest.fn().mockReturnThis(),
        required: jest.fn().mockReturnThis(),
        ok: jest.fn().mockReturnThis(),
        cancel: jest.fn().mockReturnThis(),
    };
    const confirmChain = {...promptChain};
    const alertChain = {
        ...promptChain,
        clickOutsideToClose: jest.fn().mockReturnThis(),
        parent: jest.fn().mockReturnThis(),
    };
    return {
        show: jest.fn().mockResolvedValue('result'),
        prompt: jest.fn().mockReturnValue(promptChain),
        confirm: jest.fn().mockReturnValue(confirmChain),
        alert: jest.fn().mockReturnValue(alertChain),
    };
}

function createMockScope() {
    return {
        $on: jest.fn(() => jest.fn()),
        $evalAsync: jest.fn(),
        $$phase: null,
    };
}

function createController(overrides: Record<string, any> = {}): InstanceType<typeof JobSearchController> {
    const jobSearchService = overrides.jobSearchService ?? createMockJobSearchService();
    const $mdDialog = overrides.$mdDialog ?? createMockMdDialog();
    const dispatchExecutor = overrides.dispatchExecutor ?? createMockDispatchExecutor();
    const toastrService = overrides.toastrService ?? createMockToastrService();
    const dispatchCore = overrides.dispatchCore ?? createMockDispatchCoreService();
    const $mdSidenav = jest.fn().mockReturnValue({toggle: jest.fn()});
    const $document = [{} as Document];
    const messagingDialogService = {openMessagingDialog: jest.fn()};
    const createJobDialogService = {showCreateJobDialog: jest.fn()};
    const accessorialChargesDialogService = {showAccessorialChargesDialog: jest.fn()};
    const jobFileUploadDialogService = {openJobFileUploadDialog: jest.fn()};
    const bulkPriceUploadDialogService = {openBulkPriceUploadDialog: jest.fn()};
    const dashboardSettingsDialogService = {openSettingsDialog: jest.fn()};
    const appConfig = {
        US_Customer: overrides.isUsCustomer ?? false,
        US_Coordinates_Center: {lat: 38.9, lng: -77.0},
        NZ_Coordinates_Center: {lat: -36.8, lng: 174.7},
    };
    const $scope = overrides.$scope ?? createMockScope();
    const $timeout = jest.fn((fn: any, _delay?: number) => {
        fn();
        return {} as any;
    }) as any;
    $timeout.cancel = jest.fn();
    const $interval = jest.fn() as any;
    $interval.cancel = jest.fn();

    // Set globals the controller expects
    (window as any).ClientInternal = overrides.isAdmin ?? false;
    (window as any).Modernizr = {localstorage: true};
    (window as any).ContactID = 42;
    (window as any).TimeZone = 'New Zealand Standard Time';

    return new (JobSearchController as any)(
        jobSearchService, $mdDialog, dispatchExecutor, toastrService, dispatchCore,
        $mdSidenav, $document, messagingDialogService, createJobDialogService,
        accessorialChargesDialogService, jobFileUploadDialogService, bulkPriceUploadDialogService,
        dashboardSettingsDialogService, appConfig,
        $scope, $timeout, $interval,
    );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('JobSearchController', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as any).ReactJobSearchJobList = undefined;
    });

    describe('constructor initialization', () => {
        it('sets default search criteria with fortnight date range, empty filters, and NZ map center', () => {
            const ctrl = createController();

            expect(ctrl.searchCriteria).toBeDefined();
            expect(ctrl.searchCriteria.clients).toEqual([]);
            expect(ctrl.searchCriteria.couriers).toEqual([]);
            expect(ctrl.searchCriteria.speeds).toEqual([]);
            expect(ctrl.searchCriteria.followupClient).toBe('All');
            expect(ctrl.searchCriteria.includeClosed).toBe(true);
            expect(ctrl.dateSearchRange).toBe('fortnight');

            // NZ customer gets NZ center
            expect(ctrl.mapCenter.lat).toBe(-36.8);
            expect(ctrl.mapZoom).toBe(12);
        });

        it('uses US coordinates for US customers', () => {
            const ctrl = createController({isUsCustomer: true});
            expect(ctrl.isUsCustomer).toBe(true);
            expect(ctrl.mapCenter.lat).toBe(38.9);
        });

        it('initializes all box configs with correct names and visibility', () => {
            const ctrl = createController();
            expect(ctrl.boxes).toBeDefined();
            expect(ctrl.boxes!['pickDate'].title).toBe('Filters');
            expect(ctrl.boxes!['jobList'].title).toBe('Live Job Data');
            expect(ctrl.boxes!['bulkJobList'].title).toBe('Bulk Job Data');
            expect(ctrl.boxes!['jobDetail'].title).toBe('Detail');
            expect(ctrl.boxes!['scanList'].title).toBe('Scan Detail');
            expect(ctrl.boxes!['map'].title).toBe('Map');
            expect(ctrl.boxes!['deliveryJourney'].title).toBe('Delivery Journey');

            Object.values(ctrl.boxes!).forEach((box: any) => {
                expect(box.visible).toBe(true);
            });
        });
    });

    describe('onSearchRangeChange', () => {
        it('sets fortnight range to ±7 days from now', () => {
            const ctrl = createController();
            ctrl.onSearchRangeChange('fortnight' as any);

            const now = dayjs().tz('Pacific/Auckland');
            expect(ctrl.searchCriteria.from_date.format('YYYY-MM-DD'))
                .toBe(now.subtract(7, 'day').format('YYYY-MM-DD'));
            expect(ctrl.searchCriteria.to_date.format('YYYY-MM-DD'))
                .toBe(now.add(7, 'day').format('YYYY-MM-DD'));
        });

        it('sets today range to today for both from and to', () => {
            const ctrl = createController();
            ctrl.onSearchRangeChange('today' as any);

            const today = dayjs().tz('Pacific/Auckland').format('YYYY-MM-DD');
            expect(ctrl.searchCriteria.from_date.format('YYYY-MM-DD')).toBe(today);
            expect(ctrl.searchCriteria.to_date.format('YYYY-MM-DD')).toBe(today);
        });

        it('sets month range to first and last day of current month', () => {
            const ctrl = createController();
            ctrl.onSearchRangeChange('month' as any);

            const now = dayjs().tz('Pacific/Auckland');
            expect(ctrl.searchCriteria.from_date.format('YYYY-MM-DD'))
                .toBe(now.startOf('month').format('YYYY-MM-DD'));
            expect(ctrl.searchCriteria.to_date.format('YYYY-MM-DD'))
                .toBe(now.endOf('month').format('YYYY-MM-DD'));
        });

        it('does not change dates for custom range', () => {
            const ctrl = createController();
            const beforeFrom = ctrl.searchCriteria.from_date;
            const beforeTo = ctrl.searchCriteria.to_date;

            ctrl.onSearchRangeChange('custom' as any);

            expect(ctrl.searchCriteria.from_date).toBe(beforeFrom);
            expect(ctrl.searchCriteria.to_date).toBe(beforeTo);
        });
    });

    describe('refreshData and refreshBulkData (React bridge)', () => {
        it('pushes search params and invalidates React Query for main list', () => {
            const ctrl = createController();
            const updateSearchParams = jest.fn();
            const refresh = jest.fn();
            (window as any).ReactJobSearchJobList = {updateSearchParams, refresh};

            ctrl.searchCriteria.clients = [{id: 10, text: 'Client A'}] as any;
            ctrl.searchCriteria.couriers = [{id: 20, text: 'Courier B'}] as any;
            ctrl.searchCriteria.wild = 'test';
            ctrl.refreshData();

            expect(updateSearchParams).toHaveBeenCalledWith('main', expect.objectContaining({
                startDate: ctrl.searchCriteria.from_date,
                endDate: ctrl.searchCriteria.to_date,
                clientIds: [10],
                courierIds: [20],
                wild: 'test',
                page: 0,
                pageSize: 50,
            }));
            expect(refresh).toHaveBeenCalledWith('main');
        });

        it('pushes search params and invalidates React Query for bulk list', () => {
            const ctrl = createController();
            const updateSearchParams = jest.fn();
            const refresh = jest.fn();
            (window as any).ReactJobSearchJobList = {updateSearchParams, refresh};

            ctrl.refreshBulkData();

            expect(updateSearchParams).toHaveBeenCalledWith('bulk', expect.objectContaining({
                page: 0,
                pageSize: 50,
            }));
            expect(refresh).toHaveBeenCalledWith('bulk');
        });

        it('is a no-op when ReactJobSearchJobList is not available', () => {
            const ctrl = createController();
            (window as any).ReactJobSearchJobList = undefined;

            expect(() => ctrl.refreshData()).not.toThrow();
            expect(() => ctrl.refreshBulkData()).not.toThrow();
        });
    });

    describe('selectJobDetail', () => {
        it('loads job detail, updates map center, fetches scan detail, and sets current selection', async () => {
            const jobSearchService = createMockJobSearchService();
            jobSearchService.getScanDetail.mockResolvedValue([{bulkScanId: 1, scanDetail: 'Delivered'}]);
            const dispatchCore = createMockDispatchCoreService();
            dispatchCore.getDispatchJobDetail.mockResolvedValue({
                id: 42, jobNo: 'J042',
                booked: dayjs('2024-06-15'),
                pickupAddress: {latitude: -37.0, longitude: 175.0},
            });

            const ctrl = createController({dispatchCore, jobSearchService});
            await ctrl.selectJobDetail(42);

            expect(dispatchCore.getDispatchJobDetail).toHaveBeenCalledWith(42);
            expect(ctrl.currentJob!.id).toBe(42);
            expect(ctrl.currentJobId).toBe(42);
            expect(ctrl.currentSelection).toBe(' for Job J042');
            expect(ctrl.isBulkJob).toBe(false);
            expect(ctrl.mapCenter).toEqual({lat: -37.0, lng: 175.0});
            expect(jobSearchService.getScanDetail).toHaveBeenCalledWith(
                dayjs('2024-06-15'), 'J042',
            );
        });

        it('handles missing job gracefully', async () => {
            const dispatchCore = createMockDispatchCoreService();
            dispatchCore.getDispatchJobDetail.mockResolvedValue(undefined);
            const ctrl = createController({dispatchCore});

            await ctrl.selectJobDetail(999);
            // Should not throw
        });
    });

    describe('selectBulkJobDetail', () => {
        it('loads bulk job detail and sets isBulkJob flag', async () => {
            const jobSearchService = createMockJobSearchService();
            jobSearchService.getDispatchBulkJobDetail.mockResolvedValue({
                id: 55, jobNo: 'B055',
                booked: dayjs('2024-06-15'),
                pickupAddress: {latitude: -36.5, longitude: 174.5},
            });
            jobSearchService.getScanDetail.mockResolvedValue([]);

            const ctrl = createController({jobSearchService});
            await ctrl.selectBulkJobDetail(55);

            expect(jobSearchService.getDispatchBulkJobDetail).toHaveBeenCalledWith(55);
            expect(ctrl.isBulkJob).toBe(true);
            expect(ctrl.currentSelection).toBe(' for Bulk Job B055');
        });
    });

    describe('courierQuerySearch', () => {
        it('returns empty array for short search text', async () => {
            const ctrl = createController();
            expect(await ctrl.courierQuerySearch('')).toEqual([]);
            expect(await ctrl.courierQuerySearch('a')).toEqual([]);
        });

        it('returns all results for non-numeric search', async () => {
            const jobSearchService = createMockJobSearchService();
            const results = [
                {id: 1, text: '100 Mike Runner'},
                {id: 2, text: '200 Jane Walker'},
            ];
            jobSearchService.getActiveCouriersSearch.mockResolvedValue(results);

            const ctrl = createController({jobSearchService});
            const result = await ctrl.courierQuerySearch('Mike');

            expect(result).toEqual(results);
        });

        it('filters to exact courier code matches for numeric search', async () => {
            const jobSearchService = createMockJobSearchService();
            const results = [
                {id: 1, text: '100 Mike Runner'},
                {id: 2, text: '1001 Jane Walker'},
                {id: 3, text: '200 Bob Sprinter'},
            ];
            jobSearchService.getActiveCouriersSearch.mockResolvedValue(results);

            const ctrl = createController({jobSearchService});
            const result = await ctrl.courierQuerySearch('100');

            expect(result).toEqual([{id: 1, text: '100 Mike Runner'}]);
        });

        it('falls back to all results if no exact numeric match', async () => {
            const jobSearchService = createMockJobSearchService();
            const results = [{id: 1, text: '1001 Mike Runner'}];
            jobSearchService.getActiveCouriersSearch.mockResolvedValue(results);

            const ctrl = createController({jobSearchService});
            const result = await ctrl.courierQuerySearch('999');

            expect(result).toEqual(results);
        });

        it('returns empty array on API error', async () => {
            const jobSearchService = createMockJobSearchService();
            jobSearchService.getActiveCouriersSearch.mockRejectedValue(new Error('Network error'));

            const ctrl = createController({jobSearchService});
            const result = await ctrl.courierQuerySearch('test');

            expect(result).toEqual([]);
        });
    });

    describe('speedQuerySearch', () => {
        it('returns empty array for short search text', async () => {
            const ctrl = createController();
            expect(await ctrl.speedQuerySearch('')).toEqual([]);
            expect(await ctrl.speedQuerySearch('a')).toEqual([]);
        });

        it('returns results from DispatchCoreService', async () => {
            const dispatchCore = createMockDispatchCoreService();
            const speeds = [{id: 1, text: 'Standard'}, {id: 2, text: 'Express'}];
            dispatchCore.searchSpeedOptions.mockResolvedValue(speeds);

            const ctrl = createController({dispatchCore});
            const result = await ctrl.speedQuerySearch('sta');

            expect(result).toEqual(speeds);
        });
    });

    describe('isClientJobsReportEnabled', () => {
        it('returns true when clients are selected and dates are set', () => {
            const ctrl = createController();
            ctrl.searchCriteria.clients = [{id: 1, text: 'Client'}] as any;
            expect(ctrl.isClientJobsReportEnabled()).toBe(true);
        });

        it('returns false when no clients are selected', () => {
            const ctrl = createController();
            ctrl.searchCriteria.clients = [];
            expect(ctrl.isClientJobsReportEnabled()).toBe(false);
        });
    });

    describe('handleJobDispatch', () => {
        it('dispatches job, shows toast, refreshes data, and updates assignedCourier', async () => {
            const dispatchExecutor = createMockDispatchExecutor();
            const toastrService = createMockToastrService();
            const ctrl = createController({dispatchExecutor, toastrService});
            (window as any).ReactJobSearchJobList = {updateSearchParams: jest.fn(), refresh: jest.fn()};

            const job = {id: 1, jobNo: 'J001'} as any;
            const result = await ctrl.handleJobDispatch(job, 100);

            expect(dispatchExecutor.dispatchJobs).toHaveBeenCalledWith(100, [job]);
            expect(toastrService.showSuccessToast).toHaveBeenCalledWith('J001 successfully dispatched');
            expect(job.assignedCourier).toEqual({id: 100, text: ''});
            expect(result).toBe(true);
        });

        it('throws on dispatch error', async () => {
            const dispatchExecutor = createMockDispatchExecutor();
            dispatchExecutor.dispatchJobs.mockRejectedValue(new Error('Dispatch failed'));

            const ctrl = createController({dispatchExecutor});
            await expect(ctrl.handleJobDispatch({id: 1, jobNo: 'J001'} as any, 100))
                .rejects.toThrow('Dispatch failed');
        });
    });

    describe('layout management', () => {
        it('isDefaultLayout returns true for Default layout', () => {
            const ctrl = createController();
            expect(ctrl.isDefaultLayout()).toBe(true);
            expect(ctrl.currentLayoutName).toBe('Default');
        });

        it('loadLayout sets currentLayoutName and persists to localStorage', () => {
            const ctrl = createController();
            ctrl.layouts = [
                {name: 'Default', layout: {columns: []}},
                {name: 'Custom', layout: {columns: []}},
            ];

            ctrl.loadLayout(1);

            expect(ctrl.currentLayoutName).toBe('Custom');
            // The key uses ContactID which is captured at module import time
            const allKeys = Object.keys(localStorage);
            const layoutKey = allKeys.find(k => k.startsWith('lastActiveLayout'));
            expect(layoutKey).toBeDefined();
            expect(localStorage.getItem(layoutKey!)).toBe('Custom');
        });

        it('deleteLayout prevents deleting the default layout (index 0)', () => {
            const ctrl = createController();
            const initialLength = ctrl.layouts.length;
            ctrl.deleteLayout(0);
            expect(ctrl.layouts.length).toBe(initialLength);
        });

        it('toggleBoxCollapse toggles collapsed state and prevents collapse on default layout', () => {
            const ctrl = createController();
            // Default layout — should not collapse
            ctrl.toggleBoxCollapse('jobList');
            expect(ctrl.boxes!['jobList'].collapsed).toBeFalsy();

            // Non-default layout — should collapse
            ctrl.currentLayoutName = 'Custom';
            ctrl.toggleBoxCollapse('jobList');
            expect(ctrl.boxes!['jobList'].collapsed).toBe(true);

            ctrl.toggleBoxCollapse('jobList');
            expect(ctrl.boxes!['jobList'].collapsed).toBe(false);
        });
    });

    describe('$onDestroy', () => {
        it('calls ReactJobSearchJobList.unmountAll and clears mounted set', () => {
            const ctrl = createController();
            const unmountAll = jest.fn();
            (window as any).ReactJobSearchJobList = {unmountAll};

            ctrl.$onDestroy();

            expect(unmountAll).toHaveBeenCalledTimes(1);
        });

        it('does not throw when ReactJobSearchJobList is not available', () => {
            const ctrl = createController();
            (window as any).ReactJobSearchJobList = undefined;

            expect(() => ctrl.$onDestroy()).not.toThrow();
        });
    });

    describe('updateDateField', () => {
        it('updateFromDatePicker sets from_date to start of day', () => {
            const ctrl = createController();
            const date = dayjs('2024-06-15T14:30:00');
            ctrl.updateFromDatePicker(date);
            expect(ctrl.searchCriteria.from_date.format('HH:mm:ss')).toBe('00:00:00');
            expect(ctrl.searchCriteria.from_date.format('YYYY-MM-DD')).toBe('2024-06-15');
        });

        it('updateToDatePicker sets to_date to start of day', () => {
            const ctrl = createController();
            const date = dayjs('2024-06-30T23:59:59');
            ctrl.updateToDatePicker(date);
            expect(ctrl.searchCriteria.to_date.format('HH:mm:ss')).toBe('00:00:00');
            expect(ctrl.searchCriteria.to_date.format('YYYY-MM-DD')).toBe('2024-06-30');
        });

        it('rejects invalid dates', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const ctrl = createController();
            const before = ctrl.searchCriteria.from_date;

            ctrl.updateFromDatePicker(dayjs('invalid'));

            expect(ctrl.searchCriteria.from_date).toBe(before);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'));
            errorSpy.mockRestore();
        });
    });

    describe('handleBackendSort', () => {
        it('stores sort column and direction', async () => {
            const ctrl = createController();
            await ctrl.handleBackendSort({column: 'jobNo', direction: 'desc'});
            expect(ctrl.currentSortColumn).toBe('jobNo');
            expect(ctrl.currentSortDirection).toBe('desc');
        });
    });

    describe('downloadJobList and downloadClientJobsReport', () => {
        it('downloadJobList calls getPodJobsDownloadUrl and opens in new window', () => {
            const jobSearchService = createMockJobSearchService();
            const ctrl = createController({jobSearchService});
            const openSpy = jest.spyOn(window, 'open').mockImplementation();

            ctrl.downloadJobList();

            expect(jobSearchService.getPodJobsDownloadUrl).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('/Job/PodSearchDownload?test', '_blank');
            openSpy.mockRestore();
        });

        it('downloadClientJobsReport calls getClientJobsReportDownloadUrl and opens in new window', () => {
            const jobSearchService = createMockJobSearchService();
            const ctrl = createController({jobSearchService});
            const openSpy = jest.spyOn(window, 'open').mockImplementation();

            ctrl.downloadClientJobsReport();

            expect(jobSearchService.getClientJobsReportDownloadUrl).toHaveBeenCalled();
            expect(openSpy).toHaveBeenCalledWith('/Job/ClientJobsReportDownload?test', '_blank');
            openSpy.mockRestore();
        });
    });

    describe('onRefreshButtonClicked', () => {
        it('invalidates React Query for jobList box', async () => {
            const ctrl = createController();
            const refresh = jest.fn();
            (window as any).ReactJobSearchJobList = {refresh};

            await ctrl.onRefreshButtonClicked('jobList');

            expect(refresh).toHaveBeenCalledWith('main');
        });

        it('invalidates React Query for bulkJobList box', async () => {
            const ctrl = createController();
            const refresh = jest.fn();
            (window as any).ReactJobSearchJobList = {refresh};

            await ctrl.onRefreshButtonClicked('bulkJobList');

            expect(refresh).toHaveBeenCalledWith('bulk');
        });

        it('re-selects current job for jobDetail box', async () => {
            const dispatchCore = createMockDispatchCoreService();
            const jobSearchService = createMockJobSearchService();
            const ctrl = createController({dispatchCore, jobSearchService});
            ctrl.currentJobId = 42;
            ctrl.bulkJobList = [];

            await ctrl.onRefreshButtonClicked('jobDetail');

            expect(dispatchCore.getDispatchJobDetail).toHaveBeenCalledWith(42);
        });

        it('does nothing for jobDetail when no current job', async () => {
            const dispatchCore = createMockDispatchCoreService();
            const ctrl = createController({dispatchCore});
            ctrl.currentJobId = undefined;

            await ctrl.onRefreshButtonClicked('jobDetail');

            expect(dispatchCore.getDispatchJobDetail).not.toHaveBeenCalled();
        });
    });
});
