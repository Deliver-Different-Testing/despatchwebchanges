/**
 * FlightInformation - Flight segments with connection times
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import FlightIcon from '@mui/icons-material/Flight';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import type {IAssignedFlight, IFlightSegment} from '../JobDetails.types';
import type {Dayjs} from 'dayjs';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
} from '../JobDetails.styles';

interface FlightInformationProps {
    flight: IAssignedFlight;
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
    return (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, px: 2}}>
            <FlightIcon sx={{fontSize: 18, color: 'primary.main', transform: 'rotate(45deg)'}} />
            <Box sx={{flex: 1, minWidth: 0}}>
                <Typography variant="body2" sx={{fontSize: '0.8125rem', fontWeight: 600}}>
                    {segment.flightNumber}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    <FlightTakeoffIcon sx={{fontSize: 12, color: 'text.secondary'}} />
                    <Typography variant="caption" color="text.secondary">
                        {segment.departureAirportFsCode}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{mx: 0.25}}>
                        {'\u2192'}
                    </Typography>
                    <FlightLandIcon sx={{fontSize: 12, color: 'text.secondary'}} />
                    <Typography variant="caption" color="text.secondary">
                        {segment.arrivalAirportFsCode}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{textAlign: 'right'}}>
                <Typography variant="caption" sx={{display: 'block', fontWeight: 500}}>
                    {(segment as any)._departureTimeStr} {(segment as any)._departureTimeZoneStr}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
                    {(segment as any)._arrivalTimeStr} {(segment as any)._arrivalTimeZoneStr}
                </Typography>
            </Box>
        </Box>
    );
}

export const FlightInformation = React.memo(function FlightInformation({flight}: FlightInformationProps) {
    const segments = flight?.flightSegments;
    if (!segments?.length) return null;

    return (
        <Box sx={cardContainerSx}>
            <Box sx={sectionToolbarSx}>
                <FlightIcon sx={sectionToolbarIconSx} />
                <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                    Flight Information
                </Typography>
            </Box>
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <FlightSegmentRow segment={segment} />
                    {index < segments.length - 1 && (
                        <Box sx={{display: 'flex', alignItems: 'center', px: 2, py: 0.25}}>
                            <Divider sx={{flex: 1}} />
                            <Typography variant="caption" color="text.secondary" sx={{mx: 1.5, fontWeight: 500, fontSize: '0.6875rem'}}>
                                {getConnectionTime(segment, segments[index + 1])} connection
                            </Typography>
                            <Divider sx={{flex: 1}} />
                        </Box>
                    )}
                </React.Fragment>
            ))}
        </Box>
    );
});
