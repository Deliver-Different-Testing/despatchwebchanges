/**
 * Routes a DispatchDialog confirmation to the right server call.
 *
 * Every surface that opens the dialog (job detail, job search, the dispatch page,
 * the job-list context menu, and the AngularJS Nationwide bridge) shares this so
 * the four targets can't drift apart again — Courier / Agent / NP each land on a
 * different endpoint with a different shape, which is what let NP rot into a
 * field write the server rejected.
 *
 * Returns the message to surface and how loud it should be; throws so the dialog can
 * render a failure inline. Callers own their own toast and cache invalidation.
 */

import {
    assignAgentToJob,
    assignNpAgentToJob,
    canAssignAgentToJob,
} from '../../../services/dispatchExecutorApi';
import {allocateJobs, reAllocateJobs} from '../../../services/jobListApi';
import {updateJobDetail} from '../../../services/jobDetailApi';
import {JobProperty} from '../../../../enums/job-property.enum';
import type {DispatchConfirmation} from './types';

export interface DispatchTargetJob {
    id: number;
    jobNo: string;
    /** Present ⇒ the courier path re-allocates so the server releases the old courier. */
    assignedCourierId?: number;
}

export const FLIGHT_REQUIRED_MESSAGE =
    'A flight must be assigned to the flight portion before an agent can be assigned.';

export interface DispatchOutcome {
    message: string;
    /**
     * 'warning' when the assignment itself landed but the agent was not sent the
     * inbound-agent link — the operator needs to know the agent has no way in.
     */
    severity: 'success' | 'warning';
}

export async function executeDispatchConfirmation(
    job: DispatchTargetJob,
    {type, destination, emailSubject, emailBody, includeStopJobs, awb}: DispatchConfirmation,
): Promise<DispatchOutcome> {
    if (type === 'Agent') {
        if (!await canAssignAgentToJob(job.id)) {
            throw new Error(FLIGHT_REQUIRED_MESSAGE);
        }

        const result = await assignAgentToJob(
            job.id, destination.id, includeStopJobs ?? false, emailSubject, emailBody,
        );

        // Sequenced after the assignment so a ConNote failure can't leave the job
        // unassigned. Mirrors the Nationwide flow this replaced.
        if (awb) {
            await updateJobDetail(job.id, JobProperty.ConNote, awb, false);
        }

        const base = `Job ${job.jobNo} assigned to ${destination.text}`;
        if (result.willEmail) {
            return {message: `${base} — inbound link emailed to ${result.agentEmail}`, severity: 'success'};
        }
        if (result.status === 'NoAgentEmail') {
            return {message: `${base} — agent has no email on file, no link sent`, severity: 'warning'};
        }
        if (result.status === 'NoInboundUrl') {
            return {message: `${base} — inbound portal URL not configured, no link sent`, severity: 'warning'};
        }
        return {message: `${base} — inbound link could not be sent`, severity: 'warning'};
    }

    if (type === 'NP') {
        await assignNpAgentToJob(job.id, destination.id);
        return {
            message: `Job ${job.jobNo} assigned to network partner ${destination.text}`,
            severity: 'success',
        };
    }

    if (job.assignedCourierId) {
        await reAllocateJobs(destination.id, [job.id]);
    } else {
        await allocateJobs(destination.id, [job.id]);
    }
    return {message: `Job ${job.jobNo} dispatched to ${destination.text}`, severity: 'success'};
}
