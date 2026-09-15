import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box} from '@mantine/core';
import dayjs from 'dayjs';
import type {DispatchJob, JobListSearchParams} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {fetchBulkJobs, fetchDispatchBulkJobDetail, fetchPodJobs} from '../../services/jobSearchApi';
import {getDispatchJobDetail, searchSpeedOptions} from '../../services/dispatchExecutorApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import {IDispatchMapItem, ISuggestion} from '../../../interfaces/job.interface';
import JobSearchBoxes from './lib/jobSearchBoxes';
import {searchActiveClients} from '../../services/jobApi';
import {searchActiveCouriers} from '../../services/courierApi';
import {
    addRestoreEvent,
    getActivePartnerOptions,
    getPartnerRateForJob,
    getRestorePodImpact,
    restoreJobs,
    restoreSplitJobs,
    sendToPartner,
    setJobLocked,
    unSplitJob,
} from '../../services/jobListApi';
import type {RestorePodImpactSummary} from '../../components/dialogs/restore-confirmation-dialog';
import {RestoreConfirmationDialog} from '../../components/dialogs/restore-confirmation-dialog';
import {useChangeCourierFlow} from '../../components/dialogs/change-courier-dialog';
import {needsRestoreConfirmation, summarisePodImpact} from '../../services/restorePodImpact';
import {Briefcase, Route} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';
import {NoData} from '../../components/common/no-data/NoData';
import {SearchCriteriaPanel, SearchActionDates} from '../../components/common/search-criteria-panel/SearchCriteriaPanel';
import {JobListPanel} from '../../components/job-list/JobListPanel';
import {JobDetailsMount} from '../../components/common/job-details/JobDetailsMount';
import {TaskHistory} from '../../components/common/task-history/TaskHistory';
import {BoxShell} from '../../components/common/box-shell/BoxShell';
import {JobSearchJobActionsMenu, type JobSearchJobActionId} from './components/JobSearchJobActionsMenu';
import {ScanList} from './components/ScanList';
import {useSearchCriteria} from './hooks/useSearchCriteria';
import {useBoxLayout} from '../../components/common/box-shell/useBoxLayout';
import {useDeepLinkJob} from './hooks/useDeepLinkJob';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from './lib/boxDefinitions';
import {filterCouriersForNumericSearch, normalizeSearchDate} from './lib/searchCriteria';
import {getClientJobsReportDownloadUrl, getPodJobsDownloadUrl} from './lib/exportUrls';
import {getPriceDetailReportDownloadUrl} from './lib/priceDetailExport';
import {
    openInterCourierChargeDialog
} from '../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module';
import type {LayoutStorageKeys} from '../../components/common/box-shell/layoutPersistence';
import {LayoutPromptDialogs} from '../../components/layout-prompts/LayoutPromptDialogs';
import {useLayoutPrompts} from '../../components/layout-prompts/useLayoutPrompts';
import {DispatchDialog, type DispatchConfirmation} from '../../components/dialogs/dispatch-dialog';
import {
    isNetworkPartnerSession,
    stopJobCountFor,
} from '../../components/dialogs/dispatch-dialog/dispatchSession';
import {executeDispatchConfirmation} from '../../components/dialogs/dispatch-dialog/executeDispatch';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';
import {JobSearchPageProps} from "./JobSearchPageProps";

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
    const boxLayout = useBoxLayout({
        storageKeys,
        legacyStorageKeys,
        page: 'JobSearch',
        createBoxes: createJobSearchBoxes,
        createDefaultLayout: createDefaultJobSearchLayout,
    });

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
    const [sortColumn, setSortColumn] = useState<string | undefined>();
    const [sortDirection, setSortDirection] = useState<string | undefined>();
    const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
    const [restoreConfirm, setRestoreConfirm] =
        useState<{job: DispatchJob; summary: RestorePodImpactSummary} | null>(null);

    // Save / rename / delete layout prompts, opened imperatively via the layout bridge
    // from the AngularJS toolbar so `routes.ts` keeps owning persistence.
    const layoutPrompts = useLayoutPrompts();
    const {promptSaveLayout, promptDeleteLayout, promptRenameLayout} = layoutPrompts;

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
    // selectBulkJobDetail). Job action availability and the ScanList run date
    // rely on fields the list-row DTO may not carry, so we replace the optimistic
    // row with the full record once it lands.
    const loadFullDetail = useCallback((jobId: number, bulk: boolean) => {
        const request = bulk ? fetchDispatchBulkJobDetail(jobId) : getDispatchJobDetail(jobId);
        request
            .then(full => {
                if (full && selectedIdRef.current === jobId) setCurrentJob(full);
            })
            .catch(err => {
                console.error('[JobSearchPage] Failed to load job detail:', err);
                showToast('Could not load the full job detail. Showing the list row only.', 'error');
            });
    }, [showToast]);

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
            // job-detail panel, actions menu and ScanList (booked run date) have real
            // data instead of waiting for the list results to land.
            selectedIdRef.current = jobId;
            setCurrentJobId(jobId);
            setIsBulkJob(false);
            loadFullDetail(jobId, false);
        },
    });

    // A job created from the toolbar won't be in the current results, so open it
    // by id the same way a deep link does rather than waiting for the list.
    const jobCreated = useCallback((jobId: number) => {
        selectedIdRef.current = jobId;
        setCurrentJobId(jobId);
        setIsBulkJob(false);
        loadFullDetail(jobId, false);
    }, [loadFullDetail]);

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
            jobCreated,
            importLegacyLayouts: boxLayout.importLegacyLayouts,
        });
    }, [onLayoutBridgeReady, boxLayout.setCurrentLayoutName, boxLayout.reloadFromStorage, boxLayout.importLegacyLayouts, promptSaveLayout, promptDeleteLayout, promptRenameLayout, openInterCourierCharge, jobCreated]);

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

    // The panel hands us the dates it flushed in this same click, because the
    // matching setState has not landed yet. Fall back to committed state for
    // callers that pass nothing (the AngularJS V1 bridge, which commits its
    // criteria synchronously).
    const resolveDates = useCallback((dates?: SearchActionDates) => ({
        from: normalizeSearchDate(dates?.fromDate) ?? searchCriteria.criteria.from_date,
        to: normalizeSearchDate(dates?.toDate) ?? searchCriteria.criteria.to_date,
    }), [searchCriteria.criteria.from_date, searchCriteria.criteria.to_date]);

    const handleSearch = useCallback((dates?: SearchActionDates) => {
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
        const {from, to} = resolveDates(dates);

        const mainParams: Partial<JobListSearchParams> = {
            startDate: from,
            endDate: to,
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
            startDate: from,
            endDate: to,
            courierIds: searchCriteria.selectedCourierIds,
            clientIds: searchCriteria.selectedClientIds,
            speedIds: searchCriteria.selectedSpeedIds,
            wild: searchCriteria.criteria.wild,
            job: searchCriteria.criteria.job,
            bulkJobId: searchCriteria.criteria.bulkJobId,
            disabled: byJobId,
            page: 0,
        });
    }, [sortColumn, sortDirection, resolveDates, searchCriteria.criteria.bulkJobId, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

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
            showToast('Courier search failed. Please try again.', 'error');
            return [];
        }
    }, [showToast]);
    const handleSpeedSearch = useCallback(async (text: string) => {
        if (!text || text.length < 2) return [];
        try {
            const results = await searchSpeedOptions(text);
            return results as ISuggestion[];
        } catch (err) {
            console.error('Error in speed search:', err);
            showToast('Service-level search failed. Please try again.', 'error');
            return [];
        }
    }, [showToast]);

    const handleCriteriaChange = useCallback(
        (field: string, value: ISuggestion[] | string | number | undefined) => {
            searchCriteria.setField(field as any, value as any);
        },
        [searchCriteria],
    );

    const handleDownload = useCallback((dates?: SearchActionDates) => {
        const {from, to} = resolveDates(dates);
        const url = getPodJobsDownloadUrl(
            from,
            to,
            searchCriteria.selectedCourierIds,
            searchCriteria.selectedClientIds,
            searchCriteria.selectedSpeedIds,
            searchCriteria.criteria.wild,
            searchCriteria.criteria.job,
            searchCriteria.criteria.jobId,
        );
        // Open in a new tab to trigger the browser's native download (matches V1).
        window.open(url, '_blank');
    }, [resolveDates, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

    const handleClientReport = useCallback((dates?: SearchActionDates) => {
        const {from, to} = resolveDates(dates);
        const url = getClientJobsReportDownloadUrl(
            from,
            to,
            searchCriteria.selectedClientIds,
        );
        window.open(url, '_blank');
    }, [resolveDates, searchCriteria.selectedClientIds]);

    const handlePriceDetailReport = useCallback((dates?: SearchActionDates) => {
        const {from, to} = resolveDates(dates);
        const url = getPriceDetailReportDownloadUrl(
            from,
            to,
            searchCriteria.selectedCourierIds,
            searchCriteria.selectedClientIds,
            searchCriteria.selectedSpeedIds,
            searchCriteria.criteria.wild,
            searchCriteria.criteria.job,
            searchCriteria.criteria.jobId,
        );
        window.open(url, '_blank');
    }, [resolveDates, searchCriteria.selectedCourierIds, searchCriteria.selectedClientIds, searchCriteria.selectedSpeedIds, searchCriteria.criteria.wild, searchCriteria.criteria.job, searchCriteria.criteria.jobId]);

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

    const invalidateJob = useCallback((job: DispatchJob) => Promise.all([
        queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all}),
        queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(job.id, job.isBulkJob ? 'bulk' : 'standard'),
        }),
    ]), []);

    const performRestore = useCallback(async (job: DispatchJob, removeCapturedImages = false) => {
        await addRestoreEvent(job.id);
        await restoreJobs([job.id], removeCapturedImages);
        showToast(`${job.jobNo} restored.`, 'success');
        await invalidateJob(job);
    }, [showToast, invalidateJob]);

    const openSwapPod = useCallback(async (job: DispatchJob) => {
        await (window as any).ReactSwapPodsDialog?.open(job.jobNo, {showToast});
        await invalidateJob(job);
    }, [showToast, invalidateJob]);

    // Archived-job "Change Paid Courier" flow: eligibility gate + dialog + blocked popup.
    const {openChangeCourier, changeCourierDialogs} = useChangeCourierFlow({
        showToast,
        onChanged: (jobId) => Promise.all([
            queryClient.invalidateQueries({queryKey: queryKeys.jobSearch.all}),
            queryClient.invalidateQueries({queryKey: queryKeys.jobs.detail(jobId, 'standard')}),
        ]).then(() => undefined),
    });

    const jobAction = useCallback(async (actionId: JobSearchJobActionId, job: DispatchJob) => {
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

                case 'changeCourier':
                    await openChangeCourier(job);
                    return;

                case 'restore': {
                    // Split jobs go through a different proc that has no image opt-in, so only the
                    // plain restore is gated on what it would destroy.
                    if (job.displaySplitJobDetail) {
                        await addRestoreEvent(job.id);
                        await restoreSplitJobs([job.id]);
                        showToast(`${job.jobNo} restored.`, 'success');
                        await Promise.all([invalidateLists(), invalidateDetail()]);
                        return;
                    }

                    let summary: RestorePodImpactSummary = {jobsWithPodName: 0, imageCount: 0};
                    try {
                        summary = summarisePodImpact(await getRestorePodImpact([job.id]));
                    } catch {
                        // Never block a restore on the pre-check.
                    }

                    if (needsRestoreConfirmation(!!job.done, summary)) {
                        setRestoreConfirm({job, summary});
                        return;
                    }
                    await performRestore(job);
                    return;
                }

                case 'swapPod':
                    await openSwapPod(job);
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
                    // dialog, this menu matches the un-split entry below. The pricing dialog inside
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
                    showToast(`Unknown job action: ${actionId}`, 'warning');
            }
        } catch (error) {
            console.error(`[JobSearchPage] Job action "${actionId}" failed:`, error);
            showToast(`Failed to ${actionId}: ${error instanceof Error ? error.message : 'unknown error'}`, 'error');
        }
    }, [showToast, openChangeCourier]);

    // ── Job-actions dispatch (DispatchDialog) ─────────────────────────
    // Single-job dispatch from the job-detail actions menu. Courier path allocates (or
    // re-allocates if a courier is already assigned); partner path sends to a
    // DFRNT partner. Mirrors JobListContextMenu's handlers.
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
                    <Box style={{height: '100%', overflow: 'auto'}}>
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
                            icon={<Icon lucide={Briefcase}/>}
                        />
                    );
                }
                return (
                    <JobDetailsMount
                        jobId={currentJobId}
                        containerId="react-job-search-job-detail"
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
                    <Box style={{height: '100%', minHeight: 0}}>
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
                            icon={<Icon lucide={Route}/>}
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

    // The job actions live in the Job Detail panel header rather than floating over
    // the shell, so they can't be mistaken for a control of the right-most column.
    const boxRightSlotFor = useCallback((boxName: string): React.ReactNode => {
        if (boxName === JobSearchBoxes.JobDetail) {
            return <JobSearchJobActionsMenu currentJob={currentJob} onAction={jobAction}/>;
        }
        return undefined;
    }, [currentJob, jobAction]);

    return (
        <Box style={{display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0}}>
            <Box style={{flex: 1, minHeight: 0}}>
                <BoxShell
                    layout={boxLayout.layout}
                    layoutVersion={boxLayout.layoutVersion}
                    boxes={boxLayout.boxes}
                    renderBoxContent={renderBoxContent}
                    onRefreshBox={handleRefreshBox}
                    boxSubtitle={subtitleFor}
                    boxLocked={lockedFor}
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
            {changeCourierDialogs}
            <RestoreConfirmationDialog
                open={restoreConfirm !== null}
                count={restoreConfirm?.job.done ? 1 : 0}
                podImpact={restoreConfirm?.summary}
                onClose={() => setRestoreConfirm(null)}
                onSwapPod={restoreConfirm ? async () => {
                    const {job} = restoreConfirm;
                    setRestoreConfirm(null);
                    await openSwapPod(job);
                } : undefined}
                onConfirm={async (removeCapturedImages) => {
                    const {job} = restoreConfirm!;
                    setRestoreConfirm(null);
                    await performRestore(job, removeCapturedImages);
                }}
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
