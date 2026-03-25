/**
 * Dispatch Dashboard Page (React)
 *
 * Main page component that replaces the AngularJS HomeController.
 * Renders a 6-widget resizable/reorderable dashboard using react-grid-layout.
 * Includes the AppShell (toolbar + sidenav) directly in React.
 */

import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material';
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
import {
    openDashboardSettingsDialog
} from '../../components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module';
import {openInterCourierChargeDialog} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import {ConfirmDialog} from './components/ConfirmDialog';
import {CourierSelectionDialog} from './components/CourierSelectionDialog';
import {SaveLayoutDialog} from './components/SaveLayoutDialog';
import {TruckStatusManager} from './components/TruckStatusManager';

// Widget renderers (memoized per-widget components)
import {
    JobsListWidget,
    JobDetailWidget,
    JobDetailToolbarActions,
    MapWidget,
    DriverLocationsWidget,
    DriverLocationsToolbar,
    CurrentWorkWidget,
    CurrentWorkToolbar,
    SupportsToolbar,
} from './components/WidgetRenderers';
import {SupportTasksPanel} from './components/SupportTasksPanel';

// Services
import {getPotentialCouriers} from '../../services/dispatchApi';
import type {IPotentialCourier} from '../../services/dispatchApi';

// Types
import type {DispatchJob, JobCategory} from '../../interfaces/dispatchJob';
import {fetchDispatchJobs, fetchClearListJobs} from '../../services/jobSearchApi';
import {queryKeys} from '../../query/queryClient';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import type {IDispatchMapItem} from '../../../interfaces/job.interface';

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
        overflow: 'hidden',
    },
};

export function DispatchPage({
                                 showToast,
                                 isUsCustomer,
                                 initialJobId,
                                 onNavigate,
                             }: DispatchPageProps) {
    const layout = useDispatchLayout();

    // Measure grid area height to compute dynamic rowHeight
    const gridAreaRef = useRef<HTMLDivElement>(null);
    const [gridAreaHeight, setGridAreaHeight] = useState(0);

    useLayoutEffect(() => {
        const el = gridAreaRef.current;
        if (!el) return;

        const observer = new ResizeObserver(([entry]) => {
            setGridAreaHeight(entry.contentRect.height);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const rowHeight = useMemo(() => {
        if (gridAreaHeight <= 0) return 80; // fallback before measurement
        // Compute max row extent from the layout (e.g. 12 for two rows of h=6)
        const maxRowExtent = layout.rglLayout.reduce(
            (max, item) => Math.max(max, item.y + item.h), 0
        );
        if (maxRowExtent <= 0) return 80;
        // RGL total height = rows * rowHeight + (rows - 1) * marginY + 2 * containerPaddingY
        const marginY = 8;
        const containerPaddingY = 8;
        const fixedSpace = (maxRowExtent - 1) * marginY + 2 * containerPaddingY;
        return Math.floor((gridAreaHeight - fixedSpace) / maxRowExtent);
    }, [gridAreaHeight, layout.rglLayout]);
    const jobSelection = useJobSelection(initialJobId);
    const currentWork = useCurrentWork(isUsCustomer);
    const supportTasksVisible = layout.visibleBoxIds.includes(DispatchBox.Supports);
    const supportTasks = useSupportTasks(jobSelection.currentJobId, supportTasksVisible);
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

    // Dialog refs (state owned by child components)
    const saveLayoutRef = useRef<import('./components/SaveLayoutDialog').SaveLayoutDialogHandle>(null);
    const truckStatusRef = useRef<import('./components/TruckStatusManager').TruckStatusManagerHandle>(null);

    // Potential couriers for unassigned job selection (auto-cancelled via React Query)
    const potentialCouriersJobId = jobSelection.currentJob?.courierData?.courierId
        ? undefined // Skip for already-assigned jobs
        : jobSelection.currentJobId;
    const {data: potentialCouriers = []} = useQuery({
        queryKey: ['potentialCouriers', potentialCouriersJobId],
        queryFn: () => getPotentialCouriers(potentialCouriersJobId!),
        enabled: !!potentialCouriersJobId,
        staleTime: 30_000,
    });

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
        }
    }, [jobSelection.currentJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // FetchConfig for the job list — uses refs to avoid recreating function
    // identities on every view/date change (the functions read current values
    // from refs at call time).
    const fetchContextRef = useRef({
        viewIds: pageViews.selectedViewIds,
        startDate: dateFilter.dateFilterData?.startDate,
        endDate: dateFilter.dateFilterData?.endDate,
        useTime: dateFilter.dateFilterData?.useTime,
        activeAreaId: driverLocations.activeAreaId,
    });
    fetchContextRef.current = {
        viewIds: pageViews.selectedViewIds,
        startDate: dateFilter.dateFilterData?.startDate,
        endDate: dateFilter.dateFilterData?.endDate,
        useTime: dateFilter.dateFilterData?.useTime,
        activeAreaId: driverLocations.activeAreaId,
    };

    // Only recreate fetchConfig when the activeAreaId changes (switches
    // between normal fetch and clear-list fetch), not on every view/date tweak.
    const fetchConfig = useMemo(() => {
        const activeAreaId = driverLocations.activeAreaId;

        if (activeAreaId) {
            return {
                fetchFn: (params: any, options?: any) => {
                    const ctx = fetchContextRef.current;
                    return fetchClearListJobs({
                        ...params,
                        despatchViewIds: ctx.viewIds,
                        startDate: ctx.startDate,
                        endDate: ctx.endDate,
                        useTime: ctx.useTime,
                        selectedClearListId: ctx.activeAreaId,
                        statusFilter: params.statusFilter ?? 'needs-dispatch',
                    }, options);
                },
                queryKeyFn: (params: any) => {
                    const ctx = fetchContextRef.current;
                    return queryKeys.dispatch.clearList({
                        ...params,
                        despatchViewIds: ctx.viewIds,
                        startDate: ctx.startDate,
                        endDate: ctx.endDate,
                        useTime: ctx.useTime,
                        selectedClearListId: ctx.activeAreaId,
                    });
                },
                initialParams: {},
            };
        }

        return {
            fetchFn: (params: any, options?: any) => {
                const ctx = fetchContextRef.current;
                return fetchDispatchJobs({
                    ...params,
                    despatchViewIds: ctx.viewIds,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    useTime: ctx.useTime,
                }, options);
            },
            queryKeyFn: (params: any) => {
                const ctx = fetchContextRef.current;
                return queryKeys.dispatch.jobs({
                    ...params,
                    despatchViewIds: ctx.viewIds,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    useTime: ctx.useTime,
                });
            },
            initialParams: {},
        };
    }, [driverLocations.activeAreaId]); // eslint-disable-line react-hooks/exhaustive-deps

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
            await openInterCourierChargeDialog({showToast});
        } catch (error) {
            if (!error) return; // User cancelled
            console.error('Error opening inter-courier charge dialog:', error);
        }
    }, [showToast]);

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

    // ── Current Work toolbar handlers ─────────────────────────────────

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
    const handleTruckLoadingStatus = useCallback(() => {
        const courierId = currentWork.selectedCourierId;
        if (courierId) truckStatusRef.current?.show(courierId);
    }, [currentWork.selectedCourierId]);

    const handleDriverLocationAreaClick = useCallback((area: any) => {
        driverLocations.setActiveAreaId(area.id);
    }, [driverLocations.setActiveAreaId]);

    const handleDriverLocationClearFilter = useCallback(() => {
        driverLocations.setActiveAreaId(undefined);
    }, [driverLocations.setActiveAreaId]);

    const handleRefreshJobList = useCallback(() => {
        jobSelection.refreshJobListRef.current?.();
    }, [jobSelection.refreshJobListRef]);

    // ── Per-widget toolbar actions (individually memoized) ─────────

    const toolbarActions = useMemo<Partial<Record<DispatchBox, React.ReactNode>>>(() => ({
        [DispatchBox.DriverLocations]: (
            <DriverLocationsToolbar
                activeAreaId={driverLocations.activeAreaId}
                onClearArea={handleDriverLocationClearFilter}
                truckMode={driverLocations.truckMode}
                onSetTruckMode={driverLocations.setTruckMode}
            />
        ),
        [DispatchBox.JobDetail]: (
            <JobDetailToolbarActions
                job={jobSelection.currentJob}
                showToast={showToast}
                tasks={supportTasks.tasks}
                refetchTasks={supportTasks.refetch}
                closeTask={supportTasks.closeTask}
                selectJobById={jobSelection.selectJobById}
                refreshJobList={handleRefreshJobList}
            />
        ),
        [DispatchBox.CurrentWork]: (
            <CurrentWorkToolbar
                viewMode={currentWork.viewMode}
                isUsCustomer={isUsCustomer}
                onBackToOverview={currentWork.backToOverview}
                onTruckLoadingStatus={handleTruckLoadingStatus}
                onCourierFound={handleCourierFound}
                showToast={showToast}
            />
        ),
        [DispatchBox.Supports]: (
            <SupportsToolbar
                staffList={supportTasks.staffList}
                eventTypeList={supportTasks.eventTypeList}
                selectedStaffId={supportTasks.selectedStaffId}
                selectedEventTypeId={supportTasks.selectedEventTypeId}
                onSelectStaff={supportTasks.setStaffId}
                onSelectEventType={supportTasks.setEventTypeId}
            />
        ),
    }), [
        driverLocations.activeAreaId, driverLocations.truckMode, driverLocations.setTruckMode,
        handleDriverLocationClearFilter,
        jobSelection.currentJob, jobSelection.selectJobById, handleRefreshJobList,
        showToast, supportTasks.tasks, supportTasks.refetch, supportTasks.closeTask,
        supportTasks.staffList, supportTasks.eventTypeList,
        supportTasks.selectedStaffId, supportTasks.selectedEventTypeId,
        supportTasks.setStaffId, supportTasks.setEventTypeId,
        currentWork.viewMode, currentWork.backToOverview, isUsCustomer,
        handleTruckLoadingStatus, handleCourierFound,
    ]);

    // ── Per-widget content (individually memoized to isolate re-renders) ─

    const handleSupportTaskClick = useCallback(
        (task: any) => jobSelection.selectJobById(task.jobId),
        [jobSelection.selectJobById],
    );

    const widgetJobsList = useMemo(() => (
        <JobsListWidget
            showToast={showToast}
            isUsCustomer={isUsCustomer}
            fetchConfig={fetchConfig}
            defaultCategory={jobListDefaultCategory}
            onJobSelect={handleJobSelect}
            onJobDispatch={handleJobDispatch}
            refreshJobListRef={jobSelection.refreshJobListRef}
            selectJobInListRef={jobSelection.selectJobInListRef}
            views={pageViews.views}
            onToggleView={pageViews.toggleView}
            onClearViews={pageViews.clearAll}
        />
    ), [showToast, isUsCustomer, fetchConfig, jobListDefaultCategory, handleJobSelect, handleJobDispatch, jobSelection.refreshJobListRef, jobSelection.selectJobInListRef, pageViews.views, pageViews.toggleView, pageViews.clearAll]);

    const widgetJobDetail = useMemo(() => (
        <JobDetailWidget config={jobDetailsConfig} />
    ), [jobDetailsConfig]);

    const widgetMap = useMemo(() => (
        <MapWidget
            currentJob={currentMapJob}
            jobs={mapJobs}
            clearListId={driverLocations.activeAreaId}
            onMarkerClick={handleMapMarkerClick}
        />
    ), [currentMapJob, mapJobs, driverLocations.activeAreaId, handleMapMarkerClick]);

    const widgetDriverLocations = useMemo(() => (
        <DriverLocationsWidget
            driverLocations={driverLocations.driverLocations}
            loading={driverLocations.loading}
            truckMode={driverLocations.truckMode}
            activeAreaId={driverLocations.activeAreaId}
            onAreaClick={handleDriverLocationAreaClick}
            onCourierClick={handleDriverLocationCourierClick}
            onClearFilter={handleDriverLocationClearFilter}
            isUsCustomer={isUsCustomer}
        />
    ), [driverLocations.driverLocations, driverLocations.loading, driverLocations.truckMode, driverLocations.activeAreaId, handleDriverLocationAreaClick, handleDriverLocationCourierClick, handleDriverLocationClearFilter, isUsCustomer]);

    const widgetCurrentWork = useMemo(() => (
        <CurrentWorkWidget
            viewMode={currentWork.viewMode}
            driverJobsFetchConfig={currentWork.driverJobsFetchConfig}
            drivers={currentWork.drivers}
            loading={currentWork.loading}
            selectedCourierId={currentWork.selectedCourierId}
            onDriverSelect={currentWork.selectDriver}
            showToast={showToast}
            isUsCustomer={isUsCustomer}
            onJobSelect={handleJobSelect}
            onJobDispatch={handleJobDispatch}
        />
    ), [currentWork.viewMode, currentWork.driverJobsFetchConfig, currentWork.drivers, currentWork.loading, currentWork.selectedCourierId, currentWork.selectDriver, showToast, isUsCustomer, handleJobSelect, handleJobDispatch]);

    const widgetSupports = useMemo(() => (
        <SupportTasksPanel
            tasks={supportTasks.tasks}
            loading={supportTasks.loading}
            jobId={jobSelection.currentJobId}
            onTaskUpdated={supportTasks.refetch}
            onTaskClick={handleSupportTaskClick}
            showToast={showToast}
        />
    ), [supportTasks.tasks, supportTasks.loading, jobSelection.currentJobId, supportTasks.refetch, handleSupportTaskClick, showToast]);

    const widgets = useMemo<Partial<Record<DispatchBox, React.ReactNode>>>(() => ({
        [DispatchBox.JobsList]: widgetJobsList,
        [DispatchBox.JobDetail]: widgetJobDetail,
        [DispatchBox.Map]: widgetMap,
        [DispatchBox.DriverLocations]: widgetDriverLocations,
        [DispatchBox.CurrentWork]: widgetCurrentWork,
        [DispatchBox.Supports]: widgetSupports,
    }), [widgetJobsList, widgetJobDetail, widgetMap, widgetDriverLocations, widgetCurrentWork, widgetSupports]);

    const subtitles = useMemo<Partial<Record<DispatchBox, string | undefined>>>(() => ({
        [DispatchBox.JobDetail]: jobSelection.currentSelection,
        [DispatchBox.CurrentWork]: currentWork.currentWorkSelection,
    }), [jobSelection.currentSelection, currentWork.currentWorkSelection]);

    const firstName = window.FirstName || 'User';
    const fullName = window.FullName || 'User';
    const timeZone = window.TimeZone || 'New Zealand Standard Time';

    return (
        <>
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
                        onClick={messaging.openMessages}
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
                        onSaveLayout={() => saveLayoutRef.current?.open()}
                        onLoadLayout={layout.loadLayout}
                        onDeleteLayout={layout.deleteLayout}
                    />

                    {/* Settings */}
                    <SettingsButton onClick={handleOpenSettings}/>
                </AppShell>

                <Box ref={gridAreaRef} sx={styles.gridArea}>
                    <DashboardGrid
                        layout={layout.rglLayout}
                        onLayoutChange={layout.onLayoutChange}
                        cols={layout.cols}
                        rowHeight={rowHeight}
                        isDefaultLayout={layout.isDefaultLayout}
                        visibleBoxIds={layout.visibleBoxIds}
                        widgets={widgets}
                        toolbarActions={toolbarActions}
                        subtitles={subtitles}
                        onRefresh={refreshBox}
                    />
                </Box>
            </Box>

            {/* Save Layout Dialog */}
            <SaveLayoutDialog ref={saveLayoutRef} onSave={layout.saveLayoutAs} />

            {/* Truck Loading Status Dialog */}
            <TruckStatusManager ref={truckStatusRef} isUsCustomer={isUsCustomer} showToast={showToast} />

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
        </>
    );
}
