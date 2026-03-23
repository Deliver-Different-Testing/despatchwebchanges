/**
 * MetricsGrid - Two rows of timing and pricing metric cards
 * Matches AngularJS .metrics-grid layout with 1px gap separators.
 */

import React, {useCallback} from 'react';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material/styles';
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

export function MetricsGrid({
                                job,
                                showToast,
                                onEditDateAndTime,
                                onEditPodName,
                                onEditCompletedTime,
                                onClientClick,
                                onPricingClick,
                            }: MetricsGridProps) {
    const puTz = getTzStr(job.pickUpTimeZone);
    const delTz = getTzStr(job.deliveryTimeZone);
    const defaultTz = getTimezoneAbbreviation(window.TimeZone || '');

    const notEditable = useCallback((item: string) => {
        showToast(`${item} is not editable`, 'info');
    }, [showToast]);

    const isLocked = !!job.locked;

    const canEditFollowUp = !isLocked
        && job.internalStatusId !== JobInternalStatusEnum.NewJobs
        && job.internalStatusId !== JobInternalStatusEnum.Reprice;

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
                    onClick={() => notEditable('Created Date')}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Ready"
                    value={`${job._readyStr || ''} ${job._pickUpTimeZoneStr || puTz}`}
                    onClick={() => !isLocked && onEditDateAndTime(
                        JobProperty.BookedTime, 'Booked Date', job.booked, job.pickUpTimeZone
                    )}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="PU Arrival"
                    value={job.pickupArrivalTime ? `${job._pickupArrivalTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={() => !isLocked && onEditDateAndTime(
                        JobProperty.PickupArrivalTime, 'Pickup Arrival Time', job.pickupArrivalTime, job.pickUpTimeZone
                    )}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="PU Time"
                    value={job.puTime ? `${job._puTimeStr} ${job._pickUpTimeZoneStr || puTz}` : '-'}
                    onClick={() => !isLocked && onEditDateAndTime(
                        JobProperty.PuTime, 'Pick Up Time', job.puTime, job.pickUpTimeZone
                    )}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Deliver By"
                    value={job.deliverByTime ? `${job._deliverByTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={() => !isLocked && onEditDateAndTime(
                        JobProperty.DeliverBy, 'Deliver By', job.deliverByTime, job.deliveryTimeZone
                    )}
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
                    onClick={() => notEditable('Dispatch Time')}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Del Arrival"
                    value={job.deliveryArrivalTime ? `${job._deliveryArrivalTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={() => !isLocked && onEditDateAndTime(
                        JobProperty.DeliveryArrivalTime, 'Delivery Arrival Time', job.deliveryArrivalTime, job.deliveryTimeZone
                    )}
                    disabled={isLocked}
                    category="time"
                    filled
                />
                <MetricCard
                    label="POD Name"
                    value={job.podName || '-'}
                    onClick={() => !isLocked && onEditPodName()}
                    disabled={isLocked}
                    category="pod"
                    filled
                />
                <MetricCard
                    label="POD Time"
                    value={job.completedTime ? `${job._completedTimeStr} ${job._deliveryTimeZoneStr || delTz}` : '-'}
                    onClick={() => !isLocked && onEditCompletedTime()}
                    disabled={isLocked}
                    category="pod"
                    filled
                />
                <MetricCard
                    label="Follow Up"
                    value={job.followupTime ? `${job._followupTimeStr} ${defaultTz}` : '-'}
                    onClick={() => canEditFollowUp && onEditDateAndTime(
                        JobProperty.FollowupTime, 'Follow Up Time', job.followupTime, job.deliveryTimeZone
                    )}
                    disabled={!canEditFollowUp}
                    category="time"
                    filled
                />
                <MetricCard
                    label="Client Name"
                    value={job.clientName || '-'}
                    onClick={() => !isLocked && onClientClick()}
                    disabled={isLocked}
                    category="info"
                    filled
                />
            </Box>
        </>
    );
}
