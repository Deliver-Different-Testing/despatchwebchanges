/**
 * FlightDetailsDialog Component
 *
 * React replacement for the AngularJS flight-details-dialog.
 * Displays detailed flight information with support for multi-segment flights.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {Box, Flex, Tabs} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {LayoutDashboard} from 'lucide-react';
import {IconPlane, IconPlaneDeparture} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogHeader,
    DialogShell,
    dialogSize,
} from '../shared/mantine';
import { FlightDetailsDialogProps, FlightSegmentData, FlightData } from './types';
import { FlightSummaryCard } from './FlightSummaryCard';
import { FlightDetailsCard } from './FlightDetailsCard';
import { FlightItinerary } from './FlightItinerary';

/**
 * The dialog goes edge-to-edge on a phone. Kept as the pixel value MUI's
 * `breakpoints.down('sm')` resolved to, so it flips where it always did rather
 * than at Mantine's differently-placed `sm`.
 */
const FULLSCREEN_BELOW = '(max-width: 599px)';

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
    /* Resolved on the first render rather than deferred to an effect, or the
       dialog mounts windowed and jumps to full screen a tick later. */
    const isFullscreen = useMediaQuery(FULLSCREEN_BELOW, false, {getInitialValueInEffect: false});

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

    /* Mantine tabs are keyed by string, so the index the segment lookup needs is
       parsed back out rather than handed over directly. */
    const handleTabChange = (value: string | null) => {
        setSelectedTabIndex(value ? Number(value) : 0);
    };

    return (
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.md}
            label="Flight Details"
            fullScreen={isFullscreen}
        >
            <DialogHeader
                icon={<Icon tabler={IconPlane}/>}
                title="Flight Details"
                subtitle="View flight information and segments"
                onClose={onClose}
            />

            {/* Segment tabs for multi-segment flights */}
            {flight.isMultiSegment && flight.flightSegments && flight.flightSegments.length > 0 && (
                <Tabs
                    value={String(selectedTabIndex)}
                    onChange={handleTabChange}
                    bg="var(--mantine-color-gray-0)"
                >
                    <Tabs.List px={24}>
                        <Tabs.Tab value="0" leftSection={<Icon lucide={LayoutDashboard} size={20}/>}>
                            Overview
                        </Tabs.Tab>
                        {flight.flightSegments.map((_, index) => (
                            <Tabs.Tab
                                key={index}
                                value={String(index + 1)}
                                leftSection={<Icon tabler={IconPlaneDeparture} size={20}/>}
                            >
                                Segment {index + 1}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs>
            )}

            {/* Content */}
            <Box bg="var(--mantine-color-gray-0)">
                <Flex direction="column" p={{base: 16, sm: 24}} gap={{base: 16, sm: 24}}>
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
                </Flex>
            </Box>
        </DialogShell>
    );
};

export default FlightDetailsDialog;
