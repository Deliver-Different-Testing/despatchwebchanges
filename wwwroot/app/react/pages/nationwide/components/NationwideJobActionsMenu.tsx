import React from 'react';
import {JobActionsMenu, type JobAction} from '../../../components/common/job-actions-menu/JobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * Job-detail action menu for the React Nationwide page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header. Mirrors the V1 `md-fab-speed-dial`
 * in `wwwroot/app/components/Nationwide/nationwide.template.html`; availability
 * conditions match the AngularJS `ng-if`s.
 *
 * Unlike Dispatch's FAB, Nationwide has no generic "Dispatch to Courier" action
 * (dispatch happens through the flight/agent widget) and no Split/Swap POD
 * actions in V1's speed-dial, so this menu is a subset of DispatchJobActionsMenu.
 */

export type NationwideJobActionId =
    | 'addStop'
    | 'accessorialCharges'
    | 'attachments'
    | 'addTask'
    | 'lock'
    | 'unlock';

export interface NationwideJobActionsMenuProps {
    currentJob?: DispatchJob;
    onAction?: (actionId: NationwideJobActionId, job: DispatchJob) => void;
}

const ACTIONS: JobAction<NationwideJobActionId>[] = [
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
];

export const NationwideJobActionsMenu: React.FC<NationwideJobActionsMenuProps> = ({currentJob, onAction}) => (
    <JobActionsMenu actions={ACTIONS} currentJob={currentJob} onAction={onAction}/>
);
