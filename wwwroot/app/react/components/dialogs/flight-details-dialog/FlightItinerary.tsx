/**
 * FlightItinerary Component
 *
 * Displays multi-segment timeline view for connecting flights
 */

import React from 'react';
import { Box, Paper, Typography, Icon, useMediaQuery, useTheme } from '@mui/material';
import { FlightItineraryProps, FlightSegmentData } from './types';

/**
 * Format elapsed time in minutes to readable string
 */
function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
    }
    return `${mins}m`;
}

interface SegmentItemProps {
    segment: FlightSegmentData;
    isLast: boolean;
    connectionTime?: string;
    isMobile: boolean;
}

const SegmentItem: React.FC<SegmentItemProps> = ({ segment, isLast, connectionTime, isMobile }) => {
    return (
        <Box sx={{ position: 'relative', mb: 3 }}>
            {/* Segment content */}
            <Box
                sx={{
                    bgcolor: 'grey.50',
                    borderRadius: 1.5,
                    p: 2.5,
                    border: '1px solid',
                    borderColor: 'grey.200',
                }}
            >
                {/* Segment header */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}
                    >
                        Segment {segment.segmentOrder + 1}
                    </Typography>
                    <Box
                        sx={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'primary.main',
                            bgcolor: 'background.paper',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'primary.main',
                        }}
                    >
                        {segment.carrierFsCode}{segment.flightNumber}
                    </Box>
                </Box>

                {/* Segment route */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: isMobile ? 'stretch' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? 2 : 3,
                    }}
                >
                    {/* Departure point */}
                    <Box sx={{ flex: isMobile ? 'none' : '0 0 140px', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                            {segment.departureTime.format('HH:mm')}
                        </Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
                            {segment.departureAirportFsCode}
                        </Typography>
                        {segment.departureAirportName && (
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                                {segment.departureAirportName}
                            </Typography>
                        )}
                        {segment.departureTerminal && (
                            <Box
                                sx={{
                                    fontSize: '0.6875rem',
                                    color: 'text.primary',
                                    bgcolor: 'grey.200',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1.25,
                                    display: 'inline-block',
                                }}
                            >
                                Terminal {segment.departureTerminal}
                            </Box>
                        )}
                    </Box>

                    {/* Route connection */}
                    <Box
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        {/* Duration badge */}
                        <Box
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 1.5,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                            }}
                        >
                            {formatDuration(segment.elapsedTime)}
                        </Box>

                        {/* Connection line */}
                        <Box
                            sx={{
                                width: isMobile ? 60 : '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                            }}
                        >
                            <Box
                                sx={{
                                    width: '100%',
                                    height: 3,
                                    bgcolor: 'primary.main',
                                    borderRadius: 1,
                                }}
                            />
                            <Icon
                                sx={{
                                    position: 'absolute',
                                    fontSize: 16,
                                    color: 'primary.main',
                                    bgcolor: 'background.paper',
                                    borderRadius: '50%',
                                    p: 0.5,
                                    transform: isMobile ? 'rotate(180deg)' : 'rotate(90deg)',
                                }}
                            >
                                flight
                            </Icon>
                        </Box>

                        {/* Aircraft badge */}
                        {(segment.aircraftName || segment.flightEquipmentIataCode) && (
                            <Box
                                sx={{
                                    fontSize: '0.6875rem',
                                    color: 'text.secondary',
                                    bgcolor: 'background.paper',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1.25,
                                    border: '1px solid',
                                    borderColor: 'grey.300',
                                }}
                            >
                                {segment.aircraftName || segment.flightEquipmentIataCode}
                            </Box>
                        )}
                    </Box>

                    {/* Arrival point */}
                    <Box sx={{ flex: isMobile ? 'none' : '0 0 140px', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                            {segment.arrivalTime.format('HH:mm')}
                        </Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
                            {segment.arrivalAirportFsCode}
                        </Typography>
                        {segment.arrivalAirportName && (
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                                {segment.arrivalAirportName}
                            </Typography>
                        )}
                        {segment.arrivalTerminal && (
                            <Box
                                sx={{
                                    fontSize: '0.6875rem',
                                    color: 'text.primary',
                                    bgcolor: 'grey.200',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1.25,
                                    display: 'inline-block',
                                }}
                            >
                                Terminal {segment.arrivalTerminal}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Connection info (if not last segment) */}
            {!isLast && connectionTime && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        mt: 1.5,
                        bgcolor: 'warning.lighter',
                        color: 'warning.dark',
                        px: 1.5,
                        py: 1.5,
                        borderRadius: 1,
                        fontWeight: 500,
                        fontSize: '0.875rem',
                    }}
                >
                    <Icon sx={{ fontSize: '1.25rem' }}>schedule</Icon>
                    <span>
                        {connectionTime} connection time in {segment.arrivalAirportFsCode}
                    </span>
                </Box>
            )}

            {/* Timeline connector */}
            {!isLast && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -12,
                        width: 2,
                        height: 24,
                        bgcolor: 'grey.300',
                        transform: 'translateX(-50%)',
                    }}
                />
            )}
        </Box>
    );
};

export const FlightItinerary: React.FC<FlightItineraryProps> = ({
    segments,
    getConnectionTime,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    if (!segments || segments.length === 0) {
        return null;
    }

    return (
        <Paper
            elevation={1}
            sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 3,
            }}
        >
            {/* Card title */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 3,
                }}
            >
                <Icon sx={{ fontSize: '1.5rem', color: 'primary.main' }}>route</Icon>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Flight Itinerary
                </Typography>
            </Box>

            {/* Timeline container */}
            <Box>
                {segments.map((segment, index) => {
                    const isLast = index === segments.length - 1;
                    const connectionTime = !isLast
                        ? getConnectionTime(segment, segments[index + 1])
                        : undefined;

                    return (
                        <SegmentItem
                            key={segment.segmentOrder}
                            segment={segment}
                            isLast={isLast}
                            connectionTime={connectionTime}
                            isMobile={isMobile}
                        />
                    );
                })}
            </Box>
        </Paper>
    );
};

export default FlightItinerary;
