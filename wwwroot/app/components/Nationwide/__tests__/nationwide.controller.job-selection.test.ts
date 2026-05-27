import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeFlightJob, makeDeliveryJob, makeJob, setupWindowMocks} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('selectJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectJob = ControllerClass.prototype.selectJob;
        return ctrl;
    }

    it('returns early for null/undefined job', async () => {
        const ctrl = setup();
        await ctrl.selectJob(null);
        await ctrl.selectJob(undefined);
        expect(ctrl.markJobReadStatus).not.toHaveBeenCalled();
    });

    it('returns early if isSelectingJob is true (re-entrancy guard)', async () => {
        const ctrl = setup({isSelectingJob: true});
        await ctrl.selectJob(makeJob(1));
        expect(ctrl.markJobReadStatus).not.toHaveBeenCalled();
    });

    it('sets currentJob, marks read, syncs to React', async () => {
        const ctrl = setup();
        const job = makeJob(42);
        await ctrl.selectJob(job);
        expect(ctrl.currentJob).toBe(job);
        expect(ctrl.markJobReadStatus).toHaveBeenCalledWith(42, true);
        expect((window as any).ReactNationwideJobList.selectJob).toHaveBeenCalledWith('newJobs', 42);
        expect((window as any).ReactNationwideJobList.selectJob).toHaveBeenCalledWith('podJobs', 42);
        expect((window as any).ReactNationwideJobList.selectJob).toHaveBeenCalledWith('repriceJobs', 42);
    });

    it('cancels previous task loading when job changes', async () => {
        const ctrl = setup({currentJob: {id: 10}});
        await ctrl.selectJob(makeJob(20));
        expect(ctrl.tasksService.cancelJobTaskLoading).toHaveBeenCalledWith(2, 10);
    });

    it('does NOT cancel tasks when re-selecting same job', async () => {
        const ctrl = setup({currentJob: {id: 10}});
        await ctrl.selectJob(makeJob(10));
        expect(ctrl.tasksService.cancelJobTaskLoading).not.toHaveBeenCalled();
    });

    it('sets isDeliveryJobType for agent jobs', async () => {
        const ctrl = setup();
        ctrl.isDeliveryJob = jest.fn().mockReturnValue(true);
        await ctrl.selectJob(makeDeliveryJob(1));
        expect(ctrl.isDeliveryJobType).toBe(true);
    });

    it('resets isSelectingJob in finally even on error', async () => {
        const ctrl = setup();
        ctrl.handleJobSelectionRelatedData = jest.fn().mockRejectedValue(new Error('fail'));
        await ctrl.selectJob(makeJob(1));
        expect(ctrl.isSelectingJob).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('calls updateUIState, handleJobSelectionRelatedData, loadTasksInBackground, displayJobOnMap', async () => {
        const ctrl = setup();
        const job = makeJob(1);
        await ctrl.selectJob(job);
        expect(ctrl.updateUIState).toHaveBeenCalledWith(job);
        expect(ctrl.handleJobSelectionRelatedData).toHaveBeenCalledWith(job);
        expect(ctrl.loadTasksInBackground).toHaveBeenCalledWith(undefined, 1);
        expect(ctrl.displayJobOnMap).toHaveBeenCalledWith(job);
    });
});

describe('handleJobSelectionRelatedData', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleJobSelectionRelatedData = ControllerClass.prototype.handleJobSelectionRelatedData;
        ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
        return ctrl;
    }

    it('resets flight/agent state', async () => {
        const ctrl = setup({flightOptions: [{id: 1}], agentOptions: [{id: 1}]});
        await ctrl.handleJobSelectionRelatedData(makeJob(1));
        expect(ctrl.flightOptions).toEqual([]);
        expect(ctrl.agentOptions).toEqual([]);
        expect(ctrl.flightMessage).toBeUndefined();
        expect(ctrl.agentMessage).toBeUndefined();
    });

    it('loads airports and flights for unassigned flight job', async () => {
        const ctrl = setup();
        ctrl.nationwideService.getNearbyAirports
            .mockResolvedValueOnce([{id: 10, text: 'AKL'}])
            .mockResolvedValueOnce([{id: 20, text: 'WLG'}]);

        const job = makeFlightJob(1);
        await ctrl.handleJobSelectionRelatedData(job);

        expect(ctrl.nationwideService.getNearbyAirports).toHaveBeenCalledWith(1, true);
        expect(ctrl.nationwideService.getNearbyAirports).toHaveBeenCalledWith(1, false);
        expect(ctrl.selectedOutboundAirport).toEqual({id: 10, text: 'AKL'});
        expect(ctrl.selectedInboundAirport).toEqual({id: 20, text: 'WLG'});
        expect(ctrl.loadFlights).toHaveBeenCalled();
    });

    it('sets message for flight job with assigned flight', async () => {
        const ctrl = setup();
        const job = makeFlightJob(1, {assignedFlight: {flightNumber: 'NZ123'}});
        await ctrl.handleJobSelectionRelatedData(job);
        expect(ctrl.flightMessage).toBe('Flight already assigned to this job');
        expect(ctrl.loadFlights).not.toHaveBeenCalled();
    });

    it('processes agents for unassigned delivery job', async () => {
        const ctrl = setup();
        const job = makeDeliveryJob(1);
        await ctrl.handleJobSelectionRelatedData(job);
        expect(ctrl.processAgents).toHaveBeenCalledWith(job);
    });

    it('sets message for delivery job with assigned agent', async () => {
        const ctrl = setup();
        const job = makeDeliveryJob(1, {assignedAgent: {agentId: 5}});
        await ctrl.handleJobSelectionRelatedData(job);
        expect(ctrl.agentMessage).toBe('Agent already assigned to this job');
        expect(ctrl.processAgents).not.toHaveBeenCalled();
    });
});

describe('selectTaskJobDetail', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectTaskJobDetail = ControllerClass.prototype.selectTaskJobDetail;
        return ctrl;
    }

    it('returns early when validateJobId fails', async () => {
        const ctrl = setup();
        ctrl.validateJobId = jest.fn().mockReturnValue(false);
        await ctrl.selectTaskJobDetail({id: 1, jobId: 42});
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('returns early when any job list is null', async () => {
        const ctrl = setup({jobList: null});
        await ctrl.selectTaskJobDetail({id: 1, jobId: 42});
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('finds job via tasksService.findTaskJobInLists', async () => {
        const job = makeJob(42);
        const ctrl = setup();
        ctrl.tasksService.findTaskJobInLists.mockReturnValue(job);
        await ctrl.selectTaskJobDetail({id: 1, jobId: 42});
        expect(ctrl.selectJob).toHaveBeenCalledWith(job);
    });

    it('fetches from API when not found locally', async () => {
        const apiJob = makeJob(42);
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(apiJob);
        await ctrl.selectTaskJobDetail({id: 1, jobId: 42});
        expect(ctrl.selectJob).toHaveBeenCalledWith(apiJob);
    });

    it('shows warning when no job found', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(null);
        await ctrl.selectTaskJobDetail({id: 1, jobId: 42});
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith('This task has no job attached');
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });
});

describe('findJobInLocalLists', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.findJobInLocalLists = ControllerClass.prototype.findJobInLocalLists;
        return ctrl;
    }

    it('finds in jobList', () => {
        const job = makeJob(42);
        const ctrl = setup({jobList: [job]});
        expect(ctrl.findJobInLocalLists(42)).toBe(job);
    });

    it('finds in jobListPOD when not in jobList', () => {
        const job = makeJob(42);
        const ctrl = setup({jobList: [], jobListPOD: [job]});
        expect(ctrl.findJobInLocalLists(42)).toBe(job);
    });

    it('finds in jobListReprice', () => {
        const job = makeJob(42);
        const ctrl = setup({jobList: [], jobListPOD: [], jobListReprice: [job]});
        expect(ctrl.findJobInLocalLists(42)).toBe(job);
    });

    it('returns undefined when not found', () => {
        const ctrl = setup({jobList: [], jobListPOD: [], jobListReprice: []});
        expect(ctrl.findJobInLocalLists(42)).toBeUndefined();
    });
});

describe('onRelatedJobChange', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.onRelatedJobChange = ControllerClass.prototype.onRelatedJobChange;
        ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
        return ctrl;
    }

    it('only updates flight/agent widget, does not replace currentJob or refresh other panels', async () => {
        const parentJob = makeJob(1);
        const relatedJob = makeDeliveryJob(99);
        const ctrl = setup({currentJob: parentJob});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(relatedJob);

        await ctrl.onRelatedJobChange(99);

        expect(ctrl.DispatchData.getDispatchJobDetail).toHaveBeenCalledWith(99);
        // currentJob stays as the parent job
        expect(ctrl.currentJob).toBe(parentJob);
        // Flight/agent widget updated
        expect(ctrl.isDeliveryJobType).toBe(true);
        expect(ctrl.handleJobSelectionRelatedData).toHaveBeenCalledWith(relatedJob);
        expect(ctrl.updateUIState).toHaveBeenCalledWith(relatedJob);
        expect(ctrl.applyScope).toHaveBeenCalled();
        // Should NOT touch tasks, map, job lists, or selection
        expect(ctrl.loadTasksInBackground).not.toHaveBeenCalled();
        expect(ctrl.displayJobOnMap).not.toHaveBeenCalled();
        expect(ctrl.updateCurrentSelection).not.toHaveBeenCalled();
        expect((window as any).ReactNationwideJobList.selectJob).not.toHaveBeenCalled();
        expect(ctrl.tasksService.cancelJobTaskLoading).not.toHaveBeenCalled();
    });

    it('updates flight widget for flight job without refreshing other panels', async () => {
        const parentJob = makeJob(1);
        const flightJob = makeFlightJob(50);
        const ctrl = setup({currentJob: parentJob});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(flightJob);

        await ctrl.onRelatedJobChange(50);

        expect(ctrl.currentJob).toBe(parentJob);
        expect(ctrl.isDeliveryJobType).toBe(false);
        expect(ctrl.handleJobSelectionRelatedData).toHaveBeenCalledWith(flightJob);
        expect(ctrl.updateUIState).toHaveBeenCalledWith(flightJob);
    });

    it('returns early when job not found', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(null);

        await ctrl.onRelatedJobChange(999);

        expect(ctrl.handleJobSelectionRelatedData).not.toHaveBeenCalled();
        expect(ctrl.updateUIState).not.toHaveBeenCalled();
    });

    it('logs error and does not throw on failure', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation();
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockRejectedValue(new Error('network'));

        await ctrl.onRelatedJobChange(1);

        expect(spy).toHaveBeenCalledWith('Error in onRelatedJobChange:', expect.any(Error));
        expect(ctrl.handleJobSelectionRelatedData).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('onRelatedJobChange integration – flight/agent UI flags', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.onRelatedJobChange = ControllerClass.prototype.onRelatedJobChange;
        ctrl.handleJobSelectionRelatedData = ControllerClass.prototype.handleJobSelectionRelatedData;
        ctrl.updateUIState = ControllerClass.prototype.updateUIState;
        ctrl.resetAllFlags = ControllerClass.prototype.resetAllFlags;
        ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
        return ctrl;
    }

    it('shows "flight already assigned" when switching to a flight job with assigned flight', async () => {
        const assignedFlightJob = makeFlightJob(10, {assignedFlight: {flightNumber: 'NZ123'}});
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(assignedFlightJob);

        await ctrl.onRelatedJobChange(10);

        expect(ctrl.showJobHasAssignedFlightMessage).toBe(true);
        expect(ctrl.showFlightList).toBe(false);
        expect(ctrl.isDeliveryJobType).toBe(false);
        expect(ctrl.flightMessage).toBe('Flight already assigned to this job');
        expect(ctrl.loadFlights).not.toHaveBeenCalled();
    });

    it('shows "agent already assigned" when switching to a delivery job with assigned agent', async () => {
        const assignedAgentJob = makeDeliveryJob(20, {assignedAgent: {agentId: 5}});
        const ctrl = setup();
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(assignedAgentJob);

        await ctrl.onRelatedJobChange(20);

        expect(ctrl.showJobHasAssignedAgentMessage).toBe(true);
        expect(ctrl.showAgentList).toBe(false);
        expect(ctrl.isDeliveryJobType).toBe(true);
        expect(ctrl.agentMessage).toBe('Agent already assigned to this job');
        expect(ctrl.processAgents).not.toHaveBeenCalled();
    });

    it('shows agent list when switching from flight job to unassigned delivery job', async () => {
        const deliveryJob = makeDeliveryJob(30);
        const ctrl = setup({currentJob: makeFlightJob(5)});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(deliveryJob);
        ctrl.nationwideService.getAgentOptions.mockResolvedValue({agents: [{id: 1}], message: undefined});
        ctrl.processAgents = ControllerClass.prototype.processAgents;

        await ctrl.onRelatedJobChange(30);

        expect(ctrl.isDeliveryJobType).toBe(true);
        expect(ctrl.showAgentList).toBe(true);
        expect(ctrl.showFlightList).toBe(false);
    });

    it('shows flight list when switching from delivery job to unassigned flight job', async () => {
        const flightJob = makeFlightJob(40);
        const ctrl = setup({currentJob: makeDeliveryJob(5)});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(flightJob);
        ctrl.nationwideService.getNearbyAirports
            .mockResolvedValueOnce([{id: 10}])
            .mockResolvedValueOnce([{id: 20}]);
        ctrl.nationwideService.getFlightOptions.mockResolvedValue({flights: [{id: 1}], message: undefined});
        ctrl.loadFlights = jest.fn().mockImplementation(async function (this: any) {
            this.flightOptions = [{id: 1}];
        }.bind(ctrl));

        await ctrl.onRelatedJobChange(40);

        expect(ctrl.isDeliveryJobType).toBe(false);
        expect(ctrl.showFlightList).toBe(true);
        expect(ctrl.showAgentList).toBe(false);
    });
});

describe('flightAgentWidgetJob tracking', () => {
    describe('selectJob sets flightAgentWidgetJob', () => {
        function setup(overrides = {}) {
            const ctrl = createController(overrides);
            ctrl.selectJob = ControllerClass.prototype.selectJob;
            return ctrl;
        }

        it('sets flightAgentWidgetJob to the selected job', async () => {
            const ctrl = setup();
            const job = makeJob(42);
            await ctrl.selectJob(job);
            expect(ctrl.flightAgentWidgetJob).toBe(job);
        });

        it('updates flightAgentWidgetJob when switching jobs', async () => {
            const ctrl = setup();
            const job1 = makeJob(1);
            const job2 = makeFlightJob(2);
            await ctrl.selectJob(job1);
            expect(ctrl.flightAgentWidgetJob).toBe(job1);
            await ctrl.selectJob(job2);
            expect(ctrl.flightAgentWidgetJob).toBe(job2);
        });
    });

    describe('onRelatedJobChange sets flightAgentWidgetJob', () => {
        function setup(overrides = {}) {
            const ctrl = createController(overrides);
            ctrl.onRelatedJobChange = ControllerClass.prototype.onRelatedJobChange;
            ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
            return ctrl;
        }

        it('sets flightAgentWidgetJob to the related job without changing currentJob', async () => {
            const pickupJob = makeJob(1);
            const flightJob = makeFlightJob(50);
            const ctrl = setup({currentJob: pickupJob});
            ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(flightJob);

            await ctrl.onRelatedJobChange(50);

            expect(ctrl.currentJob).toBe(pickupJob);
            expect(ctrl.flightAgentWidgetJob).toBe(flightJob);
        });

        it('does not set flightAgentWidgetJob when job not found', async () => {
            const job = makeJob(1);
            const ctrl = setup({currentJob: job, flightAgentWidgetJob: job});
            ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(null);

            await ctrl.onRelatedJobChange(999);

            expect(ctrl.flightAgentWidgetJob).toBe(job);
        });
    });

    describe('addFlightToJobReact uses flightAgentWidgetJob', () => {
        function setup(overrides = {}) {
            const ctrl = createController(overrides);
            ctrl.addFlightToJobReact = ControllerClass.prototype.addFlightToJobReact;
            ctrl.addFlightToJob = jest.fn().mockResolvedValue(undefined);
            return ctrl;
        }

        it('uses flightAgentWidgetJob instead of currentJob when set', async () => {
            const pickupJob = makeJob(1);
            const flightJob = makeFlightJob(2);
            const ctrl = setup({currentJob: pickupJob, flightAgentWidgetJob: flightJob});
            const flight = {flightNumber: 'NZ1'};

            await ctrl.addFlightToJobReact(undefined, flight);

            expect(ctrl.addFlightToJob).toHaveBeenCalledWith(
                expect.any(MouseEvent), flight, flightJob
            );
        });

        it('falls back to currentJob when flightAgentWidgetJob is undefined', async () => {
            const job = makeFlightJob(1);
            const ctrl = setup({currentJob: job, flightAgentWidgetJob: undefined});
            const flight = {flightNumber: 'NZ1'};

            await ctrl.addFlightToJobReact(undefined, flight);

            expect(ctrl.addFlightToJob).toHaveBeenCalledWith(
                expect.any(MouseEvent), flight, job
            );
        });

        it('returns early when both are undefined', async () => {
            const ctrl = setup({currentJob: undefined, flightAgentWidgetJob: undefined});

            await ctrl.addFlightToJobReact(undefined, {flightNumber: 'NZ1'});

            expect(ctrl.addFlightToJob).not.toHaveBeenCalled();
        });
    });

    describe('addAgentToJobReact uses flightAgentWidgetJob', () => {
        function setup(overrides = {}) {
            const ctrl = createController(overrides);
            ctrl.addAgentToJobReact = ControllerClass.prototype.addAgentToJobReact;
            ctrl.addAgentToJob = jest.fn().mockResolvedValue(undefined);
            return ctrl;
        }

        it('uses flightAgentWidgetJob instead of currentJob when set', async () => {
            const pickupJob = makeJob(1);
            const deliveryJob = makeDeliveryJob(2);
            const ctrl = setup({currentJob: pickupJob, flightAgentWidgetJob: deliveryJob});
            const agent = {agentId: 1, agentName: 'Alice'};

            await ctrl.addAgentToJobReact(undefined, agent);

            expect(ctrl.addAgentToJob).toHaveBeenCalledWith(
                expect.any(MouseEvent), agent, deliveryJob
            );
        });

        it('falls back to currentJob when flightAgentWidgetJob is undefined', async () => {
            const job = makeDeliveryJob(1);
            const ctrl = setup({currentJob: job, flightAgentWidgetJob: undefined});
            const agent = {agentId: 1, agentName: 'Alice'};

            await ctrl.addAgentToJobReact(undefined, agent);

            expect(ctrl.addAgentToJob).toHaveBeenCalledWith(
                expect.any(MouseEvent), agent, job
            );
        });
    });
});

describe('handleJobAction', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleJobAction = ControllerClass.prototype.handleJobAction;
        return ctrl;
    }

    it('calls restoreJob for "restore"', async () => {
        const ctrl = setup();
        const job = makeJob(1);
        await ctrl.handleJobAction('restore', job);
        expect(ctrl.restoreJob).toHaveBeenCalledWith(job);
    });

    it('calls reAllocateJobs for "reallocate"', async () => {
        const ctrl = setup();
        const job = makeJob(1);
        await ctrl.handleJobAction('reallocate', job);
        expect(ctrl.reAllocateJobs).toHaveBeenCalledWith(job);
    });

    it('logs warning for unknown action', async () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation();
        const ctrl = setup();
        await ctrl.handleJobAction('unknown', makeJob(1));
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown job action'));
        spy.mockRestore();
    });
});
