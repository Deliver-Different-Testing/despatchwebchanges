/**
 * JobDetails - Root component for the React job details panel
 *
 * Orchestrates data fetching, dialog integrations, and child component rendering.
 */

import React, {useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense} from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type {SxProps, Theme} from '@mui/material/styles';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';

import {useJobDetail} from './hooks/useJobDetail';
import {useJobUpdate} from './hooks/useJobUpdate';
import {useFieldVisibility} from './hooks/useFieldVisibility';
import {useViewDensity} from './hooks/useViewDensity';
import {usePodPhotos} from './hooks/usePodPhotos';
import {useJobActions} from './hooks/useJobActions';

import {WarningBanner} from './components/WarningBanner';
import {RelatedJobTabs} from './components/RelatedJobTabs';
import {JobDetailHeader} from './components/JobDetailHeader';
import {MetricsGrid} from './components/MetricsGrid';
import {AddressSection} from './components/AddressSection';
import {TotalDistance} from './components/TotalDistance';
import {FlightInformation} from './components/FlightInformation';
import {AgentInformation} from './components/AgentInformation';
import {JobFieldsSection} from './components/JobFieldsSection';
import {ToggleProperties} from './components/ToggleProperties';
const RecurringJobFields = lazy(() => import('./components/RecurringJobFields').then(m => ({default: m.RecurringJobFields})));
const PodPhotosSection = lazy(() => import('./components/PodPhotosSection').then(m => ({default: m.PodPhotosSection})));
import {PalletSection} from './components/PalletSection';
import {TextInputDialog} from './components/TextInputDialog';
import {StickyNotes} from '../../common/sticky-notes/StickyNotes';
import {NoteManagementDialogServiceInterface} from '../../common/sticky-notes/StickyNotes.interfaces';
import {openNoteManagementDialog} from '../../dialogs/note-management-dialog/note-management-dialog-react.module';
import type {JobNote} from '../../../interfaces';

import type {MountJobDetailsConfig, IJob} from './JobDetails.types';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {DaysOfWeekHelpers} from '../../../../enums/days-of-week.enum';
import {isAiEnabled} from '../../../../functions/aiSettings';

const reactNoteManagementDialogService: NoteManagementDialogServiceInterface = {
    openNoteDialog: async (_event: MouseEvent, model: JobNote | null): Promise<void> => {
        await openNoteManagementDialog(model);
    }
};

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
    aiContainer: {
        mx: 1.5,
        mb: 1,
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
    const {jobId, isRecurringJob, isBulkJob, isUsCustomer, showToast, onJobUpdate, onJobReadChanged} = config;

    // Data hooks
    const {
        sortedRelatedJobs,
        isLoading,
        refetch,
    } = useJobDetail({jobId, isRecurringJob, isBulkJob});

    const contactId = window.ContactID ?? 0;
    const {isEditMode, toggleEditMode, toggleField, resetToDefaults, isFieldVisible} = useFieldVisibility(contactId);
    const {viewDensity, toggleDensity, isDense} = useViewDensity(contactId);
    const viewDensityLabel = viewDensity === 'normal' ? 'Normal' : 'Dense';

    // Track which job tab is selected
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const job: IJob | undefined = sortedRelatedJobs[selectedTabIndex] ?? sortedRelatedJobs[0];

    // Days of week for recurring jobs - derived from job data
    const daysOfWeekArray = useMemo(
        () => job?.daysOfWeek != null && typeof job.daysOfWeek === 'number'
            ? DaysOfWeekHelpers.bitwiseToArray(job.daysOfWeek)
            : [],
        [job?.daysOfWeek]
    );

    // AI panel state
    const [aiEnabled] = useState(() => isAiEnabled());
    const [showAiPanel, setShowAiPanel] = useState(false);
    const aiContainerRef = useRef<HTMLDivElement>(null);

    // Update mutations
    const {updateField, updateAddress, toggleReadStatus, dispatchJob, isUpdating} = useJobUpdate(showToast);

    // Photos
    const {deliveryPhotos, pickupPhotos, imageOnlyDeliveryPhotos, imageOnlyPickupPhotos, isLoading: photosLoading} = usePodPhotos({
        job,
        isRecurringJob,
    });

    // Helper: refresh and notify parent
    const refreshAndNotify = useCallback(async () => {
        await refetch();
        onJobUpdate?.();
    }, [refetch, onJobUpdate]);

    // Stable toast wrappers for StickyNotes
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
        dispatchJob,
        refreshAndNotify,
    });

    // Reset tab index when jobId changes
    useEffect(() => {
        if (jobId && sortedRelatedJobs.length > 0) {
            const idx = sortedRelatedJobs.findIndex(j => j.id === jobId);
            setSelectedTabIndex(idx >= 0 ? idx : 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId, sortedRelatedJobs.length]);

    // AI panel render effect
    useEffect(() => {
        if (showAiPanel && aiContainerRef.current && job?.id) {
            window.ReactAiAssistant?.renderSummaryPanel(aiContainerRef.current, job.id);
        }
        return () => {
            if (aiContainerRef.current) {
                window.ReactAiAssistant?.unmountSummaryPanel(aiContainerRef.current);
            }
        };
    }, [showAiPanel, job?.id]);

    const handleTabChange = useCallback((index: number) => {
        setSelectedTabIndex(index);
    }, []);

    const handleToggleAiPanel = useCallback(() => {
        setShowAiPanel(prev => !prev);
    }, []);

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
                    <Skeleton variant="rectangular" height={44} sx={{borderRadius: 1}} />
                    <Skeleton variant="rectangular" height={100} sx={{borderRadius: 1}} />
                    <Box sx={{display: 'flex', gap: 1.5}}>
                        <Skeleton variant="rectangular" height={140} sx={{flex: 1, borderRadius: 1}} />
                        <Skeleton variant="rectangular" height={140} sx={{flex: 1, borderRadius: 1}} />
                    </Box>
                </Stack>
            </Box>
        );
    }

    if (!job) {
        return (
            <Box sx={rootStyles.emptyState}>
                <Typography color="text.secondary">Select a job to view details</Typography>
            </Box>
        );
    }

    const isRead = job.readTrackerInfo?.hasBeenRead;

    return (
        <Box sx={isDense ? rootStyles.containerDense : rootStyles.container}>
            {/* Main card */}
            <Paper elevation={0} sx={rootStyles.mainPaperPositioned}>
                {/* Progress indicator */}
                {(isLoading || isUpdating) && <LinearProgress sx={rootStyles.progressBar} />}

                <WarningBanner job={job} />

                <RelatedJobTabs
                    sortedRelatedJobs={sortedRelatedJobs}
                    selectedTabIndex={selectedTabIndex}
                    isRecurringJob={isRecurringJob}
                    onTabChange={handleTabChange}
                />

                <JobDetailHeader
                    job={job}
                    viewDensityLabel={viewDensityLabel}
                    isEditMode={isEditMode}
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
                />

                {/* AI Summary Panel Container */}
                {aiEnabled && showAiPanel && (
                    <Box ref={aiContainerRef} sx={rootStyles.aiContainer} />
                )}

                {/* Metrics Grid */}
                <Box sx={rootStyles.metricsWrapper}>
                    <MetricsGrid
                        job={job}
                        showToast={showToast}
                        onEditDateAndTime={actions.editDateAndTime}
                        onEditPodName={actions.handleEditPodName}
                        onEditCompletedTime={actions.handleEditCompletedTime}
                        onClientClick={actions.handleClientClick}
                        onPricingClick={actions.handlePricingClick}
                    />
                </Box>

                {/* Main content area */}
                <Box sx={rootStyles.contentArea}>
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

                    <TotalDistance
                        distance={job.distance}
                        isUsCustomer={isUsCustomer}
                        visible={isFieldVisible('totalMiles')}
                    />

                    <StickyNotes
                        jobId={job.id}
                        bulkJobId={job.isBulkJob ? job.id : undefined}
                        isRecurringJob={isRecurringJob}
                        noteManagementDialogService={reactNoteManagementDialogService}
                        showSuccessToast={showSuccessToast}
                        showErrorToast={showErrorToast}
                        showInfoToast={showInfoToast}
                    />

                    {job.isFlightAssigned && job.assignedFlight && (
                        <FlightInformation flight={job.assignedFlight} />
                    )}

                    {job.isAgentAssigned && job.assignedAgent && (
                        <AgentInformation agent={job.assignedAgent} />
                    )}

                    <JobFieldsSection
                        job={job}
                        dense={isDense}
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
                        onEditWeight={actions.handleEditWeight}
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
                        <PalletSection pallets={job.palletInfo} isUsCustomer={isUsCustomer} />
                    )}
                </Box>
            </Paper>

            {/* Read Status Bar */}
            <Paper elevation={0} sx={rootStyles.readStatusBar} onClick={handleToggleReadStatus}>
                <Chip
                    icon={isRead ? <MarkEmailReadIcon sx={{fontSize: '16px !important'}} /> : <MarkEmailUnreadIcon sx={{fontSize: '16px !important'}} />}
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

            {/* POD Photos */}
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

            {/* Text Input Dialog */}
            <TextInputDialog
                open={actions.textDialog.open}
                title={actions.textDialog.title}
                label={actions.textDialog.label}
                initialValue={actions.textDialog.initialValue}
                onSubmit={actions.handleTextDialogSubmit}
                onCancel={actions.handleTextDialogCancel}
            />
        </Box>
    );
}
