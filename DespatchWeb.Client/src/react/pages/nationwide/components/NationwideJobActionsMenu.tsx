import React from 'react';
import {JobActionsMenu, type JobAction} from '../../../components/common/job-actions-menu/JobActionsMenu';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import {isNetworkPartnerSession} from '../../../components/dialogs/dispatch-dialog/dispatchSession';

/**
 * Job-detail action menu for the React Nationwide page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header.
 *
 * Unlike Dispatch's FAB, Nationwide has no generic "Dispatch to courier" action
 * (dispatch happens through the flight/agent widget) and no Split/Swap POD
 * actions, so this menu is a subset of DispatchJobActionsMenu.
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
    {id: 'addStop', label: 'Add stop', icon: 'pin_drop',
        available: job => job.isAgentJob},
    {id: 'accessorialCharges', label: 'Accessorial charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId && !isNetworkPartnerSession()},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'addTask', label: 'Add task', icon: 'edit_calendar',
        available: () => true},
    {id: 'unlock', label: 'Unlock job', icon: 'lock_open',
        available: job => !!job.locked && !job.invoiced},
    {id: 'lock', label: 'Lock job', icon: 'lock',
        available: job => !job.locked && !job.invoiced},
];

export const NationwideJobActionsMenu: React.FC<NationwideJobActionsMenuProps> = ({currentJob, onAction}) => (
    <JobActionsMenu actions={ACTIONS} currentJob={currentJob} onAction={onAction}/>
);
