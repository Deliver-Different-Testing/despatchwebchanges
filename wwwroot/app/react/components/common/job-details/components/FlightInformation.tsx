/**
 * FlightInformation - Flight segments with connection times
 */

import React, {useState, useCallback} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FlightIcon from '@mui/icons-material/Flight';
import CellTowerIcon from '@mui/icons-material/CellTower';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type {IAssignedFlight, IFlightSegment} from '../JobDetails.types';
import type {Dayjs} from 'dayjs';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
} from '../JobDetails.styles';
import nationwideApi from '../../../../services/nationwideApi';

interface FlightInformationProps {
    flight: IAssignedFlight;
    jobId: number;
}

function formatElapsedTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
    return `${mins}m`;
}

function getConnectionTime(first: IFlightSegment, second: IFlightSegment): string {
    if (!first || !second) return '';
    const diffMinutes = (second.departureTime as Dayjs).diff(first.arrivalTime as Dayjs, 'minutes');
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours > 0) return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
    return `${mins}m`;
}

function FlightSegmentRow({segment}: {segment: IFlightSegment}) {
    const elapsed = formatElapsedTime(segment.elapsedTime);

    return (
        <Box sx={{px: 2, py: 1.5}}>
            {/* Header: flight number + airline + elapsed time */}
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="body2" sx={{fontWeight: 700, fontSize: '0.875rem'}}>
                        {segment.flightNumber}
                    </Typography>
                    {segment.airlineName && (
                        <Typography variant="caption" color="text.secondary">
                            {segment.airlineName}
                        </Typography>
                    )}
                </Box>
                {elapsed && (
                    <Chip size="small" icon={<ScheduleIcon />} label={elapsed} variant="outlined" />
                )}
            </Box>

            {/* Route: departure ··· ✈ ··· arrival */}
            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1}}>
                {/* Departure */}
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="body2" sx={{fontWeight: 700, color: 'primary.main', fontSize: '1rem'}}>
                        {segment.departureAirportFsCode}
                    </Typography>
                    {segment.departureAirportCity && (
                        <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
                            {segment.departureAirportCity}
                        </Typography>
                    )}
                    <Typography variant="caption" sx={{display: 'block', fontWeight: 500}}>
                        {segment._departureTimeStr} {segment._departureTimeZoneStr}
                    </Typography>
                    {segment.departureTerminal && (
                        <Chip
                            size="small"
                            label={`Terminal ${segment.departureTerminal}`}
                            variant="outlined"
                            sx={{mt: 0.5, height: 20, fontSize: '0.625rem'}}
                        />
                    )}
                </Box>

                {/* Center: dashed line with flight icon */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pt: 0.5,
                    minWidth: 60,
                }}>
                    <Box sx={{
                        flex: 1,
                        borderBottom: '2px dashed',
                        borderColor: 'divider',
                    }} />
                    <FlightIcon sx={{
                        fontSize: 18,
                        color: 'primary.main',
                        transform: 'rotate(90deg)',
                        mx: 0.5,
                    }} />
                    <Box sx={{
                        flex: 1,
                        borderBottom: '2px dashed',
                        borderColor: 'divider',
                    }} />
                </Box>

                {/* Arrival */}
                <Box sx={{flex: 1, minWidth: 0, textAlign: 'right'}}>
                    <Typography variant="body2" sx={{fontWeight: 700, color: 'primary.main', fontSize: '1rem'}}>
                        {segment.arrivalAirportFsCode}
                    </Typography>
                    {segment.arrivalAirportCity && (
                        <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
                            {segment.arrivalAirportCity}
                        </Typography>
                    )}
                    <Typography variant="caption" sx={{display: 'block', fontWeight: 500}}>
                        {segment._arrivalTimeStr} {segment._arrivalTimeZoneStr}
                    </Typography>
                    {segment.arrivalTerminal && (
                        <Chip
                            size="small"
                            label={`Terminal ${segment.arrivalTerminal}`}
                            variant="outlined"
                            sx={{mt: 0.5, height: 20, fontSize: '0.625rem'}}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export const FlightInformation = React.memo(({flight, jobId}: FlightInformationProps) => {
    const segments = flight?.flightSegments;
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'active' | 'inactive'>('idle');

    const checkWebhookStatus = useCallback(async () => {
        setWebhookStatus('loading');
        try {
            const result = await nationwideApi.getFlightWebhookStatus(jobId);
            setWebhookStatus(result.active ? 'active' : 'inactive');
        } catch {
            setWebhookStatus('inactive');
        }
    }, [jobId]);

    if (!segments?.length) return null;

    return (
        <Box sx={cardContainerSx}>
            <Box sx={sectionToolbarSx}>
                <FlightIcon sx={sectionToolbarIconSx} />
                <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                    Flight Information
                </Typography>
                <Box sx={{ml: 'auto', display: 'flex', alignItems: 'center', gap: 1}}>
                    {webhookStatus === 'active' && (
                        <Chip size="small" label="Webhooks Active" color="success" />
                    )}
                    {webhookStatus === 'inactive' && (
                        <Chip size="small" label="Webhooks Inactive" color="error" />
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={webhookStatus === 'loading' ? <CircularProgress size={14} /> : <CellTowerIcon sx={{fontSize: 16}} />}
                        onClick={checkWebhookStatus}
                        disabled={webhookStatus === 'loading'}
                        sx={{fontSize: '0.6875rem', py: 0.25, px: 1, minWidth: 0}}
                    >
                        {webhookStatus === 'loading' ? 'Checking...' : 'Check Webhooks'}
                    </Button>
                </Box>
            </Box>
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <FlightSegmentRow segment={segment} />
                    {index < segments.length - 1 && (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 0.5, borderTop: 1, borderBottom: 1, borderColor: 'divider'}}>
                            <Chip
                                size="small"
                                icon={<ScheduleIcon />}
                                label={`${getConnectionTime(segment, segments[index + 1])} connection`}
                                variant="outlined"
                                color="warning"
                            />
                        </Box>
                    )}
                </React.Fragment>
            ))}
            {flight.notes && (
                <Box sx={{px: 2, py: 1, borderTop: 1, borderColor: 'divider'}}>
                    <Typography variant="caption" color="text.secondary" sx={{fontWeight: 500}}>
                        Notes:
                    </Typography>
                    <Typography variant="body2" sx={{fontSize: '0.8125rem'}}>
                        {flight.notes}
                    </Typography>
                </Box>
            )}
        </Box>
    );
});
