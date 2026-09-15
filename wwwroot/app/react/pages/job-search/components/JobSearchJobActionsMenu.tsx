import React from 'react';
import {JobActionsMenu, type JobAction} from '../../../components/common/job-actions-menu/JobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * Job-detail action menu for the React job search page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header. Mirrors the md-fab-speed-dial in
 * `wwwroot/app/components/jobSearch/jobSearch.template.html:72-170`; availability
 * conditions match the AngularJS `ng-if`s.
 */

export type JobSearchJobActionId =
    | 'accessorialCharges'
    | 'attachments'
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
    {id: 'accessorialCharges', label: 'Accessorial Charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'dispatch', label: 'Dispatch to Courier', icon: 'send_to_mobile',
        available: job => !job.bulkJob && !job.preBook && job.assignedCourier == null},
    {id: 'changeCourier', label: 'Change Paid Courier', icon: 'swap_horiz',
        // Only for archived, completed jobs — the live-job path is a normal re-dispatch.
        // Invoiced/settled jobs are refused by the server pre-check (DispatchJob rows
        // don't carry a populated invoiced flag), which shows an explanatory popup.
        available: job => !job.bulkJob && !job.preBook && !!job.isArchived && !!job.done},
    {id: 'restore', label: 'Restore Job', icon: 'undo',
        // Archived jobs live only in the archive tables; restore operates on live (tucJob)
        // rows, so restoring an archived job silently no-ops — don't offer it.
        available: job => !job.bulkJob && !job.preBook && job.assignedCourier != null && !job.done && !job.isArchived},
    {id: 'swapPod', label: 'Swap POD', icon: 'swap_horiz',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'sendPod', label: 'Email Photo POD', icon: 'send',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'unlock', label: 'Unlock Job', icon: 'lock_open',
        available: job => !job.preBook && (!!job.locked && !job.invoiced)},
    {id: 'lock', label: 'Lock Job', icon: 'lock',
        available: job => !job.preBook && !job.bulkJob && !job.locked && !job.invoiced},
    {id: 'split', label: 'Split Job', icon: 'shuffle',
        // Archived jobs are refused by executeSplitJobFlow, so offering it would be a dead end.
        available: job => !!job.allowSplit && !job.isArchived},
    {id: 'unsplit', label: 'UnSplit Job', icon: 'undo',
        available: job => !job.preBook && !job.locked && job.jobRelationshipTypeId === 8},
];

export const JobSearchJobActionsMenu: React.FC<JobSearchJobActionsMenuProps> = ({currentJob, onAction}) => (
    <JobActionsMenu actions={ACTIONS} currentJob={currentJob} onAction={onAction}/>
);
