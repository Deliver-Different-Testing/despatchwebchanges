import React, {useState} from 'react';
import {ActionIcon, Group, Tooltip} from '@mantine/core';
import {Info} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * Job-Detail action menu, mirroring the md-fab-speed-dial in
 * `wwwroot/app/components/jobSearch/jobSearch.template.html:72-170`.
 *
 * Phase 2 ships the UI surface only — action handlers are deliberately
 * left as no-ops with a toast/log fallback. Phase 3 wires the handlers
 * to the existing dialog Promise APIs (window.ReactCreateJobDialog.open
 * etc.) one at a time, against the migration checklist.
 *
 * See `MIGRATION_CHECKLIST.md` rows under "Job actions" for the exact list.
 */

export interface JobDetailFabProps {
    currentJob?: DispatchJob;
    onAction?: (actionId: string, job: DispatchJob) => void;
}

interface FabAction {
    id: string;
    label: string;
    icon: string;
    available: (job: DispatchJob) => boolean;
}

const ACTIONS: FabAction[] = [
    {id: 'accessorialCharges', label: 'Accessorial Charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'dispatch', label: 'Dispatch to Courier', icon: 'send_to_mobile',
        available: job => !job.bulkJob && !job.preBook && job.assignedCourier == null},
    {id: 'restore', label: 'Restore Job', icon: 'undo',
        // Archived jobs live only in the archive tables; restore operates on live (tucJob)
        // rows, so restoring an archived job silently no-ops — don't offer it.
        available: job => !job.bulkJob && !job.preBook && job.assignedCourier != null && !job.done && !job.isArchived},
    {id: 'swapPod', label: 'Swap POD', icon: 'swap_horiz',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'sendPod', label: 'Email Photo POD', icon: 'send',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'unlock', label: 'Unlock Job', icon: 'lock',
        available: job => !job.preBook && (!!job.locked && !job.invoiced)},
    {id: 'lock', label: 'Lock Job', icon: 'lock_open',
        available: job => !job.preBook && !job.bulkJob && !job.locked && !job.invoiced},
    {id: 'split', label: 'Split Job', icon: 'shuffle',
        // Archived jobs are refused by executeSplitJobFlow, so offering it would be a dead end.
        available: job => !!job.allowSplit && !job.isArchived},
    {id: 'unsplit', label: 'UnSplit Job', icon: 'undo',
        available: job => !job.preBook && !job.locked && job.jobRelationshipTypeId === 8},
];

export const JobDetailFab: React.FC<JobDetailFabProps> = ({currentJob, onAction}) => {
    const [open, setOpen] = useState(false);

    if (!currentJob) return null;

    const visibleActions = ACTIONS.filter(a => a.available(currentJob));

    return (
        <Group
            data-testid="job-detail-actions"
            gap={4}
            wrap="nowrap"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {open ? (
                <Group gap={4} wrap="nowrap">
                    {visibleActions.map(action => (
                        <Tooltip key={action.id} label={action.label}>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label={action.label}
                                onClick={() => onAction?.(action.id, currentJob)}
                            >
                                {/* `SymbolIcon` is still MUI — the glyph names come from
                                    data, so it waits for the icon phase (§8). */}
                                <SymbolIcon name={action.icon} sx={{fontSize: 20}} />
                            </ActionIcon>
                        </Tooltip>
                    ))}
                </Group>
            ) : null}
            <Tooltip label="Options">
                <ActionIcon variant="subtle" aria-label="Options">
                    <Icon lucide={Info} size={18}/>
                </ActionIcon>
            </Tooltip>
        </Group>
    );
};
