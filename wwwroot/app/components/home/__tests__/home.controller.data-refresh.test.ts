/**
 * HomeController — Data Loading, View Modes & UI State
 *
 * getData, getCurrentJobs, refreshBox, refreshJobDetail,
 * getUndispatchedMapItems, mapToDispatchMapItem, isDeliveryJob,
 * toggleBoxCollapse, switchCurrentWorkViewMode, loadSupportsInBackground
 */

import './home.controller.test-setup';
import {
    ControllerClass, createController, makeJob, makeUnassignedJob,
    setupWindowMocks, CurrentWorkLists,
} from './home.controller.test-helpers';

setupWindowMocks();

// =====================================================================
// getData
// =====================================================================

describe('getData', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.getData = ControllerClass.prototype.getData;
        return ctrl;
    }

    it('clears currentJob and potentialCouriers', async () => {
        const ctrl = setup({currentJob: makeJob(1, 1), potentialCouriers: [{id: 1}]});
        await ctrl.getData();
        expect(ctrl.currentJob).toBeUndefined();
        expect(ctrl.potentialCouriers).toBeUndefined();
    });

    it('preserves and refreshes current courier', async () => {
        const ctrl = setup({currentCourier: {id: 42, text: 'C42'}});
        await ctrl.getData();
        expect(ctrl.currentCourier).toEqual({id: 42, text: 'C42'});
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('does not call getCurrentJobs without courier', async () => {
        const ctrl = setup({currentCourier: undefined});
        await ctrl.getData();
        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
    });

    it('refreshes driver counts for US customers', async () => {
        const ctrl = setup({isUsCustomer: true});
        await ctrl.getData();
        expect(ctrl.loadDriversWithJobCounts).toHaveBeenCalled();
    });

    it('skips driver counts for non-US', async () => {
        const ctrl = setup({isUsCustomer: false});
        await ctrl.getData();
        expect(ctrl.loadDriversWithJobCounts).not.toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
        const ctrl = setup();
        ctrl.getJobList = jest.fn().mockRejectedValue(new Error('fail'));
        await ctrl.getData();
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
    });
});

// =====================================================================
// getCurrentJobs
// =====================================================================

describe('getCurrentJobs', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.getCurrentJobs = ControllerClass.prototype.getCurrentJobs;
        ctrl.updateReactCurrentWorkJobList = jest.fn();
        ctrl.getUndispatchedMapItems = ControllerClass.prototype.getUndispatchedMapItems;
        return ctrl;
    }

    it('returns early for falsy courierId', async () => {
        const ctrl = setup();
        await ctrl.getCurrentJobs(0);
        await ctrl.getCurrentJobs(undefined);
        expect(ctrl.DispatchData.getJobsCurrent).not.toHaveBeenCalled();
    });

    it('populates jobsCurrentList', async () => {
        const jobs = [makeJob(1, 10), makeJob(2, 10)];
        const ctrl = setup();
        ctrl.DispatchData.getJobsCurrent.mockResolvedValue({jobs});
        await ctrl.getCurrentJobs(10);
        expect(ctrl.jobsCurrentList).toBe(jobs);
        expect(ctrl.currentListLoading).toBe(false);
    });

    it('filters undispatched jobs for map', async () => {
        const undispatched = {...makeJob(1, 10), statusId: 0};
        const dispatched = {...makeJob(2, 10), statusId: 3};
        const ctrl = setup();
        ctrl.DispatchData.getJobsCurrent.mockResolvedValue({jobs: [undispatched, dispatched]});
        await ctrl.getCurrentJobs(10);
        expect(ctrl.mapJobList).toEqual([expect.objectContaining({jobId: 1, statusId: 0})]);
    });

    it('sets empty array on error', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getJobsCurrent.mockRejectedValue(new Error('net'));
        await ctrl.getCurrentJobs(10);
        expect(ctrl.jobsCurrentList).toEqual([]);
        expect(ctrl.currentListLoading).toBe(false);
    });

    it('pushes data to React', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getJobsCurrent.mockResolvedValue({jobs: []});
        await ctrl.getCurrentJobs(10);
        expect(ctrl.updateReactCurrentWorkJobList).toHaveBeenCalled();
    });
});

// =====================================================================
// refreshBox
// =====================================================================

describe('refreshBox', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.refreshBox = ControllerClass.prototype.refreshBox;
        return ctrl;
    }

    it('routes "detail" to refreshJobDetail', async () => {
        const ctrl = setup();
        await ctrl.refreshBox('detail');
        expect(ctrl.refreshJobDetail).toHaveBeenCalled();
    });

    it('routes "supports" to getSupports', async () => {
        const ctrl = setup();
        await ctrl.refreshBox('supports');
        expect(ctrl.getSupports).toHaveBeenCalled();
    });

    it('routes "list" to ReactJobList.refresh', async () => {
        const ctrl = setup();
        await ctrl.refreshBox('list');
        expect((window as any).ReactJobList.refresh).toHaveBeenCalled();
    });

    it('routes "map" and unknown to getData', async () => {
        const ctrl = setup();
        await ctrl.refreshBox('map');
        expect(ctrl.getData).toHaveBeenCalledTimes(1);
        await ctrl.refreshBox('unknown');
        expect(ctrl.getData).toHaveBeenCalledTimes(2);
    });
});

// =====================================================================
// refreshJobDetail
// =====================================================================

describe('refreshJobDetail', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.refreshJobDetail = ControllerClass.prototype.refreshJobDetail;
        return ctrl;
    }

    it('no-ops without job', () => {
        const ctrl = setup({currentJobId: undefined});
        ctrl.refreshJobDetail();
        expect((window as any).ReactJobDetails.refresh).not.toHaveBeenCalled();
    });

    it('calls React refresh', () => {
        const ctrl = setup({currentJobId: 42});
        ctrl.refreshJobDetail();
        expect((window as any).ReactJobDetails.refresh).toHaveBeenCalled();
    });
});

// =====================================================================
// getUndispatchedMapItems
// =====================================================================

describe('getUndispatchedMapItems', () => {
    function setup() {
        const ctrl = createController();
        ctrl.getUndispatchedMapItems = ControllerClass.prototype.getUndispatchedMapItems;
        return ctrl;
    }

    it('filters to statusId === 0', () => {
        const ctrl = setup();
        const jobs = [
            {...makeJob(1, 10), statusId: 0},
            {...makeJob(2, 10), statusId: 1},
            {...makeJob(3, 10), statusId: 0},
        ];
        const result = ctrl.getUndispatchedMapItems(jobs);
        expect(result).toHaveLength(2);
    });

    it('returns empty for empty/null/undefined', () => {
        const ctrl = setup();
        expect(ctrl.getUndispatchedMapItems([])).toEqual([]);
        expect(ctrl.getUndispatchedMapItems(null)).toEqual([]);
        expect(ctrl.getUndispatchedMapItems(undefined)).toEqual([]);
    });
});

// =====================================================================
// mapToDispatchMapItem
// =====================================================================

describe('mapToDispatchMapItem', () => {
    it('maps job properties', () => {
        const ctrl = createController();
        ctrl.mapToDispatchMapItem = ControllerClass.prototype.mapToDispatchMapItem;
        const result = ctrl.mapToDispatchMapItem({
            id: 42, jobNo: 'J42', statusId: 2,
            pickupAddress: {line1: 'A'}, deliveryAddress: {line1: 'B'},
        });
        expect(result).toEqual({
            jobId: 42, jobNo: 'J42', statusId: 2,
            pickupAddress: {line1: 'A'}, deliveryAddress: {line1: 'B'},
        });
    });
});

// =====================================================================
// isDeliveryJob
// =====================================================================

describe('isDeliveryJob', () => {
    it('returns isAgentJob value', () => {
        const ctrl = createController();
        ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
        expect(ctrl.isDeliveryJob({isAgentJob: true})).toBe(true);
        expect(ctrl.isDeliveryJob({isAgentJob: false})).toBe(false);
    });
});

// =====================================================================
// toggleBoxCollapse
// =====================================================================

describe('toggleBoxCollapse', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.toggleBoxCollapse = ControllerClass.prototype.toggleBoxCollapse;
        ctrl.isDefaultLayout = jest.fn().mockReturnValue(false);
        ctrl.saveBoxVisibility = jest.fn();
        return ctrl;
    }

    it('toggles collapsed state', () => {
        const ctrl = setup({boxes: {b: {collapsed: false}}});
        ctrl.toggleBoxCollapse('b');
        expect(ctrl.boxes.b.collapsed).toBe(true);
        ctrl.toggleBoxCollapse('b');
        expect(ctrl.boxes.b.collapsed).toBe(false);
    });

    it('does nothing for missing box', () => {
        const ctrl = setup({boxes: undefined});
        expect(() => ctrl.toggleBoxCollapse('b')).not.toThrow();
    });

    it('prevents collapse on default layout', () => {
        const ctrl = setup({boxes: {b: {collapsed: false}}});
        ctrl.isDefaultLayout = jest.fn().mockReturnValue(true);
        ctrl.toggleBoxCollapse('b');
        expect(ctrl.boxes.b.collapsed).toBe(false);
    });
});

// =====================================================================
// switchCurrentWorkViewMode
// =====================================================================

describe('switchCurrentWorkViewMode', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.switchCurrentWorkViewMode = ControllerClass.prototype.switchCurrentWorkViewMode;
        return ctrl;
    }

    it('clears selection and unmounts React when switching to Overview', async () => {
        const ctrl = setup({
            currentWorkViewMode: CurrentWorkLists.Overview,
            reactCurrentWorkMounted: true,
        });

        await ctrl.switchCurrentWorkViewMode();

        expect(ctrl.currentWorkSelection).toBe('');
        expect((window as any).ReactCurrentWorkJobList.unmount).toHaveBeenCalled();
        expect(ctrl.reactCurrentWorkMounted).toBe(false);
    });

    it('refreshes driver job counts in Overview mode', async () => {
        const ctrl = setup({currentWorkViewMode: CurrentWorkLists.Overview});
        await ctrl.switchCurrentWorkViewMode();
        expect(ctrl.loadDriversWithJobCounts).toHaveBeenCalled();
    });

    it('skips unmount when not yet mounted', async () => {
        const ctrl = setup({
            currentWorkViewMode: CurrentWorkLists.Overview,
            reactCurrentWorkMounted: false,
        });
        await ctrl.switchCurrentWorkViewMode();
        expect((window as any).ReactCurrentWorkJobList.unmount).not.toHaveBeenCalled();
    });

    it('mounts/pushes React data when switching to SelectedDriver with data', async () => {
        const ctrl = setup({
            currentWorkViewMode: CurrentWorkLists.SelectedDriver,
            jobsCurrentList: [{id: 1}],
        });
        await ctrl.switchCurrentWorkViewMode();
        expect(ctrl.updateReactCurrentWorkJobList).toHaveBeenCalled();
    });

    it('does nothing when switching to SelectedDriver without data', async () => {
        const ctrl = setup({
            currentWorkViewMode: CurrentWorkLists.SelectedDriver,
            jobsCurrentList: undefined,
        });
        await ctrl.switchCurrentWorkViewMode();
        expect(ctrl.updateReactCurrentWorkJobList).not.toHaveBeenCalled();
    });
});

// =====================================================================
// loadSupportsInBackground
// =====================================================================

describe('loadSupportsInBackground', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadSupportsInBackground = ControllerClass.prototype.loadSupportsInBackground;
        return ctrl;
    }

    it('clears supports when no job selected', () => {
        const ctrl = setup({currentJobId: undefined, supports: [{id: 1}]});
        ctrl.loadSupportsInBackground();
        expect(ctrl.supports).toEqual([]);
        expect(ctrl.filteredSupports).toEqual([]);
    });

    it('cancels previous loading if in progress', () => {
        const ctrl = setup({currentJobId: 10, supportsLoadingInBackground: true});
        ctrl.loadSupportsInBackground();
        expect(ctrl.tasksService.cancelJobTaskLoading).toHaveBeenCalled();
    });

    it('builds filter request and starts background loading', () => {
        const ctrl = setup({currentJobId: 10});
        ctrl.loadSupportsInBackground();
        expect(ctrl.tasksService.buildFilterRequest).toHaveBeenCalled();
        expect(ctrl.tasksService.loadTasksInBackground).toHaveBeenCalled();
        expect(ctrl.supportsLoadingInBackground).toBe(true);
    });

    it('callback sets supports for matching job', () => {
        const ctrl = setup({currentJobId: 10});
        ctrl.loadSupportsInBackground();

        // Extract the callback passed to loadTasksInBackground
        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        const tasks = [{id: 1}, {id: 2}];
        callback(tasks, null);

        expect(ctrl.supports).toBe(tasks);
        expect(ctrl.filteredSupports).toBe(tasks);
        expect(ctrl.supportsLoadingInBackground).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('callback ignores results for stale job', () => {
        const ctrl = setup({currentJobId: 10});
        ctrl.loadSupportsInBackground('all', 10);

        // Change current job before callback
        ctrl.currentJobId = 99;

        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        callback([{id: 1}], null);

        // Should not update supports since job changed
        expect(ctrl.supports).toEqual([]);
    });

    it('callback clears supports on error', () => {
        const ctrl = setup({currentJobId: 10});
        ctrl.loadSupportsInBackground();

        const callback = ctrl.tasksService.loadTasksInBackground.mock.calls[0][1];
        callback([], new Error('fail'));

        expect(ctrl.supports).toEqual([]);
        expect(ctrl.filteredSupports).toEqual([]);
    });

    it('uses explicit jobId parameter when provided', () => {
        const ctrl = setup({currentJobId: 5});
        ctrl.loadSupportsInBackground('all', 10);

        expect(ctrl.tasksService.buildFilterRequest).toHaveBeenCalledWith(
            'all', 10, undefined, undefined,
        );
    });
});

// =====================================================================
// markJobReadStatus (private)
// =====================================================================

describe('markJobReadStatus', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.markJobReadStatus = ControllerClass.prototype.markJobReadStatus;
        return ctrl;
    }

    it('updates hasBeenRead on the matching job in jobList', async () => {
        const jobs = [
            {id: 1, hasBeenRead: false, jobNo: 'J1'},
            {id: 2, hasBeenRead: false, jobNo: 'J2'},
        ];
        const originalJob2 = jobs[1];
        const ctrl = setup({jobList: jobs});

        await ctrl.markJobReadStatus(2, true);

        expect(ctrl.jobList[1].hasBeenRead).toBe(true);
        // Spread creates a new object (immutable update)
        expect(ctrl.jobList[1]).not.toBe(originalJob2);
    });

    it('does not modify jobList when job not found', async () => {
        const jobs = [{id: 1, hasBeenRead: false}];
        const ctrl = setup({jobList: jobs});

        await ctrl.markJobReadStatus(999, true);

        expect(ctrl.jobList[0].hasBeenRead).toBe(false);
    });

    it('calls API regardless of whether job is in list', async () => {
        const ctrl = setup({jobList: []});
        await ctrl.markJobReadStatus(42, true);
        expect(ctrl.DispatchData.updateJobReadStatus).toHaveBeenCalledWith(42, true);
    });

    it('can mark as unread', async () => {
        const jobs = [{id: 1, hasBeenRead: true}];
        const ctrl = setup({jobList: jobs});

        await ctrl.markJobReadStatus(1, false);

        expect(ctrl.jobList[0].hasBeenRead).toBe(false);
        expect(ctrl.DispatchData.updateJobReadStatus).toHaveBeenCalledWith(1, false);
    });
});

// =====================================================================
// loadSupports (synchronous foreground loading)
// =====================================================================

describe('loadSupports', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadSupports = ControllerClass.prototype.loadSupports;
        return ctrl;
    }

    it('clears supports and returns when no job selected', async () => {
        const ctrl = setup({currentJobId: undefined, supports: [{id: 1}]});
        await ctrl.loadSupports();
        expect(ctrl.supports).toEqual([]);
        expect(ctrl.filteredSupports).toEqual([]);
        expect(ctrl.tasksService.loadTasks).not.toHaveBeenCalled();
    });

    it('sets loading state, builds filter, and populates supports', async () => {
        const tasks = [{id: 10}, {id: 11}];
        const ctrl = setup({currentJobId: 5});
        ctrl.tasksService.loadTasks.mockResolvedValue(tasks);

        await ctrl.loadSupports('myFilter');

        expect(ctrl.tasksService.buildFilterRequest).toHaveBeenCalledWith(
            'myFilter', 5, undefined, undefined,
        );
        expect(ctrl.supports).toBe(tasks);
        expect(ctrl.filteredSupports).toBe(tasks);
        expect(ctrl.supportsLoading).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('shows error toast and clears supports on failure', async () => {
        const ctrl = setup({currentJobId: 5});
        ctrl.tasksService.loadTasks.mockRejectedValue(new Error('fail'));

        await ctrl.loadSupports();

        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith('Error loading support tasks');
        expect(ctrl.supports).toEqual([]);
        expect(ctrl.supportsLoading).toBe(false);
    });

    it('uses default supportsFilter when no argument provided', async () => {
        const ctrl = setup({currentJobId: 5, supportsFilter: 'open'});
        ctrl.tasksService.loadTasks.mockResolvedValue([]);

        await ctrl.loadSupports();

        expect(ctrl.tasksService.buildFilterRequest).toHaveBeenCalledWith(
            'open', 5, undefined, undefined,
        );
    });
});

// =====================================================================
// setTruckMode
// =====================================================================

describe('setTruckMode', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.setTruckMode = ControllerClass.prototype.setTruckMode;
        return ctrl;
    }

    it('sets truckMode and calls getData', async () => {
        const ctrl = setup({truckMode: 'Off'});
        await ctrl.setTruckMode('On');
        expect(ctrl.truckMode).toBe('On');
        expect(ctrl.getData).toHaveBeenCalled();
    });
});

// =====================================================================
// updateJobSearchText
// =====================================================================

describe('updateJobSearchText', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.updateJobSearchText = ControllerClass.prototype.updateJobSearchText;
        return ctrl;
    }

    it('sets searchText and calls getJobList', async () => {
        const ctrl = setup();
        await ctrl.updateJobSearchText('test query');
        expect(ctrl.queryParams.searchText).toBe('test query');
        expect(ctrl.getJobList).toHaveBeenCalled();
    });

    it('defaults to empty string for falsy input', async () => {
        const ctrl = setup();
        await ctrl.updateJobSearchText('');
        expect(ctrl.queryParams.searchText).toBe('');
    });
});

// =====================================================================
// onJobsLoaded callback (map population on initial load)
// =====================================================================

describe('onJobsLoaded callback logic', () => {
    /**
     * Tests the onJobsLoaded callback logic from doMountReactJobList.
     * We extract and invoke the same logic the callback uses:
     * filter to statusId===0, map via mapToDispatchMapItem, set mapJobListFull.
     */
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        // Use real mapToDispatchMapItem so we test the full pipeline
        ctrl.mapToDispatchMapItem = ControllerClass.prototype.mapToDispatchMapItem;
        return ctrl;
    }

    /** Simulates the onJobsLoaded callback from doMountReactJobList */
    function invokeOnJobsLoaded(ctrl: any, jobs: any[]) {
        if (!ctrl.currentJob) {
            ctrl.mapJobList = jobs
                .filter((j: any) => j.statusId === 0)
                .map((j: any) => ctrl.mapToDispatchMapItem(j));
            ctrl.mapJobListFull = [...ctrl.mapJobList];
            ctrl.applyScope();
        }
    }

    it('populates mapJobList with undispatched jobs when no job is selected', () => {
        const ctrl = setup({currentJob: undefined});
        const jobs = [
            makeUnassignedJob(1),                          // statusId: 0
            {...makeJob(2, 10), statusId: 1},              // dispatched
            makeUnassignedJob(3),                          // statusId: 0
            {...makeJob(4, 20), statusId: 6},              // delivered
        ];

        invokeOnJobsLoaded(ctrl, jobs);

        expect(ctrl.mapJobList).toHaveLength(2);
        expect(ctrl.mapJobList).toEqual([
            expect.objectContaining({jobId: 1, statusId: 0}),
            expect.objectContaining({jobId: 3, statusId: 0}),
        ]);
    });

    it('also populates mapJobListFull as a copy', () => {
        const ctrl = setup({currentJob: undefined});
        const jobs = [makeUnassignedJob(1)];

        invokeOnJobsLoaded(ctrl, jobs);

        expect(ctrl.mapJobListFull).toEqual(ctrl.mapJobList);
        expect(ctrl.mapJobListFull).not.toBe(ctrl.mapJobList); // separate array
    });

    it('calls applyScope when no job is selected', () => {
        const ctrl = setup({currentJob: undefined});
        invokeOnJobsLoaded(ctrl, [makeUnassignedJob(1)]);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('does NOT populate mapJobList when a job is selected', () => {
        const ctrl = setup({currentJob: makeJob(99, 1)});
        const originalMapJobList = ctrl.mapJobList;

        invokeOnJobsLoaded(ctrl, [makeUnassignedJob(1), makeUnassignedJob(2)]);

        expect(ctrl.mapJobList).toBe(originalMapJobList);
        expect(ctrl.applyScope).not.toHaveBeenCalled();
    });

    it('sets empty mapJobList when all jobs are dispatched', () => {
        const ctrl = setup({currentJob: undefined});
        const jobs = [
            {...makeJob(1, 10), statusId: 1},
            {...makeJob(2, 20), statusId: 6},
        ];

        invokeOnJobsLoaded(ctrl, jobs);

        expect(ctrl.mapJobList).toEqual([]);
        expect(ctrl.mapJobListFull).toEqual([]);
    });
});
