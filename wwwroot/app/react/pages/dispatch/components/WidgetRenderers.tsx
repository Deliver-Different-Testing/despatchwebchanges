/**
 * Per-widget memoized renderers.
 *
 * Each widget is a memo component that only re-renders when its own
 * props change, replacing the monolithic renderWidget/renderToolbarActions
 * callbacks in DispatchPage that had 15+ shared dependencies.
 */

import React, {memo, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonApronIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import type {SxProps, Theme} from '@mui/material';

import {JobListPanel} from '../../../components/common/job-list/JobListPanel';
import {JobDetails} from '../../../components/common/job-details/JobDetails';
import {DispatchMap} from '../../../components/common/dispatch-map/DispatchMap';
import {DriverLocations} from '../../../components/common/driver-locations/DriverLocations';
import {CurrentWorkAllDrivers} from '../../../components/common/current-work-all-drivers/CurrentWorkAllDrivers';
import {JobDetailFab} from './JobDetailFab';
import {NoData} from '../../../components/common/no-data/NoData';

import {getExactCourierMatch} from '../../../services/dispatchApi';
import {updateJobDetail} from '../../../services/jobDetailApi';
import {openAddEventDialog} from '../../../components/dialogs/add-event-dialog';
import {openAccessorialChargesDialog} from '../../../components/dialogs/accessorial-charges-dialog';
import {openJobFileUploadDialog} from '../../../services/angularDialogBridge';
import {executeSplitJobFlow} from '../../../services/splitJobFlow';
import {executeAddStopFlow} from '../../../services/addStopFlow';
import {openSwapPodsDialog} from '../../../components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module';

import type {AppPage, DispatchJob, JobCategory} from '../../../interfaces/dispatchJob';
import type {MountJobDetailsConfig} from '../../../components/common/job-details/JobDetails.types';
import type {IDispatchMapItem} from '../../../../interfaces/job.interface';
import type {TruckMode} from '../../../components/common/driver-locations/DriverLocations.types';
import type {ShowToastFn} from '../../../services/toastService';
import type {EventTypeSuggestion, StaffSuggestion} from '../../../interfaces';

const styles: Record<string, SxProps<Theme>> = {
    widgetContent: {
        height: '100%',
        overflow: 'auto',
    },
    toolbarActionIcon: {
        fontSize: 18,
        color: 'inherit',
    },
};

// ── Jobs List Widget ──────────────────────────────────────────────────

interface JobsListWidgetProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    fetchConfig: any;
    defaultCategory: JobCategory | undefined;
    onJobSelect: (job: DispatchJob) => void;
    onJobDispatch: (job: DispatchJob, courierId: number) => void;
    refreshJobListRef: React.RefObject<(() => void) | null>;
    selectJobInListRef: React.RefObject<((jobId: number) => void) | null>;
    views?: Array<{ id: number; name: string; selected: boolean }> | null;
    onToggleView?: (view: { id: number; name: string; selected: boolean }) => void;
    onClearViews?: () => void;
}

export const JobsListWidget = memo(({
                                        showToast, isUsCustomer, fetchConfig, defaultCategory,
                                        onJobSelect, onJobDispatch, refreshJobListRef, selectJobInListRef,
                                        views, onToggleView, onClearViews,
                                    }: JobsListWidgetProps) => (
    <Box sx={styles.widgetContent}>
        <JobListPanel
            showToast={showToast}
            isUsCustomer={isUsCustomer}
            appPage={1 as AppPage}
            onJobSelect={onJobSelect}
            onJobDispatch={onJobDispatch}
            fetchConfig={fetchConfig}
            defaultCategory={defaultCategory}
            setRefreshCallback={(cb) => {
                refreshJobListRef.current = cb;
            }}
            setSelectJobCallback={(cb) => {
                selectJobInListRef.current = cb;
            }}
            views={views}
            onToggleView={onToggleView}
            onClearViews={onClearViews}
        />
    </Box>
));

// ── Job Detail Widget ─────────────────────────────────────────────────

interface JobDetailWidgetProps {
    config: MountJobDetailsConfig | null;
}

export const JobDetailWidget = memo(({config}: JobDetailWidgetProps) => {
    if (!config) {
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to view details"
                icon="info"
            />
        );
    }
    return (
        <Box sx={styles.widgetContent}>
            <JobDetails config={config}/>
        </Box>
    );
});

// ── Job Detail Toolbar Actions ────────────────────────────────────────

interface JobDetailToolbarProps {
    job: DispatchJob | null;
    showToast: ShowToastFn;
    tasks: any[];
    refetchTasks: () => void;
    closeTask: (taskId: number) => Promise<void>;
    selectJobById: (jobId: number | null) => void;
    refreshJobList: () => void;
}

export const JobDetailToolbarActions = memo(({
                                                 job, showToast, tasks, refetchTasks, closeTask,
                                                 selectJobById, refreshJobList,
                                             }: JobDetailToolbarProps) => {
    if (!job) return null;

    const hasOpenTask = tasks.some((t: any) => !t.closed);

    const handleAddStop = async () => {
        await executeAddStopFlow({
            job,
            showToast,
            onComplete: (newJobId) => {
                selectJobById(newJobId);
                refreshJobList();
            },
        });
    };

    const handleAccessorialCharges = async () => {
        try {
            await openAccessorialChargesDialog({
                job: {id: job.id, accessorialChargeGroupId: job.accessorialChargeGroupId!},
                toastService: {showToast},
            });
        } catch { /* User cancelled */ }
    };

    const handleAttachments = async () => {
        try {
            await openJobFileUploadDialog(job.id);
        } catch (error) {
            if (!error) return;
            console.error('Error opening file upload dialog:', error);
        }
    };

    const handleAddTask = async () => {
        await openAddEventDialog({
            job: {
                id: job.id,
                jobNo: job.jobNo ?? '',
                client: job.client ?? '',
                clientId: job.clientId,
            },
            toastService: {showToast},
        });
        refetchTasks();
    };

    const handleCloseFirstOpenTask = async () => {
        const openTask = tasks.find((t: any) => !t.closed);
        if (openTask) {
            await closeTask(openTask.id);
            showToast('Task closed', 'success');
        }
    };

    const handleLockUnlock = async () => {
        const newLocked = !job.locked;
        try {
            await updateJobDetail(job.id, 'Locked', newLocked, false);
            showToast(newLocked ? 'Job locked' : 'Job unlocked', 'success');
            refreshJobList();
        } catch {
            showToast('Error updating lock status', 'error');
        }
    };

    const handleSplitJob = async () => {
        await executeSplitJobFlow({
            job,
            showToast,
            onComplete: () => refreshJobList(),
        });
    };

    const handleSwapPod = async () => {
        try {
            const result = await openSwapPodsDialog(job.jobNo ?? '', {showToast});
            if (result) refreshJobList();
        } catch { /* User cancelled */ }
    };

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
});

// ── Map Widget ────────────────────────────────────────────────────────

interface MapWidgetProps {
    currentJob: IDispatchMapItem | undefined;
    jobs: IDispatchMapItem[] | undefined;
    clearListId: number | undefined;
    onMarkerClick: (item: IDispatchMapItem) => void;
}

export const MapWidget = memo(({currentJob, jobs, clearListId, onMarkerClick}: MapWidgetProps) => (
    <Box sx={{height: '100%'}}>
        <DispatchMap
            currentJob={currentJob}
            jobs={jobs}
            clearListId={clearListId}
            onMarkerClick={onMarkerClick}
            showAvailableCouriers
        />
    </Box>
));

// ── Driver Locations Widget ───────────────────────────────────────────

interface DriverLocationsWidgetProps {
    driverLocations: any;
    loading: boolean;
    truckMode: TruckMode;
    activeAreaId: number | undefined;
    onAreaClick: (area: any) => void;
    onCourierClick: (courier: any) => void;
    onClearFilter: () => void;
    isUsCustomer: boolean;
}

export const DriverLocationsWidget = memo(({
                                               driverLocations, loading, truckMode, activeAreaId,
                                               onAreaClick, onCourierClick, onClearFilter, isUsCustomer,
                                           }: DriverLocationsWidgetProps) => {
    const hasData = !!driverLocations && (driverLocations.columns?.length > 0 || driverLocations.areas?.length > 0);
    return (
        <Box sx={styles.widgetContent}>
            <DriverLocations
                driverLocations={driverLocations}
                loading={loading}
                showData={!loading && hasData}
                showNoData={!loading && !hasData}
                truckMode={truckMode}
                activeAreaId={activeAreaId}
                onAreaClick={onAreaClick}
                onCourierClick={onCourierClick}
                onClearFilter={onClearFilter}
                isUsCustomer={isUsCustomer}
            />
        </Box>
    );
});

// ── Driver Locations Toolbar ──────────────────────────────────────────

interface DriverLocationsToolbarProps {
    activeAreaId: number | undefined;
    onClearArea: () => void;
    truckMode: TruckMode;
    onSetTruckMode: (mode: TruckMode) => void;
}

export const DriverLocationsToolbar = memo(({
                                                activeAreaId, onClearArea, truckMode, onSetTruckMode,
                                            }: DriverLocationsToolbarProps) => (
    <>
        {activeAreaId && (
            <Tooltip title="Clear Driver Location Selection" enterDelay={400}>
                <IconButton
                    size="small"
                    onClick={onClearArea}
                    sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                >
                    <Icon sx={styles.toolbarActionIcon} baseClassName="material-symbols-outlined">
                        clear_all
                    </Icon>
                </IconButton>
            </Tooltip>
        )}
        <TruckModeMenu truckMode={truckMode} onSetTruckMode={onSetTruckMode}/>
    </>
));

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

// ── Current Work Widget ───────────────────────────────────────────────

interface CurrentWorkWidgetProps {
    viewMode: 'overview' | 'selectedDriver';
    driverJobsFetchConfig: any;
    drivers: any[];
    loading: boolean;
    selectedCourierId: number | undefined;
    onDriverSelect: (driver: any) => void;
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    onJobSelect: (job: DispatchJob) => void;
    onJobDispatch: (job: DispatchJob, courierId: number) => void;
}

export const CurrentWorkWidget = memo(({
                                           viewMode, driverJobsFetchConfig, drivers, loading,
                                           selectedCourierId, onDriverSelect,
                                           showToast, isUsCustomer, onJobSelect, onJobDispatch,
                                       }: CurrentWorkWidgetProps) => {
    // Selected driver mode — show the driver's job list
    if (viewMode === 'selectedDriver' && driverJobsFetchConfig) {
        return (
            <Box sx={styles.widgetContent}>
                <JobListPanel
                    showToast={showToast}
                    isUsCustomer={isUsCustomer}
                    appPage={1 as AppPage}
                    defaultCategory="in-progress"
                    storagePrefix="currentWorkJobList"
                    fetchConfig={driverJobsFetchConfig}
                    onJobSelect={onJobSelect}
                    onJobDispatch={onJobDispatch}
                />
            </Box>
        );
    }

    // NZ tenants skip the driver overview — show placeholder until a driver
    // is selected (via job selection or courier code search)
    if (!isUsCustomer) {
        return (
            <Box sx={styles.widgetContent}>
                <NoData
                    title="No Driver Selected"
                    message="Select a job to view the assigned driver's current work."
                    icon="local_shipping"
                />
            </Box>
        );
    }

    // US tenants: driver overview grid
    return (
        <Box sx={styles.widgetContent}>
            <CurrentWorkAllDrivers
                drivers={drivers}
                loading={loading}
                selectedCourierId={selectedCourierId}
                onDriverSelect={onDriverSelect}
            />
        </Box>
    );
});

// ── Current Work Toolbar ──────────────────────────────────────────────

interface CurrentWorkToolbarProps {
    viewMode: 'overview' | 'selectedDriver';
    isUsCustomer: boolean;
    onBackToOverview: () => void;
    onTruckLoadingStatus: () => void;
    onCourierFound: (courierId: number, courierName: string) => void;
    showToast: ShowToastFn;
}

export const CurrentWorkToolbar = memo(({
                                            viewMode,
                                            isUsCustomer,
                                            onBackToOverview,
                                            onTruckLoadingStatus,
                                            onCourierFound,
                                            showToast,
                                        }: CurrentWorkToolbarProps) => (
    <>
        {viewMode === 'selectedDriver' && (
            <>
                {/* Back to overview — only for US tenants (NZ has no driver overview) */}
                {isUsCustomer && (
                    <Tooltip title="Back to All Drivers" enterDelay={400}>
                        <IconButton
                            size="small"
                            onClick={onBackToOverview}
                            sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                        >
                            <ArrowBackIcon sx={{fontSize: 18}}/>
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Truck Loading Status" enterDelay={400}>
                    <IconButton
                        size="small"
                        onClick={onTruckLoadingStatus}
                        sx={{color: 'inherit', p: 0.5, borderRadius: 1}}
                    >
                        <LocalShippingIcon sx={{fontSize: 18}}/>
                    </IconButton>
                </Tooltip>
            </>
        )}
        <CourierCodeSearch onCourierFound={onCourierFound} showToast={showToast}/>
    </>
));

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
                if (e.key === 'Enter') return handleSearch();
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

// ── Supports Widget ───────────────────────────────────────────────────

// (SupportTasksPanel is already its own component, used directly)

// ── Supports Toolbar ──────────────────────────────────────────────────

interface SupportsToolbarProps {
    staffList: StaffSuggestion[];
    eventTypeList: EventTypeSuggestion[];
    selectedStaffId: number | undefined;
    selectedEventTypeId: number | undefined;
    onSelectStaff: (id: number | undefined) => void;
    onSelectEventType: (id: number | undefined) => void;
}

export const SupportsToolbar = memo(({
                                         staffList, eventTypeList, selectedStaffId, selectedEventTypeId,
                                         onSelectStaff, onSelectEventType,
                                     }: SupportsToolbarProps) => (
    <>
        <FilterDropdown
            label="Filter by Staff"
            icon={<PersonApronIcon sx={{fontSize: 18}}/>}
            items={staffList}
            selectedId={selectedStaffId}
            onSelect={onSelectStaff}
        />
        <FilterDropdown
            label="Filter by Event Type"
            icon={<CategoryIcon sx={{fontSize: 18}}/>}
            items={eventTypeList}
            selectedId={selectedEventTypeId}
            onSelect={onSelectEventType}
        />
    </>
));

/** Filter dropdown for toolbar */
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
