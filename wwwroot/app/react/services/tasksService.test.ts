/**
 * Tasks Service Tests
 */

import {
    tasksService,
    buildFilterRequest,
    getTasksStatusCount,
    getSavedStaffFilter,
    getSavedEventTypeFilter,
    saveStaffFilter,
    saveEventTypeFilter,
    initializePageFilters,
    getActiveFilterNames,
    findTaskJobInLists,
    validateTaskJobId,
    getViewPreferenceKey,
    getDateFilterKey,
    saveToLocalStorage,
    getFromLocalStorage,
    AppPage,
    StatusFilterValue,
    TaskFilterType,
} from './tasksService';
import {Task} from '../interfaces';
import dayjs from 'dayjs';

// Mock window.ContactID
const mockContactId = 123;
beforeAll(() => {
    (window as any).ContactID = mockContactId;
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

describe('tasksService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
    });

    describe('buildFilterRequest', () => {
        it('should build basic filter request with defaults', () => {
            const result = buildFilterRequest('all');

            expect(result.showCompleted).toBe(false);
            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('desc');
        });

        it('should build filter for "mine" type with contact ID', () => {
            const result = buildFilterRequest('mine');

            expect(result.staffId).toBe(mockContactId);
            expect(result.orderBy).toBe('assignedTo');
            expect(result.orderDirection).toBe('desc');
        });

        it('should build filter for "unassigned" type', () => {
            const result = buildFilterRequest('unassigned');

            expect(result.staffId).toBe(-1);
            expect(result.orderBy).toBe('assignedTo');
            expect(result.orderDirection).toBe('desc');
        });

        it('should build filter for "newest" type', () => {
            const result = buildFilterRequest('newest');

            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('desc');
        });

        it('should build filter for "oldest" type', () => {
            const result = buildFilterRequest('oldest');

            expect(result.orderBy).toBe('created');
            expect(result.orderDirection).toBe('asc');
        });

        it('should include jobId when provided', () => {
            const result = buildFilterRequest('all', {jobId: 456});

            expect(result.jobId).toBe(456);
        });

        it('should include staffFilter when not "all"', () => {
            const result = buildFilterRequest('all', {staffFilter: '789'});

            expect(result.staffId).toBe(789);
        });

        it('should not include staffFilter when "all"', () => {
            const result = buildFilterRequest('newest', {staffFilter: 'all'});

            expect(result.staffId).toBeUndefined();
        });

        it('should include eventTypeFilter when not "all"', () => {
            const result = buildFilterRequest('all', {eventTypeFilter: '42'});

            expect(result.eventTypeId).toBe(42);
        });

        it('should include showCompleted when provided', () => {
            const result = buildFilterRequest('all', {showCompleted: true});

            expect(result.showCompleted).toBe(true);
        });
    });

    describe('getTasksStatusCount', () => {
        const mockTasks: Task[] = [
            {
                id: 1,
                title: 'Task 1',
                description: '',
                dueDate: dayjs(),
                closed: false,
                assignee: {id: mockContactId, text: 'Current User'},
                jobId: 100,
                eventType: 'Call',
                jobNumber: 'JOB-100',
            },
            {
                id: 2,
                title: 'Task 2',
                description: '',
                dueDate: dayjs(),
                closed: false,
                assignee: {id: 456, text: 'Other User'},
                jobId: 101,
                eventType: 'Email',
                jobNumber: 'JOB-101',
            },
            {
                id: 3,
                title: 'Task 3',
                description: '',
                dueDate: dayjs(),
                closed: false,
                assignee: {id: 0, text: ''},
                jobId: 102,
                eventType: 'Meeting',
                jobNumber: 'JOB-102',
            },
        ];

        it('should count tasks assigned to current user for "mine"', () => {
            const count = getTasksStatusCount(mockTasks, 'mine');
            expect(count).toBe(1);
        });

        it('should count unassigned tasks', () => {
            const count = getTasksStatusCount(mockTasks, 'unassigned');
            expect(count).toBe(1);
        });

        it('should return total count for "newest"', () => {
            const count = getTasksStatusCount(mockTasks, 'newest');
            expect(count).toBe(3);
        });

        it('should return total count for "oldest"', () => {
            const count = getTasksStatusCount(mockTasks, 'oldest');
            expect(count).toBe(3);
        });

        it('should return total count for "all"', () => {
            const count = getTasksStatusCount(mockTasks, 'all');
            expect(count).toBe(3);
        });

        it('should return 0 for empty array', () => {
            const count = getTasksStatusCount([], 'mine');
            expect(count).toBe(0);
        });

        it('should return 0 for null/undefined', () => {
            const count = getTasksStatusCount(null as any, 'mine');
            expect(count).toBe(0);
        });
    });

    describe('localStorage filter functions', () => {
        describe('getSavedStaffFilter', () => {
            it('should return saved filter value', () => {
                const key = `selectedSupportTypeTasksFilter-${mockContactId}`;
                localStorageMock.setItem(key, '42');

                const result = getSavedStaffFilter(AppPage.Tasks);

                expect(result).toBe('42');
            });

            it('should return "all" when no saved value', () => {
                const result = getSavedStaffFilter(AppPage.Tasks);

                expect(result).toBe('all');
            });
        });

        describe('getSavedEventTypeFilter', () => {
            it('should return saved filter value', () => {
                const key = `selectedSupportTypeDispatchFilter-${mockContactId}`;
                localStorageMock.setItem(key, '99');

                const result = getSavedEventTypeFilter(AppPage.Dispatch);

                expect(result).toBe('99');
            });

            it('should return "all" when no saved value', () => {
                const result = getSavedEventTypeFilter(AppPage.Dispatch);

                expect(result).toBe('all');
            });
        });

        describe('saveStaffFilter', () => {
            it('should save filter to localStorage', () => {
                saveStaffFilter('55', AppPage.Tasks);

                const key = `selectedSupportTypeTasksFilter-${mockContactId}`;
                expect(localStorageMock.setItem).toHaveBeenCalledWith(key, '55');
            });
        });

        describe('saveEventTypeFilter', () => {
            it('should save filter to localStorage', () => {
                saveEventTypeFilter('77', AppPage.Dispatch);

                const key = `selectedSupportTypeDispatchFilter-${mockContactId}`;
                expect(localStorageMock.setItem).toHaveBeenCalledWith(key, '77');
            });
        });

        describe('initializePageFilters', () => {
            it('should return both filters for a page', () => {
                const staffKey = `selectedSupportTypeTasksFilter-${mockContactId}`;
                localStorageMock.setItem(staffKey, '10');

                const result = initializePageFilters(AppPage.Tasks);

                expect(result.staffFilter).toBe('10');
                expect(result.eventTypeFilter).toBe('10');
            });

            it('should return "all" for both when nothing saved', () => {
                const result = initializePageFilters(AppPage.Domestic);

                expect(result.staffFilter).toBe('all');
                expect(result.eventTypeFilter).toBe('all');
            });
        });
    });

    describe('getActiveFilterNames', () => {
        const staffList = [
            {id: 1, text: 'John Doe'},
            {id: 2, text: 'Jane Smith'},
        ];
        const eventTypesList = [
            {id: 10, text: 'Call'},
            {id: 20, text: 'Email'},
        ];

        it('should return "All Tasks" when both filters are "all"', () => {
            const result = getActiveFilterNames('all', 'all', staffList, eventTypesList);

            expect(result).toBe(' - (All Tasks)');
        });

        it('should show staff name when staff filter is set', () => {
            const result = getActiveFilterNames('1', 'all', staffList, eventTypesList);

            expect(result).toBe('- (John Doe)');
        });

        it('should show event type when event type filter is set', () => {
            const result = getActiveFilterNames('all', '10', staffList, eventTypesList);

            expect(result).toBe('- (Call)');
        });

        it('should show both when both filters are set', () => {
            const result = getActiveFilterNames('2', '20', staffList, eventTypesList);

            expect(result).toBe('- (Jane Smith, Email)');
        });

        it('should handle missing lists gracefully', () => {
            const result = getActiveFilterNames('1', '10', undefined, undefined);

            expect(result).toBe('- ()');
        });
    });

    describe('findTaskJobInLists', () => {
        const jobs1 = [{id: 1, name: 'Job 1'}, {id: 2, name: 'Job 2'}];
        const jobs2 = [{id: 3, name: 'Job 3'}, {id: 4, name: 'Job 4'}];

        it('should find job in first list', () => {
            const result = findTaskJobInLists(1, [
                {list: jobs1, name: 'list1'},
                {list: jobs2, name: 'list2'},
            ]);

            expect(result).toEqual({id: 1, name: 'Job 1'});
        });

        it('should find job in second list', () => {
            const result = findTaskJobInLists(4, [
                {list: jobs1, name: 'list1'},
                {list: jobs2, name: 'list2'},
            ]);

            expect(result).toEqual({id: 4, name: 'Job 4'});
        });

        it('should return undefined when job not found', () => {
            const result = findTaskJobInLists(999, [
                {list: jobs1, name: 'list1'},
                {list: jobs2, name: 'list2'},
            ]);

            expect(result).toBeUndefined();
        });

        it('should handle empty lists', () => {
            const result = findTaskJobInLists(1, [
                {list: [], name: 'empty'},
            ]);

            expect(result).toBeUndefined();
        });
    });

    describe('validateTaskJobId', () => {
        it('should return true when task has jobId', () => {
            const task = {id: 1, jobId: 100};
            const onWarning = jest.fn();

            const result = validateTaskJobId(task, onWarning);

            expect(result).toBe(true);
            expect(onWarning).not.toHaveBeenCalled();
        });

        it('should return false and call warning when no jobId', () => {
            const task = {id: 1, jobId: 0};
            const onWarning = jest.fn();

            const result = validateTaskJobId(task, onWarning);

            expect(result).toBe(false);
            expect(onWarning).toHaveBeenCalledWith('This task has no job attached');
        });

        it('should return false for undefined jobId', () => {
            const task = {id: 1, jobId: undefined as any};
            const onWarning = jest.fn();

            const result = validateTaskJobId(task, onWarning);

            expect(result).toBe(false);
            expect(onWarning).toHaveBeenCalled();
        });
    });

    describe('getViewPreferenceKey', () => {
        it('should return key with contact ID', () => {
            const result = getViewPreferenceKey();

            expect(result).toBe(`taskDashboardViewPreference-${mockContactId}`);
        });
    });

    describe('getDateFilterKey', () => {
        it('should return key with default prefix', () => {
            const result = getDateFilterKey();

            expect(result).toBe(`dateFilter-task-dashboard-${mockContactId}`);
        });

        it('should return key with custom prefix', () => {
            const result = getDateFilterKey('custom-page');

            expect(result).toBe(`dateFilter-custom-page-${mockContactId}`);
        });
    });

    describe('saveToLocalStorage and getFromLocalStorage', () => {
        it('should save and retrieve value', () => {
            saveToLocalStorage('test-key', 'test-value');

            expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'test-value');
        });

        it('should retrieve saved value', () => {
            localStorageMock.setItem('test-key', 'saved-value');

            const result = getFromLocalStorage('test-key');

            expect(result).toBe('saved-value');
        });

        it('should return default value when not found', () => {
            const result = getFromLocalStorage('non-existent', 'default');

            expect(result).toBe('default');
        });

        it('should return empty string as default when not specified', () => {
            const result = getFromLocalStorage('non-existent');

            expect(result).toBe('');
        });
    });

    describe('tasksService object', () => {
        it('should export all functions', () => {
            expect(tasksService.buildFilterRequest).toBe(buildFilterRequest);
            expect(tasksService.getTasksStatusCount).toBe(getTasksStatusCount);
            expect(tasksService.getSavedStaffFilter).toBe(getSavedStaffFilter);
            expect(tasksService.getSavedEventTypeFilter).toBe(getSavedEventTypeFilter);
            expect(tasksService.saveStaffFilter).toBe(saveStaffFilter);
            expect(tasksService.saveEventTypeFilter).toBe(saveEventTypeFilter);
            expect(tasksService.initializePageFilters).toBe(initializePageFilters);
            expect(tasksService.getActiveFilterNames).toBe(getActiveFilterNames);
            expect(tasksService.findTaskJobInLists).toBe(findTaskJobInLists);
            expect(tasksService.validateTaskJobId).toBe(validateTaskJobId);
            expect(tasksService.getViewPreferenceKey).toBe(getViewPreferenceKey);
            expect(tasksService.getDateFilterKey).toBe(getDateFilterKey);
            expect(tasksService.saveToLocalStorage).toBe(saveToLocalStorage);
            expect(tasksService.getFromLocalStorage).toBe(getFromLocalStorage);
        });

        it('should export constants', () => {
            expect(tasksService.StatusFilterValue).toBe(StatusFilterValue);
            expect(tasksService.AppPage).toBe(AppPage);
        });
    });
});
