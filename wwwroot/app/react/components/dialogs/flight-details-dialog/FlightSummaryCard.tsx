/**
 * FlightSummaryCard Component
 *
 * Displays airline info, route visualization, and duration
 */

import React from 'react';
import {Box, Group, Paper, Stack, Text} from '@mantine/core';
import {Clock} from 'lucide-react';
import {IconPlane} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
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
        <Paper withBorder radius="md" p={24} bg="var(--mantine-color-body)">
            {/* Header: Airline info and date */}
            <Group justify="space-between" align="flex-start" mb={32} wrap="nowrap">
                {/* Airline section */}
                <Group gap={16} wrap="nowrap">
                    {/*
                      * A tinted tile rather than the old brand gradient with white
                      * text on it: the DFRNT primaries are light enough that white
                      * on a solid fill fails contrast outright. Tinted background,
                      * dark-brand text.
                      */}
                    <Box
                        w={60}
                        h={60}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--mantine-radius-md)',
                            background: 'var(--mantine-primary-color-light)',
                            color: 'var(--mantine-primary-color-light-color)',
                            fontWeight: 700,
                            fontSize: '1.25rem',
                            letterSpacing: 1,
                        }}
                    >
                        {carrierCode}
                    </Box>

                    {/* Airline details */}
                    <Box>
                        <Text fz="lg" fw={600} lh={1.2} mb={4}>{airlineName}</Text>
                        {/* Ink, not the brand: this is the headline read of the card. */}
                        <Text fz={28} fw={700} lh={1.2} style={{letterSpacing: -0.5}}>
                            {carrierCode} {flightNum}
                        </Text>
                    </Box>
                </Group>

                {/* Flight date section */}
                <Text fz="md" fw={500} c="dimmed">
                    {departureTime.format('ddd, MMM D, YYYY')}
                </Text>
            </Group>

            {/* Route overview */}
            <Group gap={32} wrap="nowrap">
                {/* Departure endpoint */}
                <Box ta="left" style={{flex: '0 0 120px'}}>
                    <Text fz={40} fw={700} lh={1.2} mb={4} style={{letterSpacing: -1}}>
                        {departureCode}
                    </Text>
                    <Text fz="xl" fw={600} lh={1.2}>{departureTime.format('HH:mm')}</Text>
                </Box>

                {/* Route visualization */}
                <Stack align="center" gap={12} style={{flex: 1}}>
                    {/* Route line */}
                    <Box
                        w="100%"
                        h={4}
                        style={{
                            position: 'relative',
                            borderRadius: 'var(--mantine-radius-sm)',
                            background: 'var(--mantine-color-gray-3)',
                        }}
                    >
                        {/* Progress line */}
                        <Box
                            h="100%"
                            w="70%"
                            style={{
                                borderRadius: 'var(--mantine-radius-sm)',
                                background: 'var(--mantine-primary-color-filled)',
                            }}
                        />
                        {/* Plane icon */}
                        <Box
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '70%',
                                transform: 'translate(-50%, -50%) rotate(90deg)',
                                display: 'flex',
                                padding: 6,
                                borderRadius: '50%',
                                background: 'var(--mantine-color-body)',
                                color: 'var(--mantine-primary-color-filled)',
                            }}
                        >
                            <Icon tabler={IconPlane} size={20}/>
                        </Box>
                    </Box>

                    {/* Duration badge */}
                    <Group
                        gap={6}
                        px={16}
                        py={8}
                        c="dimmed"
                        style={{
                            borderRadius: 'var(--mantine-radius-xl)',
                            background: 'var(--mantine-color-gray-1)',
                        }}
                    >
                        <Icon lucide={Clock} size={16}/>
                        <Text fz="sm" fw={500}>{duration}</Text>
                    </Group>
                </Stack>

                {/* Arrival endpoint */}
                <Box ta="right" style={{flex: '0 0 120px'}}>
                    <Text fz={40} fw={700} lh={1.2} mb={4} style={{letterSpacing: -1}}>
                        {arrivalInfo.code}
                    </Text>
                    <Text fz="xl" fw={600} lh={1.2}>{arrivalInfo.time.format('HH:mm')}</Text>
                </Box>
            </Group>
        </Paper>
    );
};

export default FlightSummaryCard;
