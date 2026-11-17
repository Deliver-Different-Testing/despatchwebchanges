import type {DispatchJob} from '../types/dispatchJob';
import type {ShowToastFn} from '../services/toastService';
import {loadDialog} from '../components/dialogs/dialogRegistry';
import {openAddEventDialog} from '../components/dialogs/add-event-dialog';
import {setJobLocked} from '../api/jobListApi';

/** A bulk row's own `id` is a BulkJobId; every job-keyed action must target the live job behind it. */
const liveJobId = (job: DispatchJob): number => job.linkedJobId ?? job.id;

/** Resolves false without opening anything when the job has no accessorial charge group. */
export async function openAccessorialChargesForJob(job: DispatchJob, showToast: ShowToastFn): Promise<boolean> {
    if (!job.accessorialChargeGroupId) return false;
    await (await loadDialog('AccessorialCharges')).open({
        job: {
            id: liveJobId(job),
            accessorialChargeGroupId: job.accessorialChargeGroupId,
            amount: job.amount,
            weight: job.weight,
            quantity: job.quantity,
        },
        toastService: {showToast},
    });
    return true;
}

export async function openAttachmentsForJob(job: DispatchJob): Promise<void> {
    await (await loadDialog('JobFileUpload')).open(liveJobId(job));
}

export async function openAddTaskForJob(job: DispatchJob, showToast: ShowToastFn): Promise<void> {
    await openAddEventDialog({
        job: {id: liveJobId(job), jobNo: job.jobNo, client: job.client ?? '', clientId: job.clientId},
        toastService: {showToast},
    });
}

export interface SharedJobActionContext {
    showToast: ShowToastFn;
    refreshDetail: () => void;
    refreshLists: () => unknown;
}

/** Runs the job actions every page handles the same way; resolves false for any other action. */
export async function runSharedJobAction(
    actionId: string,
    job: DispatchJob,
    {showToast, refreshDetail, refreshLists}: SharedJobActionContext,
): Promise<boolean> {
    switch (actionId) {
        case 'accessorialCharges':
            if (await openAccessorialChargesForJob(job, showToast)) refreshDetail();
            return true;

        case 'attachments':
            await openAttachmentsForJob(job);
            refreshDetail();
            return true;

        case 'addTask':
            await openAddTaskForJob(job, showToast);
            return true;

        case 'lock':
        case 'unlock': {
            const locked = actionId === 'lock';
            // Recurring rows lock the template by its BulkJobId (isRecurring), so the row's own id is right here.
            await setJobLocked(job.id, locked, !!job.preBook);
            showToast(`${job.jobNo} ${locked ? 'locked' : 'unlocked'}`, 'success');
            await refreshLists();
            refreshDetail();
            return true;
        }

        default:
            return false;
    }
}
