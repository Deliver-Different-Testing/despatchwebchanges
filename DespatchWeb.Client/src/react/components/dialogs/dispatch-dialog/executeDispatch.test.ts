/**
 * executeDispatchConfirmation tests
 *
 * The shared router every DispatchDialog caller uses. Each target lands on a
 * different endpoint, so this is where that mapping is pinned down.
 */

jest.mock('../../../services/dispatchExecutorApi', () => ({
    canAssignAgentToJob: jest.fn(),
    assignAgentToJob: jest.fn(),
    assignNpAgentToJob: jest.fn(),
}));
jest.mock('../../../services/jobListApi', () => ({
    allocateJobs: jest.fn(),
    reAllocateJobs: jest.fn(),
}));
jest.mock('../../../services/jobDetailApi', () => ({
    updateJobDetail: jest.fn(),
}));

import {executeDispatchConfirmation, FLIGHT_REQUIRED_MESSAGE} from './executeDispatch';
import {
    assignAgentToJob,
    assignNpAgentToJob,
    canAssignAgentToJob,
} from '../../../services/dispatchExecutorApi';
import {allocateJobs, reAllocateJobs} from '../../../services/jobListApi';
import {updateJobDetail} from '../../../services/jobDetailApi';
import {JobProperty} from '../../../../enums/job-property.enum';

const mockCanAssign = canAssignAgentToJob as jest.Mock;
const mockAssignAgent = assignAgentToJob as jest.Mock;
const mockAssignNp = assignNpAgentToJob as jest.Mock;
const mockAllocate = allocateJobs as jest.Mock;
const mockReAllocate = reAllocateJobs as jest.Mock;
const mockUpdateJobDetail = updateJobDetail as jest.Mock;

const job = {id: 42, jobNo: 'J042'};
const courier = {id: 101, text: 'ABC Couriers'};
const agent = {id: 201, text: 'AgentOne'};
const partner = {id: 301, text: 'PartnerCo'};

beforeEach(() => {
    jest.clearAllMocks();
    mockCanAssign.mockResolvedValue(true);
    mockAssignAgent.mockResolvedValue({status: 'Queued', agentEmail: 'a@b.c', willEmail: true});
    mockAssignNp.mockResolvedValue({success: true});
    mockAllocate.mockResolvedValue(undefined);
    mockReAllocate.mockResolvedValue(undefined);
    mockUpdateJobDetail.mockResolvedValue(undefined);
});

describe('executeDispatchConfirmation', () => {
    describe('Courier', () => {
        it('allocates a fresh job and re-allocates one that already has a courier', async () => {
            await executeDispatchConfirmation(job, {type: 'Courier', destination: courier});
            expect(mockAllocate).toHaveBeenCalledWith(101, [42]);
            expect(mockReAllocate).not.toHaveBeenCalled();

            await executeDispatchConfirmation(
                {...job, assignedCourierId: 7},
                {type: 'Courier', destination: courier},
            );
            expect(mockReAllocate).toHaveBeenCalledWith(101, [42]);
        });
    });

    describe('Agent', () => {
        it('gates on a flight being assigned and never calls the assign endpoint when it fails', async () => {
            mockCanAssign.mockResolvedValue(false);

            await expect(executeDispatchConfirmation(job, {type: 'Agent', destination: agent}))
                .rejects.toThrow(FLIGHT_REQUIRED_MESSAGE);
            expect(mockAssignAgent).not.toHaveBeenCalled();
        });

        it('forwards the stop-job cascade and email overrides', async () => {
            await executeDispatchConfirmation(job, {
                type: 'Agent',
                destination: agent,
                emailSubject: 'Subject',
                emailBody: 'Body',
                includeStopJobs: true,
            });

            expect(mockAssignAgent).toHaveBeenCalledWith(42, 201, true, 'Subject', 'Body');
        });

        it('writes the AWB only after the assignment succeeds, and only when one was entered', async () => {
            await executeDispatchConfirmation(job, {type: 'Agent', destination: agent});
            expect(mockUpdateJobDetail).not.toHaveBeenCalled();

            await executeDispatchConfirmation(job, {type: 'Agent', destination: agent, awb: 'AWB-1'});
            expect(mockUpdateJobDetail).toHaveBeenCalledWith(42, JobProperty.ConNote, 'AWB-1', false);

            // A failed assignment must not leave a ConNote behind on an unassigned job.
            mockUpdateJobDetail.mockClear();
            mockAssignAgent.mockRejectedValue(new Error('assign blew up'));
            await expect(executeDispatchConfirmation(job, {type: 'Agent', destination: agent, awb: 'AWB-2'}))
                .rejects.toThrow('assign blew up');
            expect(mockUpdateJobDetail).not.toHaveBeenCalled();
        });

        it('reports what happened to the inbound-agent email', async () => {
            mockAssignAgent.mockResolvedValue({status: 'Queued', agentEmail: 'a@b.c', willEmail: true});
            expect(await executeDispatchConfirmation(job, {type: 'Agent', destination: agent}))
                .toEqual({message: expect.stringContaining('inbound link emailed to a@b.c'), severity: 'success'});

            // The assignment landed, but the agent has no way into the job — that has to
            // read as a warning, not a clean success.
            mockAssignAgent.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});
            expect(await executeDispatchConfirmation(job, {type: 'Agent', destination: agent}))
                .toEqual({message: expect.stringContaining('no email on file'), severity: 'warning'});

            mockAssignAgent.mockResolvedValue({status: 'NoInboundUrl', agentEmail: null, willEmail: false});
            expect(await executeDispatchConfirmation(job, {type: 'Agent', destination: agent}))
                .toEqual({message: expect.stringContaining('inbound portal URL not configured'), severity: 'warning'});

            mockAssignAgent.mockResolvedValue({status: 'Failed', agentEmail: null, willEmail: false});
            expect(await executeDispatchConfirmation(job, {type: 'Agent', destination: agent}))
                .toEqual({message: expect.stringContaining('could not be sent'), severity: 'warning'});
        });
    });

    describe('NP', () => {
        it('uses the dedicated network partner endpoint, not a courier allocation', async () => {
            const outcome = await executeDispatchConfirmation(job, {type: 'NP', destination: partner});

            expect(mockAssignNp).toHaveBeenCalledWith(42, 301);
            expect(mockAllocate).not.toHaveBeenCalled();
            expect(mockReAllocate).not.toHaveBeenCalled();
            expect(outcome).toEqual({
                message: 'Job J042 assigned to network partner PartnerCo',
                severity: 'success',
            });
        });
    });
});
