/**
 * Job List Context Menu
 *
 * MUI Menu positioned at mouse coordinates, built dynamically based on job state.
 * Self-contained React context menu with all action handlers.
 * Uses @mui/icons-material for all icons (no font Icon component).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// MUI Icons
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import AirplanemodeInactiveIcon from '@mui/icons-material/AirplanemodeInactive';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PinDropIcon from '@mui/icons-material/PinDrop';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SendIcon from '@mui/icons-material/Send';
import CancelIcon from '@mui/icons-material/Cancel';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import RedoIcon from '@mui/icons-material/Redo';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';

import LinearProgress from '@mui/material/LinearProgress';

import type {AppPage, DispatchJob} from '../../interfaces/dispatchJob';
import type {ShowToastFn} from '../../services/toastService';
import * as api from '../../services/jobListApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import {openAddEventDialog} from '../dialogs/add-event-dialog';
import {openEventGroupDialog} from '../dialogs/event-group-dialog';
import {executeSplitJobFlow} from '../../services/splitJobFlow';
import {DispatchDialog, type DispatchType} from '../dialogs/dispatch-dialog';
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
    const [lateDialogOpen, setLateDialogOpen] = useState(false);
    const [lateType, setLateType] = useState<'pickup' | 'delivery'>('pickup');
    const [lateMinutes, setLateMinutes] = useState('');
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
    } | null>(null);
    const [splitJobLoading, setSplitJobLoading] = useState(false);
    const [eventGroups, setEventGroups] = useState<api.EventGroupItem[]>(eventGroupsCache);
    const [eventGroupsAnchor, setEventGroupsAnchor] = useState<HTMLElement | null>(null);
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

    const hasOpenDialog = lateDialogOpen || confirmDialogOpen || splitJobLoading || dispatchDialog.open;
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
        setConfirmDialogOpen(true);
    };

    const handleUnassignAgent = () => {
        closeAll();
        setConfirmDialogConfig({
            title: 'Unassign Agent?',
            message: `Are you sure you wish to unassign agent ${activeJob.assignedAgent?.agentName} from ${activeJob.jobNo}?`,
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
        setConfirmDialogOpen(true);
    };

    const handleAddStop = () => {
        closeAll();
        if (onAddStop) onAddStop(activeJob);
    };

    const handleLatePickup = () => {
        closeAll();
        setLateType('pickup');
        setLateMinutes('');
        setLateDialogOpen(true);
    };

    const handleLateDelivery = () => {
        closeAll();
        setLateType('delivery');
        setLateMinutes('');
        setLateDialogOpen(true);
    };

    const handleLateSubmit = async () => {
        setLateDialogOpen(false);
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

    const handleDispatchDialogConfirmCourier = async (
        type: 'Courier' | 'Agent' | 'NP',
        destination: {id: number; text: string},
    ) => {
        // Single-job dispatch from the context menu. If the job already has a
        // courier assigned, treat the action as a re-dispatch so the server
        // releases the previous courier; otherwise allocate fresh.
        const targetJob = activeJob;
        if (type !== 'Courier') {
            // Agent / NP from the context menu isn't wired server-side for ad-hoc
            // dispatch yet — surface that clearly instead of failing silently.
            throw new Error(`${type} dispatch is not yet wired from the job list — use the job-details panel.`);
        }
        try {
            if (targetJob.assignedCourier?.id) {
                await api.reAllocateJobs(destination.id, [targetJob.id]);
            } else {
                await api.allocateJobs(destination.id, [targetJob.id]);
            }
            showToast(`Job ${targetJob.jobNo} dispatched to ${destination.text}`, 'success');
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
        closeAll();
        setConfirmDialogConfig({
            title: 'Send to Live?',
            message: `Are you sure you want to send bulk job ${activeJob.jobNo} to the live dispatch screen?`,
            onConfirm: async () => {
                try {
                    await api.releaseBulkJob(activeJob.id);
                    showToast(`Bulk job ${activeJob.jobNo} sent to live successfully`, 'success');
                    refresh();
                } catch {
                    showToast('Failed to send bulk job to live', 'error');
                }
            },
        });
        setConfirmDialogOpen(true);
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
            onConfirm: async () => {
                await executeSplitJobFlow({
                    job: targetJob,
                    showToast,
                    onComplete: refresh,
                    setLoading: setSplitJobLoading,
                });
            },
        });
        setConfirmDialogOpen(true);
    };

    const handleSetFirstJob = () => {
        closeAll();
        setConfirmDialogConfig({
            title: 'Set First Job?',
            message: 'Are you sure you wish to set this as the First Job?',
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
        setConfirmDialogOpen(true);
    };

    const handleRedispatch = () => {
        // Opens the universal dispatch dialog so the operator can pick any
        // destination (or keep the existing courier). Replaces the previous
        // straight re-allocate so dispatchers can switch destination types.
        openDispatchDialog('Courier');
    };

    const handleRestore = async () => {
        closeAll();
        try {
            await api.restoreJobs([activeJob.id]);
            refresh();
        } catch {
            showToast('Error restoring job', 'error');
        }
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

    return (
        <>
            <Menu
                open={open}
                onClose={closeAll}
                anchorReference="anchorPosition"
                anchorPosition={position ? {top: position.mouseY, left: position.mouseX} : undefined}
                slotProps={{
                    paper: {
                        sx: {minWidth: 200, maxWidth: 320},
                    },
                }}
            >
                {/* Mark Read / Unread */}
                <MenuItem onClick={handleMarkReadUnread}>
                    <ListItemIcon>
                        {activeJob.hasBeenRead
                            ? <MarkEmailUnreadIcon fontSize="small"/>
                            : <MarkEmailReadIcon fontSize="small"/>
                        }
                    </ListItemIcon>
                    <ListItemText>{activeJob.hasBeenRead ? 'Mark as Unread' : 'Mark as Read'}</ListItemText>
                </MenuItem>

                <Divider/>

                {/* Unassign Flight (Domestic only) */}
                {appPage === AppPageDomestic && activeJob.assignedFlight && activeJob.isFlightJob && (
                    <MenuItem onClick={handleUnassignFlight}>
                        <ListItemIcon><AirplanemodeInactiveIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Unassign Flight</ListItemText>
                    </MenuItem>
                )}

                {/* Unassign Agent (Domestic only) */}
                {appPage === AppPageDomestic && activeJob.assignedAgent && (
                    <MenuItem onClick={handleUnassignAgent}>
                        <ListItemIcon><PersonRemoveIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Unassign Agent</ListItemText>
                    </MenuItem>
                )}

                {/* Add Stop (Agent jobs) */}
                {activeJob.isAgentJob && (
                    <MenuItem onClick={handleAddStop}>
                        <ListItemIcon><PinDropIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>
                            {activeJob.toAirportId && !activeJob.fromAirportId ? 'Add Pickup Stop' : 'Add Delivery Stop'}
                        </ListItemText>
                    </MenuItem>
                )}

                {/* Late Pickup / Delivery (Dispatch or JobSearch) */}
                {(appPage === AppPageDispatch || appPage === AppPageJobSearch) && [
                    <Tooltip key="late-pickup" title={isPartnerJob ? partnerDisabledTooltip : ''} placement="right">
                        <span>
                            <MenuItem disabled={isPartnerJob} onClick={handleLatePickup}>
                                <ListItemIcon><ScheduleIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Late Pickup</ListItemText>
                            </MenuItem>
                        </span>
                    </Tooltip>,
                    <Tooltip key="late-delivery" title={isPartnerJob ? partnerDisabledTooltip : ''} placement="right">
                        <span>
                            <MenuItem disabled={isPartnerJob} onClick={handleLateDelivery}>
                                <ListItemIcon><LocalShippingIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Late Delivery</ListItemText>
                            </MenuItem>
                        </span>
                    </Tooltip>,
                ]}

                {(appPage === AppPageDispatch || appPage === AppPageJobSearch) && <Divider/>}

                {/* Reprice (Nationwide only) */}
                {isNationwideSpeed && notReprice && !activeJob.preBook && (
                    <Tooltip title={isPartnerJob ? partnerDisabledTooltip : ''} placement="right">
                        <span>
                            <MenuItem disabled={isPartnerJob} onClick={handleReprice}>
                                <ListItemIcon><PriceCheckIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Reprice Job</ListItemText>
                            </MenuItem>
                        </span>
                    </Tooltip>
                )}

                {/* Add Task / Task Groups */}
                <MenuItem onClick={handleAddTaskOther}>
                    <ListItemIcon><AddIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>Add Task - Other</ListItemText>
                </MenuItem>
                <MenuItem onClick={(e) => setEventGroupsAnchor(e.currentTarget)}>
                    <ListItemIcon><EventIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>Task Groups</ListItemText>
                    <ChevronRightIcon fontSize="small" sx={{ml: 1, color: 'text.disabled'}}/>
                </MenuItem>

                <Divider/>

                {/* Send to Live (bulk jobs not done) */}
                {activeJob.isBulkJob && !activeJob.done && (
                    <MenuItem onClick={handleSendToLive}>
                        <ListItemIcon><SendIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Send to Live</ListItemText>
                    </MenuItem>
                )}

                {/* Send to DFRNT Partner (dispatch/jobsearch only) — opens the
                    universal dispatch dialog with the DFRNT Partner radio pre-selected. */}
                {(appPage === AppPageDispatch || appPage === AppPageJobSearch) && (
                    <Tooltip
                        title={isOutboundPartnerJob ? outboundPartnerDisabledTooltip : activeJob.assignedCourier ? 'Restore job before sending to partner' : ''}
                        placement="right"
                    >
                        <span>
                            <MenuItem
                                disabled={Boolean(activeJob.assignedCourier) || isOutboundPartnerJob}
                                onClick={() => openDispatchDialog('DfrntPartner')}
                            >
                                <ListItemIcon><SendIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Send to Partner</ListItemText>
                            </MenuItem>
                        </span>
                    </Tooltip>
                )}

                {/* Void Job */}
                <Tooltip title={isOutboundPartnerJob ? outboundPartnerDisabledTooltip : ''} placement="right">
                    <span>
                        <MenuItem disabled={isOutboundPartnerJob} onClick={handleVoidJob}>
                            <ListItemIcon><CancelIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>Void Job</ListItemText>
                        </MenuItem>
                    </span>
                </Tooltip>

                {/* Swap PODs (completed non-bulk non-prebook) */}
                {activeJob.done && !activeJob.isBulkJob && !activeJob.preBook && (
                    <MenuItem onClick={handleSwapPods}>
                        <ListItemIcon><SwapHorizIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Swap PODs</ListItemText>
                    </MenuItem>
                )}

                {/* Split Job */}
                {activeJob.allowSplit && !hasChildren && !isPartnerJob && (
                    <MenuItem onClick={handleSplitJob}>
                        <ListItemIcon><CallSplitIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Split Job</ListItemText>
                    </MenuItem>
                )}

                <Divider/>

                {/* Set First Job */}
                {!isOutboundPartnerJob && (
                    <MenuItem onClick={handleSetFirstJob}>
                        <ListItemIcon><FirstPageIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Set First Job</ListItemText>
                    </MenuItem>
                )}

                {/* Re-Dispatch */}
                {activeJob.assignedCourier && !isOutboundPartnerJob && (
                    <MenuItem onClick={handleRedispatch}>
                        <ListItemIcon><RedoIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Re-Dispatch</ListItemText>
                    </MenuItem>
                )}

                {/* Restore */}
                <MenuItem onClick={handleRestore}>
                    <ListItemIcon><RedoIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>Restore</ListItemText>
                </MenuItem>

                {/* Mark Missing */}
                <MenuItem onClick={handleMarkMissing}>
                    <ListItemIcon><HelpOutlineIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>Mark Missing</ListItemText>
                </MenuItem>
            </Menu>
            {/* Task Groups Submenu */}
            <Menu
                open={Boolean(eventGroupsAnchor)}
                anchorEl={eventGroupsAnchor}
                onClose={() => setEventGroupsAnchor(null)}
                anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                {eventGroups.length === 0 ? (
                    <MenuItem disabled>
                        <ListItemText>
                            <Typography variant="body2" sx={{
                                color: "text.secondary"
                            }}>No task groups</Typography>
                        </ListItemText>
                    </MenuItem>
                ) : (
                    eventGroups.map((group) => (
                        <MenuItem key={group.id} onClick={() => handleEventGroup(group.id)}>
                            <ListItemText>{group.text}</ListItemText>
                        </MenuItem>
                    ))
                )}
            </Menu>
            {/* Late Call Dialog */}
            <Dialog open={lateDialogOpen} onClose={() => setLateDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Late {lateType === 'pickup' ? 'Pickup' : 'Delivery'}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{mb: 2}}>
                        Enter the number of minutes the courier is running late for{' '}
                        {lateType === 'pickup' ? 'pickup' : 'delivery'}:
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        type="number"
                        label="Minutes"
                        value={lateMinutes}
                        onChange={(e) => setLateMinutes(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') return handleLateSubmit();
                        }}
                        slotProps={{htmlInput: {min: 1}}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleLateSubmit} variant="contained" disabled={!lateMinutes}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Generic Confirmation Dialog */}
            <Dialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{confirmDialogConfig?.title}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">{confirmDialogConfig?.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            setConfirmDialogOpen(false);
                            if (confirmDialogConfig?.onConfirm) {
                                await confirmDialogConfig.onConfirm();
                            }
                        }}
                        variant="contained"
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Split Job Loading Dialog */}
            <Dialog
                open={splitJobLoading}
                maxWidth="xs"
                fullWidth
            >
                <DialogContent sx={{textAlign: 'center', py: 3}}>
                    <LinearProgress sx={{mb: 2}}/>
                    <Typography variant="body2">
                        Splitting job {activeJob.jobNo}...
                    </Typography>
                </DialogContent>
            </Dialog>
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
                onClose={() => setDispatchDialog((s) => ({...s, open: false}))}
                onDispatchCourier={handleDispatchDialogConfirmCourier}
                onSendToPartner={handleDispatchDialogConfirmPartner}
                fetchRate={api.getPartnerRateForJob}
                getPartnerOptions={api.getActivePartnerOptions}
            />
        </>
    );
};
