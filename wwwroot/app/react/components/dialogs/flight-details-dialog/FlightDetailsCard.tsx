/**
 * FlightDetailsCard Component
 *
 * Displays detailed departure and arrival information
 */

import React from 'react';
import { Box, Paper, Typography, Icon, Divider, useMediaQuery, useTheme } from '@mui/material';
import { FlightDetailsCardProps } from './types';

export const FlightDetailsCard: React.FC<FlightDetailsCardProps> = ({
    segment,
    flight,
    isOverview,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Get arrival info - for overview with multi-segment, show final destination
    const getArrivalInfo = () => {
        if (isOverview && flight.isMultiSegment && flight.flightSegments && flight.flightSegments.length > 0) {
            const lastSegment = flight.flightSegments[flight.flightSegments.length - 1];
            return {
                name: lastSegment.arrivalAirportName || flight.arrivalAirport,
                code: lastSegment.arrivalAirportFsCode || flight.arrivalAirport,
                city: lastSegment.arrivalAirportCity,
                country: lastSegment.arrivalAirportCountry,
                time: lastSegment.arrivalTime || flight.arrivalTime,
                terminal: lastSegment.arrivalTerminal,
            };
        }
        return {
            name: segment.arrivalAirportName || flight.arrivalAirport,
            code: segment.arrivalAirportFsCode || flight.arrivalAirport,
            city: segment.arrivalAirportCity,
            country: segment.arrivalAirportCountry,
            time: segment.arrivalTime || flight.arrivalTime,
            terminal: segment.arrivalTerminal,
        };
    };

    const departureInfo = {
        name: segment.departureAirportName || flight.departureAirport,
        code: segment.departureAirportFsCode || flight.departureAirport,
        city: segment.departureAirportCity,
        country: segment.departureAirportCountry,
        time: segment.departureTime || flight.departureTime,
        terminal: segment.departureTerminal,
    };

    const arrivalInfo = getArrivalInfo();
    const aircraftName = segment.aircraftName || flight.aircraft;

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
                <Icon sx={{ fontSize: '1.5rem', color: 'primary.main' }}>info</Icon>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Flight Information
                </Typography>
            </Box>

            {/* Details grid */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 4,
                    mb: 3,
                }}
            >
                {/* Departure section */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Icon sx={{ fontSize: 20, color: 'primary.main' }}>flight_takeoff</Icon>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            Departure
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                            {departureInfo.name}
                        </Typography>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                color: 'primary.main',
                                fontSize: '0.875rem',
                                mb: 0.5,
                            }}
                        >
                            {departureInfo.code}
                        </Typography>
                        {departureInfo.city && (
                            <Typography variant="body2" color="text.secondary">
                                {departureInfo.city}{departureInfo.country ? `, ${departureInfo.country}` : ''}
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ mb: 1.5 }}>
                        <Typography
                            sx={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'text.primary',
                                mb: 0.5,
                                lineHeight: 1.2,
                            }}
                        >
                            {departureInfo.time.format('HH:mm')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {departureInfo.time.format('MMM D, YYYY')}
                        </Typography>
                    </Box>

                    {departureInfo.terminal && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: 'grey.100',
                                px: 1.5,
                                py: 1,
                                borderRadius: 1,
                                width: 'fit-content',
                                fontWeight: 500,
                                color: 'text.secondary',
                                fontSize: '0.875rem',
                            }}
                        >
                            <Icon sx={{ fontSize: 16 }}>door_front</Icon>
                            <span>Terminal {departureInfo.terminal}</span>
                        </Box>
                    )}
                </Box>

                {/* Arrival section */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Icon sx={{ fontSize: 20, color: 'primary.main' }}>flight_land</Icon>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            Arrival
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                            {arrivalInfo.name}
                        </Typography>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                color: 'primary.main',
                                fontSize: '0.875rem',
                                mb: 0.5,
                            }}
                        >
                            {arrivalInfo.code}
                        </Typography>
                        {arrivalInfo.city && (
                            <Typography variant="body2" color="text.secondary">
                                {arrivalInfo.city}{arrivalInfo.country ? `, ${arrivalInfo.country}` : ''}
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ mb: 1.5 }}>
                        <Typography
                            sx={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'text.primary',
                                mb: 0.5,
                                lineHeight: 1.2,
                            }}
                        >
                            {arrivalInfo.time.format('HH:mm')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {arrivalInfo.time.format('MMM D, YYYY')}
                        </Typography>
                    </Box>

                    {arrivalInfo.terminal && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: 'grey.100',
                                px: 1.5,
                                py: 1,
                                borderRadius: 1,
                                width: 'fit-content',
                                fontWeight: 500,
                                color: 'text.secondary',
                                fontSize: '0.875rem',
                            }}
                        >
                            <Icon sx={{ fontSize: 16 }}>door_front</Icon>
                            <span>Terminal {arrivalInfo.terminal}</span>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Aircraft section */}
            {aircraftName && (
                <>
                    <Divider sx={{ my: 3 }} />
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Icon sx={{ fontSize: 20, color: 'primary.main' }}>airlines</Icon>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                Aircraft
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                bgcolor: 'grey.100',
                                px: 2,
                                py: 1.5,
                                borderRadius: 1,
                                display: 'inline-block',
                                fontWeight: 500,
                                color: 'text.secondary',
                                fontSize: '1rem',
                            }}
                        >
                            {aircraftName}
                        </Box>
                    </Box>
                </>
            )}
        </Paper>
    );
};

export default FlightDetailsCard;
