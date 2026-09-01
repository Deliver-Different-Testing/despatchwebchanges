/**
 * FlightItinerary Component
 *
 * Displays multi-segment timeline view for connecting flights
 */

import React from 'react';
import {Box, Group, Paper, Stack, Text} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {Clock} from 'lucide-react';
import {IconPlane, IconRoute} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import { FlightItineraryProps, FlightSegmentData } from './types';

/**
 * The dialog stacks its segment rows below this width. Kept as the pixel value
 * the MUI `breakpoints.down('md')` resolved to, so the layout flips where it
 * always did rather than at Mantine's differently-placed `md`.
 */
const STACK_BELOW = '(max-width: 899px)';

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

/** One airport end of a leg: time, code, name and terminal. */
function SegmentEndpoint({time, code, name, terminal, stacked}: {
    time: string;
    code: string;
    name?: string;
    terminal?: string;
    stacked: boolean;
}) {
    return (
        <Box ta="center" style={{flex: stacked ? 'none' : '0 0 140px'}}>
            <Text fz="xl" fw={700} mb={4}>{time}</Text>
            <Text fz="md" fw={700} mb={4}>{code}</Text>
            {name && <Text fz="xs" c="dimmed" mb={4}>{name}</Text>}
            {terminal && (
                <Box
                    display="inline-block"
                    px={8}
                    style={{
                        fontSize: '0.6875rem',
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: 'var(--mantine-color-gray-2)',
                    }}
                >
                    Terminal {terminal}
                </Box>
            )}
        </Box>
    );
}

interface SegmentItemProps {
    segment: FlightSegmentData;
    isLast: boolean;
    connectionTime?: string;
    isStacked: boolean;
}

const SegmentItem: React.FC<SegmentItemProps> = ({ segment, isLast, connectionTime, isStacked }) => {
    return (
        <Box mb={24} style={{position: 'relative'}}>
            {/* Segment content */}
            <Paper withBorder radius="md" p={20} bg="var(--mantine-color-gray-0)">
                {/* Segment header */}
                <Group justify="space-between" mb={16}>
                    <Text fz="xs" fw={600} c="dimmed" tt="uppercase" style={{letterSpacing: 0.5}}>
                        Segment {segment.segmentOrder + 1}
                    </Text>
                    <Box
                        px={12}
                        py={2}
                        style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            borderRadius: 'var(--mantine-radius-sm)',
                            background: 'var(--mantine-color-body)',
                            border: '1px solid var(--mantine-color-default-border)',
                        }}
                    >
                        {segment.carrierFsCode}{segment.flightNumber}
                    </Box>
                </Group>

                {/* Segment route */}
                <Group
                    align={isStacked ? 'stretch' : 'center'}
                    gap={isStacked ? 16 : 24}
                    wrap="nowrap"
                    style={{flexDirection: isStacked ? 'column' : 'row'}}
                >
                    <SegmentEndpoint
                        time={segment.departureTime.format('HH:mm')}
                        code={segment.departureAirportFsCode}
                        name={segment.departureAirportName}
                        terminal={segment.departureTerminal}
                        stacked={isStacked}
                    />

                    {/* Route connection */}
                    <Stack align="center" gap={8} style={{flex: 1}}>
                        {/* Duration badge */}
                        <Box
                            px={12}
                            py={2}
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: 'var(--mantine-radius-sm)',
                                background: 'var(--mantine-primary-color-light)',
                                color: 'var(--mantine-primary-color-light-color)',
                            }}
                        >
                            {formatDuration(segment.elapsedTime)}
                        </Box>

                        {/* Connection line */}
                        <Box
                            w={isStacked ? 60 : '100%'}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Box
                                w="100%"
                                h={3}
                                style={{
                                    borderRadius: 'var(--mantine-radius-sm)',
                                    background: 'var(--mantine-primary-color-filled)',
                                }}
                            />
                            <Box
                                style={{
                                    position: 'absolute',
                                    display: 'flex',
                                    padding: 4,
                                    borderRadius: '50%',
                                    background: 'var(--mantine-color-body)',
                                    color: 'var(--mantine-primary-color-filled)',
                                    transform: isStacked ? 'rotate(180deg)' : 'rotate(90deg)',
                                }}
                            >
                                <Icon tabler={IconPlane} size={16}/>
                            </Box>
                        </Box>

                        {/* Aircraft badge */}
                        {(segment.aircraftName || segment.flightEquipmentIataCode) && (
                            <Box
                                px={8}
                                py={2}
                                c="dimmed"
                                style={{
                                    fontSize: '0.6875rem',
                                    borderRadius: 'var(--mantine-radius-sm)',
                                    background: 'var(--mantine-color-body)',
                                    border: '1px solid var(--mantine-color-gray-3)',
                                }}
                            >
                                {segment.aircraftName || segment.flightEquipmentIataCode}
                            </Box>
                        )}
                    </Stack>

                    <SegmentEndpoint
                        time={segment.arrivalTime.format('HH:mm')}
                        code={segment.arrivalAirportFsCode}
                        name={segment.arrivalAirportName}
                        terminal={segment.arrivalTerminal}
                        stacked={isStacked}
                    />
                </Group>
            </Paper>

            {/*
              * Not an Alert: this is a standing fact about the itinerary, and
              * Mantine's Alert is an assertive live region — it would be announced
              * as though it had just happened, every time a tab is switched.
              */}
            {!isLast && connectionTime && (
                <Group
                    justify="center"
                    gap={8}
                    mt={12}
                    px={12}
                    py={12}
                    style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: 'var(--mantine-color-yellow-0)',
                        color: 'var(--mantine-color-yellow-9)',
                    }}
                >
                    <Icon lucide={Clock} size={20}/>
                    <Text fz="sm" fw={500}>
                        {connectionTime} connection time in {segment.arrivalAirportFsCode}
                    </Text>
                </Group>
            )}

            {/* Timeline connector */}
            {!isLast && (
                <Box
                    w={2}
                    h={24}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -12,
                        background: 'var(--mantine-color-gray-3)',
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
    /* `false` initial value, resolved on the first render rather than deferred to
       an effect — otherwise the timeline mounts side-by-side and reflows. */
    const isStacked = useMediaQuery(STACK_BELOW, false, {getInitialValueInEffect: false});

    if (!segments || segments.length === 0) {
        return null;
    }

    return (
        <Paper withBorder radius="md" p={24} bg="var(--mantine-color-body)">
            {/* Card title */}
            <Group gap={12} mb={24}>
                <Icon tabler={IconRoute} size={24}/>
                <Text fz="lg" fw={600}>Flight Itinerary</Text>
            </Group>

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
                            isStacked={isStacked}
                        />
                    );
                })}
            </Box>
        </Paper>
    );
};

export default FlightItinerary;
