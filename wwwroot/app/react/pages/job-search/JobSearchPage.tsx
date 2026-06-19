import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import dayjs from 'dayjs';
import {AppPage} from '../../interfaces/dispatchJob';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {fetchBulkJobs, fetchPodJobs} from '../../services/jobSearchApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import type {DispatchJob, JobListSearchParams} from '../../interfaces/dispatchJob';
import {ISuggestion} from '../../../interfaces/job.interface';
import type {ShowToastFn} from '../../services/toastService';
import JobSearchBoxes from '../../../components/jobSearch/enums/jobSearchBoxes';
import {searchActiveClients} from '../../services/jobApi';
import {searchActiveCouriers} from '../../services/courierApi';
import {searchSpeedOptions} from '../../services/dispatchExecutorApi';
import {
    addRestoreEvent,
    restoreJobs,
    restoreSplitJobs,
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
import type {LayoutStorageKeys} from './lib/layoutPersistence';
import {SaveLayoutDialog} from '../../components/dialogs/save-layout-dialog/SaveLayoutDialog';
import {DeleteLayoutDialog} from '../../components/dialogs/delete-layout-dialog/DeleteLayoutDialog';

export interface JobSearchLayoutBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Opens the MUI "Save Layout" dialog and resolves with the entered name (or null if cancelled). */
    promptSaveLayout: () => Promise<string | null>;
    /** Opens the MUI "Delete Layout" confirmation and resolves true if confirmed. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
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

    const selectJob = useCallback((job: DispatchJob, bulk: boolean) => {
        setCurrentJob(job);
        setCurrentJobId(job.id);
        setIsBulkJob(bulk);
    }, []);

    useDeepLinkJob({
        deepLinkJobId,
        onSelectJob: jobId => {
            // For deep-link we only know the id — JobListPanel will populate
            // the full job object once results land. Track the id so the
            // job-detail panel mounts immediately.
            setCurrentJobId(jobId);
            setIsBulkJob(false);
        },
    });

    useEffect(() => {
        onLayoutBridgeReady?.({
            setCurrentLayoutName: boxLayout.setCurrentLayoutName,
            reloadFromStorage: boxLayout.reloadFromStorage,
            promptSaveLayout,
            promptDeleteLayout,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, promptSaveLayout, promptDeleteLayout]);

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
        const mainParams: Partial<JobListSearchParams> = {
            startDate: searchCriteria.criteria.from_date,
            endDate: searchCriteria.criteria.to_date,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            jobId: searchCriteria.criteria.jobId,
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
            page: 0,
        });
    }, [searchCriteria]);

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
        const params = new URLSearchParams();
        if (searchCriteria.criteria.from_date)
            params.append('fromDate', searchCriteria.criteria.from_date.toISOString());
        if (searchCriteria.criteria.to_date)
            params.append('toDate', searchCriteria.criteria.to_date.toISOString());
        searchCriteria.selectedClientIds?.forEach(id => params.append('clientIds', String(id)));
        searchCriteria.selectedCourierIds?.forEach(id => params.append('courierIds', String(id)));
        searchCriteria.selectedSpeedIds?.forEach(id => params.append('speedIds', String(id)));
        if (searchCriteria.criteria.wild) params.append('wild', searchCriteria.criteria.wild);
        if (searchCriteria.criteria.job) params.append('job', searchCriteria.criteria.job);
        window.location.assign(`/Job/DownloadPODJobs?${params.toString()}`);
    }, [searchCriteria]);

    const handleClientReport = useCallback(() => {
        const params = new URLSearchParams();
        if (searchCriteria.criteria.from_date)
            params.append('fromDate', searchCriteria.criteria.from_date.toISOString());
        if (searchCriteria.criteria.to_date)
            params.append('toDate', searchCriteria.criteria.to_date.toISOString());
        searchCriteria.selectedClientIds?.forEach(id => params.append('clientIds', String(id)));
        window.location.assign(`/Job/DownloadClientJobsReport?${params.toString()}`);
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
                    // Phase 3.5: the FAB dispatch flow opens the in-list DispatchDialog
                    // from JobListContextMenu; for the FAB we surface a courier-id prompt
                    // via the existing dispatch service. Tracked as a Phase 4 follow-up.
                    showToast('Use the row context menu to dispatch — FAB dispatch is on the Phase 4 punch list.', 'info');
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

            case JobSearchBoxes.Map:
                return (
                    <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>
                        Map integration will land in Phase 3 (reuse existing DispatchMap component).
                    </Box>
                );

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

