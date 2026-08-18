/**
 * Shared inputs every DispatchDialog call site needs, so the four operational
 * surfaces (job detail, job search, job list context menu, dispatch page) can't
 * drift apart on how they compute them.
 */

import countSubJobs from '../../../../functions/countSubJobs';
import type {ISuggestion} from '../../../../interfaces/job.interface';

/**
 * Whether the signed-in user is a network partner. Sourced from the Razor-rendered
 * global (`Views/Home/Index.cshtml`), which is JSON-serialized and so is a real
 * boolean. `RazorScriptGlobalsTests` guards that.
 */
export function isNetworkPartnerSession(): boolean {
    return window.IsNetworkPartner === true;
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
