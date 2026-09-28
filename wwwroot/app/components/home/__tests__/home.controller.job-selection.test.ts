/** @jest-environment jest-environment-jsdom */
/**
 * HomeController — Job Selection & Navigation
 *
 * selectJob, selectJobFromMap, selectSupportJobDetail, processNewJob
 */

import './home.controller.test-setup';
import {
    ControllerClass, createController, makeJob, makeUnassignedJob,
    setupWindowMocks, CurrentWorkLists,
} from './home.controller.test-helpers';

setupWindowMocks();

// =====================================================================
// selectJob
// =====================================================================

describe('selectJob', () => {
    describe('current work list refresh (same-courier optimisation)', () => {
        it('does NOT call getCurrentJobs when the job belongs to the already-loaded courier', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'C42'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 42));
            expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
        });

        it('DOES call getCurrentJobs when the job belongs to a different courier', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'C42'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 99, 'Other'));
            expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(99);
        });

        it('DOES call getCurrentJobs when no courier was previously loaded', async () => {
            const ctrl = createController({currentCourier: undefined});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 42));
            expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
        });

        it('updates currentCourier text even when courier id has not changed', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'Old'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 42, 'New'));
            expect(ctrl.currentCourier).toEqual({id: 42, text: 'New'});
        });

        it('preserves currentCourier and jobsCurrentList for unassigned jobs', async () => {
            const courier = {id: 42, text: 'C42'};
            const jobs = [{id: 1}, {id: 2}];
            const ctrl = createController({currentCourier: courier, jobsCurrentList: jobs});
            ctrl.selectJob = ControllerClass.prototype.selectJob;

            await ctrl.selectJob(makeUnassignedJob(200));

            expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
            expect(ctrl.currentCourier).toEqual(courier);
            expect(ctrl.jobsCurrentList).toBe(jobs);
        });

        it('updates currentWorkSelection even when skipping getCurrentJobs', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'C42'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 42, 'Forty-Two'));
            expect(ctrl.currentWorkSelection).toBe(' for Courier C42: Forty-Two');
        });

        it('still fetches truck courier status when skipping getCurrentJobs', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'C42'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(100, 42));
            expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
            expect(ctrl.DispatchData.truckCourierStatus).toHaveBeenCalledWith(42);
        });
    });

    describe('general behaviour', () => {
        it('returns early for null/undefined job', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(null);
            await ctrl.selectJob(undefined);
            expect(ctrl.markJobReadStatus).not.toHaveBeenCalled();
        });

        it('sets currentJobId and currentSelection', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(55, 1));
            expect(ctrl.currentJobId).toBe(55);
            expect(ctrl.currentSelection).toBe(' for Job J55');
        });

        it('marks the job as read', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(10, 1));
            expect(ctrl.markJobReadStatus).toHaveBeenCalledWith(10, true);
        });

        it('loads supports in the background', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(10, 1));
            expect(ctrl.loadSupportsInBackground).toHaveBeenCalledWith(undefined, 10);
        });

        it('syncs selection to React job list', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(77, 1));
            expect((window as any).ReactJobList.selectJob).toHaveBeenCalledWith(77);
        });

        it('cancels previous task loading when switching jobs', async () => {
            const ctrl = createController({currentJobId: 10});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(20, 1));
            expect(ctrl.tasksService.cancelJobTaskLoading).toHaveBeenCalledWith(1, 10);
        });

        it('does not cancel task loading when re-selecting same job', async () => {
            const ctrl = createController({currentJobId: 10});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(10, 1));
            expect(ctrl.tasksService.cancelJobTaskLoading).not.toHaveBeenCalled();
        });

        it('calls applyScope and focusDispatchField', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(10, 1));
            expect(ctrl.focusDispatchField).toHaveBeenCalledWith(10);
            expect(ctrl.applyScope).toHaveBeenCalled();
        });
    });

    describe('view mode', () => {
        it('switches to SelectedDriver when not in Overview', async () => {
            const ctrl = createController({currentWorkViewMode: 'other'});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(1, 1));
            expect(ctrl.currentWorkViewMode).toBe(CurrentWorkLists.SelectedDriver);
        });

        it('preserves Overview mode', async () => {
            const ctrl = createController({currentWorkViewMode: CurrentWorkLists.Overview});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            await ctrl.selectJob(makeJob(1, 1));
            expect(ctrl.currentWorkViewMode).toBe(CurrentWorkLists.Overview);
        });
    });

    describe('unassigned job (Scenario 2)', () => {
        it('sets mapJobList to single item and fetches potential couriers', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            const job = makeUnassignedJob(50);
            await ctrl.selectJob(job);
            expect(ctrl.mapToDispatchMapItem).toHaveBeenCalledWith(job);
            expect(ctrl.getPotentialCouriers).toHaveBeenCalledWith(50);
        });
    });

    describe('assigned job with missing courierData', () => {
        it('falls back to map-only', async () => {
            const ctrl = createController();
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            const job = {
                id: 60, jobNo: 'J60', courier: 'X', assignedCourier: {id: 1, text: 'X'},
                courierData: undefined, statusId: 1, pickupAddress: {}, deliveryAddress: {},
            };
            await ctrl.selectJob(job);
            expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
            expect(ctrl.mapToDispatchMapItem).toHaveBeenCalledWith(job);
        });
    });

    describe('error handling', () => {
        it('falls back to single map item when getCurrentJobs throws', async () => {
            const ctrl = createController({currentCourier: undefined});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            ctrl.getCurrentJobs = jest.fn().mockRejectedValue(new Error('fail'));
            const job = makeJob(10, 1);
            await ctrl.selectJob(job);
            expect(ctrl.mapToDispatchMapItem).toHaveBeenCalledWith(job);
            expect(ctrl.applyScope).toHaveBeenCalled();
        });

        it('still calls applyScope when truckCourierStatus fails', async () => {
            const ctrl = createController({currentCourier: {id: 42, text: 'C42'}});
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            ctrl.DispatchData.truckCourierStatus = jest.fn().mockRejectedValue(new Error('fail'));
            await ctrl.selectJob(makeJob(10, 42));
            expect(ctrl.applyScope).toHaveBeenCalled();
        });
    });
});

// =====================================================================
// selectJobFromMap
// =====================================================================

describe('selectJobFromMap', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectJobFromMap = ControllerClass.prototype.selectJobFromMap;
        return ctrl;
    }

    it('returns early for invalid map items', async () => {
        const ctrl = setup();
        await ctrl.selectJobFromMap(null);
        await ctrl.selectJobFromMap({});
        await ctrl.selectJobFromMap({jobId: 0});
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('finds job in jobList before hitting API', async () => {
        const job = makeJob(42, 1);
        const ctrl = setup({jobList: [job] as any});
        await ctrl.selectJobFromMap({jobId: 42});
        expect(ctrl.selectJob).toHaveBeenCalledWith(job);
        expect(ctrl.DispatchData.getDispatchJobDetail).not.toHaveBeenCalled();
    });

    it('fetches from API when job not in jobList', async () => {
        const apiJob = makeJob(42, 1);
        const ctrl = setup({jobList: []});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(apiJob);
        await ctrl.selectJobFromMap({jobId: 42});
        expect(ctrl.DispatchData.getDispatchJobDetail).toHaveBeenCalledWith(42);
        expect(ctrl.selectJob).toHaveBeenCalledWith(apiJob);
    });

    it('shows error toast when API fails', async () => {
        const ctrl = setup({jobList: []});
        ctrl.DispatchData.getDispatchJobDetail.mockRejectedValue(new Error('fail'));
        await ctrl.selectJobFromMap({jobId: 42});
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalled();
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });
});

// =====================================================================
// selectSupportJobDetail
// =====================================================================

describe('selectSupportJobDetail', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectSupportJobDetail = ControllerClass.prototype.selectSupportJobDetail;
        return ctrl;
    }

    it('returns early when task job ID is invalid', async () => {
        const ctrl = setup();
        ctrl.tasksService.validateTaskJobId.mockReturnValue(false);
        await ctrl.selectSupportJobDetail({id: 1, jobId: 999, jobNumber: 'J999'});
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('finds job in jobList before API', async () => {
        const job = makeJob(42, 1);
        const ctrl = setup({jobList: [job] as any});
        ctrl.tasksService.findTaskJobInLists.mockReturnValue(job);
        await ctrl.selectSupportJobDetail({id: 1, jobId: 42, jobNumber: 'J42'});
        expect(ctrl.selectJob).toHaveBeenCalledWith(job);
        expect(ctrl.DispatchData.getDispatchJobDetail).not.toHaveBeenCalled();
    });

    it('fetches from API when not found locally', async () => {
        const apiJob = makeJob(42, 1);
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(apiJob);
        await ctrl.selectSupportJobDetail({id: 1, jobId: 42, jobNumber: 'J42'});
        expect(ctrl.selectJob).toHaveBeenCalledWith(apiJob);
    });

    it('warns when no job found at all', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(null);
        await ctrl.selectSupportJobDetail({id: 1, jobId: 42, jobNumber: 'J42'});
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith('This task has no job attached');
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });
});

// =====================================================================
// processNewJob
// =====================================================================

describe('processNewJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.processNewJob = ControllerClass.prototype.processNewJob;
        return ctrl;
    }

    it('calls getData, finds job in list, and selects it', async () => {
        const job = makeJob(10, 1);
        const ctrl = setup({jobList: [job] as any});
        await ctrl.processNewJob(10);
        expect(ctrl.getData).toHaveBeenCalled();
        expect(ctrl.selectJob).toHaveBeenCalledWith(job);
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith('New Job Created Successfully');
    });

    it('returns early when job not found in jobList after getData', async () => {
        const ctrl = setup({jobList: []});
        await ctrl.processNewJob(999);
        expect(ctrl.getData).toHaveBeenCalled();
        expect(ctrl.selectJob).not.toHaveBeenCalled();
        expect(ctrl.toastrService.showSuccessToast).not.toHaveBeenCalled();
    });
});
