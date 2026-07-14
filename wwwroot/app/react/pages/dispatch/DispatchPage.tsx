import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import {useDismissibleBanner} from '../../hooks/useDismissibleBanner';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {AppPage} from '../../interfaces/dispatchJob';
import type {DispatchJob} from '../../interfaces/dispatchJob';
import {IDispatchMapItem, ISuggestion} from '../../../interfaces/job.interface';
import type {ShowToastFn} from '../../services/toastService';
import {fetchDispatchJobs, fetchClearListJobs, fetchCurrentWorkJobs} from '../../services/jobSearchApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import {
    allocateJobs,
    reAllocateJobs,
    sendToPartner,
    setJobLocked,
    getActivePartnerOptions,
    getPartnerRateForJob,
} from '../../services/jobListApi';
import {getDispatchJobDetail} from '../../services/dispatchExecutorApi';
import {openAddEventDialog} from '../../components/dialogs/add-event-dialog';
import {JobListPanel} from '../../components/job-list/JobListPanel';
import {DispatchDialog} from '../../components/dialogs/dispatch-dialog';
import {openInterCourierChargeDialog} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';
import {DispatchJobActionsMenu, DispatchJobActionId} from './components/DispatchJobActionsMenu';
import {JobSearchShell} from '../job-search/components/JobSearchShell';
import {useBoxLayout} from '../job-search/hooks/useBoxLayout';
import type {ImportLayoutsResult, LayoutStorageKeys} from '../job-search/lib/layoutPersistence';
import {SaveLayoutDialog} from '../../components/dialogs/save-layout-dialog/SaveLayoutDialog';
import {DeleteLayoutDialog} from '../../components/dialogs/delete-layout-dialog/DeleteLayoutDialog';
import DispatchBoxes from '../../../components/home/enums/DispatchBoxes';
import {createDefaultDispatchLayout, createDispatchBoxes} from './lib/boxDefinitions';
import {computeMapJobs, selectedCourierId} from './lib/mapJobs';
import {computeMapView} from './lib/mapView';
import {getDefaultMapCenter} from '../../components/common/here-map/HereMap.types';
import {executeAddStopFlow} from './lib/addStopFlow';
import {
    DispatchFilters,
    loadDispatchFilters,
    loadSelectedViews,
    filtersKey,
    DispatchRefreshIntervals,
    loadRefreshIntervals,
} from './lib/dispatchFilters';
import {CurrentWorkBox} from './components/CurrentWorkBox';
import {SupportsBox} from './components/SupportsBox';
import {DriverLocationsBox} from './components/DriverLocationsBox';
import {TruckModeMenu} from './components/TruckModeMenu';
import type {TruckMode} from '../../components/common/driver-locations/DriverLocations.types';

export interface DispatchLayoutBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Opens the MUI "Save Layout" dialog and resolves with the entered name (or null if cancelled). */
    promptSaveLayout: () => Promise<string | null>;
    /** Opens the MUI "Delete Layout" confirmation and resolves true if confirmed. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    /** Opens the MUI "Rename Layout" dialog and resolves with the new name (or null if cancelled). */
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
    /** Push new toolbar filters (selected views + date range) into the page. */
    updateFilters: (filters: Partial<DispatchFilters>) => void;
    /** Push new auto-refresh intervals (from the settings dialog) into the page. */
    updateRefreshIntervals: (intervals: Partial<DispatchRefreshIntervals>) => void;
    /** Set layout edit mode (driven by the toolbar's Layouts → Edit layout toggle). */
    setEditMode: (enabled: boolean) => void;
    /** Open the Inter-Courier Charge dialog, wired to the page's toast. */
    openInterCourierCharge: () => void;
    /** A job was just created — refresh the list and select it. */
    jobCreated: (jobId: number) => void;
    /** Copy the user's V1 layouts into this page's (V2) layout store. */
    importLegacyLayouts: () => ImportLayoutsResult;
}

export interface DispatchPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    timeZone: string;
    timeZoneShort?: string;
    deepLinkJobId?: number;
    /** Called once with imperative handles for the AppShell toolbar to drive layout selection. */
    onLayoutBridgeReady?: (bridge: DispatchLayoutBridge) => void;
    /** Leave edit mode (in-shell "Done editing" button). Routes back through the toolbar. */
    onExitEditMode?: () => void;
}

// Adapter for the existing React job-details mount API. Keeps the existing
// module boundary (window.ReactJobDetails) so the dispatch detail box reuses
// the same job-details bundle the rest of the app already loads.
const ReactJobDetailsMount: React.FC<{
    jobId: number;
    isUsCustomer: boolean;
    showToast: ShowToastFn;
    /** Navigate to a related job picked inside the detail panel (V1 jobChanged). */
    onRelatedJobChange?: (jobId: number) => void;
    /** Detail edited a job — refresh the dispatch list. */
    onJobUpdate?: () => void;
}> = ({jobId, isUsCustomer, showToast, onRelatedJobChange, onJobUpdate}) => {
    const containerId = 'react-dispatch-job-detail';
    useEffect(() => {
        const w = window as any;
        if (!w.ReactJobDetails?.mount) return;
        w.ReactJobDetails.mount(containerId, {
            jobId,
            isBulkJob: false,
            isUsCustomer,
            showToast,
            onRelatedJobChange,
            onJobUpdate,
        });
        return () => {
            w.ReactJobDetails?.unmount?.();
        };
    }, [jobId, isUsCustomer, showToast, onRelatedJobChange, onJobUpdate]);
    return <div id={containerId} style={{height: '100%', overflow: 'auto'}} />;
};

export const DispatchPage: React.FC<DispatchPageProps> = ({
    showToast,
    isUsCustomer,
    timeZone,
    deepLinkJobId,
    onLayoutBridgeReady,
    onExitEditMode,
}) => {
    void timeZone;

    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutV2-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutV2-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${LegacyAppPage.Dispatch}-${ContactID}`,
    }), []);

    // Legacy (V1) storage keys — the source for "Import V1 layouts".
    const legacyStorageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layout-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayout-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibility-${LegacyAppPage.Dispatch}-${ContactID}`,
    }), []);

    const boxLayout = useBoxLayout({
        storageKeys,
        legacyStorageKeys,
        createBoxes: createDispatchBoxes,
        createDefaultLayout: createDefaultDispatchLayout,
        page: 'Dispatch',
    });

    const [currentJob, setCurrentJob] = useState<DispatchJob | undefined>();
    const [currentJobId, setCurrentJobId] = useState<number | undefined>(deepLinkJobId);
    // Clear-list area selected in the Driver Locations box; filters the Map box.
    const [clearListId, setClearListId] = useState<number | undefined>();
    // Truck-mode filter for Driver Locations; the control lives in that box's
    // panel header (see boxRightSlotFor), so the state is lifted here.
    const [truckMode, setTruckMode] = useState<TruckMode>('On');
    // Layout edit mode: reveals drag handles / collapse / resize on the boxes.
    // Off by default for a clean, locked view (best-practice Edit/Done toggle).
    const [editMode, setEditMode] = useState(false);
    const betaBanner = useDismissibleBanner(`dispatchBetaBannerDismissed-${ContactID}`);

    // Toolbar filters (selected views + date range). Seeded from localStorage so
    // the list/driver-locations honour the dispatcher's persisted selection on
    // mount; the AngularJS toolbar pushes runtime changes via the bridge.
    const [filters, setFilters] = useState<DispatchFilters>(() => loadDispatchFilters());
    const applyFilters = useCallback((next: Partial<DispatchFilters>) => {
        setFilters(prev => ({...prev, ...next}));
    }, []);

    // Auto-refresh intervals (ms; false = off), seeded from localStorage and
    // updated from the settings dialog via the bridge. Applied as React Query
    // refetchInterval on the job list, current work and driver locations.
    const [refreshIntervals, setRefreshIntervals] = useState<DispatchRefreshIntervals>(() => loadRefreshIntervals());
    const applyRefreshIntervals = useCallback((next: Partial<DispatchRefreshIntervals>) => {
        setRefreshIntervals(prev => ({...prev, ...next}));
    }, []);

    // Highlight-sync callback captured from the job list (V1 ReactJobList.selectJob)
    // so selecting a job from the map or supports highlights the matching row.
    const selectInListRef = useRef<((jobId: number) => void) | null>(null);

    const selectJob = useCallback((job: DispatchJob) => {
        setCurrentJob(job);
        setCurrentJobId(job.id);
        selectInListRef.current?.(job.id);
    }, []);

    // Jobs currently loaded in the list — fed to the map as markers and used to
    // resolve a clicked marker / support task back to its job.
    const loadedJobsRef = useRef<DispatchJob[]>([]);
    const [mapJobs, setMapJobs] = useState<DispatchJob[]>([]);
    const handleJobsLoaded = useCallback((jobs: DispatchJob[]) => {
        loadedJobsRef.current = jobs;
        setMapJobs(jobs);
    }, []);

    const openInterCourierCharge = useCallback(() => {
        void openInterCourierChargeDialog({showToast});
    }, [showToast]);

    // Select a job by id: resolve against the loaded list, else fetch its detail.
    // Mirrors V1 selectJobFromMap / selectSupportJobDetail.
    const selectJobById = useCallback(async (jobId: number) => {
        if (!jobId) return;
        const found = loadedJobsRef.current.find(j => j.id === jobId);
        if (found) {
            selectJob(found);
            return;
        }
        try {
            const job = await getDispatchJobDetail(jobId);
            if (job) selectJob(job as unknown as DispatchJob);
        } catch (err) {
            console.error('[DispatchPage] failed to load job detail:', err);
            showToast('Error loading job details', 'error');
        }
    }, [selectJob, showToast]);

    const handleMarkerClick = useCallback((item: IDispatchMapItem) => {
        if (item?.jobId) void selectJobById(item.jobId);
    }, [selectJobById]);

    // A new job was created from the toolbar — refresh the list and select it.
    const jobCreated = useCallback((jobId: number) => {
        void queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all});
        void selectJobById(jobId);
    }, [selectJobById]);

    const toMapItem = useCallback((job: DispatchJob): IDispatchMapItem => ({
        jobId: job.id,
        jobNo: job.jobNo,
        pickupAddress: job.pickupAddress,
        deliveryAddress: job.deliveryAddress,
        assignedCourier: job.assignedCourier,
        statusId: job.statusId,
    }), []);

    // When the selected job is already dispatched, the map shows that courier's
    // whole route (V1 selectJob → getCurrentJobs). Reuses the current-work query
    // key so it shares cache with the Current Work box.
    const mapCourierId = selectedCourierId(currentJob);
    const mapCourierParams = useMemo(() => ({
        courierId: mapCourierId,
        startDate: dayjs().startOf('day'),
        endDate: dayjs().endOf('day'),
        page: 0,
        pageSize: 50,
    }), [mapCourierId]);
    const {data: mapCourierWork} = useQuery({
        queryKey: queryKeys.dispatch.currentWork(mapCourierParams),
        queryFn: ({signal}) => fetchCurrentWorkJobs(mapCourierParams, {signal}),
        enabled: !!mapCourierId,
    });

    // Map centre/zoom follows the selected despatch view(s) (V1
    // updateMapForSelectedViews); the toolbar writes the full view objects to
    // localStorage before pushing new ids, so re-reading on an id change is fresh.
    const mapView = useMemo(
        () => computeMapView(loadSelectedViews(), getDefaultMapCenter()),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-derive when the view selection changes
        [filters.despatchViewIds],
    );

    // ── Save / delete layout dialogs, driven imperatively by the toolbar ──
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const saveLayoutResolverRef = useRef<((name: string | null) => void) | null>(null);

    const promptSaveLayout = useCallback((): Promise<string | null> => {
        return new Promise<string | null>(resolve => {
            saveLayoutResolverRef.current = resolve;
            setSaveDialogOpen(true);
        });
    }, []);

    const resolveSaveLayout = useCallback((name: string | null) => {
        setSaveDialogOpen(false);
        saveLayoutResolverRef.current?.(name);
        saveLayoutResolverRef.current = null;
    }, []);

    const [deleteDialogName, setDeleteDialogName] = useState<string | null>(null);
    const deleteLayoutResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

    const promptDeleteLayout = useCallback((layoutName: string): Promise<boolean> => {
        return new Promise<boolean>(resolve => {
            deleteLayoutResolverRef.current = resolve;
            setDeleteDialogName(layoutName);
        });
    }, []);

    const resolveDeleteLayout = useCallback((confirmed: boolean) => {
        setDeleteDialogName(null);
        deleteLayoutResolverRef.current?.(confirmed);
        deleteLayoutResolverRef.current = null;
    }, []);

    const [renameDialogName, setRenameDialogName] = useState<string | null>(null);
    const renameLayoutResolverRef = useRef<((name: string | null) => void) | null>(null);

    const promptRenameLayout = useCallback((layoutName: string): Promise<string | null> => {
        return new Promise<string | null>(resolve => {
            renameLayoutResolverRef.current = resolve;
            setRenameDialogName(layoutName);
        });
    }, []);

    const resolveRenameLayout = useCallback((name: string | null) => {
        setRenameDialogName(null);
        renameLayoutResolverRef.current?.(name);
        renameLayoutResolverRef.current = null;
    }, []);

    useEffect(() => {
        onLayoutBridgeReady?.({
            setCurrentLayoutName: boxLayout.setCurrentLayoutName,
            reloadFromStorage: boxLayout.reloadFromStorage,
            promptSaveLayout,
            promptDeleteLayout,
            promptRenameLayout,
            updateFilters: applyFilters,
            updateRefreshIntervals: applyRefreshIntervals,
            setEditMode,
            openInterCourierCharge,
            jobCreated,
            importLegacyLayouts: boxLayout.importLegacyLayouts,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, boxLayout.importLegacyLayouts, promptSaveLayout, promptDeleteLayout, promptRenameLayout, applyFilters, applyRefreshIntervals, openInterCourierCharge, jobCreated]);

    const fetchConfigMain = useMemo(() => {
        const baseParams = {
            startDate: filters.startDate,
            endDate: filters.endDate,
            useTime: filters.useTime,
            despatchViewIds: filters.despatchViewIds,
            isInternal: window.ClientInternal ?? false,
            page: 0,
            pageSize: 50,
        };
        // When a driver-location area is active, scope the list to that clear
        // list (V1 getJobList → selectedClearListId via the clear-list endpoint).
        if (clearListId) {
            return {
                fetchFn: fetchClearListJobs,
                queryKeyFn: (params: any) => queryKeys.dispatch.clearList(params),
                initialParams: {...baseParams, selectedClearListId: clearListId},
                refetchInterval: refreshIntervals.jobsMs,
            };
        }
        return {
            fetchFn: fetchDispatchJobs,
            queryKeyFn: (params: any) => queryKeys.dispatch.jobs(params),
            initialParams: baseParams,
            refetchInterval: refreshIntervals.jobsMs,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, refreshIntervals.jobsMs, clearListId]);

    const handleRefreshBox = useCallback((boxName: string) => {
        // Each box refetches via React Query (or the job-details bridge). The
        // job list, current work and driver locations all live under the
        // 'dispatch' query key, so invalidating it refreshes them together.
        if (boxName === DispatchBoxes.JobDetail) {
            (window as any).ReactJobDetails?.refresh?.();
            return;
        }
        if (boxName === DispatchBoxes.Supports) {
            void queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
            return;
        }
        void queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all});
    }, []);

    // ── Dispatch the selected job (Detail box) ────────────────────────
    // Reuses the universal DispatchDialog (the same one JobListPanel's context
    // menu uses). Courier path allocates, or re-allocates when a courier is
    // already assigned; partner path sends to a DFRNT partner. Mirrors
    // JobSearchPage's FAB dispatch handlers.
    const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);

    const invalidateAfterDispatch = useCallback(async (job: DispatchJob) => {
        await queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all});
        await queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(job.id, job.isBulkJob ? 'bulk' : 'standard'),
        });
    }, []);

    const handleDispatchCourier = useCallback(async (
        type: 'Courier' | 'Agent' | 'NP',
        destination: ISuggestion,
    ) => {
        if (!currentJob) return;
        if (type !== 'Courier') {
            throw new Error(`${type} dispatch isn't wired from the dispatch page yet — use the job-list context menu.`);
        }
        if (currentJob.assignedCourier?.id) {
            await reAllocateJobs(destination.id, [currentJob.id]);
        } else {
            await allocateJobs(destination.id, [currentJob.id]);
        }
        showToast(`Job ${currentJob.jobNo} dispatched to ${destination.text}`, 'success');
        await invalidateAfterDispatch(currentJob);
        setDispatchDialogOpen(false);
    }, [currentJob, showToast, invalidateAfterDispatch]);

    const handleSendToPartner = useCallback(async (partner: ISuggestion, agreedRate: number) => {
        if (!currentJob) return;
        const result = await sendToPartner(currentJob.id, partner.id, agreedRate);
        if (!result.success) {
            throw new Error(result.message || 'Failed to send job to partner');
        }
        setDispatchDialogOpen(false);
        showToast(`Job ${currentJob.jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`, 'success');
        await invalidateAfterDispatch(currentJob);
    }, [currentJob, showToast, invalidateAfterDispatch]);

    // ── Job-detail FAB actions ────────────────────────────────────────
    // Mirrors home.controller.ts FAB handlers, reusing the existing React
    // dialogs (window globals preloaded by the dispatchV2 route) and APIs.
    const fabAction = useCallback(async (actionId: DispatchJobActionId, job: DispatchJob) => {
        const w = window as any;
        const refreshDetail = () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.jobs.detail(job.id, job.isBulkJob ? 'bulk' : 'standard'),
            });
            w.ReactJobDetails?.refresh?.();
        };
        const refreshLists = () => queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all});

        try {
            switch (actionId) {
                case 'dispatch':
                    setDispatchDialogOpen(true);
                    return;

                case 'addStop': {
                    const newJobId = await executeAddStopFlow({job, isUsCustomer, showToast});
                    if (newJobId) {
                        showToast(`Stop added to ${job.jobNo}`, 'success');
                        jobCreated(newJobId);
                    }
                    return;
                }

                case 'accessorialCharges':
                    if (!job.accessorialChargeGroupId) return;
                    await w.ReactAccessorialChargesDialog?.open({
                        job: {
                            id: job.id,
                            accessorialChargeGroupId: job.accessorialChargeGroupId,
                            amount: job.amount,
                            weight: job.weight,
                            quantity: job.quantity,
                        },
                        toastService: {showToast},
                    });
                    refreshDetail();
                    return;

                case 'attachments':
                    await w.ReactJobFileUploadDialog?.open(job.id);
                    refreshDetail();
                    return;

                case 'addTask':
                    await openAddEventDialog({
                        job: {id: job.id, jobNo: job.jobNo, client: job.client ?? '', clientId: job.clientId},
                        toastService: {showToast},
                    });
                    return;

                case 'lock':
                case 'unlock': {
                    const locked = actionId === 'lock';
                    await setJobLocked(job.id, locked, !!job.preBook);
                    showToast(`${job.jobNo} ${locked ? 'locked' : 'unlocked'}.`, 'success');
                    await refreshLists();
                    refreshDetail();
                    return;
                }

                case 'split': {
                    const {executeSplitJobFlow} = await import('../../services/splitJobFlow');
                    await executeSplitJobFlow({
                        job: job as any,
                        showToast,
                        onComplete: () => {
                            void refreshLists();
                            refreshDetail();
                        },
                    });
                    return;
                }

                case 'swapPod':
                    await w.ReactSwapPodsDialog?.open(job.jobNo, {showToast});
                    await refreshLists();
                    refreshDetail();
                    return;

                default:
                    showToast(`Unknown FAB action: ${actionId}`, 'warning');
            }
        } catch (error) {
            console.error(`[DispatchPage] FAB action "${actionId}" failed:`, error);
            showToast(`Failed to ${actionId}: ${error instanceof Error ? error.message : 'unknown error'}`, 'error');
        }
    }, [showToast, isUsCustomer, jobCreated]);

    const renderBoxContent = useCallback((boxName: string, headerSlot?: HTMLElement | null): React.ReactNode => {
        switch (boxName) {
            case DispatchBoxes.JobsList:
                return (
                    <JobListPanel
                        // Remount when filters or the clear-list scope change so fetchConfig re-seeds.
                        key={`${filtersKey(filters)}|${clearListId ?? ''}`}
                        showToast={showToast}
                        isUsCustomer={isUsCustomer}
                        appPage={AppPage.Dispatch}
                        storagePrefix="dispatchJobList"
                        fetchConfig={fetchConfigMain as any}
                        onJobSelect={selectJob}
                        onJobsLoaded={handleJobsLoaded}
                        setSelectJobCallback={(cb) => { selectInListRef.current = cb; }}
                        headerSlot={headerSlot}
                    />
                );

            case DispatchBoxes.JobDetail:
                if (!currentJobId) {
                    return (
                        <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>
                            Select a job from the list to see its details.
                        </Box>
                    );
                }
                return (
                    <ReactJobDetailsMount
                        jobId={currentJobId}
                        isUsCustomer={isUsCustomer}
                        showToast={showToast}
                        onRelatedJobChange={(jobId) => void selectJobById(jobId)}
                        onJobUpdate={() => queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all})}
                    />
                );

            case DispatchBoxes.Map: {
                // Match V1 mapJobList: all loaded jobs when nothing is selected,
                // just the selected job when it has no courier, or the assigned
                // courier's undispatched route when it does. The selected job is
                // highlighted; auto-zoom-to-markers is handled by DispatchMap.
                const items = computeMapJobs({
                    currentJob,
                    allJobs: mapJobs,
                    courierJobs: mapCourierWork?.jobs,
                }).map(toMapItem);
                const currentItem = currentJob ? toMapItem(currentJob) : undefined;
                if (currentItem && !items.some(i => i.jobId === currentItem.jobId)) {
                    items.push(currentItem);
                }
                return (
                    <Box sx={{height: '100%', minHeight: 0}}>
                        <DispatchMap
                            jobs={items}
                            currentJob={currentItem}
                            mapCenter={mapView.center}
                            mapZoom={mapView.zoom}
                            onMarkerClick={handleMarkerClick}
                            clearListId={clearListId}
                            showAvailableCouriers
                            preferenceScope={LegacyAppPage.Dispatch}
                        />
                    </Box>
                );
            }

            case DispatchBoxes.CurrentWork:
                return (
                    <CurrentWorkBox
                        isUsCustomer={isUsCustomer}
                        showToast={showToast}
                        refetchIntervalMs={refreshIntervals.jobsMs}
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        selectedJobCourierId={currentJob?.courierData?.courierId}
                        selectedJobCourierName={
                            currentJob?.courierData?.courierName
                            ?? currentJob?.assignedCourier?.text
                        }
                        onJobSelect={selectJob}
                        headerSlot={headerSlot}
                    />
                );

            case DispatchBoxes.Supports:
                return (
                    <SupportsBox
                        jobId={currentJobId}
                        showToast={showToast}
                        refetchIntervalMs={refreshIntervals.jobsMs}
                        onSelectJob={(jobId) => void selectJobById(jobId)}
                        headerSlot={headerSlot}
                    />
                );

            case DispatchBoxes.DriverLocations:
                return (
                    <DriverLocationsBox
                        isUsCustomer={isUsCustomer}
                        despatchViewIds={filters.despatchViewIds}
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        refetchIntervalMs={refreshIntervals.driverLocationsMs}
                        activeAreaId={clearListId}
                        onAreaSelect={setClearListId}
                        onClearArea={() => setClearListId(undefined)}
                        truckMode={truckMode}
                    />
                );

            default:
                return null;
        }
    }, [showToast, isUsCustomer, fetchConfigMain, selectJob, selectJobById, currentJobId, currentJob, clearListId, filters, refreshIntervals, mapJobs, mapCourierWork, mapView, handleJobsLoaded, handleMarkerClick, toMapItem, truckMode]);

    const subtitleFor = useCallback((boxName: string) => {
        if (boxName === DispatchBoxes.JobDetail) {
            return currentJob?.jobNo;
        }
        return undefined;
    }, [currentJob]);

    // Header controls that are driven from DispatchPage state (vs. a box's own
    // local state, which boxes portal into the header themselves): Driver
    // Locations' truck-mode filter and the Job Detail action (kebab) menu.
    const boxRightSlotFor = useCallback((boxName: string): React.ReactNode => {
        if (boxName === DispatchBoxes.DriverLocations) {
            return <TruckModeMenu value={truckMode} onChange={setTruckMode} />;
        }
        if (boxName === DispatchBoxes.JobDetail) {
            return <DispatchJobActionsMenu currentJob={currentJob} onAction={fabAction} />;
        }
        return undefined;
    }, [truckMode, currentJob, fabAction]);

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0}}>
            {/* BETA banner — dismissible; the opt-out toggle lives in Settings. */}
            {!betaBanner.dismissed && (
                <Box
                    sx={(theme) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 2,
                        py: 0.75,
                        bgcolor: theme.palette.primary.main,
                        color: 'primary.contrastText',
                    })}
                >
                    <Chip
                        label="BETA"
                        size="small"
                        sx={{
                            height: 18,
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: '#fff',
                        }}
                    />
                    <Typography variant="body2" sx={{flex: 1}}>
                        You&apos;re on the rebuilt Dispatch page. Spot something off? Open Settings and turn the toggle off to switch back.
                    </Typography>
                    <IconButton
                        size="small"
                        aria-label="Dismiss beta notice"
                        onClick={betaBanner.dismiss}
                        sx={{color: '#fff', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            )}
            <Box sx={{flex: 1, minHeight: 0, position: 'relative'}}>
                <JobSearchShell
                    layout={boxLayout.layout}
                    layoutVersion={boxLayout.layoutVersion}
                    boxes={boxLayout.boxes}
                    isDefaultLayout={boxLayout.isDefaultLayout}
                    renderBoxContent={renderBoxContent}
                    onRefreshBox={handleRefreshBox}
                    onToggleCollapse={boxLayout.toggleBoxCollapse}
                    boxSubtitle={subtitleFor}
                    boxRightSlot={boxRightSlotFor}
                    onColumnSizes={boxLayout.setColumnSizes}
                    onBoxHeights={boxLayout.setBoxHeights}
                    onMoveBox={boxLayout.moveBox}
                    onAddColumn={boxLayout.addColumn}
                    onRemoveColumn={boxLayout.removeColumn}
                    editMode={editMode}
                    onExitEditMode={onExitEditMode}
                />
            </Box>
            <SaveLayoutDialog
                open={saveDialogOpen}
                existingNames={boxLayout.layouts.map(l => l.name)}
                onClose={() => resolveSaveLayout(null)}
                onConfirm={name => resolveSaveLayout(name)}
            />
            <SaveLayoutDialog
                open={renameDialogName !== null}
                initialName={renameDialogName ?? ''}
                title="Rename Layout"
                subtitle="Give this layout a new name"
                confirmLabel="Rename"
                existingNames={boxLayout.layouts.map(l => l.name).filter(n => n !== renameDialogName)}
                onClose={() => resolveRenameLayout(null)}
                onConfirm={name => resolveRenameLayout(name)}
            />
            <DeleteLayoutDialog
                open={deleteDialogName !== null}
                layoutName={deleteDialogName ?? ''}
                onClose={() => resolveDeleteLayout(false)}
                onConfirm={() => resolveDeleteLayout(true)}
            />
            {currentJob && (
                <DispatchDialog
                    open={dispatchDialogOpen}
                    mode={{
                        kind: 'single',
                        jobId: currentJob.id,
                        jobNo: currentJob.jobNo,
                        flags: {
                            isArchived: Boolean(currentJob.isArchived),
                            isBulkJob: Boolean(currentJob.isBulkJob),
                            preBook: Boolean(currentJob.preBook),
                        },
                    }}
                    existingDestination={currentJob.assignedCourier}
                    onClose={() => setDispatchDialogOpen(false)}
                    onDispatchCourier={handleDispatchCourier}
                    onSendToPartner={handleSendToPartner}
                    fetchRate={getPartnerRateForJob}
                    getPartnerOptions={getActivePartnerOptions}
                />
            )}
        </Box>
    );
};
