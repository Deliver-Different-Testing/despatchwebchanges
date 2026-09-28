/** @jest-environment jest-environment-jsdom */
import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeJob, setupWindowMocks, JobDataType} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('handleStatusChange', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleStatusChange = ControllerClass.prototype.handleStatusChange;
        return ctrl;
    }

    it('computes lists from STATUS_TO_LIST_MAP and refreshes', async () => {
        const ctrl = setup();
        await ctrl.handleStatusChange({jobId: 1, previousStatusId: 0, newStatusId: 3});
        // 0 → [NEW], 3 → [POD] → refreshes [NEW, POD]
        expect(ctrl.getJobList).toHaveBeenCalledWith(expect.arrayContaining([JobDataType.NEW, JobDataType.POD]));
    });

    it('re-selects job if found after refresh', async () => {
        const job = makeJob(42);
        const ctrl = setup();
        ctrl.findJobInLocalLists = jest.fn().mockReturnValue(job);
        await ctrl.handleStatusChange({jobId: 42, previousStatusId: 0, newStatusId: 1});
        expect(ctrl.selectJob).toHaveBeenCalledWith(job);
    });

    it('does NOT call selectJob when job not found', async () => {
        const ctrl = setup();
        ctrl.findJobInLocalLists = jest.fn().mockReturnValue(undefined);
        await ctrl.handleStatusChange({jobId: 99, previousStatusId: 0, newStatusId: 1});
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('handles unknown status IDs gracefully', async () => {
        const ctrl = setup();
        await ctrl.handleStatusChange({jobId: 1, previousStatusId: 999, newStatusId: 888});
        expect(ctrl.getJobList).toHaveBeenCalledWith([]);
    });

    it('rethrows errors', async () => {
        const ctrl = setup();
        ctrl.getJobList = jest.fn().mockRejectedValue(new Error('fail'));
        await expect(ctrl.handleStatusChange({jobId: 1, previousStatusId: 0, newStatusId: 1}))
            .rejects.toThrow('fail');
    });
});

describe('getData', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.getData = ControllerClass.prototype.getData;
        return ctrl;
    }

    it('clears jobList, jobListPOD, currentJob', async () => {
        const ctrl = setup({jobList: [makeJob(1)], jobListPOD: [makeJob(2)], currentJob: makeJob(3)});
        await ctrl.getData();
        expect(ctrl.jobList).toEqual([]);
        expect(ctrl.jobListPOD).toEqual([]);
        expect(ctrl.currentJob).toBeUndefined();
    });

    it('calls getJobList with ALL', async () => {
        const ctrl = setup();
        await ctrl.getData();
        expect(ctrl.getJobList).toHaveBeenCalledWith(JobDataType.ALL);
    });
});

describe('refreshJobLists', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.refreshJobLists = ControllerClass.prototype.refreshJobLists;
        return ctrl;
    }

    it('re-selects job when found after refresh', async () => {
        const job = makeJob(42);
        const ctrl = setup();
        ctrl.findJobInLocalLists = jest.fn().mockReturnValue(job);
        await ctrl.refreshJobLists(42);
        expect(ctrl.currentJob).toBe(job);
    });

    it('clears currentJob and warns when job not found', async () => {
        const ctrl = setup({currentJob: makeJob(42)});
        ctrl.findJobInLocalLists = jest.fn().mockReturnValue(undefined);
        await ctrl.refreshJobLists(42);
        expect(ctrl.currentJob).toBeUndefined();
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith(expect.stringContaining('no longer available'));
    });

    it('skips re-selection when no currentJobId provided', async () => {
        const ctrl = setup();
        await ctrl.refreshJobLists();
        expect(ctrl.findJobInLocalLists).not.toHaveBeenCalled();
    });
});

describe('loadTasksInBackground', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadTasksInBackground = ControllerClass.prototype.loadTasksInBackground;
        return ctrl;
    }

    it('clears tasks when no job selected', () => {
        const ctrl = setup({currentJob: undefined});
        ctrl.loadTasksInBackground();
        expect(ctrl.tasks).toEqual([]);
        expect(ctrl.filteredTasks).toEqual([]);
    });

    it('cancels previous loading if in progress', () => {
        const ctrl = setup({currentJob: {id: 10}, tasksLoadingInBackground: true});
        ctrl.loadTasksInBackground();
        expect(ctrl.tasksService.cancelJobTaskLoading).toHaveBeenCalled();
    });

    it('callback sets tasks for matching job', () => {
        const ctrl = setup({currentJob: {id: 10}});
        ctrl.loadTasksInBackground();
        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        const tasks = [{id: 1}];
        callback(tasks, null);
        expect(ctrl.tasks).toBe(tasks);
        expect(ctrl.filteredTasks).toBe(tasks);
    });

    it('callback ignores results for stale job', () => {
        const ctrl = setup({currentJob: {id: 10}});
        ctrl.loadTasksInBackground('all', 10);
        ctrl.currentJob = {id: 99};
        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        callback([{id: 1}], null);
        expect(ctrl.tasks).toEqual([]);
    });

    it('callback clears tasks on error', () => {
        const ctrl = setup({currentJob: {id: 10}});
        ctrl.loadTasksInBackground();
        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        callback([], new Error('fail'));
        expect(ctrl.tasks).toEqual([]);
    });
});

describe('getJobList', () => {
    beforeEach(() => {
        (globalThis as any).ClientInternal = false;
    });
    afterEach(() => {
        delete (globalThis as any).ClientInternal;
    });

    function setup(overrides = {}) {
        const ctrl = createController({
            viewsInitialized: true,
            selectedViews: [{id: 1}],
            jobFilters: {order: 'time', orderDirection: 'asc'},
            jobPodFilters: {order: 'time', orderDirection: 'asc'},
            jobRepriceFilters: {order: 'time', orderDirection: 'asc'},
            ...overrides,
        });
        ctrl.getJobList = ControllerClass.prototype.getJobList;
        ctrl.updateDateFilters = jest.fn();
        return ctrl;
    }

    it('calls updateSearchParams and refresh for NEW jobs', async () => {
        const ctrl = setup();
        await ctrl.getJobList(JobDataType.NEW);
        expect((window as any).ReactNationwideJobList.updateSearchParams).toHaveBeenCalledWith('newJobs', expect.any(Object));
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('newJobs');
        expect((window as any).ReactNationwideJobList.refresh).not.toHaveBeenCalledWith('podJobs');
        expect((window as any).ReactNationwideJobList.refresh).not.toHaveBeenCalledWith('repriceJobs');
    });

    it('calls updateSearchParams and refresh for POD jobs', async () => {
        const ctrl = setup();
        await ctrl.getJobList(JobDataType.POD);
        expect((window as any).ReactNationwideJobList.updateSearchParams).toHaveBeenCalledWith('podJobs', expect.any(Object));
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('podJobs');
        expect((window as any).ReactNationwideJobList.refresh).not.toHaveBeenCalledWith('newJobs');
    });

    it('calls updateSearchParams and refresh for REPRICE jobs', async () => {
        const ctrl = setup();
        await ctrl.getJobList(JobDataType.REPRICE);
        expect((window as any).ReactNationwideJobList.updateSearchParams).toHaveBeenCalledWith('repriceJobs', expect.any(Object));
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('repriceJobs');
        expect((window as any).ReactNationwideJobList.refresh).not.toHaveBeenCalledWith('newJobs');
    });

    it('refreshes all three lists for ALL', async () => {
        const ctrl = setup();
        await ctrl.getJobList(JobDataType.ALL);
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('newJobs');
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('podJobs');
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('repriceJobs');
    });

    it('does not call React bridge when ReactNationwideJobList is unavailable', async () => {
        const ctrl = setup();
        (window as any).ReactNationwideJobList = undefined;
        await ctrl.getJobList(JobDataType.NEW);
        // Should not throw
    });
});

describe('loadTasks', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadTasks = ControllerClass.prototype.loadTasks;
        return ctrl;
    }

    it('clears tasks when no currentJob', async () => {
        const ctrl = setup({currentJob: undefined});
        await ctrl.loadTasks();
        expect(ctrl.tasks).toEqual([]);
        expect(ctrl.tasksService.loadTasks).not.toHaveBeenCalled();
    });

    it('populates tasks on success', async () => {
        const tasks = [{id: 1}, {id: 2}];
        const ctrl = setup({currentJob: {id: 10}});
        ctrl.tasksService.loadTasks.mockResolvedValue(tasks);
        await ctrl.loadTasks();
        expect(ctrl.tasks).toBe(tasks);
        expect(ctrl.filteredTasks).toBe(tasks);
        expect(ctrl.tasksLoading).toBe(false);
    });

    it('shows error toast on service failure', async () => {
        const ctrl = setup({currentJob: {id: 10}});
        ctrl.tasksService.loadTasks.mockRejectedValue(new Error('fail'));
        await ctrl.loadTasks();
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalled();
        expect(ctrl.tasks).toEqual([]);
        expect(ctrl.tasksLoading).toBe(false);
    });
});

describe('markJobReadStatus', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.markJobReadStatus = ControllerClass.prototype.markJobReadStatus;
        return ctrl;
    }

    it('updates job in all 3 lists', () => {
        const j1 = {id: 42, hasBeenRead: false};
        const j2 = {id: 42, hasBeenRead: false};
        const j3 = {id: 42, hasBeenRead: false};
        const ctrl = setup({jobList: [j1], jobListPOD: [j2], jobListReprice: [j3]});
        ctrl.markJobReadStatus(42, true);
        expect(j1.hasBeenRead).toBe(true);
        expect(j2.hasBeenRead).toBe(true);
        expect(j3.hasBeenRead).toBe(true);
    });

    it('handles undefined lists', () => {
        const ctrl = setup({jobList: undefined, jobListPOD: undefined, jobListReprice: undefined});
        expect(() => ctrl.markJobReadStatus(42, true)).not.toThrow();
    });

    it('no-op for job not in any list', () => {
        const ctrl = setup({jobList: [{id: 1, hasBeenRead: false}]});
        ctrl.markJobReadStatus(999, true);
        expect(ctrl.jobList[0].hasBeenRead).toBe(false);
    });
});
