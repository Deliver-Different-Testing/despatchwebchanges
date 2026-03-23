/**
 * Dispatch Dashboard Page (React)
 *
 * Main page component that replaces the AngularJS HomeController.
 * Renders a 6-widget resizable/reorderable dashboard using react-grid-layout.
 * Includes the AppShell (toolbar + sidenav) directly in React.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonApronIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type {SxProps, Theme} from '@mui/material';
import {DispatchProvider, type DispatchContextValue} from './DispatchContext';
import {DashboardGrid} from './components/DashboardGrid';
import {useDispatchLayout} from './hooks/useDispatchLayout';
import {useJobSelection} from './hooks/useJobSelection';
import {useCurrentWork} from './hooks/useCurrentWork';
import {useDriverLocations} from './hooks/useDriverLocations';
import {useSupportTasks} from './hooks/useSupportTasks';
import {usePageViews} from './hooks/usePageViews';
import {useDateFilter} from './hooks/useDateFilter';
import {useMessaging} from './hooks/useMessaging';
import {useAutoRefresh} from './hooks/useAutoRefresh';
import {useDispatchExecutor} from './hooks/useDispatchExecutor';
import {
    BOX_CONFIGS,
    DispatchBox,
    type DispatchPageProps,
} from './DispatchPage.interfaces';

// App Shell
import {AppShell} from '../../components/common/app-shell/AppShell';
import {
    ActionsMenu,
    MessagesButton,
    SettingsButton,
    ViewsMenu,
    DateFilterMenu,
    LayoutsMenu,
} from '../../components/common/app-toolbar/ToolbarActions';
import {openHubUrl} from '../../services/navigationService';

// Dialogs
import {openCreateJobDialog} from '../../components/dialogs/create-job-dialog/create-job-dialog-react.module';
import {openMessagingDialog} from '../../components/dialogs/messaging-dialog';
import {
    openDashboardSettingsDialog
} from '../../components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module';
import {openAccessorialChargesDialog} from '../../components/dialogs/accessorial-charges-dialog';

// Widget components
import {JobListPanel} from '../../components/job-list/JobListPanel';
import {JobDetails} from '../../components/common/job-details/JobDetails';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';
import {DriverLocations} from '../../components/common/driver-locations/DriverLocations';
import {CurrentWorkAllDrivers} from '../../components/common/current-work-all-drivers/CurrentWorkAllDrivers';
import {SupportTasksPanel} from './components/SupportTasksPanel';
import {JobDetailFab} from './components/JobDetailFab';

// Services
import {updateJobDetail} from '../../services/jobDetailApi';
import {getExactCourierMatch, getPotentialCouriers, getTruckCourierStatus} from '../../services/dispatchApi';
import type {IPotentialCourier} from '../../services/dispatchApi';
import {openAddEventDialog} from '../../components/dialogs/add-event-dialog';
import {executeSplitJobFlow} from '../../services/splitJobFlow';
import {executeAddStopFlow} from '../../services/addStopFlow';
import {openSwapPodsDialog} from '../../components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module';
import {openInterCourierChargeDialog, openJobFileUploadDialog} from '../../services/angularDialogBridge';
import {TruckCourierStatusDialog} from './components/TruckCourierStatusDialog';
import {ConfirmDialog} from './components/ConfirmDialog';
import {CourierSelectionDialog} from './components/CourierSelectionDialog';
import type {ITruckCourierStatus} from '../../services/dispatchApi';

// Types
import type {DispatchJob, AppPage, JobCategory} from '../../interfaces/dispatchJob';
import {fetchDispatchJobs, fetchClearListJobs} from '../../services/jobSearchApi';
import {queryKeys} from '../../query/queryClient';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import type {IDispatchMapItem} from '../../../interfaces/job.interface';
import type {TruckMode} from '../../components/common/driver-locations/DriverLocations.types';

const styles: Record<string, SxProps<Theme>> = {
    root: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    gridArea: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
    },
    widgetContent: {
        height: '100%',
        overflow: 'auto',
    },
    noSelection: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 2,
    },
    toolbarActionIcon: {
        fontSize: 18,
        color: 'inherit',
    },
};

/** Truck mode dropdown for driver locations toolbar */
function TruckModeMenu({truckMode, onSetTruckMode}: {
    truckMode: TruckMode;
    onSetTruckMode: (mode: TruckMode) => void;
}) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    return (
        <>
            <Chip
                label={`Trucks: ${truckMode}`}
                size="small"
                deleteIcon={<ArrowDropDownIcon />}
                onDelete={(e) => setAnchorEl(e.currentTarget as HTMLElement)}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={(theme) => ({
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    bgcolor: alpha(theme.palette.common.white, 0.15),
                    color: 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease',
                    '&:hover': {bgcolor: alpha(theme.palette.common.white, 0.25)},
                    '& .MuiChip-deleteIcon': {
                        color: 'inherit',
                        fontSize: 18,
                        mr: -0.25,
                    },
                })}
            />
            <Menu
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
                slotProps={{paper: {elevation: 3, sx: {mt: 0.5, minWidth: 100}}}}
            >
                {(['On', 'Off', 'Only'] as TruckMode[]).map(mode => (
                    <MenuItem
                        key={mode}
                        selected={truckMode === mode}
                        onClick={() => {
                            onSetTruckMode(mode);
                            setAnchorEl(null);
                        }}
                        sx={{fontSize: '0.85rem'}}
                    >
                        {mode}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

/** Courier code search input for current work toolbar */
function CourierCodeSearch({onCourierFound, showToast}: {
    onCourierFound: (courierId: number, courierName: string) => void;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
    const [code, setCode] = useState('');

    const handleSearch = async () => {
        if (!code.trim()) return;
        try {
            const courier = await getExactCourierMatch(code.trim());
            if (courier?.id) {
                onCourierFound(courier.id, courier.text);
                setCode('');
            } else {
                showToast(`No courier found with code: ${code}`, 'warning');
            }
        } catch {
            showToast(`No courier found with code: ${code}`, 'warning');
        }
    };

    return (
        <TextField
            size="small"
            placeholder="Courier #"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
            }}
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <LocalShippingIcon sx={{fontSize: 15, color: 'inherit', opacity: 0.7}}/>
                        </InputAdornment>
                    ),
                    sx: (theme: Theme) => ({
                        color: 'inherit',
                        fontSize: '0.75rem',
                        height: 26,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.common.white, 0.1),
                        transition: 'background-color 150ms ease',
                        '&:hover': {bgcolor: alpha(theme.palette.common.white, 0.18)},
                        '&.Mui-focused': {bgcolor: alpha(theme.palette.common.white, 0.2)},
                        '& input': {width: 60, p: 0.5},
                        '& .MuiInputAdornment-root': {mr: 0.25},
                    }),
                },
            }}
            variant="outlined"
            sx={{
                '& .MuiOutlinedInput-notchedOutline': {borderColor: 'rgba(255,255,255,0.2)'},
                '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: 'rgba(255,255,255,0.35)'},
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: 'rgba(255,255,255,0.5)'},
            }}
        />
    );
}

/** Filter dropdown for support tasks toolbar */
function FilterDropdown({label, icon, items, selectedId, onSelect}: {
    label: string;
    icon: React.ReactNode;
    items: Array<{ id: number; text: string }>;
    selectedId: number | undefined;
    onSelect: (id: number | undefined) => void;
}) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isActive = selectedId != null;

    return (
        <>
            <Tooltip title={label} enterDelay={400}>
                <IconButton
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    sx={(theme) => ({
                        p: 0.5,
                        borderRadius: 1,
                        color: 'inherit',
                        bgcolor: isActive ? alpha(theme.palette.common.white, 0.2) : 'transparent',
                        transition: 'background-color 150ms ease',
                        '&:hover': {
                            bgcolor: alpha(theme.palette.common.white, 0.15),
                        },
                    })}
                >
                    {icon}
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
                slotProps={{paper: {elevation: 3, sx: {mt: 0.5, minWidth: 180}}}}
            >
                <MenuItem
                    selected={!selectedId}
                    onClick={() => {
                        onSelect(undefined);
                        setAnchorEl(null);
                    }}
                    sx={{fontSize: '0.85rem'}}
                >
                    <ListItemText>All</ListItemText>
                </MenuItem>
                {items.map(item => (
                    <MenuItem
                        key={item.id}
                        selected={selectedId === item.id}
                        onClick={() => {
                            onSelect(item.id);
                            setAnchorEl(null);
                        }}
                        sx={{fontSize: '0.85rem'}}
                    >
                        <ListItemText>{item.text}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

export function DispatchPage({
                                 showToast,
                                 isUsCustomer,
                                 initialJobId,
                                 onNavigate,
                             }: DispatchPageProps) {
    const layout = useDispatchLayout();
    const jobSelection = useJobSelection(initialJobId);
    const currentWork = useCurrentWork();
    const supportTasks = useSupportTasks(jobSelection.currentJobId);
    const pageViews = usePageViews();
    const dateFilter = useDateFilter();
    const messaging = useMessaging(showToast);

    // Dispatch executor (validation, confirmation dialogs, allocation)
    const dispatchExecutor = useDispatchExecutor(showToast);

    // Auto-refresh intervals (configurable, persisted to localStorage)
    const jobListRefresh = useAutoRefresh('dispatch_jobListRefreshInterval', 0);
    const driverLocationRefresh = useAutoRefresh('dispatch_driverLocationRefreshInterval', 60_000);

    // Wire pageViews and dateFilter into driver locations (BUG FIX: was hardcoded empty)
    const driverLocations = useDriverLocations(
        pageViews.selectedViewIds,
        dateFilter.dateFilterData?.startDate?.toISOString(),
        dateFilter.dateFilterData?.endDate?.toISOString(),
        driverLocationRefresh.refetchInterval,
    );

    // Save-layout dialog state
    const [saveLayoutOpen, setSaveLayoutOpen] = useState(false);
    const [saveLayoutName, setSaveLayoutName] = useState('');

    // Truck loading status dialog state
    const [truckStatus, setTruckStatus] = useState<{open: boolean; data: ITruckCourierStatus | null; isRefreshing: boolean}>({open: false, data: null, isRefreshing: false});

    // Potential couriers for unassigned job selection
    const [potentialCouriers, setPotentialCouriers] = useState<IPotentialCourier[]>([]);

    // Map jobs for courier's current work display
    const currentWorkMapJobsRef = useRef<IDispatchMapItem[]>([]);

    // ── Job Selection Effects ─────────────────────────────────────────

    // 1.1: Auto-load courier's current work when selecting an assigned job
    useEffect(() => {
        const job = jobSelection.currentJob;
        if (!job) return;

        const courierId = job.courierData?.courierId;
        const courierName = job.courierData?.courierName ?? job.courier ?? '';

        if (courierId) {
            currentWork.selectDriver({courierId, name: courierName, jobCount: 0} as any);
            setPotentialCouriers([]);
        }
    }, [jobSelection.currentJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // 4.1: Fetch potential couriers when selecting an unassigned job
    useEffect(() => {
        const job = jobSelection.currentJob;
        if (!job || job.courierData?.courierId) {
            setPotentialCouriers([]);
            return;
        }

        let cancelled = false;
        getPotentialCouriers(job.id)
            .then(couriers => { if (!cancelled) setPotentialCouriers(couriers); })
            .catch(() => { if (!cancelled) setPotentialCouriers([]); });

        return () => { cancelled = true; };
    }, [jobSelection.currentJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // FetchConfig for the job list — includes view/date context and clear list filtering
    const fetchConfig = useMemo(() => {
        const viewIds = pageViews.selectedViewIds;
        const startDate = dateFilter.dateFilterData?.startDate;
        const endDate = dateFilter.dateFilterData?.endDate;
        const useTime = dateFilter.dateFilterData?.useTime;

        // 1.3: When a clear list area is active, filter to that area's jobs
        if (driverLocations.activeAreaId) {
            return {
                fetchFn: (params: any, options?: any) => fetchClearListJobs({
                    ...params,
                    despatchViewIds: viewIds,
                    startDate,
                    endDate,
                    useTime,
                    selectedClearListId: driverLocations.activeAreaId,
                    statusFilter: params.statusFilter ?? 'needs-dispatch',
                }, options),
                queryKeyFn: (params: any) => queryKeys.dispatch.clearList({
                    ...params,
                    despatchViewIds: viewIds,
                    selectedClearListId: driverLocations.activeAreaId,
                }),
                initialParams: {},
            };
        }

        return {
            fetchFn: (params: any, options?: any) => fetchDispatchJobs({
                ...params,
                despatchViewIds: viewIds,
                startDate,
                endDate,
                useTime,
            }, options),
            queryKeyFn: (params: any) => queryKeys.dispatch.jobs({
                ...params,
                despatchViewIds: viewIds,
            }),
            initialParams: {},
        };
    }, [pageViews.selectedViewIds, dateFilter.dateFilterData, driverLocations.activeAreaId]);

    // Default category switches to "needs-dispatch" when viewing a clear list area
    const jobListDefaultCategory: JobCategory | undefined = driverLocations.activeAreaId
        ? 'needs-dispatch'
        : undefined;

    const handleJobSelect = useCallback((job: DispatchJob) => {
        jobSelection.selectJob(job);
    }, [jobSelection.selectJob]);

    const handleJobDispatch = useCallback(async (job: DispatchJob, courierId: number) => {
        const success = await dispatchExecutor.dispatchJobs(courierId, [job]);
        if (success) {
            jobSelection.refreshJobListRef.current?.();
            currentWork.refetch();
        }
    }, [dispatchExecutor, jobSelection.refreshJobListRef, currentWork]);

    const handleMapMarkerClick = useCallback((mapItem: IDispatchMapItem) => {
        jobSelection.selectJobById(mapItem.jobId);
        jobSelection.selectJobInListRef.current?.(mapItem.jobId);
    }, [jobSelection.selectJobById, jobSelection.selectJobInListRef]);

    const currentMapJob = useMemo<IDispatchMapItem | undefined>(() => {
        const job = jobSelection.currentJob;
        if (!job) return undefined;
        return {
            jobId: job.id,
            jobNo: job.jobNo || String(job.id),
            pickupAddress: job.pickupAddress as any,
            deliveryAddress: job.deliveryAddress as any,
            assignedCourier: job.courier as any,
            statusId: job.statusId,
        };
    }, [jobSelection.currentJob]);

    // 1.2: Map context switching — show courier's current work jobs on map when in selectedDriver mode
    const mapJobs = useMemo<IDispatchMapItem[] | undefined>(() => {
        if (currentWork.viewMode === 'selectedDriver' && currentWorkMapJobsRef.current.length > 0) {
            return currentWorkMapJobsRef.current;
        }
        return undefined;
    }, [currentWork.viewMode, currentWork.selectedCourierId]);

    const jobDetailsConfig = useMemo<MountJobDetailsConfig | null>(() => {
        if (!jobSelection.currentJobId) return null;
        return {
            jobId: jobSelection.currentJobId,
            isRecurringJob: false,
            isBulkJob: false,
            isUsCustomer,
            showToast,
            onJobUpdate: () => {
                jobSelection.refreshJobListRef.current?.();
            },
        };
    }, [jobSelection.currentJobId, isUsCustomer, showToast, jobSelection.refreshJobListRef]);

    const refreshBox = useCallback((boxId: DispatchBox) => {
        switch (boxId) {
            case DispatchBox.JobsList:
                jobSelection.refreshJobListRef.current?.();
                break;
            case DispatchBox.DriverLocations:
                driverLocations.refetch();
                break;
            case DispatchBox.CurrentWork:
                currentWork.refetch();
                break;
            case DispatchBox.Supports:
                supportTasks.refetch();
                break;
        }
    }, [jobSelection.refreshJobListRef, driverLocations, currentWork, supportTasks]);

    const contextValue = useMemo<DispatchContextValue>(() => ({
        isUsCustomer,
        showToast,
        layouts: layout.layouts,
        currentLayoutName: layout.currentLayoutName,
        boxStates: layout.boxStates,
        isDefaultLayout: layout.isDefaultLayout,
        refreshBox,
        currentJobId: jobSelection.currentJobId,
        currentJob: jobSelection.currentJob,
        selectJob: jobSelection.selectJob,
        selectJobById: jobSelection.selectJobById,
        currentSelection: jobSelection.currentSelection,
        currentWorkSelection: currentWork.currentWorkSelection,
    }), [
        isUsCustomer, showToast,
        layout.layouts, layout.currentLayoutName, layout.boxStates,
        layout.isDefaultLayout,
        refreshBox,
        jobSelection.currentJobId, jobSelection.currentJob,
        jobSelection.selectJob, jobSelection.selectJobById,
        jobSelection.currentSelection,
        currentWork.currentWorkSelection,
    ]);

    // ── Toolbar action handlers ──────────────────────────────────────

    const handleCreateNewJob = useCallback(async () => {
        try {
            const newJobId = await openCreateJobDialog(isUsCustomer, {showToast});
            if (newJobId) {
                jobSelection.selectJobById(newJobId);
                jobSelection.refreshJobListRef.current?.();
                showToast('New Job Created Successfully', 'success');
            }
        } catch (error) {
            console.error('Error in createNewJob:', error);
        }
    }, [isUsCustomer, showToast, jobSelection]);

    const handleInterCourierCharge = useCallback(async () => {
        try {
            await openInterCourierChargeDialog();
        } catch (error) {
            if (!error) return; // User cancelled
            console.error('Error opening inter-courier charge dialog:', error);
        }
    }, []);

    const handleOpenSettings = useCallback(async () => {
        try {
            const formatRefreshLabel = (ms: number): string => {
                if (ms === 0) return 'Disabled';
                const totalSeconds = ms / 1000;
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                if (minutes === 0) return `${totalSeconds} seconds`;
                if (seconds === 0) return minutes === 1 ? `${minutes} min` : `${minutes} mins`;
                return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ${seconds} seconds`;
            };

            const result = await openDashboardSettingsDialog(
                {
                    title: 'Dashboard Settings',
                    showRefreshInterval: true,
                    showDriverLocationRefresh: true,
                    showDashboards: !layout.isDefaultLayout,
                },
                Object.fromEntries(
                    Object.entries(BOX_CONFIGS).map(([key, cfg]) => [
                        key,
                        {
                            name: cfg.id,
                            title: cfg.title,
                            icon: cfg.icon,
                            description: cfg.description,
                            visible: layout.boxStates[key]?.visible ?? true,
                        },
                    ])
                ),
                {id: jobListRefresh.intervalMs / 1000, text: formatRefreshLabel(jobListRefresh.intervalMs)},
                {id: driverLocationRefresh.intervalMs / 1000, text: formatRefreshLabel(driverLocationRefresh.intervalMs)},
            );
            if (result) {
                if (result.selectedRefreshInterval) {
                    jobListRefresh.setIntervalMs(result.selectedRefreshInterval.id * 1000);
                }
                if (result.selectedDriverLocationRefreshInterval) {
                    driverLocationRefresh.setIntervalMs(result.selectedDriverLocationRefreshInterval.id * 1000);
                }
                if (result.boxes) {
                    layout.updateBoxStates(result.boxes);
                }
                showToast('Settings saved successfully', 'success');
            }
        } catch (error) {
            if (!error) return;
            console.error('Error opening settings dialog:', error);
        }
    }, [showToast, layout, jobListRefresh, driverLocationRefresh]);

    // ── Job Detail FAB action handlers ─────────────────────────────

    const handleAddStop = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        await executeAddStopFlow({
            job,
            showToast,
            onComplete: (newJobId) => {
                jobSelection.selectJobById(newJobId);
                jobSelection.refreshJobListRef.current?.();
            },
        });
    }, [jobSelection.currentJob, showToast, jobSelection.selectJobById, jobSelection.refreshJobListRef]);

    const handleAccessorialCharges = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        try {
            await openAccessorialChargesDialog({
                job: {
                    id: job.id,
                    accessorialChargeGroupId: job.accessorialChargeGroupId!,
                },
                toastService: {showToast},
            });
        } catch {
            // User cancelled
        }
    }, [jobSelection.currentJob, showToast]);

    const handleAttachments = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        try {
            await openJobFileUploadDialog(job.id);
        } catch (error) {
            if (!error) return; // User cancelled
            console.error('Error opening file upload dialog:', error);
        }
    }, [jobSelection.currentJob]);

    const handleAddTask = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        await openAddEventDialog({
            job: {
                id: job.id,
                jobNo: job.jobNo ?? '',
                client: job.client ?? '',
                clientId: job.clientId,
            },
            toastService: {showToast},
        });
        supportTasks.refetch();
    }, [jobSelection.currentJob, showToast, supportTasks]);

    const handleCloseFirstOpenTask = useCallback(async () => {
        const openTask = supportTasks.tasks.find((t: any) => !t.closed);
        if (openTask) {
            await supportTasks.closeTask(openTask.id);
            showToast('Task closed', 'success');
        }
    }, [supportTasks, showToast]);

    const handleLockUnlock = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        const newLocked = !job.locked;
        try {
            await updateJobDetail(job.id, 'Locked', newLocked, false);
            showToast(newLocked ? 'Job locked' : 'Job unlocked', 'success');
            jobSelection.refreshJobListRef.current?.();
        } catch {
            showToast('Error updating lock status', 'error');
        }
    }, [jobSelection.currentJob, showToast, jobSelection.refreshJobListRef]);

    const [splitJobLoading, setSplitJobLoading] = useState(false);

    const handleSplitJob = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        await executeSplitJobFlow({
            job,
            showToast,
            onComplete: () => jobSelection.refreshJobListRef.current?.(),
            setLoading: setSplitJobLoading,
        });
    }, [jobSelection.currentJob, showToast, jobSelection.refreshJobListRef]);

    const handleSwapPod = useCallback(async () => {
        const job = jobSelection.currentJob;
        if (!job) return;
        try {
            const result = await openSwapPodsDialog(job.jobNo ?? '', {showToast});
            if (result) jobSelection.refreshJobListRef.current?.();
        } catch {
            // User cancelled
        }
    }, [jobSelection.currentJob, showToast, jobSelection.refreshJobListRef]);

    // ── Current Work toolbar handler ─────────────────────────────────

    const handleCourierFound = useCallback((courierId: number, courierName: string) => {
        currentWork.selectDriver({courierId, name: courierName, jobCount: 0} as any);
    }, [currentWork]);

    // 1.4: Courier click in driver locations → load that courier's current work
    const handleDriverLocationCourierClick = useCallback((courier: any) => {
        if (courier?.courierId) {
            currentWork.selectDriver({
                courierId: courier.courierId,
                name: courier.courierName ?? courier.courier ?? '',
                jobCount: 0,
            } as any);
        }
    }, [currentWork]);

    // 3.3: Truck loading status dialog
    const handleTruckLoadingStatus = useCallback(async () => {
        const courierId = currentWork.selectedCourierId;
        if (!courierId) return;
        try {
            const status = await getTruckCourierStatus(courierId);
            setTruckStatus({open: true, data: status, isRefreshing: false});
        } catch (error) {
            console.error('Error fetching truck status:', error);
            showToast('Error loading truck status', 'error');
        }
    }, [currentWork.selectedCourierId, showToast]);

    const handleTruckStatusRefresh = useCallback(async () => {
        const courierId = truckStatus.data?.courierId;
        if (!courierId) return;
        setTruckStatus(prev => ({...prev, isRefreshing: true}));
        try {
            const status = await getTruckCourierStatus(courierId);
            setTruckStatus({open: true, data: status, isRefreshing: false});
        } catch (error) {
            console.error('Error refreshing truck status:', error);
            showToast('Error refreshing truck status', 'error');
            setTruckStatus(prev => ({...prev, isRefreshing: false}));
        }
    }, [truckStatus.data?.courierId, showToast]);

    // ── Per-widget toolbar actions ───────────────────────────────────

    const renderToolbarActions = useCallback((boxId: DispatchBox): React.ReactNode => {
        switch (boxId) {
            case DispatchBox.DriverLocations:
                return (
                    <>
                        {driverLocations.activeAreaId && (
                            <Tooltip title="Clear Driver Location Selection" enterDelay={400}>
                                <IconButton
                                    size="small"
                                    onClick={() => driverLocations.setActiveAreaId(undefined)}
                                    sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                                >
                                    <Icon sx={styles.toolbarActionIcon} baseClassName="material-symbols-outlined">
                                        clear_all
                                    </Icon>
                                </IconButton>
                            </Tooltip>
                        )}
                        <TruckModeMenu
                            truckMode={driverLocations.truckMode}
                            onSetTruckMode={driverLocations.setTruckMode}
                        />
                    </>
                );

            case DispatchBox.JobDetail: {
                const job = jobSelection.currentJob;
                if (!job) return null;
                const hasOpenTask = supportTasks.tasks.some((t: any) => !t.closed);
                return (
                    <JobDetailFab
                        job={job}
                        onAddStop={job.isAgentJob ? handleAddStop : undefined}
                        onAccessorialCharges={handleAccessorialCharges}
                        onAttachments={handleAttachments}
                        onAddTask={handleAddTask}
                        onCloseTask={handleCloseFirstOpenTask}
                        onLockUnlock={handleLockUnlock}
                        onSplitJob={handleSplitJob}
                        onSwapPod={handleSwapPod}
                        hasOpenTask={hasOpenTask}
                    />
                );
            }

            case DispatchBox.CurrentWork:
                return (
                    <>
                        {currentWork.viewMode === 'selectedDriver' && (
                            <>
                                <Tooltip title="Back to All Drivers" enterDelay={400}>
                                    <IconButton
                                        size="small"
                                        onClick={currentWork.backToOverview}
                                        sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                                    >
                                        <ArrowBackIcon sx={{fontSize: 18}} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Truck Loading Status" enterDelay={400}>
                                    <IconButton
                                        size="small"
                                        onClick={handleTruckLoadingStatus}
                                        sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                                    >
                                        <LocalShippingIcon sx={{fontSize: 18}} />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        <CourierCodeSearch
                            onCourierFound={handleCourierFound}
                            showToast={showToast}
                        />
                    </>
                );

            case DispatchBox.Supports:
                return (
                    <>
                        <FilterDropdown
                            label="Filter by Staff"
                            icon={<PersonApronIcon sx={{fontSize: 18}}/>}
                            items={supportTasks.staffList}
                            selectedId={supportTasks.selectedStaffId}
                            onSelect={supportTasks.setStaffId}
                        />
                        <FilterDropdown
                            label="Filter by Event Type"
                            icon={<CategoryIcon sx={{fontSize: 18}}/>}
                            items={supportTasks.eventTypeList}
                            selectedId={supportTasks.selectedEventTypeId}
                            onSelect={supportTasks.setEventTypeId}
                        />
                    </>
                );

            default:
                return null;
        }
    }, [
        driverLocations, jobSelection.currentJob,
        handleAddStop, handleAccessorialCharges, handleAttachments,
        handleAddTask, handleCloseFirstOpenTask, handleLockUnlock,
        handleSplitJob, handleSwapPod, supportTasks.tasks,
        handleCourierFound, showToast,
        currentWork.viewMode, currentWork.backToOverview,
        handleTruckLoadingStatus,
        supportTasks.staffList, supportTasks.eventTypeList,
        supportTasks.selectedStaffId, supportTasks.selectedEventTypeId,
        supportTasks.setStaffId, supportTasks.setEventTypeId,
    ]);

    const renderWidget = useCallback((boxId: DispatchBox) => {
        switch (boxId) {
            case DispatchBox.JobsList:
                return (
                    <Box sx={styles.widgetContent}>
                        <JobListPanel
                            showToast={showToast}
                            isUsCustomer={isUsCustomer}
                            appPage={1 as AppPage}
                            onJobSelect={handleJobSelect}
                            onJobDispatch={handleJobDispatch}
                            fetchConfig={fetchConfig}
                            defaultCategory={jobListDefaultCategory}
                            setRefreshCallback={(cb) => {
                                jobSelection.refreshJobListRef.current = cb;
                            }}
                            setSelectJobCallback={(cb) => {
                                jobSelection.selectJobInListRef.current = cb;
                            }}
                        />
                    </Box>
                );

            case DispatchBox.JobDetail:
                if (!jobDetailsConfig) {
                    return (
                        <Box sx={styles.noSelection}>
                            <Typography variant="body2" color="text.secondary">
                                Select a job to view details
                            </Typography>
                        </Box>
                    );
                }
                return (
                    <Box sx={styles.widgetContent}>
                        <JobDetails config={jobDetailsConfig}/>
                    </Box>
                );

            case DispatchBox.Map:
                return (
                    <Box sx={{height: '100%'}}>
                        <DispatchMap
                            currentJob={currentMapJob}
                            jobs={mapJobs}
                            clearListId={driverLocations.activeAreaId}
                            onMarkerClick={handleMapMarkerClick}
                            showAvailableCouriers
                        />
                    </Box>
                );

            case DispatchBox.DriverLocations:
                return (
                    <Box sx={styles.widgetContent}>
                        <DriverLocations
                            driverLocations={driverLocations.driverLocations}
                            loading={driverLocations.loading}
                            showData={!driverLocations.loading && !!driverLocations.driverLocations}
                            showNoData={!driverLocations.loading && !driverLocations.driverLocations}
                            truckMode={driverLocations.truckMode}
                            activeAreaId={driverLocations.activeAreaId}
                            onAreaClick={(area) => {
                                driverLocations.setActiveAreaId(area.id);
                            }}
                            onCourierClick={handleDriverLocationCourierClick}
                            onClearFilter={() => {
                                driverLocations.setActiveAreaId(undefined);
                            }}
                            isUsCustomer={isUsCustomer}
                        />
                    </Box>
                );

            case DispatchBox.CurrentWork:
                if (currentWork.viewMode === 'selectedDriver' && currentWork.driverJobsFetchConfig) {
                    return (
                        <Box sx={styles.widgetContent}>
                            <JobListPanel
                                showToast={showToast}
                                isUsCustomer={isUsCustomer}
                                appPage={1 as AppPage}
                                defaultCategory="in-progress"
                                storagePrefix="currentWorkJobList"
                                fetchConfig={currentWork.driverJobsFetchConfig}
                                onJobSelect={handleJobSelect}
                                onJobDispatch={handleJobDispatch}
                            />
                        </Box>
                    );
                }
                return (
                    <Box sx={styles.widgetContent}>
                        <CurrentWorkAllDrivers
                            drivers={currentWork.drivers}
                            loading={currentWork.loading}
                            selectedCourierId={currentWork.selectedCourierId}
                            onDriverSelect={currentWork.selectDriver}
                        />
                    </Box>
                );

            case DispatchBox.Supports:
                return (
                    <SupportTasksPanel
                        tasks={supportTasks.tasks}
                        loading={supportTasks.loading}
                        jobId={jobSelection.currentJobId}
                        onCloseTask={supportTasks.closeTask}
                    />
                );

            default:
                return null;
        }
    }, [
        showToast, isUsCustomer, fetchConfig, jobListDefaultCategory,
        handleJobSelect, handleJobDispatch,
        jobSelection.refreshJobListRef, jobSelection.selectJobInListRef,
        jobDetailsConfig, currentMapJob, mapJobs, handleMapMarkerClick,
        driverLocations, handleDriverLocationCourierClick,
        currentWork, supportTasks,
        jobSelection.currentJobId,
    ]);

    const getSubtitle = useCallback((boxId: DispatchBox) => {
        if (boxId === DispatchBox.JobDetail) return jobSelection.currentSelection;
        if (boxId === DispatchBox.CurrentWork) return currentWork.currentWorkSelection;
        return undefined;
    }, [jobSelection.currentSelection, currentWork.currentWorkSelection]);

    const firstName = window.FirstName || 'User';
    const fullName = window.FullName || 'User';
    const timeZone = window.TimeZone || 'New Zealand Standard Time';

    return (
        <DispatchProvider value={contextValue}>
            <Box sx={styles.root}>
                <AppShell
                    title="Dispatch Dashboard"
                    firstName={firstName}
                    fullName={fullName}
                    isUsCustomer={isUsCustomer}
                    currentState="home"
                    onLogoClick={openHubUrl}
                    onNavigate={onNavigate}
                >
                    {/* Actions Menu (Add New Job, Inter-Courier Charge) */}
                    <ActionsMenu
                        onCreateNewJob={handleCreateNewJob}
                        onInterCourierCharge={handleInterCourierCharge}
                    />

                    {/* Messages */}
                    <MessagesButton
                        unreadCount={messaging.unreadCount}
                        onClick={() => messaging.openMessages()}
                    />

                    {/* Date Filter */}
                    <DateFilterMenu
                        dateFilterData={dateFilter.dateFilterData}
                        appPage="dispatch"
                        timeZone={timeZone}
                        onRefreshData={dateFilter.onRefreshData}
                        onShowToast={showToast}
                    />

                    {/* Views */}
                    <ViewsMenu
                        views={pageViews.views}
                        loading={pageViews.loading}
                        onToggleView={pageViews.toggleView}
                        onClearAll={pageViews.clearAll}
                    />

                    {/* Layouts */}
                    <LayoutsMenu
                        layouts={layout.layouts.map(l => ({name: l.name}))}
                        currentLayoutName={layout.currentLayoutName}
                        onSaveLayout={() => {
                            setSaveLayoutName('');
                            setSaveLayoutOpen(true);
                        }}
                        onLoadLayout={layout.loadLayout}
                        onDeleteLayout={layout.deleteLayout}
                    />

                    {/* Settings */}
                    <SettingsButton onClick={handleOpenSettings}/>
                </AppShell>

                <Box sx={styles.gridArea}>
                    <DashboardGrid
                        layout={layout.rglLayout}
                        onLayoutChange={layout.onLayoutChange}
                        cols={layout.cols}
                        rowHeight={layout.rowHeight}
                        isDefaultLayout={layout.isDefaultLayout}
                        visibleBoxIds={layout.visibleBoxIds}
                        renderWidget={renderWidget}
                        renderToolbarActions={renderToolbarActions}
                        getSubtitle={getSubtitle}
                        onRefresh={refreshBox}
                    />
                </Box>
            </Box>

            {/* Save Layout Dialog */}
            <Dialog
                open={saveLayoutOpen}
                onClose={() => setSaveLayoutOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Save Layout</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Layout name"
                        fullWidth
                        value={saveLayoutName}
                        onChange={(e) => setSaveLayoutName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && saveLayoutName.trim()) {
                                layout.saveLayoutAs(saveLayoutName.trim());
                                setSaveLayoutOpen(false);
                            }
                        }}
                        sx={{mt: 1}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveLayoutOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!saveLayoutName.trim()}
                        onClick={() => {
                            layout.saveLayoutAs(saveLayoutName.trim());
                            setSaveLayoutOpen(false);
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Truck Loading Status Dialog */}
            <TruckCourierStatusDialog
                open={truckStatus.open}
                onClose={() => setTruckStatus(prev => ({...prev, open: false}))}
                truckCourierStatus={truckStatus.data}
                isUsCustomer={isUsCustomer}
                onRefresh={handleTruckStatusRefresh}
                isRefreshing={truckStatus.isRefreshing}
            />

            {/* Dispatch Confirmation Dialog (offline courier, chilled warning) */}
            {dispatchExecutor.pendingConfirmation && (
                <ConfirmDialog
                    open
                    onClose={() => dispatchExecutor.resolveConfirmation(false)}
                    onConfirm={() => dispatchExecutor.resolveConfirmation(true)}
                    title={dispatchExecutor.pendingConfirmation.title}
                    message={dispatchExecutor.pendingConfirmation.message}
                    confirmLabel={dispatchExecutor.pendingConfirmation.confirmLabel}
                    severity={dispatchExecutor.pendingConfirmation.type === 'chilled-warning' ? 'warning' : 'info'}
                />
            )}

            {/* Courier Selection Dialog (for reallocation) */}
            {dispatchExecutor.pendingCourierSelection && (
                <CourierSelectionDialog
                    open
                    onClose={() => dispatchExecutor.resolveCourierSelection(null)}
                    onSelect={(courier) => dispatchExecutor.resolveCourierSelection(courier.courierId)}
                    jobNo={dispatchExecutor.pendingCourierSelection.jobNo}
                    potentialCouriers={potentialCouriers}
                />
            )}
        </DispatchProvider>
    );
}
