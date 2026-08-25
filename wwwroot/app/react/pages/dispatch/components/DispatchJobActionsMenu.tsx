import React from 'react';
import {JobActionsMenu, type JobAction} from '../../../components/common/job-actions-menu/JobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * Job-detail action menu for the React dispatch page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header. Mirrors the V1
 * `md-fab-speed-dial` in `wwwroot/app/components/home/home.template.html:78-156`;
 * availability conditions match the AngularJS `ng-if`s.
 *
 * Add Stop and Close Task are intentionally omitted from V1: Add Stop has no
 * React-native flow yet, and Close Task was a dead button (`closeSupport` was
 * never defined).
 */

export type DispatchJobActionId =
    | 'dispatch'
    | 'addStop'
    | 'accessorialCharges'
    | 'attachments'
    | 'addTask'
    | 'lock'
    | 'unlock'
    | 'split'
    | 'swapPod';

export interface DispatchJobActionsMenuProps {
    currentJob?: DispatchJob;
    onAction?: (actionId: DispatchJobActionId, job: DispatchJob) => void;
}

const ACTIONS: JobAction<DispatchJobActionId>[] = [
    {id: 'dispatch', label: 'Dispatch to Courier', icon: 'send_to_mobile',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'addStop', label: 'Add Stop', icon: 'pin_drop',
        available: job => job.isAgentJob},
    {id: 'accessorialCharges', label: 'Accessorial Charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'addTask', label: 'Add Task', icon: 'edit_calendar',
        available: () => true},
    {id: 'unlock', label: 'Unlock Job', icon: 'lock_open',
        available: job => !!job.locked && !job.invoiced},
    {id: 'lock', label: 'Lock Job', icon: 'lock',
        available: job => !job.locked && !job.invoiced},
    {id: 'split', label: 'Split Job', icon: 'shuffle',
        available: job => !!job.allowSplit},
    {id: 'swapPod', label: 'Swap POD', icon: 'swap_calls',
        available: job => !!job.done && !job.bulkJob && !job.preBook},
];

export const DispatchJobActionsMenu: React.FC<DispatchJobActionsMenuProps> = ({currentJob, onAction}) => (
    <JobActionsMenu actions={ACTIONS} currentJob={currentJob} onAction={onAction}/>
);
