/**
 * MetricsGrid - Two rows of timing and pricing metric cards
 * Matches AngularJS .metrics-grid layout with 1px gap separators.
 */

import React, {useCallback} from 'react';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import {MetricCard} from './MetricCard';
import type {IJob} from '../JobDetails.types';
import {getTimezoneAbbreviation} from '../../../../utils/dateUtils';
import {JobProperty} from '../../../../../enums/job-property.enum';
import JobInternalStatusEnum from '../../../../../enums/job-internal-status.enum';

interface MetricsGridProps {
    job: IJob;
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
    bgcolor: 'divider',
};

function getTzStr(timezone?: { text?: string }): string {
    if (timezone?.text) return getTimezoneAbbreviation(timezone.text);
    return getTimezoneAbbreviation(window.TimeZone || '');
}

export const MetricsGrid = React.memo(({
                                           job,
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

    const canEditFollowUp = !isLocked
        && job.internalStatusId !== JobInternalStatusEnum.NewJobs
        && job.internalStatusId !== JobInternalStatusEnum.Reprice;

    // Stable click handlers — avoid inline arrow functions to preserve MetricCard memo
    const handleCreatedClick = useCallback(() => {
        showToast('Created Date is not editable', 'info');
    }, [showToast]);

    const handleDispatchedClick = useCallback(() => {
        showToast('Dispatch Time is not editable', 'info');
    }, [showToast]);

    const handleReadyClick = useCallback(() => {
        onEditDateAndTime(JobProperty.BookedTime, 'Booked Date', job.booked, job.pickUpTimeZone);
    }, [onEditDateAndTime, job.booked, job.pickUpTimeZone]);

    const handlePuArrivalClick = useCallback(() => {
        onEditDateAndTime(JobProperty.PickupArrivalTime, 'Pickup Arrival Time', job.pickupArrivalTime, job.pickUpTimeZone);
    }, [onEditDateAndTime, job.pickupArrivalTime, job.pickUpTimeZone]);

    const handlePuTimeClick = useCallback(() => {
        onEditDateAndTime(JobProperty.PuTime, 'Pick Up Time', job.puTime, job.pickUpTimeZone);
    }, [onEditDateAndTime, job.puTime, job.pickUpTimeZone]);

    const handleDeliverByClick = useCallback(() => {
        onEditDateAndTime(JobProperty.DeliverBy, 'Deliver By', job.deliverByTime, job.deliveryTimeZone);
    }, [onEditDateAndTime, job.deliverByTime, job.deliveryTimeZone]);

    const handleDelArrivalClick = useCallback(() => {
        onEditDateAndTime(JobProperty.DeliveryArrivalTime, 'Delivery Arrival Time', job.deliveryArrivalTime, job.deliveryTimeZone);
    }, [onEditDateAndTime, job.deliveryArrivalTime, job.deliveryTimeZone]);

    const handleFollowUpClick = useCallback(() => {
        onEditDateAndTime(JobProperty.FollowupTime, 'Follow Up Time', job.followupTime, job.deliveryTimeZone);
    }, [onEditDateAndTime, job.followupTime, job.deliveryTimeZone]);

    return (
        <>
            {/* Row 1: PRICING, CREATED, READY, PU ARRIVAL, PU TIME, DELIVER BY */}
            <Box sx={gridSx}>
                <MetricCard
                    label="Pricing"
                    value={job.charge != null ? job.charge.toLocaleString(undefined, {
                        style: 'currency',
                        currency: (window as any).CurrencyCode || 'USD'
                    }) : ''}
                    onClick={onPricingClick}
                    disabled={isLocked}
                    highlight
                    category="pricing"
                    filled
                />
                <MetricCard
                    label="Created"
                    value={`${job._createdDateTimeStr || ''} ${defaultTz}`}
                    onClick={handleCreatedClick}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Ready"
                    value={`${job._readyStr || ''} ${job._pickUpTimeZoneStr || puTz}`}
                    onClick={handleReadyClick}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="PU Arrival"
                    value={job.pickupArrivalTime ? `${job._pickupArrivalTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuArrivalClick}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="PU Time"
                    value={job.puTime ? `${job._puTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuTimeClick}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Deliver By"
                    value={job.deliverByTime ? `${job._deliverByTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={handleDeliverByClick}
                    disabled={isLocked}
                    category="time"
                    filled
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
                />
                <MetricCard
                    label="Del Arrival"
                    value={job.deliveryArrivalTime ? `${job._deliveryArrivalTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={handleDelArrivalClick}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="POD Name"
                    value={job.podName || '-'}
                    onClick={onEditPodName}
                    disabled={isLocked}
                    category="pod"
                    filled
                />
                <MetricCard
                    label="POD Time"
                    value={job.completedTime ? `${job._completedTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={onEditCompletedTime}
                    disabled={isLocked}
                    category="pod"
                    filled
                />
                <MetricCard
                    label="Follow Up"
                    value={job.followupTime ? `${job._followupTimeStr} ${defaultTz}` : '-'}
                    onClick={handleFollowUpClick}
                    disabled={!canEditFollowUp}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Client Name"
                    value={job.clientName || '-'}
                    onClick={onClientClick}
                    disabled={isLocked}
                    category="info"
                    filled
                />
            </Box>

            {/* Internal Status - only editable on nationwide jobs */}
            {job.hasNationwide && job.internalStatusId != null && (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', py: 0.75, borderTop: 1, borderColor: 'divider'}}>
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
