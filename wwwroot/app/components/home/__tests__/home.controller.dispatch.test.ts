/**
 * HomeController — Dispatching & Courier Assignment
 *
 * handleJobDispatch, handleUndispatchedJob, dispatchJob,
 * handleDispatchSelection, addStopToJob
 */

import './home.controller.test-setup';
import {
    ControllerClass, createController, makeJob,
    setupWindowMocks,
} from './home.controller.test-helpers';

setupWindowMocks();

// =====================================================================
// handleJobDispatch
// =====================================================================

describe('handleJobDispatch', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleJobDispatch = ControllerClass.prototype.handleJobDispatch;
        return ctrl;
    }

    it('calls dispatchJob with correct arguments', async () => {
        const ctrl = setup();
        await ctrl.handleJobDispatch(makeJob(10, 1) as any, 99);
        expect(ctrl.dispatchJob).toHaveBeenCalledWith(99, 10);
    });

    it('sets assignedCourier on the job', async () => {
        const ctrl = setup();
        const job = makeJob(10, 1) as any;
        await ctrl.handleJobDispatch(job, 99);
        expect(job.assignedCourier).toEqual({id: 99, text: ''});
    });

    it('refreshes currentJob when dispatching the selected job', async () => {
        const updated = makeJob(10, 99);
        const ctrl = setup({currentJobId: 10});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(updated);
        await ctrl.handleJobDispatch(makeJob(10, 1) as any, 99);
        expect(ctrl.DispatchData.getDispatchJobDetail).toHaveBeenCalledWith(10);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('does not refresh currentJob when dispatching a different job', async () => {
        const ctrl = setup({currentJobId: 5});
        await ctrl.handleJobDispatch(makeJob(10, 1) as any, 99);
        expect(ctrl.DispatchData.getDispatchJobDetail).not.toHaveBeenCalled();
    });

    it('rethrows errors', async () => {
        const ctrl = setup();
        ctrl.dispatchJob = jest.fn().mockRejectedValue(new Error('dispatch failed'));
        await expect(ctrl.handleJobDispatch(makeJob(10, 1) as any, 99))
            .rejects.toThrow('dispatch failed');
    });
});

// =====================================================================
// handleUndispatchedJob
// =====================================================================

describe('handleUndispatchedJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleUndispatchedJob = ControllerClass.prototype.handleUndispatchedJob;
        return ctrl;
    }

    it('fetches potential couriers and clears currentCourier', async () => {
        const ctrl = setup({currentCourier: {id: 42, text: 'Old'}});
        await ctrl.handleUndispatchedJob({id: 10, jobNo: 'J10'} as any);
        expect(ctrl.getPotentialCouriers).toHaveBeenCalledWith(10);
        expect(ctrl.currentCourier).toBeUndefined();
        expect(ctrl.currentSelection).toBe(' for Job J10');
    });
});

// =====================================================================
// dispatchJob (private)
// =====================================================================

describe('dispatchJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.dispatchJob = ControllerClass.prototype.dispatchJob;
        return ctrl;
    }

    it('assigns job via service and shows courier toast', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({id: 'DR1', name: 'Alice', courierId: 99});
        await ctrl.dispatchJob(99, 10);
        expect(ctrl.dispatchJobService.assignSingleJobById).toHaveBeenCalledWith(99, 10);
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith('Dispatched to DR1: Alice');
    });

    it('falls back to generic toast when courier fetch fails', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockRejectedValue(new Error('fail'));
        await ctrl.dispatchJob(99, 10);
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith('Job dispatched successfully');
    });

    it('calls getData and restores currentJobId after', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({id: 'DR1', name: 'Alice', courierId: 99});
        await ctrl.dispatchJob(99, 10);
        expect(ctrl.getData).toHaveBeenCalled();
        expect(ctrl.currentJobId).toBe(10);
        expect(ctrl.refreshJobDetail).toHaveBeenCalled();
    });

    it('rethrows when assignSingleJobById fails', async () => {
        const ctrl = setup();
        ctrl.dispatchJobService.assignSingleJobById.mockRejectedValue(new Error('fail'));
        await expect(ctrl.dispatchJob(99, 10)).rejects.toThrow('fail');
    });

    it('handles courier with empty id field', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({id: '', name: 'Bob', courierId: 99});
        await ctrl.dispatchJob(99, 10);
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith('Dispatched to Bob');
    });
});

// =====================================================================
// handleDispatchSelection
// =====================================================================

describe('handleDispatchSelection', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleDispatchSelection = ControllerClass.prototype.handleDispatchSelection;
        return ctrl;
    }

    it('returns early when $event is undefined', async () => {
        const ctrl = setup();
        await ctrl.handleDispatchSelection({id: 1, text: ''}, {}, '', undefined, makeJob(1, 1) as any);
        expect(ctrl.dispatchJob).not.toHaveBeenCalled();
    });

    it('returns early when selectedCourier is null or has no id', async () => {
        const ctrl = setup();
        const event = {} as MouseEvent;
        await ctrl.handleDispatchSelection(null, {}, '', event, makeJob(1, 1) as any);
        await ctrl.handleDispatchSelection({id: 0, text: ''}, {}, '', event, makeJob(1, 1) as any);
        expect(ctrl.dispatchJob).not.toHaveBeenCalled();
    });

    it('calls dispatchJob with courier and job ids', async () => {
        const ctrl = setup();
        const event = {} as MouseEvent;
        await ctrl.handleDispatchSelection({id: 99, text: 'C99'}, {}, '', event, makeJob(10, 1) as any);
        expect(ctrl.dispatchJob).toHaveBeenCalledWith(99, 10);
    });

    it('clears searchText and sets assignedCourier on success', async () => {
        const ctrl = setup();
        const event = {} as MouseEvent;
        const job = makeJob(10, 1) as any;
        job.searchText = 'some text';
        await ctrl.handleDispatchSelection({id: 99, text: 'C99'}, {}, '', event, job);
        expect(job.searchText).toBe('');
        expect(job.assignedCourier).toEqual({id: 99, text: 'C99'});
    });

    it('clears assignedCourier on error', async () => {
        const ctrl = setup();
        ctrl.dispatchJob = jest.fn().mockRejectedValue(new Error('fail'));
        const event = {} as MouseEvent;
        const job = makeJob(10, 1) as any;
        await ctrl.handleDispatchSelection({id: 99, text: 'C99'}, {}, '', event, job);
        expect(job.assignedCourier).toBeUndefined();
    });
});

// =====================================================================
// addStopToJob
// =====================================================================

describe('addStopToJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.addStopToJob = ControllerClass.prototype.addStopToJob;
        return ctrl;
    }

    it('sets loading state, calls addNewStop, selects new job from list', async () => {
        const newJob = makeJob(20, 1);
        const ctrl = setup({jobList: [newJob] as any});
        ctrl.jobAddStopService.addNewStop.mockResolvedValue(20);
        const event = {} as MouseEvent;
        const job = makeJob(10, 1) as any;

        await ctrl.addStopToJob(event, job);

        expect(ctrl.jobAddStopService.addNewStop).toHaveBeenCalledWith(job, event);
        expect(ctrl.selectJob).toHaveBeenCalledWith(newJob);
        expect(ctrl.isDataLoading).toBe(false); // finally resets
    });

    it('fetches from API when new stop not in jobList', async () => {
        const apiJob = makeJob(20, 1);
        const ctrl = setup({jobList: []});
        ctrl.jobAddStopService.addNewStop.mockResolvedValue(20);
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(apiJob);

        await ctrl.addStopToJob({} as MouseEvent, makeJob(10, 1) as any);

        expect(ctrl.DispatchData.getDispatchJobDetail).toHaveBeenCalledWith(20);
        expect(ctrl.selectJob).toHaveBeenCalledWith(apiJob);
    });

    it('restores current job when addNewStop returns falsy', async () => {
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockResolvedValue(null);
        const job = makeJob(10, 1) as any;

        await ctrl.addStopToJob({} as MouseEvent, job);

        expect(ctrl.currentJobId).toBe(10);
        expect(ctrl.currentJob).toBe(job);
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockRejectedValue(new Error('fail'));

        await ctrl.addStopToJob({} as MouseEvent, makeJob(10, 1) as any);

        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith('Failed to add stop to job');
        expect(ctrl.isDataLoading).toBe(false);
    });

    it('shows loading-specific error message', async () => {
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockRejectedValue(new Error('Error loading details'));

        await ctrl.addStopToJob({} as MouseEvent, makeJob(10, 1) as any);

        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith('Error loading new stop job details');
    });
});

// =====================================================================
// reAllocateJobs
// =====================================================================

describe('reAllocateJobs', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.reAllocateJobs = ControllerClass.prototype.reAllocateJobs;
        return ctrl;
    }

    it('returns early for null job', async () => {
        const ctrl = setup();
        await ctrl.reAllocateJobs(null);
        expect(ctrl.dispatchJobService.reassignJob).not.toHaveBeenCalled();
    });

    it('reassigns, refreshes data, then searches courier', async () => {
        const ctrl = setup();
        const job = makeJob(10, 1) as any;

        await ctrl.reAllocateJobs(job);

        expect(ctrl.dispatchJobService.reassignJob).toHaveBeenCalledWith(job);
        expect(ctrl.getData).toHaveBeenCalled();
        expect(ctrl.searchCourier).toHaveBeenCalled();
    });
});
