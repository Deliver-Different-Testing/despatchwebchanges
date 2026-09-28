import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * The courier a job is dispatched to, if any. Prefers the richer `courierData`
 * (what V1 keyed the map's current-work fetch on) and falls back to the
 * lightweight `assignedCourier` suggestion.
 */
export function selectedCourierId(job?: DispatchJob): number | undefined {
    return job?.courierData?.courierId ?? job?.assignedCourier?.id;
}

/**
 * Which jobs the dispatch map should show, mirroring V1
 * `home.controller.selectJob` → `mapJobList`:
 *   - nothing selected → every loaded job;
 *   - selected job with no courier → just that job (its pickup + delivery);
 *   - selected job with a courier → that courier's undispatched (statusId 0)
 *     jobs, i.e. their route, falling back to just the selected job when the
 *     courier's current work hasn't loaded or has none undispatched.
 */
export function computeMapJobs(params: {
    currentJob?: DispatchJob;
    allJobs: DispatchJob[];
    courierJobs?: DispatchJob[];
}): DispatchJob[] {
    const {currentJob, allJobs, courierJobs} = params;
    if (!currentJob) return allJobs;
    if (selectedCourierId(currentJob)) {
        const undispatched = (courierJobs ?? []).filter(j => j.statusId === 0);
        return undispatched.length ? undispatched : [currentJob];
    }
    return [currentJob];
}
