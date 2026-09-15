/**
 * JobDetails - Root component for the React job details panel
 *
 * Orchestrates data fetching, dialog integrations, and child component rendering.
 */

import React, {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActionIcon, Alert, Badge, Box, Collapse, Group, Paper, Progress, Skeleton, Stack, Text,
    UnstyledButton,
} from '@mantine/core';
import {Briefcase, Eye, EyeOff, Info, MailOpen, Mail} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {sectionBorderStyle} from './JobDetails.styles';
import classes from './JobDetails.module.css';
import {useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {useJobDetail} from './hooks/useJobDetail';
import {useJobUpdate} from './hooks/useJobUpdate';
import {PriceChangeModal} from '../../dialogs/price-change-modal/PriceChangeModal';
import {FamilyPriceChangeDialog} from '../../dialogs/family-price-change-dialog';
import {CascadeDateConfirmDialog} from '../../dialogs/cascade-date-confirm-dialog';
import {useFieldVisibility} from './hooks/useFieldVisibility';
import {useViewDensity} from './hooks/useViewDensity';
import {usePodPhotos} from './hooks/usePodPhotos';
import {useJobActions} from './hooks/useJobActions';
import {useRouteList} from '../../../hooks/useRecurringJobsApi';

import {WarningBanner} from './components/WarningBanner';
import {RelatedJobTabs} from './components/RelatedJobTabs';
import {JobDetailHeader} from './components/JobDetailHeader';
import {AiSummaryCard} from '../ai-summary-card/AiSummaryCard';
import {AiBlockersCard} from '../ai-blockers-card/AiBlockersCard';
import {summarizeJob, extractBlockers} from '../../../services/aiAssistantApi';
import {isAiAutoOpenEnabled, isAiEnabled} from '../../../../functions/aiSettings';
import {MetricsGrid} from './components/MetricsGrid';
import {RateAcceptanceBanner} from './components/RateAcceptanceBanner';
import {AddressSection} from './components/AddressSection';
import {TotalDistance} from './components/TotalDistance';
import {FlightInformation} from './components/FlightInformation';
import {AgentInformation} from './components/AgentInformation';
import {JobFieldsSection} from './components/JobFieldsSection';
import {ToggleProperties} from './components/ToggleProperties';
import {PalletSection} from './components/PalletSection';
import {TextInputDialog} from './components/TextInputDialog';
import {DispatchDialog, type DispatchMode} from '../../dialogs/dispatch-dialog';
import {useChangeCourierFlow} from '../../dialogs/change-courier-dialog';
import {isNetworkPartnerSession, stopJobCountFor} from '../../dialogs/dispatch-dialog/dispatchSession';
import {getActivePartnerOptions, getPartnerRateForJob} from '../../../services/jobListApi';
import {StickyNotes} from '../../common/sticky-notes/StickyNotes';
import {JobChangeRequestsForJob} from '../../job-change-requests/JobChangeRequestsForJob';
import {JobChangeRequestDialog} from '../../dialogs/job-change-request-dialog/JobChangeRequestDialog';
import {EditSavedFlightDialog} from '../../dialogs/edit-saved-flight-dialog';
import {CreateAheadBackfillDialog} from './components/CreateAheadBackfillDialog';
import {PartnerJobBanner} from './components/PartnerJobBanner';

import type {IJob, MountJobDetailsConfig} from './JobDetails.types';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {DaysOfWeekHelpers} from '../../../../enums/days-of-week.enum';
import {NoData} from '../no-data/NoData';

const RecurringJobFields = lazy(() => import('./components/RecurringJobFields').then(m => ({default: m.RecurringJobFields})));
const PodPhotosSection = lazy(() => import('./components/PodPhotosSection').then(m => ({default: m.PodPhotosSection})));

/** Inline edit-mode toggle row for card-level visibility */
function CardVisibilityToggle({label, fieldKey, isVisible, onToggle}: {
    label: string; fieldKey: string; isVisible: boolean; onToggle: (key: string) => void;
}) {
    return (
        <Group
            justify="space-between"
            gap="xs"
            style={{...sectionBorderStyle, paddingInline: 8, paddingBlock: 4}}
        >
            <UnstyledButton
                onClick={() => onToggle(fieldKey)}
                style={{flex: 1, minWidth: 0, textAlign: 'left'}}
            >
                <Text c={isVisible ? undefined : 'dimmed'} style={{fontSize: '0.8125rem'}}>
                    {label}
                </Text>
            </UnstyledButton>
            <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
                onClick={() => onToggle(fieldKey)}
            >
                <Icon lucide={isVisible ? Eye : EyeOff} size={18}/>
            </ActionIcon>
        </Group>
    );
}

interface JobDetailsProps {
    config: MountJobDetailsConfig;
}

const rootStyles = {
    container: (dense: boolean): React.CSSProperties => ({
        backgroundColor: 'var(--mantine-color-gray-1)',
        ...(dense ? {fontSize: '0.8125rem'} : {}),
    }),
    progressBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    } as React.CSSProperties,
    metricsWrapper: {
        backgroundColor: 'var(--dd-surface-container)',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: 'var(--mantine-color-default-border)',
    } as React.CSSProperties,
    contentArea: (dense: boolean): React.CSSProperties => ({
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 8 : 16,
        padding: dense ? 12 : 16,
    }),
    readStatusBar: {
        borderRadius: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        paddingInline: 16,
        paddingBlock: 8,
        cursor: 'pointer',
    } as React.CSSProperties,
    readChip: {
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
        letterSpacing: '0.03em',
    } as React.CSSProperties,
    readText: {fontSize: '0.75rem'} as React.CSSProperties,
};

export function JobDetails({config}: JobDetailsProps) {
    const {
        jobId,
        isRecurringJob,
        isBulkJob,
        isUsCustomer,
        showToast: showToastProp,
        onJobUpdate,
        onJobReadChanged,
        onRelatedJobChange
    } = config;

    // Stabilize showToast — may come from AngularJS bridge with unstable identity
    const showToastRef = useRef(showToastProp);
    useEffect(() => {
        showToastRef.current = showToastProp;
    }, [showToastProp]);
    const showToast = useCallback(
        (msg: string, type: 'success' | 'error' | 'warning' | 'info') => showToastRef.current(msg, type),
        []
    );

    // Data hooks
    const {
        sortedRelatedJobs,
        isLoading,
        isFetching,
        refetch,
    } = useJobDetail({jobId, isRecurringJob, isBulkJob});

    // Recurring Routes list (only fetched for recurring jobs). Falls
    // back to an empty array on error or non-medical tenants where the
    // Routes table is absent — RecurringJobFields hides the dropdown
    // when routes.length === 0.
    const {data: routesData} = useRouteList({enabled: isRecurringJob});
    const routes = routesData ?? [];

    const contactId = window.ContactID ?? 0;
    const {isEditMode, toggleEditMode, toggleField, resetToDefaults, isFieldVisible} = useFieldVisibility(contactId);
    const {viewDensity, toggleDensity, isDense} = useViewDensity(contactId);
    const viewDensityLabel = viewDensity === 'normal' ? 'Normal' : 'Dense';

    // Track which job tab is selected
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);

    // AI briefing — per-user opt-in via dashboard settings. The card lives
    // below MetricsGrid and renders in collapsible mode so it stays closed
    // until the user expands it (first expand triggers summarizeJob).
    const aiEnabled = useMemo(() => isAiEnabled(), []);
    const aiAutoOpen = useMemo(() => isAiAutoOpenEnabled(), []);
    // Keep jobRef synchronously current so handlers never read a stale job
    const job: IJob | undefined = sortedRelatedJobs[selectedTabIndex] ?? sortedRelatedJobs[0];

    // Tracks the jobId we've already initialized the tab for — prevents data refetches
    // from snapping the user back to the originally-selected job after they navigate to a sibling tab
    const tabInitializedForJobRef = useRef<number | undefined>(undefined);

    // Days of week for recurring jobs - derived from job data
    const daysOfWeekArray = useMemo(
        () => job?.daysOfWeek != null && typeof job.daysOfWeek === 'number'
            ? DaysOfWeekHelpers.bitwiseToArray(job.daysOfWeek)
            : [],
        [job?.daysOfWeek]
    );

    // Inter-tenant change-request dialog state. Opened when an inline edit on a
    // partner job hits the gate (via useJobUpdate.onPartnerJobBlocked) or when
    // a click handler short-circuits because it knows the field is gated (via
    // useJobActions.onRequestPartnerChange). Carries the preselected field and
    // any value the user already supplied so the dialog opens primed.
    //
    // `locked` is set when the dialog is the second leg of an "edit then
    // confirm" flow — i.e. the user already entered the new value via the
    // main edit dialog, so the field + value render as a read-only summary
    // and only the reason textarea is editable. Modifying an existing pending
    // request from the history panel leaves `locked` false so the dispatcher
    // can still adjust the proposed value.
    const [changeRequestDialog, setChangeRequestDialog] = useState<{
        open: boolean;
        field?: string;
        value?: string;
        locked?: boolean;
    }>({open: false});

    // Update mutations
    const {
        updateField, updateAddress, updatePod, toggleReadStatus, dispatchJob, isUpdating, invalidateJobLists,
        checkForRateChange, checkForRateChanges, pendingRateChanges, selectedRateJobIds,
        toggleRateSelection, toggleAllRateSelection, isApplyingRate, confirmRateChange, dismissRateChange,
    } = useJobUpdate(showToast, {
        onPartnerJobBlocked: ({field, value}) => {
            // The user already entered this value via the main edit dialog
            // (which the backend then rejected). Lock the field + value so
            // they only need to add a reason in the confirmation dialog.
            setChangeRequestDialog({
                open: true,
                field,
                value: value == null ? '' : String(value),
                locked: true,
            });
        },
    });

    // Photos
    const {
        deliveryPhotos,
        pickupPhotos,
        imageOnlyDeliveryPhotos,
        imageOnlyPickupPhotos,
        isLoading: photosLoading
    } = usePodPhotos({
        job,
        isRecurringJob,
    });

    const rqClient = useQueryClient();

    // Helper: refresh and notify parent — refetches job detail and invalidates notes
    const refreshAndNotify = useCallback(async () => {
        await Promise.all([
            refetch(),
            rqClient.invalidateQueries({queryKey: ['notes']}),
        ]);
        onJobUpdate?.();
    }, [refetch, rqClient, onJobUpdate]);

    // When the AngularJS bridge calls refreshJobDetails(), it increments _refreshNonce and
    // re-renders with the new value. Watching it here lets us call refetch() directly,
    // bypassing React Query's cache invalidation path which can fail to trigger a network
    // request in some scenarios. refetch/rqClient are stable refs and intentionally omitted.
    const refreshNonce = config._refreshNonce;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!refreshNonce) return;
        void refetch();
        void rqClient.invalidateQueries({queryKey: ['notes']});
    }, [refreshNonce]);
    const invalidatePhotos = useCallback(async () => {
        if (!jobId) return;
        await Promise.all([
            rqClient.invalidateQueries({queryKey: queryKeys.jobs.photos(jobId, 'delivery')}),
            rqClient.invalidateQueries({queryKey: queryKeys.jobs.photos(jobId, 'pickup')}),
        ]);
    }, [rqClient, jobId]);

    // Stable toast wrappers for StickyNotes (showToast is already ref-stabilized)
    const showSuccessToast = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
    const showErrorToast = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    const showInfoToast = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

    // Archived-job "Change Paid Courier" flow: eligibility gate + dialog + blocked popup.
    const {openChangeCourier, changeCourierDialogs} = useChangeCourierFlow({
        showToast,
        onChanged: refreshAndNotify,
    });

    // All job action handlers
    const actions = useJobActions({
        job,
        isRecurringJob,
        isUsCustomer,
        showToast,
        updateField,
        updateAddress,
        updatePod,
        dispatchJob,
        refreshAndNotify,
        invalidateJobLists,
        invalidatePhotos,
        checkForRateChange,
        checkForRateChanges,
        invalidateAllJobDetails: () => rqClient.invalidateQueries({queryKey: ['jobs', 'detail']}),
        relatedJobs: sortedRelatedJobs,
        onStatusChange: config.onStatusChange,
        onRequestPartnerChange: (field, initialValue, locked) =>
            setChangeRequestDialog({
                open: true,
                field,
                value: initialValue ?? '',
                locked: locked ?? false,
            }),
        onChangeArchivedCourier: (j) => void openChangeCourier(j),
    });

    // Initialize the tab to show the originally-selected job. Only runs once per jobId change -
    // subsequent data refetches must not snap the user back if they navigated to a sibling tab.
    //
    // The findIndex guard: when the user clicks a sibling in a DIFFERENT family, React Query's
    // keepPreviousData briefly serves the previous family's sortedRelatedJobs while the new
    // query is in-flight. Without the guard we'd lock the ref to the new jobId on the stale
    // data (idx = -1, fallback to 0), then the ref check would block the legitimate
    // re-initialization once fresh data arrived, leaving the tab stuck on the family parent.
    // Returning early when idx < 0 keeps the ref un-baked until data matches the requested job.
    useEffect(() => {
        if (jobId && sortedRelatedJobs.length > 0 && tabInitializedForJobRef.current !== jobId) {
            const idx = sortedRelatedJobs.findIndex(j => j.id === jobId);
            if (idx < 0) return;
            setSelectedTabIndex(idx);
            tabInitializedForJobRef.current = jobId;
        }
    }, [jobId, sortedRelatedJobs]);

    const handleTabChange = useCallback((index: number) => {
        setSelectedTabIndex(index);
        const selectedJob = sortedRelatedJobs[index];
        if (selectedJob?.id) {
            onRelatedJobChange?.(selectedJob.id);
        }
    }, [sortedRelatedJobs, onRelatedJobChange]);

    const handleResetFieldVisibility = useCallback(() => {
        resetToDefaults();
        showToast('Default Job Detail layout restored', 'success');
    }, [resetToDefaults, showToast]);

    const handleToggleReadStatus = useCallback(async () => {
        if (!job) return;
        const newStatus = !job.readTrackerInfo?.hasBeenRead;
        await toggleReadStatus({jobId: job.id, hasBeenRead: newStatus});
        onJobReadChanged?.(job.id, newStatus);
    }, [job, toggleReadStatus, onJobReadChanged]);

    // ── Render ──────────────────────────────────────────────────────

    if (isLoading && !job) {
        return (
            <Box p="sm" data-testid="job-detail-loading">
                <Stack gap="sm">
                    <Skeleton height={44} radius="xs"/>
                    <Skeleton height={100} radius="xs"/>
                    <Group gap="sm" grow>
                        <Skeleton height={140} radius="xs"/>
                        <Skeleton height={140} radius="xs"/>
                    </Group>
                </Stack>
            </Box>
        );
    }

    if (!job) {
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to view details"
                icon={<Icon lucide={Briefcase}/>}
            />
        );
    }

    const isRead = job.readTrackerInfo?.hasBeenRead;

    return (
        <Box style={rootStyles.container(isDense)}>
            {/* Main card */}
            <Paper
                withBorder
                data-testid="job-details-card"
                style={{overflow: 'hidden', position: 'relative', borderRadius: 0}}
            >
                {/*
                  * Progress indicator. Mantine has no indeterminate bar, so the
                  * activity is carried by an animated full-width section.
                  */}
                {(isLoading || isFetching || isUpdating) && (
                    <Progress.Root size="xs" radius={0} style={rootStyles.progressBar}>
                        <Progress.Section value={100} animated aria-label="Loading job"/>
                    </Progress.Root>
                )}

                <WarningBanner job={job}/>

                {/* Partner-job context banner — slim, dismissible (per-device).
                    Explains the change-request workflow up-front so dispatchers
                    don't discover gated fields by trying them. */}
                {job.isPartnerJob && (
                    <PartnerJobBanner
                        partnerName={job.partnerTenantName ?? undefined}
                        pairingId={job.partnerPairingId}
                    />
                )}

                <RelatedJobTabs
                    sortedRelatedJobs={sortedRelatedJobs}
                    selectedTabIndex={selectedTabIndex}
                    onTabChange={handleTabChange}
                />

                <JobDetailHeader
                    job={job}
                    dense={isDense}
                    viewDensityLabel={viewDensityLabel}
                    isEditMode={isEditMode}
                    routes={routes}
                    onToggleDensity={toggleDensity}
                    onToggleEditMode={toggleEditMode}
                    onResetFieldVisibility={handleResetFieldVisibility}
                    onStatusClick={actions.handleStatusClick}
                    onPodReport={actions.handlePodReport}
                    onPodSpreadsheet={actions.handlePodSpreadsheet}
                    onSendPodEmail={actions.handleSendPodEmail}
                    onLockToggle={actions.handleLockToggle}
                    onRouteChange={actions.handleRouteChange}
                    overlayDocuments={actions.overlayDocuments}
                    overlayDocumentsLoading={actions.overlayDocumentsLoading}
                    onOverlayMenuOpen={actions.fetchOverlayDocuments}
                    onDownloadOverlay={actions.handleDownloadOverlay}
                />

                {/* Partner-job edit banner. Rated fields (qty, speed, dates, DG, etc.)
                    queue for the other tenant's approval; notes / refs / contacts sync
                    automatically; dispatch state (courier, status, lock) stays local. */}
                {job.isPartnerJob && isEditMode && (
                    <Alert color="reflex" variant="light" icon={<Icon lucide={Info} size={18}/>} mb="xs">
                        Rated fields require {job.partnerTenantName?.trim() || 'the partner'} to
                        approve before they apply. Notes and contact details sync
                        automatically. See the change-request panel below for pending items.
                    </Alert>
                )}

                {/* Mode 1 rate-acceptance gate. Renders nothing when the gate is open
                    (Modes 2/3 / Accepted) or this isn't a partner-inbound job. */}
                {job.isPartnerJob && <RateAcceptanceBanner jobId={job.id}/>}

                {/* Metrics Grid */}
                <Box style={rootStyles.metricsWrapper}>
                    <MetricsGrid
                        job={job}
                        dense={isDense}
                        showToast={showToast}
                        onEditDateAndTime={actions.editDateAndTime}
                        onEditPodName={actions.handleEditPodName}
                        onEditCompletedTime={actions.handleEditCompletedTime}
                        onClientClick={actions.handleClientClick}
                        onPricingClick={() => actions.handlePricingClick()}
                        onInternalStatusClick={actions.handleInternalStatusClick}
                    />
                </Box>

                {/* AI Job Briefing — collapsible card under the pricing / client
                    row. key={job.id} resets state when switching related-job tabs;
                    the card starts collapsed and only calls summarizeJob the first
                    time the user opens it. */}
                {aiEnabled && (
                    <Box mx="sm" mt="xs">
                        <AiSummaryCard
                            key={job.id}
                            title="Auto-mate Job Briefing"
                            fetchSummary={(signal) => summarizeJob(job.id, {signal})}
                            collapsible
                            autoOpen={aiAutoOpen}
                        />
                    </Box>
                )}

                {aiEnabled && (
                    <Box mx="sm" mt="xs">
                        <AiBlockersCard
                            key={job.id}
                            title="Auto-mate Blockers"
                            fetchBlockers={(signal) => extractBlockers(job.id, {signal})}
                            collapsible
                            autoOpen={aiAutoOpen}
                        />
                    </Box>
                )}

                {/* Main content area */}
                <Box style={rootStyles.contentArea(isDense)}>
                    {job.isFlightAssigned && job.assignedFlight && (
                        <FlightInformation flight={job.assignedFlight} jobId={job.id}/>
                    )}

                    {job.isAgentAssigned && job.assignedAgent && (
                        <AgentInformation agent={job.assignedAgent}/>
                    )}

                    <AddressSection
                        job={job}
                        dense={isDense}
                        onEditPickupAddress={actions.handleEditPickupAddress}
                        onEditDeliveryAddress={actions.handleEditDeliveryAddress}
                        onEditFromContact={actions.handleEditFromContact}
                        onEditToContact={actions.handleEditToContact}
                        onEditFromContactPhone={actions.handleEditFromContactPhone}
                        onEditToContactPhone={actions.handleEditToContactPhone}
                    />

                    {isEditMode && (
                        <CardVisibilityToggle label="Total Distance" fieldKey="totalMiles"
                                              isVisible={isFieldVisible('totalMiles')} onToggle={toggleField}/>
                    )}
                    <TotalDistance
                        distance={job.distance}
                        isUsCustomer={isUsCustomer}
                        visible={isFieldVisible('totalMiles')}
                    />

                    {isEditMode && (
                        <CardVisibilityToggle label="Notes" fieldKey="notes"
                                              isVisible={isFieldVisible('notes')} onToggle={toggleField}/>
                    )}
                    <Collapse expanded={isFieldVisible('notes')} keepMounted={false}>
                        <StickyNotes
                            jobId={job.id}
                            bulkJobId={job.isBulkJob ? job.id : undefined}
                            isRecurringJob={isRecurringJob}
                            showSuccessToast={showSuccessToast}
                            showErrorToast={showErrorToast}
                            showInfoToast={showInfoToast}
                        />
                    </Collapse>

                    <JobFieldsSection
                        job={job}
                        dense={isDense}
                        isUsCustomer={isUsCustomer}
                        isEditMode={isEditMode}
                        isFieldVisible={isFieldVisible}
                        onToggleField={toggleField}
                        onSpeedClick={actions.handleSpeedClick}
                        onJobTypeClick={actions.handleJobTypeClick}
                        onSizeClick={actions.handleSizeClick}
                        onEditRefA={actions.handleEditRefA}
                        onEditRefB={actions.handleEditRefB}
                        onEditOurRef={actions.handleEditOurRef}
                        onEditConNote={actions.handleEditConNote}
                        onDgClassClick={actions.handleDgClassClick}
                        onLeaveClick={actions.handleLeaveClick}
                        onTrackingMethodClick={actions.handleTrackingMethodClick}
                        onEditTrackingMobile={actions.handleEditTrackingMobile}
                        onEditTrackingEmail={actions.handleEditTrackingEmail}
                        onCourierClick={actions.handleCourierClick}
                        onContactClick={actions.handleContactClick}
                        onClientClick={actions.handleClientClick}
                        onEditCustomJobName={actions.handleEditCustomJobName}
                        onEditDimensions={actions.handleEditDimensions}
                        onInActiveByClick={actions.handleInActiveByClick}
                    />

                    {/* Inter-tenant change-request history (partner jobs only) */}
                    {job.isPartnerJob && (
                        <>
                            {isEditMode && (
                                <CardVisibilityToggle label="Partner Change Requests" fieldKey="partnerChangeRequests"
                                                      isVisible={isFieldVisible('partnerChangeRequests')}
                                                      onToggle={toggleField}/>
                            )}
                            <Collapse expanded={isFieldVisible('partnerChangeRequests')} keepMounted={false}>
                                <JobChangeRequestsForJob
                                    jobId={job.id}
                                    pickUpTimezoneText={(job.pickUpTimeZone as {text?: string} | undefined)?.text}
                                    deliveryTimezoneText={(job.deliveryTimeZone as {text?: string} | undefined)?.text}
                                    onChanged={refreshAndNotify}
                                    onModifyRequest={({fieldName, requestedValue}) =>
                                        setChangeRequestDialog({
                                            open: true,
                                            field: fieldName,
                                            value: requestedValue ?? '',
                                            locked: false,
                                        })}
                                />
                            </Collapse>
                        </>
                    )}

                    <ToggleProperties
                        job={job}
                        isRecurringJob={isRecurringJob}
                        dense={isDense}
                        isEditMode={isEditMode}
                        isFieldVisible={isFieldVisible}
                        onToggleField={toggleField}
                        onToggleProperty={actions.handleToggleProperty}
                        onVoidClick={actions.handleVoidClick}
                        onActiveClick={actions.handleActiveClick}
                        onTailLiftPickupClick={actions.handleTailLiftPuClick}
                        onTailLiftDropOffClick={actions.handleTailLiftDoClick}
                        onDeliverToPrivateResChanged={actions.handlePrivateResChange}
                        onDoneClick={actions.handleDoneClick}
                    />

                    {isRecurringJob && (
                        <Suspense fallback={null}>
                            <RecurringJobFields
                                job={job}
                                daysOfWeekArray={daysOfWeekArray}
                                dense={isDense}
                                onDaysOfWeekChange={actions.handleDaysOfWeekChange}
                                onFrequencyChange={actions.handleFrequencyChange}
                                onHolidayOptionChange={actions.handleHolidayOptionChange}
                                onEditFirstDue={actions.handleEditFirstDue}
                                onEditStopDate={actions.handleEditStopDate}
                                onEditRestartDate={actions.handleEditRestartDate}
                                onEditSavedFlight={actions.handleEditSavedFlight}
                                onAddFlight={actions.handleAddFlight}
                                onInitialDaysChange={actions.handleInitialDaysChange}
                            />
                        </Suspense>
                    )}

                    {job.palletInfo && job.palletInfo.length > 0 && (
                        <PalletSection
                            key={job.id}
                            pallets={job.palletInfo}
                            isUsCustomer={isUsCustomer}
                        />
                    )}
                </Box>
            </Paper>
            {/* Read Status Bar */}
            <Paper
                data-testid="job-details-read-status"
                className={classes.readStatusBar}
                style={rootStyles.readStatusBar}
                onClick={handleToggleReadStatus}
            >
                <Badge
                    color={isRead ? 'green' : 'gray'}
                    variant={isRead ? 'filled' : 'outline'}
                    leftSection={<Icon lucide={isRead ? MailOpen : Mail} size={14}/>}
                    style={rootStyles.readChip}
                >
                    {isRead ? 'READ' : 'UNREAD'}
                </Badge>
                {isRead && job.readTrackerInfo?.readBy && (
                    <Text style={rootStyles.readText}>
                        Read by <strong>{job.readTrackerInfo.readBy}</strong>
                        {(job.readTrackerInfo._readDateStr || job.readTrackerInfo.readDate) && (
                            <Text component="span" c="dimmed" ml={4} style={{fontSize: 'inherit'}}>
                                on {job.readTrackerInfo._readDateStr || String(job.readTrackerInfo.readDate)} {getTimezoneAbbreviation(window.TimeZone || '')}
                            </Text>
                        )}
                    </Text>
                )}
                {!isRead && (
                    <Text c="dimmed" style={rootStyles.readText}>
                        Click to mark as read
                    </Text>
                )}
            </Paper>
            {/* POD Photos — only mount when there are photos or still loading */}
            {(deliveryPhotos.length > 0 || pickupPhotos.length > 0 || photosLoading) && (
                <Box mt="sm">
                    <Suspense fallback={null}>
                        <PodPhotosSection
                            deliveryPhotos={deliveryPhotos}
                            pickupPhotos={pickupPhotos}
                            imageOnlyDeliveryPhotos={imageOnlyDeliveryPhotos}
                            imageOnlyPickupPhotos={imageOnlyPickupPhotos}
                            isLoading={photosLoading}
                            showToast={showToast}
                            onUploadPhotos={actions.handlePodUpload}
                            onSendPod={actions.handleSendPodEmail}
                            jobId={job.id}
                            onPhotoDeleted={invalidatePhotos}
                        />
                    </Suspense>
                </Box>
            )}
            {/* Price Change Modal — one job keeps the original modal; a family gets the list. */}
            {pendingRateChanges.length === 1 && (
                <PriceChangeModal
                    open={true}
                    jobNumber={pendingRateChanges[0].jobNo}
                    oldPrice={pendingRateChanges[0].oldPrice}
                    newPrice={pendingRateChanges[0].newPrice}
                    description={pendingRateChanges[0].description}
                    isApplying={isApplyingRate}
                    onAccept={confirmRateChange}
                    onKeep={dismissRateChange}
                    onManualEdit={() => {
                        dismissRateChange();
                        void actions.handlePricingClick(true);
                    }}
                />
            )}
            {pendingRateChanges.length > 1 && (
                <FamilyPriceChangeDialog
                    open={true}
                    rows={pendingRateChanges.map((r) => ({
                        jobId: r.jobId,
                        jobNo: r.jobNo,
                        oldPrice: r.oldPrice,
                        newPrice: r.newPrice,
                        ratedManually: !!r.ratedManually,
                    }))}
                    selectedIds={selectedRateJobIds}
                    isApplying={isApplyingRate}
                    onToggle={toggleRateSelection}
                    onToggleAll={toggleAllRateSelection}
                    onAcceptSelected={confirmRateChange}
                    onKeepAll={dismissRateChange}
                />
            )}
            {/* Cascade date confirmation */}
            <CascadeDateConfirmDialog
                open={actions.cascadeDialog.open}
                jobNumber={actions.cascadeDialog.jobNumber}
                newDateLabel={actions.cascadeDialog.newDateLabel}
                members={actions.cascadeDialog.members}
                onCancel={actions.handleCascadeCancel}
                onChoose={actions.handleCascadeChoose}
            />
            {/* Text Input Dialog */}
            <TextInputDialog
                open={actions.textDialog.open}
                title={actions.textDialog.title}
                label={actions.textDialog.label}
                initialValue={actions.textDialog.initialValue}
                allowClear={actions.textDialog.allowClear}
                onSubmit={actions.handleTextDialogSubmit}
                onCancel={actions.handleTextDialogCancel}
            />
            {/* Inter-tenant Job Change Request dialog — opened when the partner-job
                gate rejects an inline field edit (or when a click handler knows the
                edit will be gated, e.g. Pricing). The history panel above
                (JobChangeRequestsForJob) reflects new rows after refreshAndNotify. */}
            <JobChangeRequestDialog
                open={changeRequestDialog.open}
                jobId={job.id}
                jobNo={job.jobNo}
                preselectedFieldName={changeRequestDialog.field}
                preInitialValue={changeRequestDialog.value}
                lockedField={changeRequestDialog.locked}
                partnerName={job.partnerTenantName}
                pairingId={job.partnerPairingId}
                onClose={() => setChangeRequestDialog({open: false})}
                onSubmitted={() => {
                    setChangeRequestDialog({open: false});
                    void refreshAndNotify();
                }}
            />
            {/* Universal Dispatch Dialog — replaces the legacy AutoCompleteDialog
                courier picker. Same dialog handles Courier / Agent / NP / DFRNT
                Partner dispatch; isRecurringJob switches it into recurring mode
                which disables the DFRNT Partner radio. */}
            <DispatchDialog
                open={actions.dispatchDialog.open}
                mode={(isRecurringJob
                    ? {kind: 'recurring' as const, jobId: job.id, jobNo: job.jobNo}
                    : {
                        kind: 'single' as const,
                        jobId: job.id,
                        jobNo: job.jobNo,
                        flags: {
                            isArchived: Boolean(job.isArchived),
                            isBulkJob: Boolean(job.isBulkJob),
                            preBook: Boolean(job.preBook),
                        },
                    }) satisfies DispatchMode}
                initialType={actions.dispatchDialog.initialType}
                existingDestination={job.assignedCourier}
                stopJobCount={stopJobCountFor(job.jobNo, job.relatedJobs)}
                existingConNote={job.conNote}
                isNetworkPartner={isNetworkPartnerSession()}
                onClose={actions.closeDispatchDialog}
                onDispatchCourier={actions.dispatchDialogConfirmCourier}
                onUnassignCourier={actions.dispatchDialogUnassignCourier}
                onSendToPartner={actions.dispatchDialogConfirmPartner}
                fetchRate={getPartnerRateForJob}
                getPartnerOptions={getActivePartnerOptions}
            />

            {/* Change Paid Courier (archived jobs) + its blocked popup */}
            {changeCourierDialogs}

            {/* Saved-flight picker for recurring flight bookings. */}
            <EditSavedFlightDialog
                open={actions.savedFlightDialog.open}
                bookingId={actions.savedFlightDialog.bookingId}
                fromAirportId={actions.savedFlightDialog.fromAirportId}
                toAirportId={actions.savedFlightDialog.toAirportId}
                currentValue={actions.savedFlightDialog.currentValue}
                departureDate={actions.savedFlightDialog.departureDate}
                showAirportPickers={actions.savedFlightDialog.showAirportPickers}
                onClose={actions.closeSavedFlightDialog}
                onSubmit={actions.savedFlightDialogConfirm}
            />

            {/* Create-ahead backfill dialog. Opens when the operator raises
             *  RecurringInitialDays on the recurring schedule card. */}
            <CreateAheadBackfillDialog
                open={actions.createAheadBackfillDialog.open}
                jobId={actions.createAheadBackfillDialog.jobId}
                oldValue={actions.createAheadBackfillDialog.oldValue}
                newValue={actions.createAheadBackfillDialog.newValue}
                onClose={actions.closeCreateAheadBackfillDialog}
                onSuccess={() => { void refetch(); }}
                showToast={showToast}
            />
        </Box>
    );
}
