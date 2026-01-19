/**
 * FlightSummaryCard Component
 *
 * Displays airline info, route visualization, and duration
 */

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Flight as FlightIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { FlightSummaryCardProps } from './types';

export const FlightSummaryCard: React.FC<FlightSummaryCardProps> = ({
    segment,
    flight,
    duration,
    isOverview,
}) => {
    // Determine the display values based on whether we're showing overview or segment
    const departureCode = segment.departureAirportFsCode || flight.departureAirport;
    const departureTime = segment.departureTime || flight.departureTime;

    // For arrival in overview mode with multi-segment, show the final destination
    const getArrivalInfo = () => {
        if (isOverview && flight.isMultiSegment && flight.flightSegments && flight.flightSegments.length > 0) {
            const lastSegment = flight.flightSegments[flight.flightSegments.length - 1];
            return {
                code: lastSegment.arrivalAirportFsCode || flight.arrivalAirport,
                time: lastSegment.arrivalTime || flight.arrivalTime,
            };
        }
        return {
            code: segment.arrivalAirportFsCode || flight.arrivalAirport,
            time: segment.arrivalTime || flight.arrivalTime,
        };
    };

    const arrivalInfo = getArrivalInfo();
    const carrierCode = segment.carrierFsCode || flight.flightNumber.substring(0, 2);
    const airlineName = segment.airlineName || flight.airline;
    const flightNum = segment.flightNumber || flight.flightNumber.substring(2);

    return (
        <Paper
            elevation={1}
            sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 3,
            }}
        >
            {/* Header: Airline info and date */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 4,
                }}
            >
                {/* Airline section */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Airline logo placeholder */}
                    <Box
                        sx={(theme) => ({
                            width: 60,
                            height: 60,
                            borderRadius: 1.5,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'primary.contrastText',
                            fontWeight: 700,
                            fontSize: '1.25rem',
                            letterSpacing: 1,
                            boxShadow: 1,
                        })}
                    >
                        {carrierCode}
                    </Box>

                    {/* Airline details */}
                    <Box>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                lineHeight: 1.2,
                                mb: 0.5,
                            }}
                        >
                            {airlineName}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '1.75rem',
                                fontWeight: 700,
                                color: 'primary.main',
                                letterSpacing: -0.5,
                                lineHeight: 1.2,
                            }}
                        >
                            {carrierCode} {flightNum}
                        </Typography>
                    </Box>
                </Box>

                {/* Flight date section */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.secondary',
                            fontWeight: 500,
                        }}
                    >
                        {departureTime.format('ddd, MMM D, YYYY')}
                    </Typography>
                </Box>
            </Box>

            {/* Route overview */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}
            >
                {/* Departure endpoint */}
                <Box sx={{ flex: '0 0 120px', textAlign: 'left' }}>
                    <Typography
                        sx={{
                            fontSize: '2.5rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            mb: 0.5,
                            letterSpacing: -1,
                            lineHeight: 1.2,
                        }}
                    >
                        {departureCode}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'primary.main',
                            lineHeight: 1.2,
                        }}
                    >
                        {departureTime.format('HH:mm')}
                    </Typography>
                </Box>

                {/* Route visualization */}
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1.5,
                    }}
                >
                    {/* Route line */}
                    <Box
                        sx={{
                            width: '100%',
                            height: 4,
                            bgcolor: 'grey.300',
                            borderRadius: 1,
                            position: 'relative',
                            overflow: 'visible',
                        }}
                    >
                        {/* Progress line */}
                        <Box
                            sx={(theme) => ({
                                width: '70%',
                                height: '100%',
                                background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                                borderRadius: 1,
                            })}
                        />
                        {/* Plane icon */}
                        <FlightIcon
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '70%',
                                transform: 'translate(-50%, -50%) rotate(90deg)',
                                fontSize: 20,
                                color: 'primary.main',
                                bgcolor: 'background.paper',
                                borderRadius: '50%',
                                p: 0.75,
                                boxShadow: 1,
                            }}
                        />
                    </Box>

                    {/* Duration badge */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            bgcolor: 'grey.100',
                            px: 2,
                            py: 1,
                            borderRadius: 2.5,
                            color: 'text.secondary',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                        }}
                    >
                        <ScheduleIcon sx={{ fontSize: 16 }} />
                        <span>{duration}</span>
                    </Box>
                </Box>

                {/* Arrival endpoint */}
                <Box sx={{ flex: '0 0 120px', textAlign: 'right' }}>
                    <Typography
                        sx={{
                            fontSize: '2.5rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            mb: 0.5,
                            letterSpacing: -1,
                            lineHeight: 1.2,
                        }}
                    >
                        {arrivalInfo.code}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: 'primary.main',
                            lineHeight: 1.2,
                        }}
                    >
                        {arrivalInfo.time.format('HH:mm')}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
};

export default FlightSummaryCard;
