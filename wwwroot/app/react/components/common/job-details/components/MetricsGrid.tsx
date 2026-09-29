/**
 * MetricsGrid - Two rows of timing and pricing metric cards
 * Matches AngularJS .metrics-grid layout with 1px gap separators.
 */

import React, {useCallback, useRef, useEffect} from 'react';
import {formatCurrency} from '../../../../utils/currencyUtils';
import {Badge, Group, SimpleGrid} from '@mantine/core';
import {sectionBorderStyle} from '../JobDetails.styles';
import {MetricCard} from './MetricCard';
import type {IJob} from '../JobDetails.types';
import {getTimezoneAbbreviation} from '../../../../utils/dateUtils';
import {JobProperty} from '../../../../../enums/job-property.enum';
import JobInternalStatusEnum from '../../../../../enums/job-internal-status.enum';
import {usePendingChangeForField} from '../../../job-change-requests/useJobChangeRequests';
import {PendingChangeBadge} from '../../../job-change-requests/PendingChangeBadge';
import {isNetworkPartnerSession} from '../../../dialogs/dispatch-dialog/dispatchSession';

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

/**
 * The 1px gap over a grey fill is what draws the separators between tiles — the
 * cards themselves are borderless. `spacing={1}` is 1px (Mantine converts number
 * spacing to rem).
 */
const gridProps = {
    cols: {base: 2, sm: 3, md: 6},
    spacing: 1,
    verticalSpacing: 1,
    style: {backgroundColor: 'var(--mantine-color-gray-3)'},
} as const;

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

    // Follow Up opens the date/time dialog, which renders read-only when the job
    // is locked — so lock no longer disables the card, only the status rule does.
    const canEditFollowUp = job.internalStatusId !== JobInternalStatusEnum.NewJobs
        && job.internalStatusId !== JobInternalStatusEnum.Reprice;

    // Use jobRef so callbacks don't recreate when job fields change
    const jobRef = useRef(job);
    useEffect(() => { jobRef.current = job; }, [job]);

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
            {/* Row 1: PRICING, READY, PU ARRIVAL, PU TIME, DELIVER BY */}
            <SimpleGrid {...gridProps}>
                <MetricCard
                    label={isNetworkPartnerSession() ? 'Your Pay' : 'Pricing'}
                    value={job.charge != null ? formatCurrency(job.charge) : ''}
                    onClick={onPricingClick}
                    highlight
                    category="pricing"
                    filled
                    dense={dense}
                    overlay={pendingRate && <PendingChangeBadge request={pendingRate}/>}
                />
                <MetricCard
                    label="Ready"
                    value={`${job._readyStr || ''} ${job._pickUpTimeZoneStr || puTz}`}
                    onClick={handleReadyClick}
                    category="time"
                    filled
                    dense={dense}
                    overlay={pendingBooked && <PendingChangeBadge request={pendingBooked}/>}
                />
                <MetricCard
                    label="PU Arrival"
                    value={job.pickupArrivalTime ? `${job._pickupArrivalTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuArrivalClick}
                    category="time"
                    filled
                    dense={dense}
                />
                <MetricCard
                    label="PU Time"
                    value={job.puTime ? `${job._puTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={handlePuTimeClick}
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
                    category="time"
                    filled
                    dense={dense}
                />
            </SimpleGrid>

            {/* Row 2: DISPATCHED, DEL ARRIVAL, POD NAME, POD TIME, FOLLOW UP, CLIENT NAME */}
            <SimpleGrid {...gridProps} style={{...gridProps.style, ...sectionBorderStyle}}>
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
            </SimpleGrid>

            {/* Internal Status - only editable on nationwide jobs */}
            {job.hasNationwide && job.internalStatusId != null && (
                <Group
                    justify="center"
                    style={{paddingBlock: dense ? 2 : 6, ...sectionBorderStyle}}
                >
                    {/* Mantine has no clickable `Chip` in the MUI sense (its Chip is a
                        checkbox), so the status pill is a `Badge` rendered as a button. */}
                    <Badge
                        component="button"
                        type="button"
                        variant="default"
                        onClick={onInternalStatusClick}
                        style={{fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', textTransform: 'none'}}
                    >
                        {`Internal: ${getInternalStatusLabel(job.internalStatusId)}`}
                    </Badge>
                </Group>
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
