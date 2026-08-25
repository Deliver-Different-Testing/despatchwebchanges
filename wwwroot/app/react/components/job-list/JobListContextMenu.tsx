/**
 * Job List Context Menu
 *
 * A Mantine Menu positioned at mouse coordinates, built dynamically from job
 * state. Self-contained: it owns all of its action handlers.
 * Icons come from the shared <Icon> wrapper (Lucide/Tabler).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Box, Menu, NumberInput, Paper, Stack, Text, Tooltip} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    ArrowLeftRight,
    Ban,
    BadgeDollarSign,
    Calendar,
    ChevronFirst,
    ChevronRight,
    CircleHelp,
    Clock,
    Mail,
    MailOpen,
    Plus,
    Redo2,
    Send,
    Split,
    UserMinus,
    UserPlus,
} from 'lucide-react';
import {IconPinned, IconPlaneOff, IconTruck} from '@tabler/icons-react';

import {Icon} from '../common/icon/Icon';

import type {AppPage, DispatchJob} from '../../interfaces/dispatchJob';
import type {ShowToastFn} from '../../services/toastService';
import * as api from '../../services/jobListApi';
import {executeDispatchConfirmation} from '../dialogs/dispatch-dialog/executeDispatch';
import {queryClient, queryKeys} from '../../query/queryClient';
import {openAddEventDialog} from '../dialogs/add-event-dialog';
import {openEventGroupDialog} from '../dialogs/event-group-dialog';
import {executeSplitJobFlow} from '../../services/splitJobFlow';
import {DispatchDialog, type DispatchConfirmation, type DispatchType} from '../dialogs/dispatch-dialog';
import {isNetworkPartnerSession, stopJobCountFor} from '../dialogs/dispatch-dialog/dispatchSession';
import {SendToLiveConfirmationDialog} from '../dialogs/send-to-live-confirmation-dialog';
import {RestoreConfirmationDialog} from '../dialogs/restore-confirmation-dialog';
import type {RestorePodImpactSummary} from '../dialogs/restore-confirmation-dialog';
import {needsRestoreConfirmation, summarisePodImpact} from '../../services/restorePodImpact';
import {SplitJobProgressDialog} from '../dialogs/split-job-progress-dialog';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg, sectionPaperProps} from '../dialogs/shared/mantine';
import {type HeaderVariant} from '../dialogs/shared/mantine/styles';
import {openJobInSearch} from '../../services/navigationService';
import JobInternalStatusEnum from "../../../enums/job-internal-status.enum";
import {NationwideSpeedId} from "../../../contants";

// Nationwide speed constant
const INTERNAL_STATUS_REPRICE = JobInternalStatusEnum.Reprice;

interface ContextMenuPosition {
    mouseX: number;
    mouseY: number;
}

interface JobListContextMenuProps {
    job: DispatchJob | null;
    position: ContextMenuPosition | null;
    onClose: () => void;
    appPage: AppPage;
    showToast: ShowToastFn;
    onRefresh?: () => void;
    onAddStop?: (job: DispatchJob) => void;
    isUsCustomer?: boolean;
}

// Static cache for event groups
let eventGroupsCache: api.EventGroupItem[] = [];
let eventGroupsLoading = false;

export const JobListContextMenu: React.FC<JobListContextMenuProps> = ({
    job,
    position,
    onClose,
    appPage,
    showToast,
    onRefresh,
    onAddStop,
}) => {
    const [lateDialogOpen, {open: openLateDialog, close: closeLateDialog}] = useDisclosure(false);
    const [lateType, setLateType] = useState<'pickup' | 'delivery'>('pickup');
    const [lateMinutes, setLateMinutes] = useState('');
    const [confirmDialogOpen, {open: openConfirmDialog, close: closeConfirmDialog}] = useDisclosure(false);
    const [restoreConfirm, setRestoreConfirm] = useState<RestorePodImpactSummary | null>(null);
    const [restoreChecking, setRestoreChecking] = useState(false);
    const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
        icon?: React.ReactNode;
        variant?: HeaderVariant;
    } | null>(null);
    const [sendToLiveTarget, setSendToLiveTarget] = useState<{id: number; jobNo: string} | null>(null);
    const [splitJobLoading, setSplitJobLoading] = useState(false);
    const [eventGroups, setEventGroups] = useState<api.EventGroupItem[]>(eventGroupsCache);
    const [eventGroupsAnchor, setEventGroupsAnchor] = useState<{top: number; left: number} | null>(null);
    const [dispatchDialog, setDispatchDialog] = useState<{
        open: boolean;
        initialType: DispatchType;
    }>({open: false, initialType: 'Courier'});

    // Capture job reference for dialogs that outlive the context menu
    const dialogJobRef = useRef<DispatchJob | null>(null);
    if (job) dialogJobRef.current = job;

    const open = Boolean(position) && Boolean(job);

    // Preload event groups
    useEffect(() => {
        if (eventGroupsCache.length > 0 || eventGroupsLoading) return;
        eventGroupsLoading = true;
        api.getEventGroups()
            .then((groups) => {
                eventGroupsCache = groups;
                setEventGroups(groups);
            })
            .catch(() => {
                eventGroupsCache = [];
            })
            .finally(() => {
                eventGroupsLoading = false;
            });
    }, []);

    const closeAll = useCallback(() => {
        onClose();
        setEventGroupsAnchor(null);
    }, [onClose]);

    const refresh = useCallback(() => {
        if (onRefresh) onRefresh();
    }, [onRefresh]);

    const hasOpenDialog = lateDialogOpen || confirmDialogOpen || restoreConfirm !== null || splitJobLoading || dispatchDialog.open || sendToLiveTarget !== null;
    if (!job && !hasOpenDialog) return null;

    // Use prop when available, fall back to ref for dialogs that outlive the menu
    const activeJob = job ?? dialogJobRef.current;
    if (!activeJob) return null;

    // ── Action Handlers ──────────────────────────────────────────────

    const handleMarkReadUnread = async () => {
        closeAll();
        try {
            await api.updateJobReadStatus(activeJob.id, !activeJob.hasBeenRead);
            showToast(activeJob.hasBeenRead ? 'Job marked as unread' : 'Job marked as read', 'success');
            refresh();
        } catch {
            showToast('Error marking job as read/unread', 'error');
        }
    };

    const handleUnassignFlight = () => {
        closeAll();
        setConfirmDialogConfig({
            title: 'Unassign Flight?',
            message: `Are you sure you wish to unassign flight ${activeJob.assignedFlight?.flightNumber} from ${activeJob.jobNo}?`,
            icon: <Icon tabler={IconPlaneOff}/>,
            variant: 'warning',
            onConfirm: async () => {
                try {
                    await api.restoreNationwideJob(activeJob.id);
                    showToast(`${activeJob.assignedFlight?.flightNumber} unassigned successfully`, 'success');
                    refresh();
                } catch {
                    showToast('Error unassigning flight', 'error');
                }
            },
        });
        openConfirmDialog();
    };

    const handleUnassignAgent = () => {
        closeAll();
        setConfirmDialogConfig({
            title: 'Unassign Agent?',
            message: `Are you sure you wish to unassign agent ${activeJob.assignedAgent?.agentName} from ${activeJob.jobNo}?`,
            icon: <Icon lucide={UserMinus}/>,
            variant: 'warning',
            onConfirm: async () => {
                try {
                    await api.restoreNationwideJob(activeJob.id);
                    showToast(`${activeJob.assignedAgent?.agentName} unassigned successfully`, 'success');
                    refresh();
                } catch {
                    showToast('Error unassigning agent', 'error');
                }
            },
        });
        openConfirmDialog();
    };

    const handleAddStop = () => {
        closeAll();
        if (onAddStop) onAddStop(activeJob);
    };

    const handleLatePickup = () => {
        closeAll();
        setLateType('pickup');
        setLateMinutes('');
        openLateDialog();
    };

    const handleLateDelivery = () => {
        closeAll();
        setLateType('delivery');
        setLateMinutes('');
        openLateDialog();
    };

    const handleLateSubmit = async () => {
        closeLateDialog();
        const mins = parseInt(lateMinutes, 10);
        const targetJob = dialogJobRef.current;
        if (isNaN(mins) || mins <= 0 || !targetJob) return;

        try {
            await api.lateCall({
                jobId: targetJob.id,
                lateType: lateType === 'pickup' ? 1 : 2,
                lateTime: mins,
                calculationRequired: true,
            });
            showToast('Late call applied successfully', 'success');
            refresh();
        } catch {
            showToast(`Error applying late ${lateType}`, 'error');
        }
    };

    const handleReprice = async () => {
        closeAll();
        try {
            await api.moveJobToReprice(activeJob.id);
            showToast(`Job ${activeJob.jobNo} marked as Reprice`, 'success');
            refresh();
        } catch {
            showToast('Error repricing job', 'error');
        }
    };

    const handleAddTaskOther = async () => {
        closeAll();
        await openAddEventDialog({
            job: {
                id: activeJob.id,
                jobNo: activeJob.jobNo,
                client: activeJob.client ?? '',
                clientId: activeJob.clientId,
            },
            toastService: {showToast},
        });
        refresh();
    };

    const handleEventGroup = async (groupId: number) => {
        setEventGroupsAnchor(null);
        closeAll();
        try {
            const saved = await openEventGroupDialog({
                eventGroupId: groupId,
                jobId: activeJob.id,
                toastService: {showToast},
            });
            if (saved) refresh();
        } catch (error) {
            console.error('Error in event group dialog:', error);
        }
    };

    const openDispatchDialog = (initialType: DispatchType) => {
        closeAll();
        setDispatchDialog({open: true, initialType});
    };

    // Assign an agent from the dispatch dialog: gate on a flight being assigned, then
    // assign and report whether the agent was emailed the inbound-agent link.
    const handleDispatchDialogConfirmCourier = async (confirmation: DispatchConfirmation) => {
        // Single-job dispatch from the context menu. The shared executor routes each
        // target to its own endpoint and re-allocates when a courier already exists.
        const targetJob = activeJob;
        try {
            const {message, severity} = await executeDispatchConfirmation(
                {
                    id: targetJob.id,
                    jobNo: targetJob.jobNo,
                    assignedCourierId: targetJob.assignedCourier?.id,
                },
                confirmation,
            );
            showToast(message, severity);
            await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
            setDispatchDialog((s) => ({...s, open: false}));
            refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error dispatching job';
            throw new Error(message, {cause: err});
        }
    };

    const handleDispatchDialogConfirmPartner = async (
        partner: {id: number; text: string},
        agreedRate: number,
    ) => {
        const sentJobId = activeJob.id;
        const sentJobNo = activeJob.jobNo;
        const result = await api.sendToPartner(sentJobId, partner.id, agreedRate);
        if (!result.success) {
            throw new Error(result.message || 'Failed to send job to partner');
        }
        setDispatchDialog((s) => ({...s, open: false}));
        let copied = false;
        try {
            await navigator.clipboard.writeText(sentJobNo);
            copied = true;
        } catch {
            // navigator.clipboard rejects when the document loses focus or runs
            // in an insecure context; to send succeeded, so just skip the copy.
        }
        
        const copySuffix = copied ? ' (job number copied)' : '';
        showToast(
            `Job ${sentJobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}${copySuffix}`,
            'success',
            {label: 'Open', onClick: () => openJobInSearch(sentJobId)},
        );
        refresh();
    };

    const handleSendToLive = () => {
        const target = {id: activeJob.id, jobNo: activeJob.jobNo};
        closeAll();
        setSendToLiveTarget(target);
    };

    const handleSendToLiveConfirm = async (): Promise<void> => {
        if (!sendToLiveTarget) return;
        const {id, jobNo} = sendToLiveTarget;
        try {
            const {jobNumbers} = await api.releaseBulkJob(id);
            const joined = jobNumbers.join(', ');

            let copied = false;
            try {
                await navigator.clipboard.writeText(joined);
                copied = true;
            } catch {
                // clipboard.writeText rejects in insecure contexts or when the
                // document loses focus; release succeeded, so just skip the copy.
            }

            const copySuffix = copied ? ' (copied to clipboard)' : '';
            showToast(
                `Bulk job ${jobNo} sent to live — ${joined}${copySuffix}`,
                'success',
            );
            refresh();
        } catch (err) {
            // Surface the server's message so operators see the real reason
            // ("Bulk job not found", "no releasable rows", SP/trigger mismatch, …)
            // rather than a generic failure string that hides the cause.
            const message = (err as {message?: string})?.message ?? 'Failed to send bulk job to live';
            showToast(message, 'error');
        }
    };

    const handleVoidJob = async () => {
        closeAll();
        try {
            if (window.ReactVoidJobConfirmationDialog) {
                const result = await window.ReactVoidJobConfirmationDialog.open(
                    {id: activeJob.id, jobNo: activeJob.jobNo, isBulkJob: activeJob.isBulkJob, isArchived: activeJob.isArchived},
                    {showToast},
                );
                if (result?.success) {
                    await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
                    refresh();
                }
            }
        } catch {
            // User canceled
        }
    };

    const handleSwapPods = async () => {
        closeAll();
        try {
            if (window.ReactSwapPodsDialog) {
                const result = await window.ReactSwapPodsDialog.open(activeJob.jobNo, {showToast});
                if (result) refresh();
            }
        } catch {
            // User canceled
        }
    };

    const handleSplitJob = () => {
        closeAll();
        const targetJob = dialogJobRef.current ?? activeJob;
        setConfirmDialogConfig({
            title: 'Split Job',
            message: 'Are you sure you wish to split this job?',
            icon: <Icon lucide={Split}/>,
            variant: 'primary',
            onConfirm: async () => {
                await executeSplitJobFlow({
                    job: targetJob,
                    showToast,
                    onComplete: refresh,
                    setLoading: setSplitJobLoading,
                });
            },
        });
        openConfirmDialog();
    };

    const handleSetFirstJob = () => {
        closeAll();
        setConfirmDialogConfig({
            title: 'Set First Job?',
            message: 'Are you sure you wish to set this as the First Job?',
            icon: <Icon lucide={ChevronFirst}/>,
            variant: 'primary',
            onConfirm: async () => {
                if (activeJob.courierData?.courierId) {
                    try {
                        await api.setFirstJob(activeJob.id, activeJob.courierData.courierId);
                        showToast('Job set as first job successfully', 'success');
                        refresh();
                    } catch {
                        showToast('Error setting first job', 'error');
                    }
                }
            },
        });
        openConfirmDialog();
    };

    const handleRedispatch = () => {
        // Opens the universal dispatch dialog so the operator can pick any
        // destination (or keep the existing courier). Replaces the previous
        // straight re-allocate so dispatchers can switch destination types.
        openDispatchDialog('Courier');
    };

    const performRestore = async (removeCapturedImages = false) => {
        try {
            await api.addRestoreEvent(activeJob.id);
            await api.restoreJobs([activeJob.id], removeCapturedImages);
            showToast(`Job ${activeJob.jobNo} restored`, 'success');
            // Invalidate job detail (and related/photos) so an open detail panel reflects the
            // reset status, then refresh the list.
            await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
            refresh();
        } catch {
            showToast('Error restoring job', 'error');
        }
    };

    const handleRestore = async () => {
        closeAll();
        if (restoreChecking) return;

        // Restoring re-opens a completed job and always clears the POD name, so find out what it
        // would cost before doing it. A failed check falls back to confirming completed jobs only.
        setRestoreChecking(true);
        let summary: RestorePodImpactSummary = {jobsWithPodName: 0, imageCount: 0};
        try {
            summary = summarisePodImpact(await api.getRestorePodImpact([activeJob.id]));
        } catch {
            // Never block a restore on the pre-check.
        } finally {
            setRestoreChecking(false);
        }

        if (needsRestoreConfirmation(!!activeJob.done, summary)) {
            setRestoreConfirm(summary);
            return;
        }
        void performRestore();
    };

    const handleMarkMissing = async () => {
        closeAll();
        try {
            await api.markJobMissing(activeJob.id);
            showToast('Job successfully marked as missing.', 'success');
            refresh();
        } catch {
            showToast('An unexpected error occurred marking this job as missing.', 'error');
        }
    };

    // ── Build Menu Items ──────────────────────────────────────────────

    const AppPageDispatch = 1;
    const AppPageDomestic = 2;
    const AppPageJobSearch = 3;

    const hasChildren = activeJob._groupChildren && activeJob._groupChildren.length > 0;
    const isNationwideSpeed = activeJob.speedId === NationwideSpeedId;
    const notReprice = activeJob.internalStatusId !== INTERNAL_STATUS_REPRICE;
    const isPartnerJob = Boolean(activeJob.isPartnerJob);
    // Outbound = *this* tenant sent the job to a partner (sentToPartnerName is
    // populated from JobPartnerDispatch). Courier-slot actions and Void mutate
    // local state that, on the sender side, is reserved for the partner pairing —
    // so we keep blocking those. The receiver side has no JobPartnerDispatch row
    // and behaves like a normal local job.
    const isOutboundPartnerJob = isPartnerJob && Boolean(activeJob.sentToPartnerName);
    const partnerDisabledTooltip = 'This job is managed by a partner';
    const outboundPartnerDisabledTooltip = 'This job has already been sent to a partner';

    /**
     * Mantine's Menu positions against a target element, but a context menu is
     * anchored to a pointer coordinate — so an empty, fixed-position node is
     * parked where the user right-clicked and used as the target.
     */
    const menuTargetStyle: React.CSSProperties = position
        ? {position: 'fixed', top: position.mouseY, left: position.mouseX, width: 0, height: 0}
        : {display: 'none'};

    /**
     * A menu row, optionally explained by a tooltip. `Menu.Sub` opens on hover
     * rather than click, so the Task Groups submenu keeps its own `Menu` anchored
     * to the row's rect instead — the click-to-open behaviour dispatchers expect.
     */
    const menuItem = (
        key: string,
        {icon, label, onClick, disabled, tooltip, rightSection, closeMenuOnClick}: {
            icon: React.ReactNode;
            label: React.ReactNode;
            onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
            disabled?: boolean;
            tooltip?: string;
            rightSection?: React.ReactNode;
            closeMenuOnClick?: boolean;
        },
    ) => {
        const item = (
            <Menu.Item
                leftSection={icon}
                rightSection={rightSection}
                disabled={disabled}
                closeMenuOnClick={closeMenuOnClick}
                onClick={onClick}
            >
                {label}
            </Menu.Item>
        );
        if (!tooltip) return <React.Fragment key={key}>{item}</React.Fragment>;
        return (
            <Tooltip key={key} label={tooltip} position="right" withArrow>
                <div>{item}</div>
            </Tooltip>
        );
    };

    return (
        <>
            <Menu opened={open} onClose={closeAll} position="bottom-start" withinPortal shadow="md" width={240}>
                <Menu.Target>
                    <div style={menuTargetStyle} aria-hidden="true"/>
                </Menu.Target>
                <Menu.Dropdown style={{minWidth: 200, maxWidth: 320}}>
                    {/* Mark Read / Unread */}
                    {menuItem('read', {
                        icon: <Icon lucide={activeJob.hasBeenRead ? Mail : MailOpen} size={16}/>,
                        label: activeJob.hasBeenRead ? 'Mark as Unread' : 'Mark as Read',
                        onClick: handleMarkReadUnread,
                    })}

                    <Menu.Divider/>

                    {/* Unassign Flight (Domestic only) */}
                    {appPage === AppPageDomestic && activeJob.assignedFlight && activeJob.isFlightJob && menuItem('unassign-flight', {
                        icon: <Icon tabler={IconPlaneOff} size={16}/>,
                        label: 'Unassign Flight',
                        onClick: handleUnassignFlight,
                    })}

                    {/* Unassign Agent (Domestic only) */}
                    {appPage === AppPageDomestic && activeJob.assignedAgent && menuItem('unassign-agent', {
                        icon: <Icon lucide={UserMinus} size={16}/>,
                        label: 'Unassign Agent',
                        onClick: handleUnassignAgent,
                    })}

                    {/* Add Stop (Agent jobs) */}
                    {activeJob.isAgentJob && menuItem('add-stop', {
                        icon: <Icon tabler={IconPinned} size={16}/>,
                        label: activeJob.toAirportId && !activeJob.fromAirportId ? 'Add Pickup Stop' : 'Add Delivery Stop',
                        onClick: handleAddStop,
                    })}

                    {/* Late Pickup / Delivery (Dispatch or JobSearch) */}
                    {(appPage === AppPageDispatch || appPage === AppPageJobSearch) && [
                        menuItem('late-pickup', {
                            icon: <Icon lucide={Clock} size={16}/>,
                            label: 'Late Pickup',
                            onClick: handleLatePickup,
                            disabled: isPartnerJob,
                            tooltip: isPartnerJob ? partnerDisabledTooltip : undefined,
                        }),
                        menuItem('late-delivery', {
                            icon: <Icon tabler={IconTruck} size={16}/>,
                            label: 'Late Delivery',
                            onClick: handleLateDelivery,
                            disabled: isPartnerJob,
                            tooltip: isPartnerJob ? partnerDisabledTooltip : undefined,
                        }),
                    ]}

                    {(appPage === AppPageDispatch || appPage === AppPageJobSearch) && <Menu.Divider/>}

                    {/* Reprice (Nationwide only) */}
                    {isNationwideSpeed && notReprice && !activeJob.preBook && menuItem('reprice', {
                        icon: <Icon lucide={BadgeDollarSign} size={16}/>,
                        label: 'Reprice Job',
                        onClick: handleReprice,
                        disabled: isPartnerJob,
                        tooltip: isPartnerJob ? partnerDisabledTooltip : undefined,
                    })}

                    {/* Add Task / Task Groups */}
                    {menuItem('add-task', {
                        icon: <Icon lucide={Plus} size={16}/>,
                        label: 'Add Task - Other',
                        onClick: handleAddTaskOther,
                    })}
                    {menuItem('task-groups', {
                        icon: <Icon lucide={Calendar} size={16}/>,
                        label: 'Task Groups',
                        // Opening the submenu must not close the parent — closing it
                        // runs `closeAll`, which clears the anchor we just set.
                        closeMenuOnClick: false,
                        rightSection: <Icon lucide={ChevronRight} size={16} color="var(--mantine-color-dimmed)"/>,
                        onClick: (event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setEventGroupsAnchor({top: rect.top, left: rect.right});
                        },
                    })}

                    <Menu.Divider/>

                    {/* Send to Live (bulk jobs not done) */}
                    {activeJob.isBulkJob && !activeJob.released && menuItem('send-to-live', {
                        icon: <Icon lucide={Send} size={16}/>,
                        label: 'Send to Live',
                        onClick: handleSendToLive,
                    })}

                    {/* Send to DFRNT Partner — opens the universal dispatch dialog with
                        the DFRNT Partner radio pre-selected. */}
                    {menuItem('send-to-partner', {
                        icon: <Icon lucide={Send} size={16}/>,
                        label: 'Send to Partner',
                        onClick: () => openDispatchDialog('DfrntPartner'),
                        disabled: Boolean(activeJob.assignedCourier) || isOutboundPartnerJob,
                        tooltip: isOutboundPartnerJob
                            ? outboundPartnerDisabledTooltip
                            : activeJob.assignedCourier ? 'Restore job before sending to partner' : undefined,
                    })}

                    {/* Void Job */}
                    {menuItem('void', {
                        icon: <Icon lucide={Ban} size={16}/>,
                        label: 'Void Job',
                        onClick: handleVoidJob,
                        disabled: isOutboundPartnerJob,
                        tooltip: isOutboundPartnerJob ? outboundPartnerDisabledTooltip : undefined,
                    })}

                    {/* Swap PODs (completed non-bulk non-prebook) */}
                    {activeJob.done && !activeJob.isBulkJob && !activeJob.preBook && menuItem('swap-pods', {
                        icon: <Icon lucide={ArrowLeftRight} size={16}/>,
                        label: 'Swap PODs',
                        onClick: handleSwapPods,
                    })}

                    {/* Split Job */}
                    {activeJob.allowSplit && !hasChildren && !isPartnerJob && menuItem('split', {
                        icon: <Icon lucide={Split} size={16}/>,
                        label: 'Split Job',
                        onClick: handleSplitJob,
                    })}

                    <Menu.Divider/>

                    {/* Set First Job */}
                    {!isOutboundPartnerJob && menuItem('set-first', {
                        icon: <Icon lucide={ChevronFirst} size={16}/>,
                        label: 'Set First Job',
                        onClick: handleSetFirstJob,
                    })}

                    {/* Assign… — the unbiased way into the shared modal. Re-Dispatch below
                        only appears once a courier exists, so without this a job that has
                        never been assigned has no route to the dialog from the row. */}
                    {!isOutboundPartnerJob && menuItem('assign', {
                        icon: <Icon lucide={UserPlus} size={16}/>,
                        label: 'Assign…',
                        onClick: () => openDispatchDialog('Courier'),
                    })}

                    {/* Re-Dispatch */}
                    {activeJob.assignedCourier && !isOutboundPartnerJob && menuItem('redispatch', {
                        icon: <Icon lucide={Redo2} size={16}/>,
                        label: 'Re-Dispatch',
                        onClick: handleRedispatch,
                    })}

                    {/* Restore — disabled for archived jobs: restore only operates on live
                        (tucJob) rows, so restoring an archived job silently does nothing. */}
                    {menuItem('restore', {
                        icon: <Icon lucide={Redo2} size={16}/>,
                        label: 'Restore',
                        onClick: () => void handleRestore(),
                        disabled: activeJob.isArchived,
                        tooltip: activeJob.isArchived ? 'Archived jobs cannot be restored' : undefined,
                    })}

                    {/* Mark Missing */}
                    {menuItem('mark-missing', {
                        icon: <Icon lucide={CircleHelp} size={16}/>,
                        label: 'Mark Missing',
                        onClick: handleMarkMissing,
                    })}
                </Menu.Dropdown>
            </Menu>

            {/* Task Groups Submenu */}
            <Menu
                opened={Boolean(eventGroupsAnchor)}
                onClose={() => setEventGroupsAnchor(null)}
                position="bottom-start"
                withinPortal
                shadow="md"
            >
                <Menu.Target>
                    <div
                        style={eventGroupsAnchor
                            ? {position: 'fixed', top: eventGroupsAnchor.top, left: eventGroupsAnchor.left, width: 0, height: 0}
                            : {display: 'none'}}
                        aria-hidden="true"
                    />
                </Menu.Target>
                <Menu.Dropdown>
                    {eventGroups.length === 0 ? (
                        <Menu.Item disabled>
                            <Text size="sm" c="dimmed">No task groups</Text>
                        </Menu.Item>
                    ) : (
                        eventGroups.map((group) => (
                            <Menu.Item key={group.id} onClick={() => handleEventGroup(group.id)}>
                                {group.text}
                            </Menu.Item>
                        ))
                    )}
                </Menu.Dropdown>
            </Menu>

            {/* Late Call Dialog */}
            <DialogShell
                opened={lateDialogOpen}
                onClose={closeLateDialog}
                label={`Late ${lateType === 'pickup' ? 'Pickup' : 'Delivery'}`}
            >
                <DialogHeader
                    icon={<Icon lucide={Clock}/>}
                    title={`Late ${lateType === 'pickup' ? 'Pickup' : 'Delivery'}`}
                    onClose={closeLateDialog}
                />
                <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                    <Paper {...sectionPaperProps}>
                        <Stack gap="sm">
                            <Text size="sm">
                                Enter the number of minutes the courier is running late for{' '}
                                {lateType === 'pickup' ? 'pickup' : 'delivery'}:
                            </Text>
                            <NumberInput
                                data-autofocus
                                label="Minutes"
                                min={1}
                                value={lateMinutes}
                                onChange={(value) => setLateMinutes(value === '' || value === null ? '' : String(value))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleLateSubmit();
                                }}
                            />
                        </Stack>
                    </Paper>
                </Box>
                <DialogFooter
                    onCancel={closeLateDialog}
                    onConfirm={handleLateSubmit}
                    confirmLabel="Save"
                    confirmDisabled={!lateMinutes}
                />
            </DialogShell>

            {/* Restore Completed Job Confirmation */}
                <RestoreConfirmationDialog
                    open={restoreConfirm !== null}
                    count={activeJob.done ? 1 : 0}
                    podImpact={restoreConfirm ?? undefined}
                    onClose={() => setRestoreConfirm(null)}
                    onSwapPod={async () => {
                        setRestoreConfirm(null);
                        await handleSwapPods();
                    }}
                    onConfirm={async (removeCapturedImages) => {
                        setRestoreConfirm(null);
                        await performRestore(removeCapturedImages);
                    }}
                />
                {/* Send to Live Confirmation Dialog */}
                <SendToLiveConfirmationDialog
                    open={sendToLiveTarget !== null}
                    jobNo={sendToLiveTarget?.jobNo ?? ''}
                    onClose={() => setSendToLiveTarget(null)}
                    onConfirm={handleSendToLiveConfirm}
                />
                {/* Split Job Loading Dialog */}
                <SplitJobProgressDialog open={splitJobLoading} jobNo={activeJob.jobNo}/>
                {/* Universal Dispatch Dialog */}
                <DispatchDialog
                    open={dispatchDialog.open}
                    mode={{
                        kind: 'single',
                        jobId: activeJob.id,
                        jobNo: activeJob.jobNo,
                        flags: {
                            isArchived: Boolean(activeJob.isArchived),
                            isBulkJob: Boolean(activeJob.isBulkJob),
                            preBook: Boolean(activeJob.preBook),
                        },
                    }}
                    initialType={dispatchDialog.initialType}
                    existingDestination={activeJob.assignedCourier}
                    stopJobCount={stopJobCountFor(activeJob.jobNo, activeJob.relatedJobs)}
                    existingConNote={activeJob.conNote}
                    isNetworkPartner={isNetworkPartnerSession()}
                    onClose={() => setDispatchDialog((s) => ({...s, open: false}))}
                    onDispatchCourier={handleDispatchDialogConfirmCourier}
                    onSendToPartner={handleDispatchDialogConfirmPartner}
                    fetchRate={api.getPartnerRateForJob}
                getPartnerOptions={api.getActivePartnerOptions}
            />

            {/* Generic Confirmation Dialog */}
            <DialogShell
                opened={confirmDialogOpen}
                onClose={closeConfirmDialog}
                label={confirmDialogConfig?.title}
            >
                <DialogHeader
                    icon={confirmDialogConfig?.icon ?? <Icon lucide={CircleHelp}/>}
                    title={confirmDialogConfig?.title}
                    variant={confirmDialogConfig?.variant ?? 'primary'}
                    onClose={closeConfirmDialog}
                />
                <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                    <Paper {...sectionPaperProps}>
                        <Text size="sm">{confirmDialogConfig?.message}</Text>
                    </Paper>
                </Box>
                <DialogFooter
                    onCancel={closeConfirmDialog}
                    onConfirm={async () => {
                        closeConfirmDialog();
                        if (confirmDialogConfig?.onConfirm) {
                            await confirmDialogConfig.onConfirm();
                        }
                    }}
                    confirmLabel="OK"
                    confirmColor={confirmDialogConfig?.variant === 'warning' ? 'orange' : undefined}
                />
            </DialogShell>
        </>
    );
};
