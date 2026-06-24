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
import {openInterCourierChargeDialog} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import type {LayoutStorageKeys} from './lib/layoutPersistence';
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
    /** Opens the Inter-Courier Charge dialog, wired to this page's toast. */
    openInterCourierCharge: () => Promise<void>;
}

export interface JobSearchPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    timeZone: string;
    timeZoneShort?: string;
    deepLinkJobId?: number;
    /** Called once with imperative handles for the AppShell toolbar to drive layout selection. */
    onLayoutBridgeReady?: (bridge: JobSearchLayoutBridge) => void;
}

export const JobSearchPage: React.FC<JobSearchPageProps> = ({
    showToast,
    isUsCustomer,
    timeZone,
    timeZoneShort,
    deepLinkJobId,
    onLayoutBridgeReady,
}) => {
    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsCS-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutCS-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibility-${LegacyAppPage.JobSearch}-${ContactID}`,
    }), []);

    const searchCriteria = useSearchCriteria({timeZone});
    const boxLayout = useBoxLayout({storageKeys});

    const [currentJob, setCurrentJob] = useState<DispatchJob | undefined>();
    const [currentJobId, setCurrentJobId] = useState<number | undefined>();
    const [isBulkJob, setIsBulkJob] = useState(false);
    const [sortColumn, setSortColumn] = useState<string | undefined>();
    const [sortDirection, setSortDirection] = useState<string | undefined>();
    const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);

    // Save-layout dialog — opened imperatively via the layout bridge from the
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

    // Delete-layout confirmation — same imperative bridge pattern as save.
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
            openInterCourierCharge,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, promptSaveLayout, promptDeleteLayout, openInterCourierCharge]);

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
    }), []);

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
    }), []);

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
    }, [searchCriteria, sortColumn, sortDirection]);

    const handleRefreshBox = useCallback((boxName: string) => {
        switch (boxName) {
            case JobSearchBoxes.JobList:
                queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.pod({} as any)});
                break;
            case JobSearchBoxes.BulkJobList:
                queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.bulk({} as any)});
                break;
            case JobSearchBoxes.JobDetail:
                if (currentJobId) {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.jobs.detail(currentJobId, isBulkJob ? 'bulk' : 'standard'),
                    });
                }
                break;
            case JobSearchBoxes.ScanList:
                if (currentJobId) {
                    queryClient.invalidateQueries({
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
    }, [searchCriteria]);

    const handleClientReport = useCallback(() => {
        const url = getClientJobsReportDownloadUrl(
            searchCriteria.criteria.from_date,
            searchCriteria.criteria.to_date,
            searchCriteria.selectedClientIds,
        );
        window.open(url, '_blank');
    }, [searchCriteria]);

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
                    invalidateDetail();
                    return;

                case 'attachments':
                    await w.ReactJobFileUploadDialog?.open(job.id);
                    invalidateDetail();
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
                    invalidateLists();
                    invalidateDetail();
                    return;

                case 'swapPod':
                    await w.ReactSwapPodsDialog?.open(job.jobNo, {showToast});
                    invalidateLists();
                    invalidateDetail();
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
                    invalidateLists();
                    invalidateDetail();
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
                    invalidateLists();
                    invalidateDetail();
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
        queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all});
        queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(currentJob.id, isBulkJob ? 'bulk' : 'standard'),
        });
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
        queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all});
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
                        <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>
                            Select a job from the list to see its details.
                        </Box>
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
                        <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>
                            Select a job to see its delivery journey.
                        </Box>
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
    }, [
        searchCriteria,
        handleCriteriaChange,
        handleSearch,
        handleDownload,
        handleClientReport,
        handleUpload,
        handleClientSearch,
        handleCourierSearch,
        handleSpeedSearch,
        fetchConfigMain,
        fetchConfigBulk,
        showToast,
        isUsCustomer,
        selectJob,
        currentJobId,
        currentJob,
        isBulkJob,
        timeZoneShort,
    ]);

    const subtitleFor = useCallback((boxName: string) => {
        if (boxName === JobSearchBoxes.JobDetail || boxName === JobSearchBoxes.ScanList) {
            return currentJob?.jobNo;
        }
        return undefined;
    }, [currentJob]);

    const lockedFor = useCallback((boxName: string) => {
        if (boxName === JobSearchBoxes.JobDetail) {
            return !!currentJob?.locked;
        }
        return false;
    }, [currentJob]);

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0}}>
            {/* BETA banner — opt-in toggle lives in the Settings dialog. */}
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
                    You&apos;re on the rebuilt Job Search. Spot something off? Open Settings and turn the toggle off to switch back.
                </Typography>
            </Box>
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
                    boxLocked={lockedFor}
                    onColumnSizes={boxLayout.setColumnSizes}
                    onBoxHeights={boxLayout.setBoxHeights}
                    onMoveBox={boxLayout.moveBox}
                />
                {/* FAB lives outside the box — Phase 4 will dock it inside JobDetail header */}
                <Box sx={{position: 'absolute', top: 8, right: 16, zIndex: 1}}>
                    <JobDetailFab currentJob={currentJob} onAction={fabAction} />
                </Box>
            </Box>
            <SaveLayoutDialog
                open={saveDialogOpen}
                existingNames={boxLayout.layouts.map(l => l.name)}
                onClose={() => resolveSaveLayout(null)}
                onConfirm={name => resolveSaveLayout(name)}
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
    return <div id={containerId} style={{height: '100%', overflow: 'auto'}} />;
};

