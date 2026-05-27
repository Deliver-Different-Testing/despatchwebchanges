import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeFlightJob, makeDeliveryJob, makeJob, setupWindowMocks} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('updateUIState', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.updateUIState = ControllerClass.prototype.updateUIState;
        ctrl.resetAllFlags = ControllerClass.prototype.resetAllFlags;
        ctrl.isDeliveryJob = ControllerClass.prototype.isDeliveryJob;
        return ctrl;
    }

    it('shows no-job-selected message when no job (flight mode)', () => {
        const ctrl = setup();
        ctrl.updateUIState(undefined);
        expect(ctrl.showNoJobSelectedMessage).toBe(true);
    });

    it('shows assigned-flight message when flight assigned', () => {
        const ctrl = setup();
        ctrl.updateUIState(makeFlightJob(1, {assignedFlight: {flightNumber: 'NZ1'}}));
        expect(ctrl.showJobHasAssignedFlightMessage).toBe(true);
    });

    it('shows missing-airport message when airports incomplete', () => {
        const ctrl = setup();
        ctrl.updateUIState(makeFlightJob(1, {toAirportId: undefined, fromAirportId: 10}));
        expect(ctrl.showMissingAirportInfoMessage).toBe(true);
    });

    it('shows no-flights message when not loading and empty', () => {
        const ctrl = setup({flightsLoading: false, flightOptions: []});
        ctrl.updateUIState(makeFlightJob(1));
        expect(ctrl.showNoFlightsAvailableMessage).toBe(true);
    });

    it('shows flight list when flights available', () => {
        const ctrl = setup({flightsLoading: false, flightOptions: [{flightNumber: 'NZ1'}]});
        ctrl.updateUIState(makeFlightJob(1));
        expect(ctrl.showFlightList).toBe(true);
    });

    it('shows assigned-agent message for delivery job with agent', () => {
        const ctrl = setup();
        ctrl.updateUIState(makeDeliveryJob(1, {assignedAgent: {agentId: 1}}));
        expect(ctrl.showJobHasAssignedAgentMessage).toBe(true);
    });

    it('shows no-agents message when not loading and empty', () => {
        const ctrl = setup({agentsLoading: false, agentOptions: []});
        ctrl.updateUIState(makeDeliveryJob(1));
        expect(ctrl.showNoAgentsAvailableMessage).toBe(true);
    });

    it('shows agent list when agents available', () => {
        const ctrl = setup({agentsLoading: false, agentOptions: [{agentId: 1}]});
        ctrl.updateUIState(makeDeliveryJob(1));
        expect(ctrl.showAgentList).toBe(true);
    });

    it('always enters flight mode when no active job (isDeliveryJobType resets to false)', () => {
        const ctrl = setup({isDeliveryJobType: true}); // even if previously delivery mode
        ctrl.updateUIState(undefined);
        // No activeJob → isDeliveryJobType becomes false → flight mode
        expect(ctrl.isDeliveryJobType).toBe(false);
        expect(ctrl.showNoJobSelectedMessage).toBe(true);
        expect(ctrl.showNoAgentJobSelectedMessage).toBe(false);
    });
});

describe('resetAllFlags', () => {
    it('resets all flags to false', () => {
        const ctrl = createController({
            showNoJobSelectedMessage: true,
            showJobHasAssignedFlightMessage: true,
            showMissingAirportInfoMessage: true,
            showNoFlightsAvailableMessage: true,
            showFlightList: true,
            showNoAgentJobSelectedMessage: true,
            showJobHasAssignedAgentMessage: true,
            showNoAgentsAvailableMessage: true,
            showAgentList: true,
        });
        ctrl.resetAllFlags = ControllerClass.prototype.resetAllFlags;

        ctrl.resetAllFlags();

        expect(ctrl.showNoJobSelectedMessage).toBe(false);
        expect(ctrl.showJobHasAssignedFlightMessage).toBe(false);
        expect(ctrl.showFlightList).toBe(false);
        expect(ctrl.showAgentList).toBe(false);
    });
});

describe('toggleBoxCollapse', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.toggleBoxCollapse = ControllerClass.prototype.toggleBoxCollapse;
        return ctrl;
    }

    it('toggles collapsed state', () => {
        const ctrl = setup({boxes: {b: {collapsed: false}}});
        ctrl.toggleBoxCollapse('b');
        expect(ctrl.boxes.b.collapsed).toBe(true);
    });

    it('does nothing for missing box', () => {
        const ctrl = setup({boxes: {}});
        expect(() => ctrl.toggleBoxCollapse('missing')).not.toThrow();
    });

    it('prevents collapse on default layout', () => {
        const ctrl = setup({boxes: {b: {collapsed: false}}});
        ctrl.isDefaultLayout = jest.fn().mockReturnValue(true);
        ctrl.toggleBoxCollapse('b');
        expect(ctrl.boxes.b.collapsed).toBe(false);
    });
});

describe('refreshAction', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.refreshAction = ControllerClass.prototype.refreshAction;
        return ctrl;
    }

    it('loads tasks for "tasksList"', async () => {
        const ctrl = setup();
        await ctrl.refreshAction('tasksList');
        expect(ctrl.loadTasks).toHaveBeenCalled();
    });

    it('calls ReactNationwideJobList.refresh for "jobsList"', async () => {
        const ctrl = setup();
        await ctrl.refreshAction('jobsList');
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('newJobs');
    });

    it('calls ReactNationwideJobList.refresh for "jobsListPOD"', async () => {
        const ctrl = setup();
        await ctrl.refreshAction('jobsListPOD');
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('podJobs');
    });

    it('calls ReactNationwideJobList.refresh for "jobsListReprice"', async () => {
        const ctrl = setup();
        await ctrl.refreshAction('jobsListReprice');
        expect((window as any).ReactNationwideJobList.refresh).toHaveBeenCalledWith('repriceJobs');
    });

    it('refreshes map for "map"', async () => {
        const ctrl = setup();
        ctrl.refreshMap = jest.fn();
        await ctrl.refreshAction('map');
        expect(ctrl.refreshMap).toHaveBeenCalled();
    });

    it('refreshes flight/agent data for "flightAgentDataTable" when job selected', async () => {
        const job = makeJob(42);
        const ctrl = setup({currentJob: job});
        ctrl.handleJobSelectionRelatedData = jest.fn().mockResolvedValue(undefined);
        await ctrl.refreshAction('flightAgentDataTable');
        expect(ctrl.handleJobSelectionRelatedData).toHaveBeenCalledWith(job);
    });

    it('re-fetches and selects job for "jobDetail"', async () => {
        const freshJob = makeJob(42);
        const ctrl = setup({currentJob: {id: 42}});
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(freshJob);

        await ctrl.refreshAction('jobDetail');

        expect(ctrl.currentJob).toBeUndefined(); // cleared before fetch
        expect(ctrl.selectJob).toHaveBeenCalledWith(freshJob);
    });

    it('returns early for jobDetail when no current job', async () => {
        const ctrl = setup({currentJob: undefined});
        await ctrl.refreshAction('jobDetail');
        expect(ctrl.DispatchData.getDispatchJobDetail).not.toHaveBeenCalled();
    });
});
