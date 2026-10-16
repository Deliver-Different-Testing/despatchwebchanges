/**
 * Restore POD impact
 *
 * Folds the per-job rows from `job/GetRestorePodImpact` into the summary the confirmation dialog
 * renders, and answers the one question every restore entry point asks: does this restore destroy
 * enough to be worth stopping the operator for?
 */
import type {RestorePodImpactSummary} from '../components/dialogs/restore-confirmation-dialog';

export interface RestorePodImpactRow {
    jobId: number;
    podName: string | null;
    capturedImageCount: number;
    /** False when the server skipped or failed the S3 probe — the count is then not to be quoted. */
    imageCountKnown: boolean;
}

export function summarisePodImpact(rows: RestorePodImpactRow[]): RestorePodImpactSummary {
    const named = rows.filter(r => !!r.podName?.trim());
    const imageCount = rows.some(r => !r.imageCountKnown)
        ? null
        : rows.reduce((total, r) => total + r.capturedImageCount, 0);

    return {
        jobsWithPodName: named.length,
        podName: rows.length === 1 ? named[0]?.podName ?? undefined : undefined,
        imageCount,
    };
}

/**
 * Restoring always clears the POD name and reopens a completed job, so confirm whenever any of
 * that applies — including when the image count is unknown, since silence there could hide a POD.
 */
export function needsRestoreConfirmation(anyCompleted: boolean, summary: RestorePodImpactSummary): boolean {
    return anyCompleted
        || summary.jobsWithPodName > 0
        || summary.imageCount === null
        || summary.imageCount > 0;
}
