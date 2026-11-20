import React from 'react';
import {JobActionsMenu, type JobAction} from '../../../components/common/job-actions-menu/JobActionsMenu';
import type {DispatchJob} from '../../../types/dispatchJob';
import {isNetworkPartnerSession} from '../../../components/dialogs/dispatch-dialog/dispatchSession';

/**
 * Job-detail action menu for the React job search page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header.
 */

export type JobSearchJobActionId =
    | 'accessorialCharges'
    | 'attachments'
    | 'printLabel'
    | 'dispatch'
    | 'changeCourier'
    | 'restore'
    | 'swapPod'
    | 'sendPod'
    | 'lock'
    | 'unlock'
    | 'split'
    | 'unsplit';

export interface JobSearchJobActionsMenuProps {
    currentJob?: DispatchJob;
    onAction?: (actionId: JobSearchJobActionId, job: DispatchJob) => void;
}

const ACTIONS: JobAction<JobSearchJobActionId>[] = [
    {id: 'accessorialCharges', label: 'Accessorial charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId && !isNetworkPartnerSession()},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'printLabel', label: 'Print labels', icon: 'print',
        // Every job, including network partners' (the server scopes the lookup), but not a pre-book:
        // its id is a booking id, and there is no job to label yet.
        available: job => !job.preBook},
    {id: 'dispatch', label: 'Dispatch to courier', icon: 'send_to_mobile',
        available: job => !job.isBulkJob && !job.preBook && job.assignedCourier == null},
    {id: 'changeCourier', label: 'Change paid courier', icon: 'swap_horiz',
        // Only for archived, completed jobs — the live-job path is a normal re-dispatch.
        // Invoiced/settled jobs are refused by the server pre-check (DispatchJob rows
        // don't carry a populated invoiced flag), which shows an explanatory popup.
        available: job => !job.isBulkJob && !job.preBook && !!job.isArchived && !!job.done
            && !isNetworkPartnerSession()},
    {id: 'restore', label: 'Restore job', icon: 'undo',
        // Archived jobs live only in the archive tables; restore operates on live (tucJob)
        // rows, so restoring an archived job silently no-ops — don't offer it. A completed live job
        // is offered; the page confirms before reopening it.
        available: job => !job.isBulkJob && !job.preBook && job.assignedCourier != null && !job.isArchived},
    {id: 'swapPod', label: 'Swap POD', icon: 'swap_horiz',
        available: job => !job.isBulkJob && !job.preBook},
    {id: 'sendPod', label: 'Email photo POD', icon: 'send',
        available: job => !job.isBulkJob && !job.preBook},
    {id: 'unlock', label: 'Unlock job', icon: 'lock_open',
        available: job => !job.preBook && (!!job.locked && !job.invoiced)},
    {id: 'lock', label: 'Lock job', icon: 'lock',
        available: job => !job.preBook && !job.isBulkJob && !job.locked && !job.invoiced},
    {id: 'split', label: 'Split job', icon: 'shuffle',
        // Archived jobs are refused by executeSplitJobFlow, so offering it would be a dead end.
        available: job => !!job.allowSplit && !job.isArchived && !isNetworkPartnerSession()},
    {id: 'unsplit', label: 'Unsplit job', icon: 'undo',
        available: job => !job.preBook && !job.locked && job.jobRelationshipTypeId === 8
            && !isNetworkPartnerSession()},
];

export const JobSearchJobActionsMenu: React.FC<JobSearchJobActionsMenuProps> = ({currentJob, onAction}) => (
    <JobActionsMenu actions={ACTIONS} currentJob={currentJob} onAction={onAction}/>
);
