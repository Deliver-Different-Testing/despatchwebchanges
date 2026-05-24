/**
 * MetricsGrid - Two rows of timing and pricing metric cards
 * Matches AngularJS .metrics-grid layout with 1px gap separators.
 */

import React, {useCallback, useRef, useEffect} from 'react';
import {formatCurrency} from '../../../../utils/currencyUtils';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import {MetricCard} from './MetricCard';
import type {IJob} from '../JobDetails.types';
import {getTimezoneAbbreviation} from '../../../../utils/dateUtils';
import {JobProperty} from '../../../../../enums/job-property.enum';
import JobInternalStatusEnum from '../../../../../enums/job-internal-status.enum';
import {usePendingChangeForField} from '../../../job-change-requests/useJobChangeRequests';
import {PendingChangeBadge} from '../../../job-change-requests/PendingChangeBadge';

interface MetricsGridProps {
    job: IJob;
    dense?: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    onEditDateAndTime: (field: string, title: string, dateTime?: unknown, timezone?: unknown) => void;
    onEditPodName: () => void;
    onEditCompletedTime: () => void;
    onClientClick: () => void;
    onPricingClick: () => void;
    onInternalStatusClick: () => void;
}

const gridSx: SxProps<Theme> = {
    display: 'grid',
    gridTemplateColumns: {
        xs: 'repeat(2, 1fr)',
        sm: 'repeat(3, 1fr)',
        md: 'repeat(6, 1fr)',
    },
    gap: '1px',
    bgcolor: 'grey.200',
};

function getTzStr(timezone?: { text?: string }): string {
    if (timezone?.text) return getTimezoneAbbreviation(timezone.text);
    return getTimezoneAbbreviation(window.TimeZone || '');
}

export const MetricsGrid = React.memo(({
                                           job,
                                           dense,
                                           showToast,
                                           onEditDateAndTime,
                                           onEditPodName,
                                           onEditCompletedTime,
                                           onClientClick,
                                           onPricingClick,
                                           onInternalStatusClick,
                                       }: MetricsGridProps) => {
    const puTz = getTzStr(job.pickUpTimeZone);
    const delTz = getTzStr(job.deliveryTimeZone);
    const defaultTz = getTimezoneAbbreviation(window.TimeZone || '');

    const isLocked = !!job.locked;

    // Partner-job pending-change badges. The hook reads the shared
    // ['jobChangeRequests', jobId] cache, so cards stay in sync with the
    // history panel and refresh automatically when a request is filed /
    // approved. Each call is filtered by JobChangeField name so the badge
    // only appears on the card whose field is actually pending.
    const pendingRate = usePendingChangeForField(job.id, 'PartnerAgreedRate');
    const pendingBooked = usePendingChangeForField(job.id, ['BookedTime', 'Date']);
    const pendingPuTime = usePendingChangeForField(job.id, 'PuTime');
    const pendingDeliverBy = usePendingChangeForField(job.id, 'DeliverBy');

    const canEditFollowUp = !isLocked
        && job.internalStatusId !== JobInternalStatusEnum.NewJobs
        && job.internalStatusId !== JobInternalStatusEnum.Reprice;

    // Use jobRef so callbacks don't recreate when job fields change
    const jobRef = useRef(job);
    useEffect(() => { jobRef.current = job; }, [job]);

    const handleCreatedClick = useCallback(() => {
        showToast('Created Date is not editable', 'info');
    }, [showToast]);

    const handleDispatchedClick = useCallback(() => {
        showToast('Dispatch Time is not editable', 'info');
    }, [showToast]);

    const handleReadyClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.BookedTime, 'Booked Date', j.booked, j.pickUpTimeZone);
    }, [onEditDateAndTime]);

    const handlePuArrivalClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.PickupArrivalTime, 'Pickup Arrival Time', j.pickupArrivalTime, j.pickUpTimeZone);
    }, [onEditDateAndTime]);

    const handlePuTimeClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.PuTime, 'Pick Up Time', j.puTime, j.pickUpTimeZone);
    }, [onEditDateAndTime]);

    const handleDeliverByClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.DeliverBy, 'Deliver By', j.deliverByTime, j.deliveryTimeZone);
    }, [onEditDateAndTime]);

    const handleDelArrivalClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.DeliveryArrivalTime, 'Delivery Arrival Time', j.deliveryArrivalTime, j.deliveryTimeZone);
    }, [onEditDateAndTime]);

    const handleFollowUpClick = useCallback(() => {
        const j = jobRef.current;
        onEditDateAndTime(JobProperty.FollowupTime, 'Follow Up Time', j.followupTime, j.deliveryTimeZone);
    }, [onEditDateAndTime]);

    return (
        <>
            {/* Row 1: PRICING, CREATED, READY, PU ARRIVAL, PU TIME, DELIVER BY */}
            <Box sx={gridSx}>
                <MetricCard
                    label="Pricing"
                    value={job.charge != null ? formatCurrency(job.charge) : ''}
                    onClick={onPricingClick}
                    disabled={isLocked}
                    highlight
                    category="pricing"
                    filled
                    dense={dense}
                    overlay={pendingRate && <PendingChangeBadge request={pendingRate}/>}
                />
                <MetricCard
                    label="Created"
                    value={`${job._createdDateTimeStr || ''} ${defaultTz}`}
                    onClick={handleCreatedClick}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="Ready"
                    value={`${job._readyStr || ''} ${job._pickUpTimeZoneStr || puTz}`}
                    onClick={handleReadyClick}
                    disabled={isLocked}
                    category="time"
                    filled
                    dense={dense}
                    overlay={pendingBooked && <PendingChangeBadge request={pendingBooked}/>}
                />
                <MetricCard
                    label="PU Arrival"
                    value={job.pickupArrivalTime ? `${job._pickupArrivalTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuArrivalClick}
                    disabled={isLocked}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="PU Time"
                    value={job.puTime ? `${job._puTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuTimeClick}
                    disabled={isLocked}
                    category="time"
                    filled
                    dense={dense}
                    overlay={pendingPuTime && <PendingChangeBadge request={pendingPuTime}/>}
                />
                <MetricCard
                    label="Deliver By"
                    value={job.deliverByTime ? `${job._deliverByTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={handleDeliverByClick}
                    overlay={pendingDeliverBy && <PendingChangeBadge request={pendingDeliverBy}/>}
                    disabled={isLocked}
                    category="time"
                    filled
                    dense={dense}
                />
            </Box>

            {/* Row 2: DISPATCHED, DEL ARRIVAL, POD NAME, POD TIME, FOLLOW UP, CLIENT NAME */}
            <Box sx={{...gridSx as object, borderTop: 1, borderColor: 'divider'}}>
                <MetricCard
                    label="Dispatched"
                    value={job.dispatchTime ? `${job._dispatchTimeStr} ${defaultTz}` : '-'}
                    onClick={handleDispatchedClick}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="Del Arrival"
                    value={job.deliveryArrivalTime ? `${job._deliveryArrivalTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={handleDelArrivalClick}
                    disabled={isLocked}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="POD Name"
                    value={job.podName || '-'}
                    onClick={onEditPodName}
                    disabled={isLocked}
                    category="pod"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="POD Time"
                    value={job.completedTime ? `${job._completedTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={onEditCompletedTime}
                    disabled={isLocked}
                    category="pod"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="Follow Up"
                    value={job.followupTime ? `${job._followupTimeStr} ${defaultTz}` : '-'}
                    onClick={handleFollowUpClick}
                    disabled={!canEditFollowUp}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="Client Name"
                    value={job.clientName || '-'}
                    onClick={onClientClick}
                    disabled={isLocked}
                    category="info"
                    filled
                    dense={dense}
                />
            </Box>

            {/* Internal Status - only editable on nationwide jobs */}
            {job.hasNationwide && job.internalStatusId != null && (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', py: dense ? 0.25 : 0.75, borderTop: 1, borderColor: 'divider'}}>
                    <Chip
                        label={`Internal: ${getInternalStatusLabel(job.internalStatusId)}`}
                        size="small"
                        variant="outlined"
                        clickable
                        onClick={onInternalStatusClick}
                        sx={{fontSize: '0.75rem', fontWeight: 500}}
                    />
                </Box>
            )}
        </>
    );
});

function getInternalStatusLabel(id: number): string {
    switch (id) {
        case JobInternalStatusEnum.NewJobs: return 'New Jobs';
        case JobInternalStatusEnum.ActionRequired: return 'Action Required';
        case JobInternalStatusEnum.AwaitingPod: return 'Awaiting POD';
        case JobInternalStatusEnum.Reprice: return 'Reprice';
        case JobInternalStatusEnum.OvernightCp: return 'Overnight CP';
        default: return `Status ${id}`;
    }
}
