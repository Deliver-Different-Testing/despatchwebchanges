/**
 * JobDetails - Root component for the React job details panel
 *
 * Orchestrates data fetching, dialog integrations, and child component rendering.
 */

import React, {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type {SxProps, Theme} from '@mui/material/styles';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import {useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {useJobDetail} from './hooks/useJobDetail';
import {useJobUpdate} from './hooks/useJobUpdate';
import {PriceChangeModal} from '../../dialogs/price-change-modal/PriceChangeModal';
import {useFieldVisibility} from './hooks/useFieldVisibility';
import {useViewDensity} from './hooks/useViewDensity';
import {usePodPhotos} from './hooks/usePodPhotos';
import {useJobActions} from './hooks/useJobActions';
import {useRouteList} from '../../../hooks/useRecurringJobsApi';

import {WarningBanner} from './components/WarningBanner';
import {RelatedJobTabs} from './components/RelatedJobTabs';
import {JobDetailHeader} from './components/JobDetailHeader';
import {AiSummaryCard} from '../ai-summary-card/AiSummaryCard';
import {summarizeJob} from '../../../services/aiAssistantApi';
import {isAiEnabled} from '../../../../functions/aiSettings';
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
import {getActivePartnerOptions, getPartnerRateForJob} from '../../../services/jobListApi';
import {StickyNotes} from '../../common/sticky-notes/StickyNotes';
import {JobChangeRequestsForJob} from '../../job-change-requests/JobChangeRequestsForJob';
import {JobChangeRequestDialog} from '../../dialogs/job-change-request-dialog/JobChangeRequestDialog';
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
        <List dense disablePadding sx={{borderTop: 1, borderColor: 'divider'}}>
            <ListItem dense disablePadding secondaryAction={
                <IconButton edge="end" size="small" onClick={() => onToggle(fieldKey)}>
                    {isVisible ? <VisibilityIcon sx={{fontSize: 18}}/> : <VisibilityOffIcon sx={{fontSize: 18}}/>}
                </IconButton>
            }>
                <ListItemButton dense onClick={() => onToggle(fieldKey)}>
                    <ListItemText primary={label} slotProps={{
                        primary: {
                            variant: 'body2',
                            fontSize: '0.8125rem',
                            color: isVisible ? 'text.primary' : 'text.disabled'
                        }
                    }}/>
                </ListItemButton>
            </ListItem>
        </List>
    );
}

interface JobDetailsProps {
    config: MountJobDetailsConfig;
}

const rootStyles: Record<string, SxProps<Theme>> = {
    container: {
        bgcolor: 'grey.50',
    },
    mainPaper: {
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
    },
    progressBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    metricsWrapper: {
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
    },
    contentArea: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
    },
    contentAreaDense: {
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1.5,
    },
    readStatusBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        mt: 1.5,
        px: 2,
        py: 1,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
        '&:hover': {
            borderColor: 'grey.400',
            bgcolor: 'action.hover',
        },
    },
    readChip: {
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
        letterSpacing: '0.03em',
    },
    readText: {
        fontSize: '0.75rem',
    },
    photosWrapper: {
        mt: 1.5,
    },
    loadingSkeleton: {
        p: 1.5,
    },
    emptyState: {
        p: 4,
        textAlign: 'center',
    },
    containerDense: {
        bgcolor: 'grey.50',
        fontSize: '0.8125rem',
    },
    mainPaperPositioned: {
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        position: 'relative',
    },
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

    // AI panel state — per-user opt-in via dashboard settings. Collapsed by
    // default; expanding mounts AiSummaryCard which auto-fetches summarizeJob.
    const aiEnabled = useMemo(() => isAiEnabled(), []);
    const [showAiPanel, setShowAiPanel] = useState(false);
    const handleToggleAiPanel = useCallback(() => setShowAiPanel(prev => !prev), []);
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
        checkForRateChange, pendingRateChange, isApplyingRate, confirmRateChange, dismissRateChange,
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
        await rqClient.invalidateQueries({queryKey: queryKeys.jobs.photos(jobId, 'delivery')});
        await rqClient.invalidateQueries({queryKey: queryKeys.jobs.photos(jobId, 'pickup')});
    }, [rqClient, jobId]);

    // Stable toast wrappers for StickyNotes (showToast is already ref-stabilized)
    const showSuccessToast = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
    const showErrorToast = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    const showInfoToast = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

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
    });

    // Initialize the tab to show the originally-selected job. Only runs once per jobId change —
    // subsequent data refetches must not snap the user back if they navigated to a sibling tab.
    useEffect(() => {
        if (jobId && sortedRelatedJobs.length > 0 && tabInitializedForJobRef.current !== jobId) {
            const idx = sortedRelatedJobs.findIndex(j => j.id === jobId);
            setSelectedTabIndex(idx >= 0 ? idx : 0);
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
            <Box sx={rootStyles.loadingSkeleton}>
                <Stack spacing={1.5}>
                    <Skeleton variant="rectangular" height={44} sx={{borderRadius: 1}}/>
                    <Skeleton variant="rectangular" height={100} sx={{borderRadius: 1}}/>
                    <Box sx={{display: 'flex', gap: 1.5}}>
                        <Skeleton variant="rectangular" height={140} sx={{flex: 1, borderRadius: 1}}/>
                        <Skeleton variant="rectangular" height={140} sx={{flex: 1, borderRadius: 1}}/>
                    </Box>
                </Stack>
            </Box>
        );
    }

    if (!job) {
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to view details"
                icon="work_outline"
            />
        );
    }

    const isRead = job.readTrackerInfo?.hasBeenRead;

    return (
        <Box sx={isDense ? rootStyles.containerDense : rootStyles.container}>
            {/* Main card */}
            <Paper elevation={0} sx={rootStyles.mainPaperPositioned}>
                {/* Progress indicator */}
                {(isLoading || isFetching || isUpdating) && <LinearProgress sx={rootStyles.progressBar}/>}

                <WarningBanner job={job}/>

                {/* Partner-job context banner — slim, dismissible (per-device).
                    Explains the change-request workflow up-front so dispatchers
                    don't discover gated fields by trying them. */}
                {job.isPartnerJob && <PartnerJobBanner partnerName={job.partnerTenantName ?? undefined}/>}

                <RelatedJobTabs
                    sortedRelatedJobs={sortedRelatedJobs}
                    selectedTabIndex={selectedTabIndex}
                    isRecurringJob={isRecurringJob}
                    onTabChange={handleTabChange}
                />

                <JobDetailHeader
                    job={job}
                    dense={isDense}
                    viewDensityLabel={viewDensityLabel}
                    isEditMode={isEditMode}
                    routes={routes}
                    aiEnabled={aiEnabled}
                    showAiPanel={showAiPanel}
                    onToggleDensity={toggleDensity}
                    onToggleEditMode={toggleEditMode}
                    onResetFieldVisibility={handleResetFieldVisibility}
                    onToggleAiPanel={handleToggleAiPanel}
                    onStatusClick={actions.handleStatusClick}
                    onPodReport={actions.handlePodReport}
                    onPodSpreadsheet={actions.handlePodSpreadsheet}
                    onSendPodEmail={actions.handleSendPodEmail}
                    onLockToggle={actions.handleLockToggle}
                    onRouteChange={actions.handleRouteChange}
                />

                {/* AI Summary Panel — toggled from the header. key={job.id}
                    forces a fresh fetch when switching between related-job tabs. */}
                {aiEnabled && showAiPanel && (
                    <Box sx={{mx: 1.5, mt: 1}}>
                        <AiSummaryCard
                            key={job.id}
                            title="AI Job Briefing"
                            fetchSummary={(signal) => summarizeJob(job.id, {signal})}
                        />
                    </Box>
                )}

                {/* Partner-job edit banner. Rated fields (qty, speed, dates, DG, etc.)
                    queue for the other tenant's approval; notes / refs / contacts sync
                    automatically; dispatch state (courier, status, lock) stays local. */}
                {job.isPartnerJob && isEditMode && (
                    <Alert severity="info" sx={{mb: 1}}>
                        Rated fields require {job.partnerTenantName?.trim() || 'the partner'} to
                        approve before they apply. Notes and contact details sync
                        automatically. See the change-request panel below for pending items.
                    </Alert>
                )}

                {/* Mode 1 rate-acceptance gate. Renders nothing when the gate is open
                    (Modes 2/3 / Accepted) or this isn't a partner-inbound job. */}
                {job.isPartnerJob && <RateAcceptanceBanner jobId={job.id}/>}

                {/* Metrics Grid */}
                <Box sx={rootStyles.metricsWrapper}>
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

                {/* Main content area */}
                <Box sx={isDense ? rootStyles.contentAreaDense : rootStyles.contentArea}>
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
                    <Collapse in={isFieldVisible('notes')} unmountOnExit>
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
                            <Collapse in={isFieldVisible('partnerChangeRequests')} unmountOnExit>
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
            <Paper elevation={0} sx={rootStyles.readStatusBar} onClick={handleToggleReadStatus}>
                <Chip
                    icon={isRead ? <MarkEmailReadIcon sx={{fontSize: '16px !important'}}/> :
                        <MarkEmailUnreadIcon sx={{fontSize: '16px !important'}}/>}
                    label={isRead ? 'READ' : 'UNREAD'}
                    size="small"
                    color={isRead ? 'success' : 'default'}
                    variant={isRead ? 'filled' : 'outlined'}
                    sx={rootStyles.readChip}
                />
                {isRead && job.readTrackerInfo?.readBy && (
                    <Typography variant="body2" sx={rootStyles.readText}>
                        Read by <strong>{job.readTrackerInfo.readBy}</strong>
                        {(job.readTrackerInfo._readDateStr || job.readTrackerInfo.readDate) && (
                            <Typography component="span" color="text.secondary" sx={{fontSize: 'inherit', ml: 0.5}}>
                                on {job.readTrackerInfo._readDateStr || String(job.readTrackerInfo.readDate)} {getTimezoneAbbreviation(window.TimeZone || '')}
                            </Typography>
                        )}
                    </Typography>
                )}
                {!isRead && (
                    <Typography variant="body2" color="text.secondary" sx={rootStyles.readText}>
                        Click to mark as read
                    </Typography>
                )}
            </Paper>

            {/* POD Photos — only mount when there are photos or still loading */}
            {(deliveryPhotos.length > 0 || pickupPhotos.length > 0 || photosLoading) && (
                <Box sx={rootStyles.photosWrapper}>
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
                        />
                    </Suspense>
                </Box>
            )}

            {/* Price Change Modal */}
            {pendingRateChange && (
                <PriceChangeModal
                    open={true}
                    jobNumber={pendingRateChange.jobNo}
                    oldPrice={pendingRateChange.oldPrice}
                    newPrice={pendingRateChange.newPrice}
                    description={pendingRateChange.description}
                    isApplying={isApplyingRate}
                    onAccept={confirmRateChange}
                    onKeep={dismissRateChange}
                    onManualEdit={() => {
                        dismissRateChange();
                        void actions.handlePricingClick(true);
                    }}
                />
            )}

            {/* Text Input Dialog */}
            <TextInputDialog
                open={actions.textDialog.open}
                title={actions.textDialog.title}
                label={actions.textDialog.label}
                initialValue={actions.textDialog.initialValue}
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
                onClose={actions.closeDispatchDialog}
                onDispatchCourier={actions.dispatchDialogConfirmCourier}
                onSendToPartner={actions.dispatchDialogConfirmPartner}
                fetchRate={getPartnerRateForJob}
                getPartnerOptions={getActivePartnerOptions}
            />
        </Box>
    );
}
