import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import dayjs from 'dayjs';
import {AppPage} from '../../interfaces/dispatchJob';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {fetchBulkJobs, fetchDispatchBulkJobDetail, fetchPodJobs} from '../../services/jobSearchApi';
import {getDispatchJobDetail} from '../../services/dispatchExecutorApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import type {DispatchJob, JobListSearchParams} from '../../interfaces/dispatchJob';
import {ISuggestion, IDispatchMapItem} from '../../../interfaces/job.interface';
import type {ShowToastFn} from '../../services/toastService';
import JobSearchBoxes from '../../../components/jobSearch/enums/jobSearchBoxes';
import {searchActiveClients} from '../../services/jobApi';
import {searchActiveCouriers} from '../../services/courierApi';
import {searchSpeedOptions} from '../../services/dispatchExecutorApi';
import {
    addRestoreEvent,
    allocateJobs,
    getActivePartnerOptions,
    getPartnerRateForJob,
    reAllocateJobs,
    restoreJobs,
    restoreSplitJobs,
    sendToPartner,
    setJobLocked,
    unSplitJob,
} from '../../services/jobListApi';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import {NoData} from '../../components/common/no-data/NoData';
import {useDismissibleBanner} from '../../hooks/useDismissibleBanner';
import {SearchCriteriaPanel} from '../../components/common/search-criteria-panel/SearchCriteriaPanel';
import {JobListPanel} from '../../components/job-list/JobListPanel';
import {TaskHistory} from '../../components/common/task-history/TaskHistory';
import {JobSearchShell} from './components/JobSearchShell';
import {JobDetailFab} from './components/JobDetailFab';
import {ScanList} from './components/ScanList';
import {useSearchCriteria} from './hooks/useSearchCriteria';
import {useBoxLayout} from './hooks/useBoxLayout';
import {useDeepLinkJob} from './hooks/useDeepLinkJob';
import {filterCouriersForNumericSearch} from './lib/searchCriteria';
import {getClientJobsReportDownloadUrl, getPodJobsDownloadUrl} from './lib/exportUrls';
import {getPriceDetailReportDownloadUrl} from './lib/priceDetailExport';
import {
    openInterCourierChargeDialog
} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import type {ImportLayoutsResult, LayoutStorageKeys} from './lib/layoutPersistence';
import {SaveLayoutDialog} from '../../components/dialogs/save-layout-dialog/SaveLayoutDialog';
import {DeleteLayoutDialog} from '../../components/dialogs/delete-layout-dialog/DeleteLayoutDialog';
import {DispatchDialog} from '../../components/dialogs/dispatch-dialog';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';

export interface JobSearchLayoutBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Opens the MUI "Save Layout" dialog and resolves with the entered name (or null if cancelled). */
    promptSaveLayout: () => Promise<string | null>;
    /** Opens the MUI "Delete Layout" confirmation and resolves true if confirmed. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    /** Opens the MUI "Rename Layout" dialog and resolves with the new name (or null if cancelled). */
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
    /** Set layout edit mode (driven by the toolbar's Layouts → Edit layout toggle). */
    resetCurrentLayout: () => void;
    setColumnEditMode: (enabled: boolean) => void;
    /** Opens the Inter-Courier Charge dialog, wired to this page's toast. */
    openInterCourierCharge: () => Promise<void>;
    /** Copy the user's V1 layouts into this page's (V2) layout store. */
    importLegacyLayouts: () => ImportLayoutsResult;
}

export interface JobSearchPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    timeZone: string;
    timeZoneShort?: string;
    deepLinkJobId?: number;
    /** Called once with imperative handles for the AppShell toolbar to drive layout selection. */
    /** Leave "Edit columns" mode; routes back through the toolbar so its menu stays in sync. */
    onExitColumnEditMode?: () => void;
    onLayoutBridgeReady?: (bridge: JobSearchLayoutBridge) => void;
    /** Leave edit mode (in-shell "Done editing" button). Routes back through the toolbar. */
}

export const JobSearchPage: React.FC<JobSearchPageProps> = ({
                                                                showToast,
                                                                isUsCustomer,
                                                                timeZone,
                                                                timeZoneShort,
                                                                deepLinkJobId,
                                                                onExitColumnEditMode,
                                                                onLayoutBridgeReady,
                                                            }) => {
    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsCSV2-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutCSV2-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${LegacyAppPage.JobSearch}-${ContactID}`,
    }), []);

    // Legacy (V1) storage keys — the source for "Import V1 layouts".
    const legacyStorageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsCS-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutCS-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibility-${LegacyAppPage.JobSearch}-${ContactID}`,
    }), []);

    const searchCriteria = useSearchCriteria({timeZone});
    const boxLayout = useBoxLayout({storageKeys, legacyStorageKeys, page: 'JobSearch'});

    const [currentJob, setCurrentJob] = useState<DispatchJob | undefined>();
    const [currentJobId, setCurrentJobId] = useState<number | undefined>();
    const [isBulkJob, setIsBulkJob] = useState(false);
    // "Edit columns" mode, driven from the toolbar's Layouts menu: shows the
    // layout column stepper in the shell and each list's column editor.
    const [columnEditMode, setColumnEditMode] = useState(false);
    const handleExitColumnEditMode = useCallback(() => {
        setColumnEditMode(false);
        onExitColumnEditMode?.();
    }, [onExitColumnEditMode]);
    const betaBanner = useDismissibleBanner(`jobSearchBetaBannerDismissed-${ContactID}`);
    const [sortColumn, setSortColumn] = useState<string | undefined>();
    const [sortDirection, setSortDirection] = useState<string | undefined>();
    const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);

    // Save-layout dialogue — opened imperatively via the layout bridge from the
    // AngularJS toolbar. Resolves the pending promise with the entered name (or
    // null on cancel) so `routes.ts` keeps owning persistence.
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

    // Delete-layout confirmation — same imperative bridge pattern as safe.
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

    // Rename-layout prompt — same imperative bridge pattern as save/delete.
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

    // Callbacks each JobListPanel hands back via `setUpdateSearchParamsCallback`.
    // We invoke these whenever the user clicks Search so the panel's
    // useJobListData picks up the new criteria (matches the V1 controller
    // pattern of calling `window.ReactJobSearchJobList.updateSearchParams(...)`).
    const updateMainParamsRef = useRef<((p: Partial<JobListSearchParams>) => void) | null>(null);
    const updateBulkParamsRef = useRef<((p: Partial<JobListSearchParams>) => void) | null>(null);

    // Tracks the currently-selected job id so async detail fetches only apply
    // if the operator hasn't moved on to another job in the meantime.
    const selectedIdRef = useRef<number | undefined>(undefined);

    // Fetch the full dispatch-shaped job detail (matches V1 selectJobDetail /
    // selectBulkJobDetail). FAB action availability and the ScanList run date
    // rely on fields the list-row DTO may not carry, so we replace the optimistic
    // row with the full record once it lands.
    const loadFullDetail = useCallback((jobId: number, bulk: boolean) => {
        const request = bulk ? fetchDispatchBulkJobDetail(jobId) : getDispatchJobDetail(jobId);
        request
            .then(full => {
                if (full && selectedIdRef.current === jobId) setCurrentJob(full);
            })
            .catch(err => console.error('[JobSearchPage] Failed to load job detail:', err));
    }, []);

    const selectJob = useCallback((job: DispatchJob, bulk: boolean) => {
        selectedIdRef.current = job.id;
        setCurrentJob(job);          // optimistic: show the list row immediately
        setCurrentJobId(job.id);
        setIsBulkJob(bulk);
        loadFullDetail(job.id, bulk); // then upgrade to the full detail record
    }, [loadFullDetail]);

    useDeepLinkJob({
        deepLinkJobId,
        onSelectJob: jobId => {
            // Deep-link gives us only the id. Fetch the full detail so the
            // job-detail panel, FAB and ScanList (booked run date) have real
            // data instead of waiting for the list results to land.
            selectedIdRef.current = jobId;
            setCurrentJobId(jobId);
            setIsBulkJob(false);
            loadFullDetail(jobId, false);
        },
    });

    const openInterCourierCharge = useCallback(
        () => openInterCourierChargeDialog({showToast}),
        [showToast],
    );

    useEffect(() => {
        onLayoutBridgeReady?.({
            setCurrentLayoutName: boxLayout.setCurrentLayoutName,
            reloadFromStorage: boxLayout.reloadFromStorage,
            promptSaveLayout,
            promptDeleteLayout,
            promptRenameLayout,
            resetCurrentLayout: boxLayout.resetCurrentLayout,
            setColumnEditMode,
            openInterCourierCharge,
            importLegacyLayouts: boxLayout.importLegacyLayouts,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, boxLayout.importLegacyLayouts, promptSaveLayout, promptDeleteLayout, promptRenameLayout, openInterCourierCharge]);

    const fetchConfigMain = useMemo(() => ({
        fetchFn: fetchPodJobs,
        queryKeyFn: (params: any) => queryKeys.jobSearch.pod(params),
        initialParams: {
            startDate: searchCriteria.criteria.from_date,
            endDate: searchCriteria.criteria.to_date,
            page: 0,
            pageSize: 50,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            jobId: searchCriteria.criteria.jobId,
            sortColumn,
            sortDirection,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId, sortColumn, sortDirection]);

    const fetchConfigBulk = useMemo(() => ({
        fetchFn: fetchBulkJobs,
        queryKeyFn: (params: any) => queryKeys.jobSearch.bulk(params),
        initialParams: {
            startDate: searchCriteria.criteria.from_date,
            endDate: searchCriteria.criteria.to_date,
            page: 0,
            pageSize: 50,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            bulkJobId: searchCriteria.criteria.bulkJobId,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.bulkJobId]);

    const handleSearch = useCallback(() => {
        // Push the current criteria into each JobListPanel — they own their
        // own `params` state seeded from fetchConfig.initialParams and only
        // update via this callback (not by re-reading our `fetchConfig` prop).
        //
        // Single-ID isolation (matches V1 refreshAllData): a job-id search only
        // makes sense against the main list, and a bulk-job-id search only
        // against the bulk list — so disable the other panel to avoid a wasted
        // query and stray results in the wrong box.
        const byJobId = searchCriteria.criteria.jobId != null;
        const byBulkJobId = searchCriteria.criteria.bulkJobId != null;

        const mainParams: Partial<JobListSearchParams> = {
            startDate: searchCriteria.criteria.from_date,
            endDate: searchCriteria.criteria.to_date,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            jobId: searchCriteria.criteria.jobId,
            sortColumn,
            sortDirection,
            disabled: byBulkJobId,
            page: 0,
        };
        updateMainParamsRef.current?.(mainParams);
        updateBulkParamsRef.current?.({
            startDate: searchCriteria.criteria.from_date,
            endDate: searchCriteria.criteria.to_date,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            bulkJobId: searchCriteria.criteria.bulkJobId,
            disabled: byJobId,
            page: 0,
        });
    }, [sortColumn, sortDirection, searchCriteria.criteria.bulkJobId, searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

    const handleRefreshBox = useCallback(async (boxName: string) => {
        switch (boxName) {
            case JobSearchBoxes.JobList:
                await queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.pod({} as any)});
                break;
            case JobSearchBoxes.BulkJobList:
                await queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.bulk({} as any)});
                break;
            case JobSearchBoxes.JobDetail:
                if (currentJobId) {
                    await queryClient.invalidateQueries({
                        queryKey: queryKeys.jobs.detail(currentJobId, isBulkJob ? 'bulk' : 'standard'),
                    });
                }
                break;
            case JobSearchBoxes.ScanList:
                if (currentJobId) {
                    await queryClient.invalidateQueries({
                        queryKey: queryKeys.jobSearch.scanDetail(currentJobId, isBulkJob),
                    });
                }
                break;
        }
    }, [currentJobId, isBulkJob]);

    const handleClientSearch = useCallback(
        (text: string) => searchActiveClients(text) as Promise<ISuggestion[]>,
        [],
    );
    const handleCourierSearch = useCallback(async (text: string) => {
        if (!text || text.length < 2) return [];
        try {
            const results = await searchActiveCouriers(text);
            return filterCouriersForNumericSearch(results, text) as unknown as ISuggestion[];
        } catch (err) {
            console.error('Error in courier search:', err);
            return [];
        }
    }, []);
    const handleSpeedSearch = useCallback(async (text: string) => {
        if (!text || text.length < 2) return [];
        try {
            const results = await searchSpeedOptions(text);
            return results as ISuggestion[];
        } catch (err) {
            console.error('Error in speed search:', err);
            return [];
        }
    }, []);

    const handleCriteriaChange = useCallback(
        (field: string, value: ISuggestion[] | string | number | undefined) => {
            searchCriteria.setField(field as any, value as any);
        },
        [searchCriteria],
    );

    const handleDownload = useCallback(() => {
        const url = getPodJobsDownloadUrl(
            searchCriteria.criteria.from_date,
            searchCriteria.criteria.to_date,
            searchCriteria.selectedCourierIds,
            searchCriteria.selectedClientIds,
            searchCriteria.selectedSpeedIds,
            searchCriteria.criteria.wild,
            searchCriteria.criteria.job,
            searchCriteria.criteria.jobId,
        );
        // Open in a new tab to trigger the browser's native download (matches V1).
        window.open(url, '_blank');
    }, [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

    const handleClientReport = useCallback(() => {
        const url = getClientJobsReportDownloadUrl(
            searchCriteria.criteria.from_date,
            searchCriteria.criteria.to_date,
            searchCriteria.selectedClientIds,
        );
        window.open(url, '_blank');
    }, [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedClientIds]);

    const handlePriceDetailReport = useCallback(() => {
        const url = getPriceDetailReportDownloadUrl(
            searchCriteria.criteria.from_date,
            searchCriteria.criteria.to_date,
            searchCriteria.selectedCourierIds,
            searchCriteria.selectedClientIds,
            searchCriteria.selectedSpeedIds,
            searchCriteria.criteria.wild,
            searchCriteria.criteria.job,
            searchCriteria.criteria.jobId,
        );
        window.open(url, '_blank');
    }, [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

    const handleUpload = useCallback(() => {
        const w = window as any;
        if (w.ReactBulkPriceUploadDialog?.open) {
            w.ReactBulkPriceUploadDialog.open({showToast})
                .then(() => queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all}))
                .catch((err: unknown) => console.error('Bulk upload dialog error:', err));
        } else {
            showToast('Bulk price upload dialog is not loaded.', 'warning');
        }
    }, [showToast]);

    const fabAction = useCallback(async (actionId: string, job: DispatchJob) => {
        const w = window as any;
        const invalidateDetail = () => queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(job.id, job.isBulkJob ? 'bulk' : 'standard'),
        });
        const invalidateLists = () => queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all});

        try {
            switch (actionId) {
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
                    await invalidateDetail();
                    return;

                case 'attachments':
                    await w.ReactJobFileUploadDialog?.open(job.id);
                    await invalidateDetail();
                    return;

                case 'dispatch':
                    // Open the same universal DispatchDialog the job-list context
                    // menu uses (courier / agent / NP / partner picker).
                    setDispatchDialogOpen(true);
                    return;

                case 'restore':
                    await addRestoreEvent(job.id);
                    if (job.displaySplitJobDetail) {
                        await restoreSplitJobs([job.id]);
                    } else {
                        await restoreJobs([job.id]);
                    }
                    showToast(`${job.jobNo} restored.`, 'success');
                    await Promise.all([invalidateLists(), invalidateDetail()]);
                    return;

                case 'swapPod':
                    await w.ReactSwapPodsDialog?.open(job.jobNo, {showToast});
                    await Promise.all([invalidateLists(), invalidateDetail()]);
                    return;

                case 'sendPod':
                    await w.ReactSendPodDialog?.open({
                        jobId: job.id,
                        jobNo: job.jobNo,
                        clientName: job.clientName ?? job.client ?? '',
                        driverName: job.assignedCourier?.text ?? '',
                        deliveryAddress: job.deliveryAddress?.fullAddress ?? '',
                        deliveryDateTime: job.time ? job.time.toString() : '',
                    });
                    return;

                case 'lock':
                case 'unlock': {
                    const locked = actionId === 'lock';
                    await setJobLocked(job.id, locked, !!job.preBook);
                    showToast(`${job.jobNo} ${locked ? 'locked' : 'unlocked'}.`, 'success');
                    await Promise.all([invalidateLists(), invalidateDetail()]);
                    return;
                }

                case 'split': {
                    // Intent confirmation lives with the caller — the context menu uses its own
                    // dialog, this FAB matches the un-split entry below. The pricing dialog inside
                    // the flow confirms the money separately.
                    const confirmed = window.confirm('Are you sure you wish to split this job?');
                    if (!confirmed) return;
                    const {executeSplitJobFlow} = await import('../../services/splitJobFlow');
                    await executeSplitJobFlow({
                        job,
                        showToast,
                        onComplete: () => {
                            void Promise.all([invalidateLists(), invalidateDetail()]);
                        },
                    });
                    return;
                }

                case 'unsplit': {
                    const confirmed = window.confirm('Un-split this job? This cannot be undone.');
                    if (!confirmed) return;
                    const msg = await unSplitJob(job.id);
                    if ((msg || '').length > 2) {
                        showToast(msg, 'error');
                    } else {
                        showToast(`${job.jobNo} un-split.`, 'success');
                    }
                    await Promise.all([invalidateLists(), invalidateDetail()]);
                    return;
                }

                default:
                    showToast(`Unknown FAB action: ${actionId}`, 'warning');
            }
        } catch (error) {
            console.error(`[JobSearchPage] FAB action "${actionId}" failed:`, error);
            showToast(`Failed to ${actionId}: ${error instanceof Error ? error.message : 'unknown error'}`, 'error');
        }
    }, [showToast]);

    // ── FAB dispatch (DispatchDialog) ─────────────────────────────────
    // Single-job dispatch from the job-detail FAB. Courier path allocates (or
    // re-allocates if a courier is already assigned); partner path sends to a
    // DFRNT partner. Mirrors JobListContextMenu's handlers.
    const handleDispatchCourier = useCallback(async (
        type: 'Courier' | 'Agent' | 'NP',
        destination: ISuggestion,
    ) => {
        if (!currentJob) return;
        if (type !== 'Courier') {
            throw new Error(`${type} dispatch isn't wired from Job Search yet — use the job-list context menu.`);
        }
        if (currentJob.assignedCourier?.id) {
            await reAllocateJobs(destination.id, [currentJob.id]);
        } else {
            await allocateJobs(destination.id, [currentJob.id]);
        }
        showToast(`Job ${currentJob.jobNo} dispatched to ${destination.text}`, 'success');
        await Promise.all([
            queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all}),
            queryClient.invalidateQueries({
                queryKey: queryKeys.jobs.detail(currentJob.id, isBulkJob ? 'bulk' : 'standard'),
            }),
        ]);
        setDispatchDialogOpen(false);
    }, [currentJob, isBulkJob, showToast]);

    const handleSendToPartner = useCallback(async (partner: ISuggestion, agreedRate: number) => {
        if (!currentJob) return;
        const result = await sendToPartner(currentJob.id, partner.id, agreedRate);
        if (!result.success) {
            throw new Error(result.message || 'Failed to send job to partner');
        }
        setDispatchDialogOpen(false);
        showToast(`Job ${currentJob.jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`, 'success');
        await queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all});
    }, [currentJob, showToast]);

    const renderBoxContent = useCallback((boxName: string): React.ReactNode => {
        switch (boxName) {
            case JobSearchBoxes.SearchWidget:
                return (
                    <Box sx={{height: '100%', overflow: 'auto'}}>
                        <SearchCriteriaPanel
                            dateSearchRange={searchCriteria.dateSearchRange}
                            fromDate={searchCriteria.criteria.from_date}
                            toDate={searchCriteria.criteria.to_date}
                            onSearchRangeChange={(range) => searchCriteria.setDateSearchRange(range as any)}
                            onFromDateChange={searchCriteria.setFromDate}
                            onToDateChange={searchCriteria.setToDate}
                            onCriteriaChange={handleCriteriaChange}
                            onSearch={handleSearch}
                            onDownload={handleDownload}
                            onClientReport={handleClientReport}
                            onPriceDetailReport={handlePriceDetailReport}
                            onUpload={handleUpload}
                            onClientSearch={handleClientSearch}
                            onCourierSearch={handleCourierSearch}
                            onSpeedSearch={handleSpeedSearch}
                        />
                    </Box>
                );

            case JobSearchBoxes.JobList:
                return (
                    <JobListPanel
                        columnEditMode={columnEditMode}
                        onExitColumnEditMode={handleExitColumnEditMode}
                        showToast={showToast}
                        isUsCustomer={isUsCustomer}
                        appPage={AppPage.JobSearch}
                        storagePrefix="jobSearchJobList"
                        fetchConfig={fetchConfigMain as any}
                        onJobSelect={(job) => selectJob(job, false)}
                        onBackendFilter={(column, direction) => {
                            setSortColumn(column);
                            setSortDirection(direction);
                        }}
                        setUpdateSearchParamsCallback={(cb) => {
                            updateMainParamsRef.current = cb;
                        }}
                    />
                );

            case JobSearchBoxes.BulkJobList:
                return (
                    <JobListPanel
                        columnEditMode={columnEditMode}
                        onExitColumnEditMode={handleExitColumnEditMode}
                        showToast={showToast}
                        isUsCustomer={isUsCustomer}
                        appPage={AppPage.JobSearch}
                        storagePrefix="jobSearchBulkList"
                        fetchConfig={fetchConfigBulk as any}
                        onJobSelect={(job) => selectJob(job, true)}
                        setUpdateSearchParamsCallback={(cb) => {
                            updateBulkParamsRef.current = cb;
                        }}
                    />
                );

            case JobSearchBoxes.JobDetail:
                if (!currentJobId) {
                    return (
                        <NoData
                            title="No Job Selected"
                            message="Select a job from the list to see its details."
                            icon={<WorkOutlineIcon/>}
                        />
                    );
                }
                return (
                    <ReactJobDetailsMount
                        jobId={currentJobId}
                        isBulkJob={isBulkJob}
                        isUsCustomer={isUsCustomer}
                        showToast={showToast}
                    />
                );

            case JobSearchBoxes.ScanList:
                return (
                    <ScanList
                        jobId={currentJobId}
                        runDate={currentJob?.booked ?? dayjs()}
                        isBulkJob={isBulkJob}
                        timeZoneShort={timeZoneShort}
                    />
                );

            case JobSearchBoxes.Map: {
                // Show the selected job on the map, centred on its pickup (matches
                // V1 selectJobDetail's mapCenter behaviour). DispatchMap falls back
                // to the tenant's default centre when no job is selected.
                const pickup = currentJob?.pickupAddress;
                const mapCenter = pickup?.latitude && pickup?.longitude
                    ? {lat: pickup.latitude, lng: pickup.longitude}
                    : undefined;
                const mapItem: IDispatchMapItem | undefined = currentJob
                    ? {
                        jobId: currentJob.id,
                        jobNo: currentJob.jobNo,
                        pickupAddress: currentJob.pickupAddress,
                        deliveryAddress: currentJob.deliveryAddress,
                        assignedCourier: currentJob.assignedCourier,
                    }
                    : undefined;
                return (
                    <Box sx={{height: '100%', minHeight: 0}}>
                        <DispatchMap
                            jobs={mapItem ? [mapItem] : []}
                            currentJob={mapItem}
                            mapCenter={mapCenter}
                            mapZoom={12}
                        />
                    </Box>
                );
            }

            case JobSearchBoxes.DeliveryJourney:
                if (!currentJobId) {
                    return (
                        <NoData
                            title="No Job Selected"
                            message="Select a job to see its delivery journey."
                            icon={<RouteOutlinedIcon/>}
                        />
                    );
                }
                return (
                    <TaskHistory
                        jobId={currentJobId}
                        showErrorToast={msg => showToast(msg, 'error')}
                        showInfoToast={msg => showToast(msg, 'info')}
                        showSuccessToast={msg => showToast(msg, 'success')}
                    />
                );

            default:
                return null;
        }
    }, [searchCriteria, handleCriteriaChange, handleSearch, handleDownload, handleClientReport, handleUpload, handleClientSearch, handleCourierSearch, handleSpeedSearch, fetchConfigMain, fetchConfigBulk, showToast, isUsCustomer, selectJob, currentJob, isBulkJob, timeZoneShort, searchCriteria.criteria.from_date, searchCriteria.criteria.to_date, handlePriceDetailReport, currentJob?.booked, currentJob?.pickupAddress]);

    const subtitleFor = useCallback((boxName: string) => {
        if (boxName === JobSearchBoxes.JobDetail || boxName === JobSearchBoxes.ScanList) {
            return currentJob?.jobNo;
        }
        return undefined;
    }, [currentJob?.jobNo]);

    const lockedFor = useCallback((boxName: string) => {
        if (boxName === JobSearchBoxes.JobDetail) {
            return !!currentJob?.locked;
        }
        return false;
    }, [currentJob?.locked]);

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
                        You&apos;re on the rebuilt Job Search. Spot something off? Open Settings and turn the toggle off to
                        switch back.
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
                    renderBoxContent={renderBoxContent}
                    onRefreshBox={handleRefreshBox}
                    boxSubtitle={subtitleFor}
                    boxLocked={lockedFor}
                    onColumnSizes={boxLayout.setColumnSizes}
                    onBoxHeights={boxLayout.setBoxHeights}
                    onMoveBox={boxLayout.moveBox}
                    columnEditMode={columnEditMode}
                    onExitColumnEditMode={handleExitColumnEditMode}
                    onAddColumn={boxLayout.addColumn}
                    onRemoveColumn={boxLayout.removeColumn}
                />
                {/* Job-detail FAB. Layout Edit/Done lives in the toolbar's
                    Layouts dropdown (driven via the bridge). */}
                <Box sx={{position: 'absolute', top: 8, right: 16, zIndex: 1}}>
                    <JobDetailFab currentJob={currentJob} onAction={fabAction}/>
                </Box>
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

// Adapter for the existing React job-details mount API.
// Mounts/unmounts via window.ReactJobDetails to keep the existing module
// boundary; Phase 3 may replace this with a direct JobDetails component import.
const ReactJobDetailsMount: React.FC<{
    jobId: number;
    isBulkJob: boolean;
    isUsCustomer: boolean;
    showToast: ShowToastFn;
}> = ({jobId, isBulkJob, isUsCustomer, showToast}) => {
    const containerId = 'react-job-search-job-detail';
    useEffect(() => {
        const w = window as any;
        if (!w.ReactJobDetails?.mount) return;
        w.ReactJobDetails.mount(containerId, {
            jobId,
            isBulkJob,
            isUsCustomer,
            showToast,
        });
        return () => {
            w.ReactJobDetails?.unmount?.();
        };
    }, [jobId, isBulkJob, isUsCustomer, showToast]);
    return <div id={containerId} style={{height: '100%', overflow: 'auto'}}/>;
};

