/** @jest-environment jest-environment-jsdom */
import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeDeliveryJob, makeFlightJob, setupWindowMocks} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('processAgents', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.processAgents = ControllerClass.prototype.processAgents;
        ctrl.updateUIState = jest.fn();
        return ctrl;
    }

    it('sets loading state and populates agents', async () => {
        const agents = [{agentId: 1, agentName: 'Alice'}];
        const ctrl = setup();
        ctrl.nationwideService.getAgentOptions.mockResolvedValue({agents, message: undefined});

        await ctrl.processAgents(makeDeliveryJob(1));

        expect(ctrl.agentOptions).toBe(agents);
        expect(ctrl.agentsLoading).toBe(false);
        expect(ctrl.updateUIState).toHaveBeenCalled();
    });

    it('sets fallback message when no agents', async () => {
        const ctrl = setup();
        ctrl.nationwideService.getAgentOptions.mockResolvedValue({agents: [], message: undefined});

        await ctrl.processAgents(makeDeliveryJob(1));

        expect(ctrl.agentMessage).toBe('No agents available for this job');
    });

    it('uses server message when provided', async () => {
        const ctrl = setup();
        ctrl.nationwideService.getAgentOptions.mockResolvedValue({agents: [], message: 'Custom msg'});

        await ctrl.processAgents(makeDeliveryJob(1));

        expect(ctrl.agentMessage).toBe('Custom msg');
    });

    it('sets error message on failure', async () => {
        const ctrl = setup();
        ctrl.nationwideService.getAgentOptions.mockRejectedValue(new Error('fail'));

        await ctrl.processAgents(makeDeliveryJob(1));

        expect(ctrl.agentMessage).toContain('error occurred');
        expect(ctrl.agentOptions).toEqual([]);
        expect(ctrl.agentsLoading).toBe(false);
    });
});

describe('addSelectedAgentToJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.addSelectedAgentToJob = ControllerClass.prototype.addSelectedAgentToJob;
        return ctrl;
    }

    it('shows alert when flight not assigned first', async () => {
        const ctrl = setup();
        ctrl.DispatchData.canAssignAgentToJob.mockResolvedValue(false);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.$mdDialog.show).toHaveBeenCalled();
        expect(ctrl.nationwideService.assignAgentToJob).not.toHaveBeenCalled();
    });

    it('returns early when dialog cancelled', async () => {
        const ctrl = setup();
        ctrl.flightAgentConfirmationDialogService.agentConfirmationDialog.mockResolvedValue({shouldAssign: false});

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.nationwideService.assignAgentToJob).not.toHaveBeenCalled();
    });

    it('assigns agent, updates AWB, refreshes lists, re-selects job', async () => {
        const freshJob = makeDeliveryJob(10, {assignedAgent: {agentId: 1}});
        const ctrl = setup();
        ctrl.flightAgentConfirmationDialogService.agentConfirmationDialog.mockResolvedValue({
            shouldAssign: true, shouldAssignToStopJobs: true, awb: 'AWB123',
        });
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(freshJob);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.nationwideService.assignAgentToJob).toHaveBeenCalledWith(10, 1, true);
        expect(ctrl.DispatchData.updateJobDetail).toHaveBeenCalled();
        expect(ctrl.getJobList).toHaveBeenCalled();
        expect(ctrl.selectJob).toHaveBeenCalledWith(freshJob);
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith(expect.stringContaining('Agent'));
    });

    it('sets isDataLoading false on error', async () => {
        const ctrl = setup();
        ctrl.flightAgentConfirmationDialogService.agentConfirmationDialog.mockResolvedValue({shouldAssign: true});
        ctrl.nationwideService.assignAgentToJob.mockRejectedValue(new Error('fail'));

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'A'}, makeDeliveryJob(10));

        expect(ctrl.isDataLoading).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });
});
