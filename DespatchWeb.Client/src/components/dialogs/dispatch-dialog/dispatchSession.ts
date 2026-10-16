/**
 * Shared inputs every DispatchDialog call site needs, so the four operational
 * surfaces (job detail, job search, job list context menu, dispatch page) can't
 * drift apart on how they compute them.
 */

import countSubJobs from '../../../utils/countSubJobs';
import type {ISuggestion} from '../../../types/interfaces/job.interface';
import {getSession} from '../../../api/session';

/**
 * Whether the signed-in user is a network partner. Sourced from the session context
 * (`GET /api/context`, see `api/session.ts`), which is JSON-serialized and so is a real
 * boolean. `RazorScriptGlobalsTests` guards that.
 */
export function isNetworkPartnerSession(): boolean {
    return getSession().isNetworkPartner;
}

/**
 * How many stop jobs hang off this job. Drives the "assign to N stop job(s)"
 * cascade on the Agent path; 0 hides it. `relatedJobs` is only populated by the
 * server for jobs that have a parent, so standalone jobs correctly yield 0.
 */
export function stopJobCountFor(jobNo?: string, relatedJobs?: ISuggestion[]): number {
    if (!jobNo || !relatedJobs?.length) return 0;
    return countSubJobs(jobNo, relatedJobs);
}
