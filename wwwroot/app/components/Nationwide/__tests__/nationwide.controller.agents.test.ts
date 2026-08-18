import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeDeliveryJob, setupWindowMocks} from './nationwide.controller.test-helpers';

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
        ctrl.openDispatchDialogForJob = ControllerClass.prototype.openDispatchDialogForJob;
        return ctrl;
    }

    it('shows alert when flight not assigned first', async () => {
        const ctrl = setup();
        ctrl.DispatchData.canAssignAgentToJob.mockResolvedValue(false);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.$mdDialog.show).toHaveBeenCalled();
        expect(ctrl.dispatchDialogService.openDispatchDialog).not.toHaveBeenCalled();
    });

    it('opens the shared dispatch modal with the agent pre-filled, not the agent-email dialog', async () => {
        // The agent-only confirmation dialog led with the inbound-agent email, which is
        // what made this action read as "send the app email" instead of an assignment.
        const ctrl = setup();
        const job = makeDeliveryJob(10);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, job);

        expect(ctrl.dispatchDialogService.openDispatchDialog)
            .toHaveBeenCalledWith(job, 'Agent', {id: 1, text: 'Agent'});
        expect(ctrl.flightAgentConfirmationDialogService.agentConfirmationDialog).not.toHaveBeenCalled();
    });

    it('returns early when the modal is cancelled', async () => {
        const ctrl = setup();
        ctrl.dispatchDialogService.openDispatchDialog.mockResolvedValue(null);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.getJobList).not.toHaveBeenCalled();
        expect(ctrl.selectJob).not.toHaveBeenCalled();
    });

    it('refreshes lists, re-selects the job, and reports the modal\'s outcome', async () => {
        const freshJob = makeDeliveryJob(10, {assignedAgent: {agentId: 1}});
        const ctrl = setup();
        ctrl.dispatchDialogService.openDispatchDialog.mockResolvedValue({
            type: 'Agent',
            destinationId: 1,
            destinationText: 'Agent',
            message: 'Job J10 assigned to Agent — inbound link emailed to a@b.c',
        });
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(freshJob);

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'Agent'}, makeDeliveryJob(10));

        expect(ctrl.getJobList).toHaveBeenCalled();
        expect(ctrl.selectJob).toHaveBeenCalledWith(freshJob);
        expect(ctrl.isDataLoading).toBe(false);
        expect(ctrl.toastrService.showSuccessToast)
            .toHaveBeenCalledWith('Job J10 assigned to Agent — inbound link emailed to a@b.c');
    });

    it('sets isDataLoading false on error', async () => {
        const ctrl = setup();
        ctrl.dispatchDialogService.openDispatchDialog.mockResolvedValue({
            type: 'Agent', destinationId: 1, destinationText: 'A', message: 'ok',
        });
        ctrl.DispatchData.getDispatchJobDetail.mockRejectedValue(new Error('fail'));

        await ctrl.addSelectedAgentToJob({} as MouseEvent, {id: 1, text: 'A'}, makeDeliveryJob(10));

        expect(ctrl.isDataLoading).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });
});
