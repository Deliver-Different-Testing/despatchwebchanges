import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {Box, Stack} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {Briefcase} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';

/**
 * A driver-location area scopes the job list to its clear list, and V1 forced the
 * category to Unassigned when the area was clicked (`selectAndActivateArea`).
 */
const CLEAR_LIST_CATEGORY = 'needs-dispatch' as const;

import {NoData} from '../../components/common/no-data/NoData';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {AppPage} from '../../interfaces/dispatchJob';
import type {DispatchJob, JobListSearchParams} from '../../interfaces/dispatchJob';
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
import {JobDetailsMount} from '../../components/common/job-details/JobDetailsMount';
import {loadJobListCategory, toStatusFilter} from '../../components/job-list/jobListPreferences';
import {DispatchDialog, type DispatchConfirmation} from '../../components/dialogs/dispatch-dialog';
import {
    isNetworkPartnerSession,
    stopJobCountFor,
} from '../../components/dialogs/dispatch-dialog/dispatchSession';
import {executeDispatchConfirmation} from '../../components/dialogs/dispatch-dialog/executeDispatch';
import {openInterCourierChargeDialog} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';
import {DispatchJobActionsMenu, DispatchJobActionId} from './components/DispatchJobActionsMenu';
import {BoxShell} from '../../components/common/box-shell/BoxShell';
import {useBoxLayout} from '../../components/common/box-shell/useBoxLayout';
import type {ImportLayoutsResult, LayoutStorageKeys} from '../../components/common/box-shell/layoutPersistence';
import {LayoutPromptDialogs} from '../../components/layout-prompts/LayoutPromptDialogs';
import {useLayoutPrompts} from '../../components/layout-prompts/useLayoutPrompts';
import DispatchBoxes from './lib/dispatchBoxes';
import {createDefaultDispatchLayout, createDispatchBoxes} from './lib/boxDefinitions';
import {computeMapJobs, selectedCourierId} from './lib/mapJobs';
import {computeMapView} from './lib/mapView';
import {getDefaultMapCenter, getNetworkPartnerMapCenter} from '../../components/common/here-map/HereMap.types';
import {executeAddStopFlow} from './lib/addStopFlow';
import {
    DispatchFilters,
    loadDispatchFilters,
    loadSelectedViewIds,
    loadSelectedViews,
    hasStoredViewSelection,
    persistSelectedViews,
    resolveInitialViewSelection,
    DispatchRefreshIntervals,
    loadRefreshIntervals,
} from './lib/dispatchFilters';
import {useDispatchViews} from './hooks/useDispatchViews';
import {ViewsRail} from './components/ViewsRail';
import type {DfrntPageViewModel} from '../../../interfaces/dfrnt-page-view-model.interface';
import {CurrentWorkBox} from './components/CurrentWorkBox';
import {TasksBox} from '../../components/common/tasks-box/TasksBox';
import {DriverLocationsBox} from './components/DriverLocationsBox';
import {OverviewDeliveriesBox} from './components/OverviewDeliveriesBox';
import {OpenJobsBox} from './components/OpenJobsBox';
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
    /**
     * Subscribe the host's Views menu to the page's view list + selection.
     * Fires immediately with the current state and on every change; returns an
     * unsubscribe function.
     */
    registerViewsListener: (listener: (views: DfrntPageViewModel[]) => void) => () => void;
    /** Replace the selected views (the host toolbar's Views menu). */
    setViewSelection: (viewIds: number[]) => void;
    /** Push new auto-refresh intervals (from the settings dialog) into the page. */
    updateRefreshIntervals: (intervals: Partial<DispatchRefreshIntervals>) => void;
    /** Restore the current layout to the shipped arrangement (toolbar → Layouts → Reset layout). */
    resetCurrentLayout: () => void;
    /** Show or hide the "Edit columns" bar (toolbar → Layouts → Edit columns). */
    setColumnEditMode: (enabled: boolean) => void;
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
    /** Leave "Edit columns" mode; routes back through the toolbar so its menu stays in sync. */
    onExitColumnEditMode?: () => void;
    onLayoutBridgeReady?: (bridge: DispatchLayoutBridge) => void;
}

export const DispatchPage: React.FC<DispatchPageProps> = ({
    showToast,
    isUsCustomer,
    timeZone,
    deepLinkJobId,
    onExitColumnEditMode,
    onLayoutBridgeReady,
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
    // "Edit columns" mode, driven from the toolbar's Layouts menu: shows the
    // layout column stepper in the shell and each list's column editor.
    const [columnEditMode, setColumnEditMode] = useState(false);
    const handleExitColumnEditMode = useCallback(() => {
        setColumnEditMode(false);
        onExitColumnEditMode?.();
    }, [onExitColumnEditMode]);

    // Toolbar filters (selected views + date range). Seeded from localStorage so
    // the list/driver-locations honour the dispatcher's persisted selection on
    // mount; the AngularJS toolbar pushes runtime changes via the bridge.
    const [filters, setFilters] = useState<DispatchFilters>(() => loadDispatchFilters());
    const applyFilters = useCallback((next: Partial<DispatchFilters>) => {
        setFilters(prev => ({...prev, ...next}));
    }, []);

    // ── Page views (the job list's scope) ──────────────────────────────
    // The definitions come from the server; the selection lives in `filters`
    // and is mirrored to localStorage so V1 and the host toolbar see it too.
    const {data: pageViews, isLoading: viewsLoading} = useDispatchViews(LegacyAppPage.Dispatch);
    const viewsRef = useRef<DfrntPageViewModel[]>([]);
    viewsRef.current = pageViews ?? [];
    const selectedViewIdsRef = useRef(filters.despatchViewIds);
    selectedViewIdsRef.current = filters.despatchViewIds;

    const applyViewSelection = useCallback((ids: number[]) => {
        // Normalise to server order so the persisted selection is stable
        // regardless of the order the dispatcher clicked the pills in.
        const selected = viewsRef.current.filter(v => ids.includes(v.id));
        persistSelectedViews(selected.map(v => ({...v, selected: true})));
        setFilters(prev => (
            prev.despatchViewIds.join(',') === selected.map(v => v.id).join(',')
                ? prev
                : {...prev, despatchViewIds: selected.map(v => v.id)}
        ));
    }, []);

    const toggleView = useCallback((viewId: number) => {
        const current = selectedViewIdsRef.current;
        applyViewSelection(
            current.includes(viewId) ? current.filter(id => id !== viewId) : [...current, viewId],
        );
    }, [applyViewSelection]);

    const clearViews = useCallback(() => applyViewSelection([]), [applyViewSelection]);

    /*
     * Filter changes are pushed into the mounted list rather than re-keying it. The
     * views rail lives inside that panel (`topSlot`) and scrolls horizontally, so a
     * remount threw away both its scroll position and the table's. Same channel
     * JobSearchPage uses. `statusFilter` is deliberately absent: the panel's category
     * chip owns it, and re-pushing the stored value would fight the live choice.
     *
     * The dates are compared by value because the host toolbar hands us a fresh dayjs
     * on every push — by identity, an unchanged range would restart the query.
     */
    const pushListParams = useRef<((params: Partial<JobListSearchParams>) => void) | null>(null);
    const filtersRef = useRef(filters);
    filtersRef.current = filters;
    const listParamsSeededRef = useRef(false);
    const startDateMs = filters.startDate.valueOf();
    const endDateMs = filters.endDate.valueOf();
    useEffect(() => {
        if (!listParamsSeededRef.current) {
            listParamsSeededRef.current = true;
            return;
        }
        const {startDate, endDate, useTime, despatchViewIds} = filtersRef.current;
        pushListParams.current?.({startDate, endDate, useTime, despatchViewIds, page: 0});
    }, [startDateMs, endDateMs, filters.useTime, filters.despatchViewIds]);

    // Resolve the starting selection once the server list lands: restore what
    // was stored, drop views that no longer exist, and only fall back to the
    // first view on a genuine first visit (V1 `initializeViews`).
    const viewsSeededRef = useRef(false);
    useEffect(() => {
        if (viewsSeededRef.current || !pageViews || pageViews.length === 0) return;
        viewsSeededRef.current = true;
        applyViewSelection(
            resolveInitialViewSelection(pageViews, loadSelectedViewIds(), hasStoredViewSelection()),
        );
    }, [pageViews, applyViewSelection]);

    // The host toolbar's Views menu mirrors this selection; it registers a
    // listener and pushes its own changes back through `setViewSelection`.
    const decoratedViews = useMemo<DfrntPageViewModel[]>(
        () => (pageViews ?? []).map(v => ({...v, selected: filters.despatchViewIds.includes(v.id)})),
        [pageViews, filters.despatchViewIds],
    );
    const decoratedViewsRef = useRef(decoratedViews);
    const viewsListenerRef = useRef<((views: DfrntPageViewModel[]) => void) | null>(null);
    // Hold the first notification until the list has actually loaded, so the
    // toolbar menu keeps its spinner instead of flashing "No views available".
    const viewsLoadedRef = useRef(false);
    viewsLoadedRef.current = !viewsLoading;
    useEffect(() => {
        decoratedViewsRef.current = decoratedViews;
        if (!viewsLoading) viewsListenerRef.current?.(decoratedViews);
    }, [decoratedViews, viewsLoading]);

    const registerViewsListener = useCallback((listener: (views: DfrntPageViewModel[]) => void) => {
        viewsListenerRef.current = listener;
        if (viewsLoadedRef.current) listener(decoratedViewsRef.current);
        return () => {
            if (viewsListenerRef.current === listener) viewsListenerRef.current = null;
        };
    }, []);

    // Auto-refresh intervals (ms; false = off), seeded from localStorage and
    // updated from the settings dialog via the bridge. Applied as React Query
    // refetchInterval on the job list, current work, driver locations and tasks.
    // The Tasks panel has its own independent interval (tasksMs).
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
    // whole route (V1 selectJob → getCurrentJobs). Uses its own currentWorkMap
    // key: the Current Work box keys the same params under an infinite query, so
    // sharing the key would clash cache shapes (plain vs {pages}) and crash it.
    const mapCourierId = selectedCourierId(currentJob);
    const mapCourierParams = useMemo(() => ({
        courierId: mapCourierId,
        startDate: dayjs().startOf('day'),
        endDate: dayjs().endOf('day'),
        page: 0,
        pageSize: 50,
    }), [mapCourierId]);
    const {data: mapCourierWork} = useQuery({
        queryKey: queryKeys.dispatch.currentWorkMap(mapCourierParams),
        queryFn: ({signal}) => fetchCurrentWorkJobs(mapCourierParams, {signal}),
        enabled: !!mapCourierId,
    });

    // Map centre/zoom follows the selected despatch view(s) (V1
    // updateMapForSelectedViews); the toolbar writes the full view objects to
    // localStorage before pushing new ids, so re-reading on an id change is fresh.
    const mapView = useMemo(
        () => computeMapView(loadSelectedViews(), getDefaultMapCenter(), getNetworkPartnerMapCenter()),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-derive when the view selection changes
        [filters.despatchViewIds],
    );

    // Save / rename / delete layout prompts, opened imperatively via the layout bridge
    // from the AngularJS toolbar so `routes.ts` keeps owning persistence.
    const layoutPrompts = useLayoutPrompts();
    const {promptSaveLayout, promptDeleteLayout, promptRenameLayout} = layoutPrompts;

    useEffect(() => {
        onLayoutBridgeReady?.({
            setCurrentLayoutName: boxLayout.setCurrentLayoutName,
            reloadFromStorage: boxLayout.reloadFromStorage,
            promptSaveLayout,
            promptDeleteLayout,
            promptRenameLayout,
            updateFilters: applyFilters,
            registerViewsListener,
            setViewSelection: applyViewSelection,
            updateRefreshIntervals: applyRefreshIntervals,
            resetCurrentLayout: boxLayout.resetCurrentLayout,
            setColumnEditMode,
            openInterCourierCharge,
            jobCreated,
            importLegacyLayouts: boxLayout.importLegacyLayouts,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, boxLayout.importLegacyLayouts, boxLayout.resetCurrentLayout, promptSaveLayout, promptDeleteLayout, promptRenameLayout, applyFilters, registerViewsListener, applyViewSelection, applyRefreshIntervals, openInterCourierCharge, jobCreated]);

    const fetchConfigMain = useMemo(() => {
        const baseParams = {
            startDate: filters.startDate,
            endDate: filters.endDate,
            useTime: filters.useTime,
            despatchViewIds: filters.despatchViewIds,
            isInternal: window.ClientInternal ?? false,
            page: 0,
            pageSize: 50,
            // Seeds the dispatcher's Unassigned/Active choice on mount; from then on the
            // panel's own category chip owns it — useJobListData only reads initialParams
            // once, and later filter changes are pushed in (see `pushListParams`).
            statusFilter: toStatusFilter(loadJobListCategory('dispatchJobList')),
        };
        // When a driver-location area is active, scope the list to that clear
        // list (V1 getJobList → selectedClearListId via the clear-list endpoint).
        // V1 also forced the category to `needs-dispatch` on area click
        // (selectAndActivateArea), so the scope overrides the stored choice —
        // `forcedCategory` below keeps the visible chip in step with this filter.
        if (clearListId) {
            return {
                fetchFn: fetchClearListJobs,
                queryKeyFn: (params: any) => queryKeys.dispatch.clearList(params),
                initialParams: {
                    ...baseParams,
                    statusFilter: toStatusFilter(CLEAR_LIST_CATEGORY),
                    selectedClearListId: clearListId,
                },
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
    }, [refreshIntervals.jobsMs, clearListId, filters.startDate, filters.endDate, filters.useTime, filters.despatchViewIds]);

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
        // The Overview panels read from their own key space, so the shared
        // 'dispatch' invalidation below would leave their refresh button inert.
        if (boxName === DispatchBoxes.OverviewDeliveries || boxName === DispatchBoxes.OpenJobs) {
            void queryClient.invalidateQueries({queryKey: queryKeys.overview.all});
            return;
        }
        void queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all});
    }, []);

    // ── Dispatch the selected job (Detail box) ────────────────────────
    // Reuses the universal DispatchDialog (the same one JobListPanel's context
    // menu uses). Courier path allocates, or re-allocates when a courier is
    // already assigned; partner path sends to a DFRNT partner. Mirrors
    // JobSearchPage's FAB dispatch handlers.
    const [dispatchDialogOpen, {open: openDispatchDialog, close: closeDispatchDialog}] = useDisclosure(false);

    const invalidateAfterDispatch = useCallback(async (job: DispatchJob) => {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: queryKeys.dispatch.all}),
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobs.detail(job.id, job.isBulkJob ? 'bulk' : 'standard'),
            }),
        ]);
    }, []);

    const handleDispatchCourier = useCallback(async (confirmation: DispatchConfirmation) => {
        if (!currentJob) return;

        const {message, severity} = await executeDispatchConfirmation(
            {
                id: currentJob.id,
                jobNo: currentJob.jobNo,
                assignedCourierId: currentJob.assignedCourier?.id,
            },
            confirmation,
        );

        showToast(message, severity);
        await invalidateAfterDispatch(currentJob);
        closeDispatchDialog();
    }, [currentJob, showToast, invalidateAfterDispatch, closeDispatchDialog]);

    const handleSendToPartner = useCallback(async (partner: ISuggestion, agreedRate: number) => {
        if (!currentJob) return;
        const result = await sendToPartner(currentJob.id, partner.id, agreedRate);
        if (!result.success) {
            throw new Error(result.message || 'Failed to send job to partner');
        }
        closeDispatchDialog();
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
                    openDispatchDialog();
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
                        columnEditMode={columnEditMode}
                        onExitColumnEditMode={handleExitColumnEditMode}
                        // Only the clear-list scope remounts: it swaps fetchFn/queryKeyFn and
                        // forces its own category. View and date changes are pushed in below.
                        key={clearListId ?? 'all'}
                        showToast={showToast}
                        isUsCustomer={isUsCustomer}
                        appPage={AppPage.Dispatch}
                        storagePrefix="dispatchJobList"
                        // Keeps the visible category chip in step with the clear-list
                        // scope's forced status filter, without persisting over the
                        // operator's own choice.
                        forcedCategory={clearListId ? CLEAR_LIST_CATEGORY : undefined}
                        fetchConfig={fetchConfigMain as any}
                        onJobSelect={selectJob}
                        onJobsLoaded={handleJobsLoaded}
                        setSelectJobCallback={(cb) => { selectInListRef.current = cb; }}
                        setUpdateSearchParamsCallback={(cb) => { pushListParams.current = cb; }}
                        headerSlot={headerSlot}
                        topSlot={
                            <ViewsRail
                                views={pageViews ?? []}
                                selectedIds={filters.despatchViewIds}
                                isUsCustomer={isUsCustomer}
                                loading={viewsLoading}
                                onToggle={toggleView}
                                onClearAll={clearViews}
                            />
                        }
                    />
                );

            case DispatchBoxes.JobDetail:
                if (!currentJobId) {
                    return (
                        <NoData
                            title="No Job Selected"
                            message="Select a job from the list to see its details."
                            icon={<Icon lucide={Briefcase} size={48}/>}
                        />
                    );
                }
                return (
                    <JobDetailsMount
                        jobId={currentJobId}
                        containerId="react-dispatch-job-detail"
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
                    <Box style={{height: '100%', minHeight: 0}}>
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
                    <TasksBox
                        appPage={LegacyAppPage.Dispatch}
                        jobId={currentJobId}
                        showToast={showToast}
                        refetchIntervalMs={refreshIntervals.tasksMs}
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

            case DispatchBoxes.OverviewDeliveries:
                return (
                    <OverviewDeliveriesBox
                        despatchViewIds={filters.despatchViewIds}
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        refetchIntervalMs={refreshIntervals.jobsMs}
                        onSelectJob={(jobId) => void selectJobById(jobId)}
                        headerSlot={headerSlot}
                    />
                );

            case DispatchBoxes.OpenJobs:
                return (
                    <OpenJobsBox
                        despatchViewIds={filters.despatchViewIds}
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        refetchIntervalMs={refreshIntervals.jobsMs}
                        onSelectJob={(jobId) => void selectJobById(jobId)}
                        headerSlot={headerSlot}
                    />
                );

            default:
                return null;
        }
    }, [showToast, isUsCustomer, fetchConfigMain, selectJob, selectJobById, currentJobId, currentJob, clearListId, filters, mapJobs, handleJobsLoaded, handleMarkerClick, toMapItem, truckMode, pageViews, viewsLoading, toggleView, clearViews, mapCourierWork?.jobs, mapView.center, mapView.zoom, refreshIntervals.jobsMs, refreshIntervals.tasksMs, refreshIntervals.driverLocationsMs]);

    const subtitleFor = useCallback((boxName: string) => {
        if (boxName === DispatchBoxes.JobDetail) {
            return currentJob?.jobNo;
        }
        return undefined;
    }, [currentJob?.jobNo]);

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
        <Stack h="100%" w="100%" gap={0} style={{minHeight: 0}}>
            <Box style={{flex: 1, minHeight: 0, position: 'relative'}}>
                <BoxShell
                    layout={boxLayout.layout}
                    layoutVersion={boxLayout.layoutVersion}
                    boxes={boxLayout.boxes}
                    renderBoxContent={renderBoxContent}
                    onRefreshBox={handleRefreshBox}
                    boxSubtitle={subtitleFor}
                    boxRightSlot={boxRightSlotFor}
                    onColumnSizes={boxLayout.setColumnSizes}
                    onBoxHeights={boxLayout.setBoxHeights}
                    onMoveBox={boxLayout.moveBox}
                    isDefaultLayout={boxLayout.isDefaultLayout}
                    columnEditMode={columnEditMode}
                    onExitColumnEditMode={handleExitColumnEditMode}
                    onAddColumn={boxLayout.addColumn}
                    onRemoveColumn={boxLayout.removeColumn}
                />
            </Box>
            <LayoutPromptDialogs
                prompts={layoutPrompts}
                layoutNames={boxLayout.layouts.map(l => l.name)}
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
                    stopJobCount={stopJobCountFor(currentJob.jobNo, currentJob.relatedJobs)}
                    existingConNote={currentJob.conNote}
                    isNetworkPartner={isNetworkPartnerSession()}
                    onClose={closeDispatchDialog}
                    onDispatchCourier={handleDispatchCourier}
                    onSendToPartner={handleSendToPartner}
                    fetchRate={getPartnerRateForJob}
                    getPartnerOptions={getActivePartnerOptions}
                />
            )}
        </Stack>
    );
};
