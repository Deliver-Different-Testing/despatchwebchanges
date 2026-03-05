/**
 * FlightDetailsDialog Component
 *
 * React replacement for the AngularJS flight-details-dialog.
 * Displays detailed flight information with support for multi-segment flights.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    IconButton,
    Tabs,
    Tab,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Flight as FlightIcon,
    Close as CloseIcon,
    Dashboard as OverviewIcon,
    FlightTakeoff as FlightTakeoffIcon,
} from '@mui/icons-material';
import { FlightDetailsDialogProps, FlightSegmentData, FlightData } from './types';
import { FlightSummaryCard } from './FlightSummaryCard';
import { FlightDetailsCard } from './FlightDetailsCard';
import { FlightItinerary } from './FlightItinerary';

/**
 * Create a pseudo-segment from the main flight data for non-segmented flights
 */
function createPseudoSegment(flight: FlightData): FlightSegmentData {
    return {
        segmentOrder: 0,
        carrierFsCode: flight.flightNumber.substring(0, 2),
        flightNumber: flight.flightNumber.substring(2),
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        departureAirportFsCode: flight.departureAirport,
        arrivalAirportFsCode: flight.arrivalAirport,
        departureAirportTimeZone: flight.departureTimeZone,
        arrivalAirportTimeZone: flight.arrivalTimeZone,
        elapsedTime: flight.elapsedTime || 0,
        stopsInSegment: 0,
    };
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
}

/**
 * Parse duration string (HH:MM:SS format) to minutes
 */
function parseDurationToMinutes(durationStr: string): number {
    const matches = durationStr.match(/(\d+):(\d+):(\d+)/);
    if (matches && matches.length >= 4) {
        const hours = parseInt(matches[1]);
        const mins = parseInt(matches[2]);
        return hours * 60 + mins;
    }
    return 0;
}

export const FlightDetailsDialog: React.FC<FlightDetailsDialogProps> = ({
    open,
    flight,
    onClose,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isFullscreen = useMediaQuery(theme.breakpoints.down('sm'));

    // State
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);

    // Computed values
    const isDisplayingOverview = selectedTabIndex === 0;

    // Get current segment based on selected tab
    const currentSegment = useMemo<FlightSegmentData>(() => {
        if (flight.isMultiSegment && flight.flightSegments && flight.flightSegments.length > 0) {
            // Tab 0 is overview, use first segment
            // Tab 1+ is segment index - 1
            const segmentIndex = selectedTabIndex === 0 ? 0 : selectedTabIndex - 1;
            if (segmentIndex < flight.flightSegments.length) {
                return flight.flightSegments[segmentIndex] as FlightSegmentData;
            }
            return flight.flightSegments[0] as FlightSegmentData;
        }
        return createPseudoSegment(flight);
    }, [flight, selectedTabIndex]);

    // Calculate total flight duration
    const getFlightTotalDuration = useCallback((): string => {
        if (flight.elapsedTime) {
            return formatDuration(flight.elapsedTime);
        }
        if (flight.duration) {
            const minutes = parseDurationToMinutes(flight.duration.toString());
            if (minutes > 0) {
                return formatDuration(minutes);
            }
        }
        return 'N/A';
    }, [flight]);

    // Calculate segment duration
    const getSegmentDuration = useCallback((): string => {
        if (isDisplayingOverview) {
            return getFlightTotalDuration();
        }
        if (currentSegment && currentSegment.elapsedTime) {
            return formatDuration(currentSegment.elapsedTime);
        }
        return 'N/A';
    }, [isDisplayingOverview, currentSegment, getFlightTotalDuration]);

    // Calculate connection time between two segments
    const getConnectionTime = useCallback((firstSegment: FlightSegmentData, secondSegment: FlightSegmentData): string => {
        if (!firstSegment || !secondSegment) return '';

        const diffMinutes = secondSegment.departureTime.diff(firstSegment.arrivalTime, 'minutes');
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours > 0) {
            return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
        }
        return `${mins}m`;
    }, []);

    // Handle tab change
    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setSelectedTabIndex(newValue);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            fullScreen={isFullscreen}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: isFullscreen ? 0 : 3,
                        overflow: 'hidden',
                        height: isFullscreen ? '100vh' : 680,
                        maxHeight: isFullscreen ? '100vh' : '95vh',
                        width: isFullscreen ? '100vw' : 900,
                        maxWidth: '95vw',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <FlightIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Flight Details
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Segment tabs for multi-segment flights */}
            {flight.isMultiSegment && flight.flightSegments && flight.flightSegments.length > 0 && (
                <Box
                    sx={{
                        bgcolor: 'grey.50',
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
                    }}
                >
                    <Tabs
                        value={selectedTabIndex}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            px: 3,
                            '& .MuiTab-root': {
                                minHeight: 48,
                                textTransform: 'none',
                                fontWeight: 500,
                                fontSize: '0.875rem',
                                gap: 1,
                            },
                        }}
                    >
                        <Tab
                            icon={<OverviewIcon sx={{ fontSize: 20 }} />}
                            iconPosition="start"
                            label="Overview"
                        />
                        {flight.flightSegments.map((_, index) => (
                            <Tab
                                key={index}
                                icon={<FlightTakeoffIcon sx={{ fontSize: 20 }} />}
                                iconPosition="start"
                                label={`Segment ${index + 1}`}
                            />
                        ))}
                    </Tabs>
                </Box>
            )}

            {/* Content */}
            <DialogContent
                sx={{
                    p: 0,
                    bgcolor: 'grey.50',
                    flex: 1,
                    overflow: 'auto',
                }}
            >
                <Box
                    sx={{
                        p: isMobile ? 2 : 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? 2 : 3,
                    }}
                >
                    {/* Flight summary card */}
                    <FlightSummaryCard
                        segment={currentSegment}
                        flight={flight}
                        duration={getSegmentDuration()}
                        isOverview={isDisplayingOverview}
                    />

                    {/* Flight details card */}
                    <FlightDetailsCard
                        segment={currentSegment}
                        flight={flight}
                        isOverview={isDisplayingOverview}
                    />

                    {/* Multi-segment timeline (only in overview) */}
                    {flight.isMultiSegment && isDisplayingOverview && flight.flightSegments && (
                        <FlightItinerary
                            segments={flight.flightSegments as FlightSegmentData[]}
                            getConnectionTime={getConnectionTime}
                        />
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default FlightDetailsDialog;
