/**
 * FlightDetailsCard Component
 *
 * Displays detailed departure and arrival information
 */

import React from 'react';
import {Box, Divider, Group, Paper, SimpleGrid, Text} from '@mantine/core';
import {DoorOpen, Info} from 'lucide-react';
import {IconPlane, IconPlaneArrival, IconPlaneDeparture} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import { FlightDetailsCardProps } from './types';

/** Airport, code, city, local time and terminal — the same block for each end of the leg. */
function Endpoint({icon, title, info}: {
    icon: React.ReactNode;
    title: string;
    info: {
        name: string;
        code: string;
        city?: string;
        country?: string;
        time: {format: (pattern: string) => string};
        terminal?: string;
    };
}) {
    return (
        <Box>
            <Group gap={8} mb={16}>
                {icon}
                <Text fz="md" fw={600}>{title}</Text>
            </Group>

            <Box mb={12}>
                <Text fz="lg" fw={600} mb={4}>{info.name}</Text>
                <Text fz="sm" fw={600} mb={4}>{info.code}</Text>
                {info.city && (
                    <Text fz="sm" c="dimmed">
                        {info.city}{info.country ? `, ${info.country}` : ''}
                    </Text>
                )}
            </Box>

            <Box mb={12}>
                <Text fz={24} fw={700} lh={1.2} mb={4}>{info.time.format('HH:mm')}</Text>
                <Text fz="sm" c="dimmed">{info.time.format('MMM D, YYYY')}</Text>
            </Box>

            {info.terminal && (
                <Group
                    gap={8}
                    px={12}
                    py={8}
                    c="dimmed"
                    w="fit-content"
                    style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: 'var(--mantine-color-gray-1)',
                    }}
                >
                    <Icon lucide={DoorOpen} size={16}/>
                    <Text fz="sm" fw={500}>Terminal {info.terminal}</Text>
                </Group>
            )}
        </Box>
    );
}

export const FlightDetailsCard: React.FC<FlightDetailsCardProps> = ({
    segment,
    flight,
    isOverview,
}) => {
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
        <Paper withBorder radius="md" p={24} bg="var(--mantine-color-body)">
            {/* Card title */}
            <Group gap={12} mb={24}>
                <Icon lucide={Info} size={24}/>
                <Text fz="lg" fw={600}>Flight Information</Text>
            </Group>

            {/*
              * One column on a narrow dialog, two otherwise. This was a
              * useMediaQuery driving a grid-template-columns string; SimpleGrid
              * says the same thing without a hook or a re-render on resize.
              */}
            <SimpleGrid cols={{base: 1, md: 2}} spacing={32} mb={24}>
                <Endpoint
                    icon={<Icon tabler={IconPlaneDeparture} size={20}/>}
                    title="Departure"
                    info={departureInfo}
                />
                <Endpoint
                    icon={<Icon tabler={IconPlaneArrival} size={20}/>}
                    title="Arrival"
                    info={arrivalInfo}
                />
            </SimpleGrid>

            {/* Aircraft section */}
            {aircraftName && (
                <>
                    <Divider my={24}/>
                    <Box>
                        <Group gap={8} mb={12}>
                            <Icon tabler={IconPlane} size={20}/>
                            <Text fz="md" fw={600}>Aircraft</Text>
                        </Group>
                        <Box
                            px={16}
                            py={12}
                            c="dimmed"
                            display="inline-block"
                            style={{
                                borderRadius: 'var(--mantine-radius-sm)',
                                background: 'var(--mantine-color-gray-1)',
                                fontWeight: 500,
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
