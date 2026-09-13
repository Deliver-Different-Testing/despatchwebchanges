import React, {useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ContactID} from '../../../contants';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {AppPage} from '../../interfaces/dispatchJob';
import type {DispatchJob} from '../../interfaces/dispatchJob';
import type {IDispatchMapItem, ISuggestion} from '../../../interfaces/job.interface';
import {JobProperty} from '../../../enums/job-property.enum';
import type {Agent} from '../../interfaces/agent';
import type {FlightViewModel} from '../../interfaces/nationwideJobs';
import {formatDateForApiWithTzs} from '../../utils/dateUtils';
import {
    fetchNationwideJobsNew,
    fetchNationwideJobsPod,
    fetchNationwideJobsReprice,
} from '../../services/jobSearchApi';
import {getDispatchJobDetail} from '../../services/dispatchExecutorApi';
import {queryClient, queryKeys} from '../../query/queryClient';
import {JobListPanel} from '../../components/job-list/JobListPanel';
import {DispatchMap} from '../../components/common/dispatch-map/DispatchMap';
import {NoData} from '../../components/common/no-data/NoData';
import {FlightAgentDataTable} from '../../components/common/flight-agent-data-table';
import {TasksBox} from '../../components/common/tasks-box/TasksBox';
import {JobDetailsMount} from '../../components/common/job-details/JobDetailsMount';
import {ConfirmDialog} from '../../components/dialogs/confirm-dialog';
import {DispatchDialog, type DispatchConfirmation} from '../../components/dialogs/dispatch-dialog';
import {
    isNetworkPartnerSession,
    stopJobCountFor,
} from '../../components/dialogs/dispatch-dialog/dispatchSession';
import {executeDispatchConfirmation} from '../../components/dialogs/dispatch-dialog/executeDispatch';
import {
    getActivePartnerOptions,
    getPartnerRateForJob,
    sendToPartner,
} from '../../services/jobListApi';
import {openFlightConfirmationDialog} from '../../components/dialogs/flight-agent-confirmation-dialog/flight-agent-confirmation-dialog-react.module';
import {openAutoCompleteDialog} from '../../components/dialogs/auto-complete-dialog/auto-complete-dialog-react.module';
import {openRecoveryAgentManagementDialog} from '../../components/dialogs/recovery-agent-management-dialog';
import {nationwideApi} from '../../services/nationwideApi';
import {canAssignAgentToJob} from '../../services/dispatchExecutorApi';
import {apiClient} from '../../services/apiClient';
import {BoxShell} from '../../components/common/box-shell/BoxShell';
import {useBoxLayout} from '../../components/common/box-shell/useBoxLayout';
import type {LayoutStorageKeys} from '../../components/common/box-shell/layoutPersistence';
import {LayoutPromptDialogs} from '../../components/layout-prompts/LayoutPromptDialogs';
import {useLayoutPrompts} from '../../components/layout-prompts/useLayoutPrompts';
import {NZ_MAP_CENTER, US_MAP_CENTER, getDefaultMapCenter} from '../../components/common/here-map/HereMap.types';
import {NationwideBoxes} from './lib/nationwideBoxes';
import {createDefaultNationwideLayout, createNationwideBoxes} from './lib/boxDefinitions';
import {calculateMapBounds} from './lib/mapBounds';
import {
    formatAirportCodeForDropdown,
    formatMinutesAsDuration,
    getConnectionTime,
} from './lib/flightFormatting';
import {useFlightAgentWidget} from './hooks/useFlightAgentWidget';
import {loadDateFilterFrom} from '../../utils/dateFilterStorage';
import type {NationwidePageProps} from './NationwidePageProps';

/** Storage prefixes for each list's own column/sort/density preferences. */
const LIST_STORAGE_PREFIX = {
    [NationwideBoxes.NewJobs]: 'nwNewJobList',
    [NationwideBoxes.PodJobs]: 'nwPodJobList',
    [NationwideBoxes.RepriceJobs]: 'nwRepriceJobList',
} as const;

const LIST_FETCHERS = {
    [NationwideBoxes.NewJobs]: fetchNationwideJobsNew,
    [NationwideBoxes.PodJobs]: fetchNationwideJobsPod,
    [NationwideBoxes.RepriceJobs]: fetchNationwideJobsReprice,
} as const;

/** Each list caches separately -- they page independently. */
const LIST_QUERY_KEYS = {
    [NationwideBoxes.NewJobs]: queryKeys.nationwide.newJobs,
    [NationwideBoxes.PodJobs]: queryKeys.nationwide.podJobs,
    [NationwideBoxes.RepriceJobs]: queryKeys.nationwide.repriceJobs,
} as const;

export const NationwidePage: React.FC<NationwidePageProps> = ({
                                                                  showToast,
                                                                  isUsCustomer,
                                                                  timeZone,
                                                                  deepLinkJobId,
                                                              }) => {
    /*
     * V2 keys, with V1's as the import source -- the same arrangement Dispatch
     * and Job Search use. Writing V1's keys directly would corrupt the classic
     * page's layouts for operators who still opt out of this one.
     */
    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsNWV2-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutNWV2-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${LegacyAppPage.Domestic}-${ContactID}`,
    }), []);

    const legacyStorageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsNW-${ContactID}`,
        lastActiveLayoutKey: `lastActiveLayoutNW-${ContactID}`,
        boxVisibilityKeyBase: `boxVisibility-${LegacyAppPage.Domestic}-${ContactID}`,
    }), []);

    const boxLayout = useBoxLayout({
        storageKeys,
        legacyStorageKeys,
        page: 'Nationwide',
        createBoxes: createNationwideBoxes,
        createDefaultLayout: createDefaultNationwideLayout,
    });

    const layoutPrompts = useLayoutPrompts();

    const [currentJob, setCurrentJob] = useState<DispatchJob | undefined>();

    const dateFilter = useMemo(
        () => loadDateFilterFrom(`dateFilter-${LegacyAppPage.Domestic}-${ContactID}`, {timeZone}),
        [timeZone],
    );

    /*
     * Deep link. V1 could not honour `?jobId` at all -- it looked the id up in a
     * local array that was never populated -- so this resolves against the
     * server instead. `enabled` keeps it to a single fetch on mount.
     */
    useQuery({
        queryKey: queryKeys.jobs.detail(deepLinkJobId ?? 0, 'standard'),
        queryFn: async () => {
            const job = await getDispatchJobDetail(deepLinkJobId!);
            if (job) setCurrentJob(job);
            return job;
        },
        enabled: !!deepLinkJobId && !currentJob,
    });

    const selectJob = useCallback((job: DispatchJob) => setCurrentJob(job), []);

    /** Select a job we only have the id for — a task click, or a deep link. */
    const selectJobById = useCallback(async (jobId: number) => {
        try {
            const job = await getDispatchJobDetail(jobId);
            if (job) setCurrentJob(job);
        } catch (error) {
            console.error('Could not load job', jobId, error);
            showToast('Could not open that job. Please try again.', 'error');
        }
    }, [showToast]);

    /**
     * Point the flight/agent widget at a related job without changing the page
     * selection, so the detail panel and lists stay where the operator left them.
     */
    const retargetWidget = useCallback(async (jobId: number) => {
        try {
            const job = await getDispatchJobDetail(jobId);
            if (job) setWidgetJob(job);
        } catch (error) {
            console.error('Could not load related job', jobId, error);
        }
    }, []);

    /*
     * The widget follows its own job: switching the related-job tab inside the
     * detail panel retargets the flight/agent search without changing the
     * page's selection (V1 `flightAgentWidgetJob` vs `currentJob`).
     */
    const [widgetJob, setWidgetJob] = useState<DispatchJob | undefined>();
    /** Agent picked for assignment; hands off to the shared dispatch dialog. */
    const [agentToDispatch, setAgentToDispatch] = useState<Agent | undefined>();
    const flightAgentJob = widgetJob ?? currentJob;

    const onWarning = useCallback(
        (message: string) => showToast(message, 'warning'),
        [showToast],
    );

    const widget = useFlightAgentWidget({job: flightAgentJob, timeZone, onWarning});

    /** Quote request and the "flight required" notice both use the shared confirm. */
    const [confirm, setConfirm] = useState<{
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);
    const closeConfirm = useCallback(() => setConfirm(null), []);

    const refreshLists = useCallback(() => {
        // Both the new-jobs and POD lists can change when a flight or agent
        // lands, matching V1's `getJobList([NEW, POD])`.
        void queryClient.invalidateQueries({queryKey: queryKeys.nationwide.all});
    }, []);

    const handleAddFlightToJob = useCallback(async (flight: FlightViewModel) => {
        if (!flightAgentJob) return;

        const result = await openFlightConfirmationDialog({
            jobId: flightAgentJob.id,
            jobNumber: flightAgentJob.jobNo,
            flight: flight as never,
            existingAwb: flightAgentJob.conNote,
            toastService: {showToast},
        });
        if (!result?.shouldAssign) return;

        try {
            await nationwideApi.assignFlightToJob({
                jobId: flightAgentJob.id,
                fromAirportId: widget.selectedOutboundAirport?.id,
                toAirportId: widget.selectedInboundAirport?.id,
                flightNumber: flight.flightNumber,
                departureDate: formatDateForApiWithTzs(flight.departureTime),
                flightSegments: (flight.flightSegments ?? []) as never,
                packageReadyTime: result.packageReadyTime
                    ? formatDateForApiWithTzs(result.packageReadyTime)
                    : undefined,
                packageDeliverByTime: result.packageDeliverByTime
                    ? formatDateForApiWithTzs(result.packageDeliverByTime)
                    : undefined,
                packageDeliveryNotes: result.packageDeliveryNotes,
            });

            // V1 wrote a returned AWB back to the job's ConNote.
            if (result.awb) {
                await apiClient.post('job/UpdateJob', {
                    jobId: flightAgentJob.id,
                    property: JobProperty.ConNote,
                    value: result.awb,
                });
            }

            refreshLists();
            showToast('Flight assigned to job', 'success');
        } catch (error) {
            console.error('Error assigning flight:', error);
            showToast('Could not assign the flight. Please try again.', 'error');
        }
    }, [flightAgentJob, widget.selectedOutboundAirport, widget.selectedInboundAirport, showToast, refreshLists]);

    const handleAddAgentToJob = useCallback(async (agent: Agent) => {
        if (!flightAgentJob) return;

        // V1 blocked agent assignment until a flight exists, via $mdDialog.alert.
        const allowed = await canAssignAgentToJob(flightAgentJob.id).catch(() => true);
        if (!allowed) {
            setConfirm({
                title: 'Flight Assignment Required',
                message: 'Assign a flight to this job before assigning an agent.',
            });
            return;
        }

        setAgentToDispatch(agent);
    }, [flightAgentJob]);

    const handleSendQuoteRequest = useCallback((agent: Agent) => {
        if (!flightAgentJob) return;

        setConfirm({
            title: 'Send Quote Request',
            message: `Send a quote request to ${agent.agentName} for job ${flightAgentJob.jobNo}?`,
            onConfirm: async () => {
                closeConfirm();
                try {
                    await nationwideApi.sendAgentQuote(flightAgentJob.id, agent.agentId);
                    showToast('Quote request sent', 'success');
                } catch (error) {
                    console.error('Error sending quote request:', error);
                    showToast('Could not send the quote request. Please try again.', 'error');
                }
            },
        });
    }, [flightAgentJob, showToast, closeConfirm]);

    const closeDispatchDialog = useCallback(() => setAgentToDispatch(undefined), []);

    /**
     * The dialog performs the assignment; this reacts to the outcome. V1
     * refreshed the New and POD lists, then re-selected a freshly fetched job so
     * the detail panel and the widget both saw the assignment.
     */
    const handleDispatchCourier = useCallback(async (confirmation: DispatchConfirmation) => {
        if (!flightAgentJob) return;

        const {message, severity} = await executeDispatchConfirmation(
            {
                id: flightAgentJob.id,
                jobNo: flightAgentJob.jobNo,
                assignedCourierId: flightAgentJob.assignedCourier?.id,
            },
            confirmation,
        );

        showToast(message, severity);
        closeDispatchDialog();
        refreshLists();
        await selectJobById(flightAgentJob.id);
    }, [flightAgentJob, showToast, closeDispatchDialog, refreshLists, selectJobById]);

    const handleSendToPartner = useCallback(async (partner: ISuggestion, agreedRate: number) => {
        if (!flightAgentJob) return;

        const result = await sendToPartner(flightAgentJob.id, partner.id, agreedRate);
        if (!result.success) {
            throw new Error(result.message || 'Failed to send job to partner');
        }

        closeDispatchDialog();
        showToast(
            `Job ${flightAgentJob.jobNo} sent to ${partner.text} — tracking: ${result.trackingNumber}`,
            'success',
        );
        refreshLists();
        await selectJobById(flightAgentJob.id);
    }, [flightAgentJob, showToast, closeDispatchDialog, refreshLists, selectJobById]);

    const handleOpenAgentSearchDialog = useCallback(async () => {
        if (!flightAgentJob) return;

        const picked = await openAutoCompleteDialog(
            'Search Agents',
            'Start typing an agent name',
            (term: string) => apiClient.get('nationwideJob/GetAllAgentsSearch', {searchTerm: term}),
        );
        if (!picked?.item) return;

        await handleAddAgentToJob({
            agentId: picked.item.id,
            agentName: picked.item.text,
        } as Agent);
    }, [flightAgentJob, handleAddAgentToJob]);

    const handleOpenRecoveryAgentDialog = useCallback(() => {
        if (!flightAgentJob) return;
        void openRecoveryAgentManagementDialog({jobId: flightAgentJob.id});
    }, [flightAgentJob]);

    const fetchConfigFor = useCallback((boxName: keyof typeof LIST_FETCHERS) => ({
        fetchFn: LIST_FETCHERS[boxName],
        queryKeyFn: LIST_QUERY_KEYS[boxName],
        initialParams: {
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
            useTime: dateFilter.useTime,
            isInternal: window.ClientInternal ?? false,
            page: 0,
            pageSize: 50,
        },
    }), [dateFilter]);

    const mapConfig = useMemo(() => {
        if (!currentJob) {
            return {center: getDefaultMapCenter(), zoom: 7, selectedJobIndex: 0};
        }
        return calculateMapBounds(currentJob as never, {
            isUsCustomer,
            usCentre: US_MAP_CENTER,
            nzCentre: NZ_MAP_CENTER,
        });
    }, [currentJob, isUsCustomer]);

    /** The map takes its own item shape, not the list DTO. */
    const mapItems = useMemo<IDispatchMapItem[]>(() => (currentJob ? [{
        jobId: currentJob.id,
        jobNo: currentJob.jobNo,
        pickupAddress: currentJob.pickupAddress,
        deliveryAddress: currentJob.deliveryAddress,
        assignedCourier: currentJob.assignedCourier,
        statusId: currentJob.statusId,
    }] : []), [currentJob]);

    const renderBoxContent = useCallback((boxName: string) => {
        switch (boxName) {
            case NationwideBoxes.NewJobs:
            case NationwideBoxes.PodJobs:
            case NationwideBoxes.RepriceJobs: {
                const key = boxName as keyof typeof LIST_FETCHERS;
                return (
                    <JobListPanel
                        showToast={showToast}
                        isUsCustomer={isUsCustomer}
                        appPage={AppPage.Domestic}
                        storagePrefix={LIST_STORAGE_PREFIX[key]}
                        fetchConfig={fetchConfigFor(key) as never}
                        onJobSelect={selectJob}
                    />
                );
            }

            case NationwideBoxes.Map:
                return (
                    <DispatchMap
                        mapCenter={mapConfig.center}
                        mapZoom={mapConfig.zoom}
                        jobs={mapItems}
                        currentJob={mapItems[0]}
                        preferenceScope="nationwide"
                    />
                );

            case NationwideBoxes.JobDetail:
                if (!currentJob) return <NoData message="Select a job from one of the lists"/>;
                return (
                    <JobDetailsMount
                        jobId={currentJob.id}
                        containerId="react-nationwide-job-detail"
                        isUsCustomer={isUsCustomer}
                        showToast={showToast}
                        /* Retargets the flight/agent widget without moving the
                           page selection (V1 onRelatedJobChange). */
                        onRelatedJobChange={(jobId) => void retargetWidget(jobId)}
                        onJobUpdate={refreshLists}
                    />
                );

            case NationwideBoxes.FlightAgents:
                return (
                    <FlightAgentDataTable
                        isDeliveryJobType={widget.uiState.isDeliveryJobType}
                        currentJob={(flightAgentJob ?? null) as never}
                        flightsLoading={widget.flightsLoading}
                        agentsLoading={widget.agentsLoading}
                        flightOptions={widget.flightOptions as never}
                        filteredFlightOptions={widget.filteredFlightOptions as never}
                        flightSearchText={widget.flightSearchText}
                        flightMessage={widget.flightMessage}
                        agentOptions={widget.agentOptions as never}
                        agentMessage={widget.agentMessage}
                        activeAirlineOptions={widget.activeAirlineOptions as never}
                        selectedAirline={widget.selectedAirline as never}
                        includeNearbyAirports={widget.includeNearbyAirports}
                        outboundAirportOptions={widget.outboundAirportOptions as never}
                        inboundAirportOptions={widget.inboundAirportOptions as never}
                        selectedOutboundAirport={widget.selectedOutboundAirport as never}
                        selectedInboundAirport={widget.selectedInboundAirport as never}
                        showNoJobSelectedMessage={widget.uiState.showNoJobSelectedMessage}
                        showJobHasAssignedFlightMessage={widget.uiState.showJobHasAssignedFlightMessage}
                        showMissingAirportInfoMessage={widget.uiState.showMissingAirportInfoMessage}
                        showNoFlightsAvailableMessage={widget.uiState.showNoFlightsAvailableMessage}
                        showFlightList={widget.uiState.showFlightList}
                        showNoAgentJobSelectedMessage={widget.uiState.showNoAgentJobSelectedMessage}
                        showJobHasAssignedAgentMessage={widget.uiState.showJobHasAssignedAgentMessage}
                        showNoAgentsAvailableMessage={widget.uiState.showNoAgentsAvailableMessage}
                        showAgentList={widget.uiState.showAgentList}
                        /* Always false in V1 too -- never set by the derivation. */
                        showNotDeliveryJobMessage={false}
                        onFlightSearchChange={widget.onFlightSearchChange}
                        onFilterFlightsByAirline={widget.onFilterFlightsByAirline as never}
                        onToggleNearbyAirports={widget.onToggleNearbyAirports}
                        onOutboundAirportChange={widget.onOutboundAirportChange as never}
                        onInboundAirportChange={widget.onInboundAirportChange as never}
                        onAddFlightToJob={handleAddFlightToJob as never}
                        onLoadMoreFlights={widget.loadMoreFlights}
                        onLoadNextDayFlights={widget.loadNextDayFlights}
                        onAddAgentToJob={handleAddAgentToJob as never}
                        onSendQuoteRequest={handleSendQuoteRequest as never}
                        onOpenAgentSearchDialog={handleOpenAgentSearchDialog}
                        onOpenRecoveryAgentDialog={handleOpenRecoveryAgentDialog}
                        formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                        getConnectionTime={getConnectionTime as never}
                        formatMinutesToTime={formatMinutesAsDuration}
                        isUsCustomer={isUsCustomer}
                    />
                );

            case NationwideBoxes.Tasks:
                return (
                    <TasksBox
                        jobId={currentJob?.id}
                        appPage={LegacyAppPage.Domestic}
                        showToast={showToast}
                        onSelectJob={(jobId) => void selectJobById(jobId)}
                    />
                );

            default:
                return null;
        }
    }, [showToast, isUsCustomer, fetchConfigFor, selectJob, selectJobById, retargetWidget, refreshLists,
        mapConfig, mapItems, currentJob,
        widget, flightAgentJob, handleAddFlightToJob, handleAddAgentToJob, handleSendQuoteRequest,
        handleOpenAgentSearchDialog, handleOpenRecoveryAgentDialog]);

    const handleRefreshBox = useCallback(() => {
        // Each panel refetches through React Query; the shell's refresh button
        // is wired per box in the next step.
    }, []);

    const boxSubtitle = useCallback((boxName: string) => (
        boxName === NationwideBoxes.JobDetail ? currentJob?.jobNo : undefined
    ), [currentJob?.jobNo]);

    return (
        <>
            <BoxShell
                layout={boxLayout.layout}
                layoutVersion={boxLayout.layoutVersion}
                boxes={boxLayout.boxes}
                renderBoxContent={renderBoxContent}
                onRefreshBox={handleRefreshBox}
                boxSubtitle={boxSubtitle}
                isDefaultLayout={boxLayout.currentLayoutName === 'Default'}
                onColumnSizes={boxLayout.setColumnSizes}
                onBoxHeights={boxLayout.setBoxHeights}
            />
            {agentToDispatch && flightAgentJob && (
                <DispatchDialog
                    open
                    mode={{
                        kind: 'single',
                        jobId: flightAgentJob.id,
                        jobNo: flightAgentJob.jobNo,
                        flags: {
                            isArchived: Boolean(flightAgentJob.isArchived),
                            isBulkJob: Boolean(flightAgentJob.isBulkJob),
                            preBook: Boolean(flightAgentJob.preBook),
                        },
                    }}
                    /* V1 opened this pre-set to Agent with the picked agent filled in. */
                    initialType="Agent"
                    existingDestination={{
                        id: agentToDispatch.agentId,
                        text: agentToDispatch.agentName,
                    } as ISuggestion}
                    stopJobCount={stopJobCountFor(flightAgentJob.jobNo, flightAgentJob.relatedJobs)}
                    existingConNote={flightAgentJob.conNote}
                    isNetworkPartner={isNetworkPartnerSession()}
                    onClose={closeDispatchDialog}
                    onDispatchCourier={handleDispatchCourier}
                    onSendToPartner={handleSendToPartner}
                    fetchRate={getPartnerRateForJob}
                    getPartnerOptions={getActivePartnerOptions}
                />
            )}
            <ConfirmDialog
                opened={!!confirm}
                title={confirm?.title ?? ''}
                message={confirm?.message ?? ''}
                onConfirm={confirm?.onConfirm}
                onClose={closeConfirm}
                confirmLabel="Send request"
                variant={confirm?.onConfirm ? 'primary' : 'warning'}
            />
            <LayoutPromptDialogs
                prompts={layoutPrompts}
                layoutNames={boxLayout.layouts.map(l => l.name)}
            />
        </>
    );
};

export default NationwidePage;
