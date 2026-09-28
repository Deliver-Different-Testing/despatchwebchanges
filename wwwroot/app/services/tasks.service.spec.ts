/** @jest-environment jest-environment-jsdom */
/**
 * Tests for TasksService
 * Covers API operations, caching, filter building, task loading,
 * localStorage persistence, display helpers, and validation.
 */
import {ExtendedTask, ITask} from "../interfaces/task.interfaces";
import {ISuggestion} from "../interfaces/job.interface";
import {StatusFilter} from "../enums/status-filter.enum";
import {AppPage} from "../enums/app-pages.enum";
import TasksService from "./tasks.service";
import DispatchCoreService from "./dispatch-core.service";

jest.mock('angular', () => ({
    default: {
        element: jest.fn(),
        module: jest.fn(() => ({
            service: jest.fn(),
            provider: jest.fn(),
        })),
    },
    element: jest.fn(),
    module: jest.fn(() => ({
        service: jest.fn(),
        provider: jest.fn(),
    })),
}));

jest.mock('../react/utils/dateUtils', () => ({
    formatDateForApiWithTzs: jest.fn(() => '2026-03-31T10:00:00+00:00'),
}));

jest.mock('../contants', () => ({
    get ContactID() { return (window as any).ContactID || 0; },
    FirstName: 'Test',
    TimeZone: 'Europe/London',
    NationwideSpeedId: 415,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockHttp() {
    return {
        post: jest.fn().mockResolvedValue({data: {}}),
    };
}

function createMockDispatchData(): jest.Mocked<Pick<DispatchCoreService, 'getActiveStaff' | 'getEventTypes' | 'getAllTasks'>> {
    return {
        getActiveStaff: jest.fn().mockResolvedValue([]),
        getEventTypes: jest.fn().mockResolvedValue([]),
        getAllTasks: jest.fn().mockResolvedValue([]),
    };
}

function createService() {
    const mockHttp = createMockHttp();
    const mockDispatchData = createMockDispatchData();

    const service = new (TasksService as any)(
        mockHttp,
        mockDispatchData,
    ) as TasksService;

    return {service, mockHttp, mockDispatchData};
}

const staffList: ISuggestion[] = [
    {id: 1, text: 'Alice'},
    {id: 2, text: 'Bob'},
];

const eventTypesList: ISuggestion[] = [
    {id: 10, text: 'Pickup'},
    {id: 20, text: 'Delivery'},
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TasksService', () => {

    beforeEach(() => {
        (window as any).ContactID = 42;
        (window as any).Modernizr = {localstorage: true};
        localStorage.clear();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // $get
    // -----------------------------------------------------------------------
    describe('$get', () => {
        it('returns the service instance', () => {
            const {service} = createService();
            expect(service.$get()).toBe(service);
        });
    });

    // -----------------------------------------------------------------------
    // API methods
    // -----------------------------------------------------------------------
    describe('markTaskAsClosed', () => {
        it('posts correct URL and payload', async () => {
            const {service, mockHttp} = createService();
            await service.markTaskAsClosed(5, true);

            expect(mockHttp.post).toHaveBeenCalledWith('task/MarkTaskAsClosed', {eventId: 5, closed: true});
        });
    });

    describe('updateTaskDate', () => {
        it('posts correct URL and formatted date', async () => {
            const {service, mockHttp} = createService();
            const mockDate = {} as any;
            await service.updateTaskDate(7, mockDate);

            expect(mockHttp.post).toHaveBeenCalledWith('task/UpdateTaskDate', {
                eventId: 7,
                date: '2026-03-31T10:00:00+00:00',
            });
        });
    });

    describe('updateTaskTime', () => {
        it('posts correct URL and formatted time', async () => {
            const {service, mockHttp} = createService();
            const mockTime = {} as any;
            await service.updateTaskTime(9, mockTime);

            expect(mockHttp.post).toHaveBeenCalledWith('task/UpdateTaskTime', {
                eventId: 9,
                time: '2026-03-31T10:00:00+00:00',
            });
        });
    });

    describe('reassignTaskToStaff', () => {
        it('posts correct URL and payload', async () => {
            const {service, mockHttp} = createService();
            await service.reassignTaskToStaff(3, 99);

            expect(mockHttp.post).toHaveBeenCalledWith('task/ReassignTask', {eventId: 3, staffId: 99});
        });
    });

    // -----------------------------------------------------------------------
    // getStaffList / getEventTypesList (caching)
    // -----------------------------------------------------------------------
    describe('getStaffList', () => {
        it('returns staff from DispatchData on first call', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getActiveStaff.mockResolvedValue(staffList);

            const result = await service.getStaffList();
            expect(result).toEqual(staffList);
            expect(mockDispatchData.getActiveStaff).toHaveBeenCalledTimes(1);
        });

        it('returns cached data on subsequent calls', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getActiveStaff.mockResolvedValue(staffList);

            await service.getStaffList();
            const result = await service.getStaffList();

            expect(result).toEqual(staffList);
            expect(mockDispatchData.getActiveStaff).toHaveBeenCalledTimes(1);
        });

        it('returns empty array and clears promise on error', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getActiveStaff.mockRejectedValue(new Error('fail'));

            const result = await service.getStaffList();
            expect(result).toEqual([]);

            // Retry should call DispatchData again
            mockDispatchData.getActiveStaff.mockResolvedValue(staffList);
            const retry = await service.getStaffList();
            expect(retry).toEqual(staffList);
            expect(mockDispatchData.getActiveStaff).toHaveBeenCalledTimes(2);
        });

        it('deduplicates concurrent calls', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getActiveStaff.mockResolvedValue(staffList);

            const [r1, r2] = await Promise.all([service.getStaffList(), service.getStaffList()]);

            expect(r1).toEqual(staffList);
            expect(r2).toEqual(staffList);
            expect(mockDispatchData.getActiveStaff).toHaveBeenCalledTimes(1);
        });
    });

    describe('getEventTypesList', () => {
        it('returns event types from DispatchData on first call', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getEventTypes.mockResolvedValue(eventTypesList);

            const result = await service.getEventTypesList();
            expect(result).toEqual(eventTypesList);
            expect(mockDispatchData.getEventTypes).toHaveBeenCalledTimes(1);
        });

        it('returns cached data on subsequent calls', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getEventTypes.mockResolvedValue(eventTypesList);

            await service.getEventTypesList();
            const result = await service.getEventTypesList();

            expect(result).toEqual(eventTypesList);
            expect(mockDispatchData.getEventTypes).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on error and allows retry', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getEventTypes.mockRejectedValue(new Error('fail'));

            const result = await service.getEventTypesList();
            expect(result).toEqual([]);

            mockDispatchData.getEventTypes.mockResolvedValue(eventTypesList);
            const retry = await service.getEventTypesList();
            expect(retry).toEqual(eventTypesList);
        });
    });

    // -----------------------------------------------------------------------
    // loadLists
    // -----------------------------------------------------------------------
    describe('loadLists', () => {
        it('returns both staff and event types lists', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getActiveStaff.mockResolvedValue(staffList);
            mockDispatchData.getEventTypes.mockResolvedValue(eventTypesList);

            const result = await service.loadLists();

            expect(result.staffList).toEqual(staffList);
            expect(result.eventTypesList).toEqual(eventTypesList);
        });
    });

    // -----------------------------------------------------------------------
    // buildFilterRequest
    // -----------------------------------------------------------------------
    describe('buildFilterRequest', () => {
        it('sets jobId and showCompleted=false', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('default', 100);

            expect(result.jobId).toBe(100);
            expect(result.showCompleted).toBe(false);
        });

        it('sets staffId to ContactID for "mine" filter', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('mine');

            expect(result.staffId).toBe(42);
            expect(result.orderBy).toBe('assignedTo');
            expect(result.orderDirection).toBe('desc');
        });

        it('sets staffId to -1 for "unassigned" filter', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('unassigned');

            expect(result.staffId).toBe(-1);
            expect(result.orderBy).toBe('assignedTo');
            expect(result.orderDirection).toBe('desc');
        });

        it('sets orderDirection desc for "newest"', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('newest');

            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('desc');
        });

        it('sets orderDirection asc for "oldest"', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('oldest');

            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('asc');
        });

        it('defaults to created desc for unknown filterType', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('unknown');

            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('desc');
        });

        it('applies staffFilter when not "all"', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('newest', undefined, '5');

            expect(result.staffId).toBe(5);
        });

        it('does not apply staffFilter when "all"', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('newest', undefined, StatusFilter.All);

            expect(result.staffId).toBeUndefined();
        });

        it('applies eventTypeFilter when not "all"', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('newest', undefined, undefined, '10');

            expect(result.eventTypeId).toBe(10);
        });

        it('"mine" filter overrides staffFilter', () => {
            const {service} = createService();
            const result = service.buildFilterRequest('mine', undefined, '99');

            expect(result.staffId).toBe(42);
        });
    });

    // -----------------------------------------------------------------------
    // loadTasks
    // -----------------------------------------------------------------------
    describe('loadTasks', () => {
        it('returns tasks from DispatchData', async () => {
            const {service, mockDispatchData} = createService();
            const tasks = [{id: 1}] as any[];
            mockDispatchData.getAllTasks.mockResolvedValue(tasks);

            const result = await service.loadTasks({});
            expect(result).toEqual(tasks);
        });

        it('calls onProgress true then false', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getAllTasks.mockResolvedValue([]);
            const onProgress = jest.fn();

            await service.loadTasks({}, onProgress);

            expect(onProgress).toHaveBeenNthCalledWith(1, true);
            expect(onProgress).toHaveBeenNthCalledWith(2, false);
        });

        it('returns empty array and calls onError on failure', async () => {
            const {service, mockDispatchData} = createService();
            const error = new Error('fail');
            mockDispatchData.getAllTasks.mockRejectedValue(error);
            const onError = jest.fn();
            const onProgress = jest.fn();

            const result = await service.loadTasks({}, onProgress, onError);

            expect(result).toEqual([]);
            expect(onError).toHaveBeenCalledWith(error);
            expect(onProgress).toHaveBeenLastCalledWith(false);
        });

        it('returns empty array when getAllTasks returns null', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getAllTasks.mockResolvedValue(null as any);

            const result = await service.loadTasks({});
            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // loadTasksInBackground / cancelJobTaskLoading
    // -----------------------------------------------------------------------
    describe('loadTasksInBackground', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('calls callback with tasks after setTimeout', async () => {
            const {service, mockDispatchData} = createService();
            const tasks = [{id: 1}] as any[];
            mockDispatchData.getAllTasks.mockResolvedValue(tasks);
            const callback = jest.fn();

            service.loadTasksInBackground({}, callback, AppPage.Dispatch);
            await jest.runAllTimersAsync();

            expect(callback).toHaveBeenCalledWith(tasks);
        });

        it('skips request if same key is already loading', async () => {
            const {service, mockDispatchData} = createService();
            mockDispatchData.getAllTasks.mockResolvedValue([]);
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            service.loadTasksInBackground({}, callback1, AppPage.Dispatch, 5);
            service.loadTasksInBackground({}, callback2, AppPage.Dispatch, 5);

            await jest.runAllTimersAsync();

            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });

        it('calls callback with error when getAllTasks fails', async () => {
            const {service, mockDispatchData} = createService();
            const error = new Error('fail');
            mockDispatchData.getAllTasks.mockRejectedValue(error);
            const callback = jest.fn();

            service.loadTasksInBackground({}, callback, AppPage.Dispatch);
            await jest.runAllTimersAsync();

            expect(callback).toHaveBeenCalledWith([], error);
        });

        it('does not call callback after cancellation', async () => {
            const {service, mockDispatchData} = createService();
            let resolveTask: (value: any) => void;
            mockDispatchData.getAllTasks.mockReturnValue(new Promise(r => { resolveTask = r; }));
            const callback = jest.fn();

            service.loadTasksInBackground({}, callback, AppPage.Dispatch, 7);
            jest.runAllTimers();

            // Cancel before the promise resolves
            service.cancelJobTaskLoading(AppPage.Dispatch, 7);
            resolveTask!([{id: 1}]);
            await Promise.resolve();

            expect(callback).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // getTasksStatusCount
    // -----------------------------------------------------------------------
    describe('getTasksStatusCount', () => {
        const tasks = [
            {assignee: {id: 42}},
            {assignee: {id: 42}},
            {assignee: {id: 99}},
            {assignee: {id: 0}},
            {assignee: null},
        ] as ExtendedTask[];

        it('counts "mine" tasks by ContactID', () => {
            const {service} = createService();
            expect(service.getTasksStatusCount(tasks, 'mine')).toBe(2);
        });

        it('counts "unassigned" tasks with no assignee id', () => {
            const {service} = createService();
            expect(service.getTasksStatusCount(tasks, 'unassigned')).toBe(2);
        });

        it('returns total for "newest" and "oldest"', () => {
            const {service} = createService();
            expect(service.getTasksStatusCount(tasks, 'newest')).toBe(5);
            expect(service.getTasksStatusCount(tasks, 'oldest')).toBe(5);
        });

        it('returns total for unknown status type', () => {
            const {service} = createService();
            expect(service.getTasksStatusCount(tasks, 'unknown')).toBe(5);
        });

        it('returns 0 for null or non-array input', () => {
            const {service} = createService();
            expect(service.getTasksStatusCount(null as any, 'mine')).toBe(0);
            expect(service.getTasksStatusCount(undefined as any, 'mine')).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // localStorage filter methods
    // -----------------------------------------------------------------------
    describe('localStorage filters', () => {
        it('saves and retrieves staff filter for a page', () => {
            const {service} = createService();
            service.saveStaffFilter('5', AppPage.Tasks);

            expect(service.getSavedStaffFilter(AppPage.Tasks)).toBe('5');
        });

        it('saves and retrieves event type filter for a page', () => {
            const {service} = createService();
            service.saveEventTypeFilter('10', AppPage.Dispatch);

            expect(service.getSavedEventTypeFilter(AppPage.Dispatch)).toBe('10');
        });

        it('returns StatusFilter.All when no saved value', () => {
            const {service} = createService();
            expect(service.getSavedStaffFilter(AppPage.Tasks)).toBe(StatusFilter.All);
            expect(service.getSavedEventTypeFilter(AppPage.Tasks)).toBe(StatusFilter.All);
        });

        it('returns StatusFilter.All when Modernizr.localstorage is false', () => {
            (window as any).Modernizr.localstorage = false;
            const {service} = createService();

            service.saveStaffFilter('5', AppPage.Tasks);
            expect(service.getSavedStaffFilter(AppPage.Tasks)).toBe(StatusFilter.All);
        });

        it('does not write to localStorage when Modernizr.localstorage is false', () => {
            (window as any).Modernizr.localstorage = false;
            const {service} = createService();
            const spy = jest.spyOn(Storage.prototype, 'setItem');

            service.saveStaffFilter('5', AppPage.Tasks);
            expect(spy).not.toHaveBeenCalled();
        });

        it('does not throw when Modernizr is not defined on window', () => {
            delete (window as any).Modernizr;
            const {service} = createService();

            expect(() => service.getSavedStaffFilter(AppPage.Tasks)).not.toThrow();
            expect(() => service.getSavedEventTypeFilter(AppPage.Tasks)).not.toThrow();
            expect(() => service.saveStaffFilter('5', AppPage.Tasks)).not.toThrow();
            expect(() => service.saveEventTypeFilter('10', AppPage.Tasks)).not.toThrow();
        });

        it('falls back to localStorage when Modernizr is not defined on window', () => {
            delete (window as any).Modernizr;
            const {service} = createService();

            service.saveStaffFilter('5', AppPage.Tasks);
            expect(service.getSavedStaffFilter(AppPage.Tasks)).toBe('5');
        });
    });

    // -----------------------------------------------------------------------
    // initializePageFilters
    // -----------------------------------------------------------------------
    describe('initializePageFilters', () => {
        it('returns saved filters for the page', () => {
            const {service} = createService();
            // Note: staff and eventType share the same localStorage key per page,
            // so saving one overwrites the other. Test them separately.
            service.saveStaffFilter('2', AppPage.Dispatch);
            const result1 = service.initializePageFilters(AppPage.Dispatch);
            expect(result1.staffFilter).toBe('2');
            expect(result1.eventTypeFilter).toBe('2');

            service.saveEventTypeFilter('10', AppPage.Dispatch);
            const result2 = service.initializePageFilters(AppPage.Dispatch);
            expect(result2.staffFilter).toBe('10');
            expect(result2.eventTypeFilter).toBe('10');
        });

        it('returns All when no saved filters', () => {
            const {service} = createService();
            const result = service.initializePageFilters(AppPage.Dispatch);

            expect(result.staffFilter).toBe(StatusFilter.All);
            expect(result.eventTypeFilter).toBe(StatusFilter.All);
        });
    });

    // -----------------------------------------------------------------------
    // getActiveFilterNames
    // -----------------------------------------------------------------------
    describe('getActiveFilterNames', () => {
        it('returns " - (All Tasks)" when both filters are All', () => {
            const {service} = createService();
            expect(service.getActiveFilterNames(StatusFilter.All, StatusFilter.All)).toBe(' - (All Tasks)');
        });

        it('shows staff name when staff filter is set', () => {
            const {service} = createService();
            expect(service.getActiveFilterNames('1', StatusFilter.All, staffList)).toBe('- (Alice)');
        });

        it('shows event type name when event type filter is set', () => {
            const {service} = createService();
            expect(service.getActiveFilterNames(StatusFilter.All, '10', undefined, eventTypesList)).toBe('- (Pickup)');
        });

        it('shows both names joined with comma', () => {
            const {service} = createService();
            expect(service.getActiveFilterNames('2', '20', staffList, eventTypesList)).toBe('- (Bob, Delivery)');
        });

        it('handles unmatched filter values gracefully', () => {
            const {service} = createService();
            expect(service.getActiveFilterNames('999', StatusFilter.All, staffList)).toBe('- ()');
        });
    });

    // -----------------------------------------------------------------------
    // findTaskJobInLists
    // -----------------------------------------------------------------------
    describe('findTaskJobInLists', () => {
        it('finds job across multiple lists', () => {
            const {service} = createService();
            const job = {id: 5, name: 'Job 5'};
            const lists = [
                {list: [{id: 1}], name: 'list1'},
                {list: [job], name: 'list2'},
            ];

            expect(service.findTaskJobInLists(5, lists)).toBe(job);
        });

        it('returns undefined when job is not found', () => {
            const {service} = createService();
            const lists = [{list: [{id: 1}], name: 'list1'}];
            expect(service.findTaskJobInLists(99, lists)).toBeUndefined();
        });

        it('handles null lists gracefully', () => {
            const {service} = createService();
            const lists = [{list: null as any, name: 'empty'}];
            expect(service.findTaskJobInLists(1, lists)).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // validateTaskJobId
    // -----------------------------------------------------------------------
    describe('validateTaskJobId', () => {
        it('returns true when task has a jobId', () => {
            const {service} = createService();
            const task = {jobId: 10} as ITask;
            const onWarning = jest.fn();

            expect(service.validateTaskJobId(task, onWarning)).toBe(true);
            expect(onWarning).not.toHaveBeenCalled();
        });

        it('returns false and calls onWarning when task has no jobId', () => {
            const {service} = createService();
            const task = {id: 1, jobId: 0} as ITask;
            const onWarning = jest.fn();

            expect(service.validateTaskJobId(task, onWarning)).toBe(false);
            expect(onWarning).toHaveBeenCalledWith('This task has no job attached');
        });
    });
});
