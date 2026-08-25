import {JobStatus} from '../../enums/job-status.enum';

/**
 * The status pill's meaning, exposed as `data-status-tone` so it can be asserted
 * without reaching into the palette (the colour may be re-tuned; the tone won't).
 */
export type StatusTone = 'void' | 'done' | 'dispatched' | 'pending';

/**
 * The status fields a job carries. `resolvedStatusId` is the server's single answer, resolved from
 * the competing raw fields; the raw ones are still present because some surfaces edit them.
 */
export interface JobStatusFields {
    statusId?: number | null;
    statusName?: string | null;
    status?: string | null;
    resolvedStatusId?: number | null;
}

const IN_TRANSIT = new Set<number>([
    JobStatus.Dispatched,
    JobStatus.Accepted,
    JobStatus.PickedUp,
    JobStatus.InTransit,
    JobStatus.OutForDelivery,
    JobStatus.LatePickup,
    JobStatus.LateDelivery,
]);

const FINISHED = new Set<number>([JobStatus.Completed, JobStatus.Undeliverable, JobStatus.AssumingCompleted]);

/**
 * Labels for the statuses the resolver can substitute for a job's raw one. Only consulted when the
 * resolved status differs from the raw status the server named — otherwise the tenant's own status
 * name from tucJobStatus wins, so custom names keep showing.
 */
const RESOLVED_LABEL: Record<number, string> = {
    [JobStatus.Void]: 'Void',
    [JobStatus.Completed]: 'Completed',
    [JobStatus.New]: 'New',
};

/** Never returns null — a job with no status at all reads as New rather than as nothing. */
export function resolvedStatusId(job: JobStatusFields): number {
    return job.resolvedStatusId ?? job.statusId ?? JobStatus.New;
}

/** The one label to render. */
export function resolvedStatusLabel(job: JobStatusFields): string {
    const serverName = job.statusName || job.status || '';

    // Only substitute when the server actually resolved to a different status. Otherwise the
    // tenant's own name from tucJobStatus wins, so custom status names keep showing.
    if (job.resolvedStatusId == null || job.resolvedStatusId === job.statusId) {
        return serverName || RESOLVED_LABEL[resolvedStatusId(job)] || '';
    }

    return RESOLVED_LABEL[job.resolvedStatusId] || serverName;
}

/** The one tone to colour by, so a pill's colour can never contradict its label. */
export function resolvedStatusTone(job: JobStatusFields): StatusTone {
    const resolved = resolvedStatusId(job);

    if (resolved === JobStatus.Void) return 'void';
    if (FINISHED.has(resolved)) return 'done';
    if (IN_TRANSIT.has(resolved)) return 'dispatched';
    return 'pending';
}
