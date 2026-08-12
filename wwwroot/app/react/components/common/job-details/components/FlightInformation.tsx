/**
 * FlightInformation - Flight segments with connection times
 */

import React, {useState, useCallback} from 'react';
import {Badge, Box, Button, Group, Paper, Text} from '@mantine/core';
import {RadioTower} from 'lucide-react';
import {IconClock, IconPlane} from '@tabler/icons-react';
import type {IAssignedFlight, IFlightSegment} from '../JobDetails.types';
import type {Dayjs} from 'dayjs';
import {Icon} from '../../icon/Icon';
import {
    cardContainerProps,
    cardNotesContainerStyle,
    sectionBorderStyle,
} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';
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

/** The airport code — the one brand-coloured token in a segment row. */
const airportCodeStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--mantine-primary-color-filled)',
};

/** Half of the dashed route line either side of the plane glyph. */
const routeRuleStyle: React.CSSProperties = {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomStyle: 'dashed',
    borderBottomColor: 'var(--mantine-color-default-border)',
};

const terminalBadgeStyle: React.CSSProperties = {marginTop: 4, height: 20, fontSize: '0.625rem'};

function FlightSegmentRow({segment}: {segment: IFlightSegment}) {
    const elapsed = formatElapsedTime(segment.elapsedTime);

    return (
        <Box px="md" py="sm">
            {/* Header: flight number + airline + elapsed time */}
            <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <Text fz="sm" fw={700}>{segment.flightNumber}</Text>
                    {segment.airlineName && (
                        <Text fz="xs" c="dimmed">{segment.airlineName}</Text>
                    )}
                </Group>
                {elapsed && (
                    <Badge size="sm" variant="default" tt="none" leftSection={<Icon tabler={IconClock} size={12}/>}>
                        {elapsed}
                    </Badge>
                )}
            </Group>
            {/* Route: departure ··· ✈ ··· arrival */}
            <Group align="flex-start" gap="xs" wrap="nowrap">
                {/* Departure */}
                <Box style={{flex: 1, minWidth: 0}}>
                    <Text style={airportCodeStyle}>{segment.departureAirportFsCode}</Text>
                    {segment.departureAirportCity && (
                        <Text fz="xs" c="dimmed">{segment.departureAirportCity}</Text>
                    )}
                    <Text fz="xs" fw={500}>
                        {segment._departureTimeStr} {segment._departureTimeZoneStr}
                    </Text>
                    {segment.departureTerminal && (
                        <Badge size="sm" variant="default" tt="none" style={terminalBadgeStyle}>
                            {`Terminal ${segment.departureTerminal}`}
                        </Badge>
                    )}
                </Box>

                {/* Center: dashed line with flight icon */}
                <Group gap={4} wrap="nowrap" pt={4} style={{flex: 1, minWidth: 60}}>
                    <Box style={routeRuleStyle}/>
                    <Icon
                        tabler={IconPlane}
                        size={18}
                        color="var(--mantine-primary-color-filled)"
                        style={{transform: 'rotate(90deg)', flexShrink: 0}}
                        aria-hidden
                    />
                    <Box style={routeRuleStyle}/>
                </Group>

                {/* Arrival */}
                <Box style={{flex: 1, minWidth: 0, textAlign: 'right'}}>
                    <Text style={airportCodeStyle}>{segment.arrivalAirportFsCode}</Text>
                    {segment.arrivalAirportCity && (
                        <Text fz="xs" c="dimmed">{segment.arrivalAirportCity}</Text>
                    )}
                    <Text fz="xs" fw={500}>
                        {segment._arrivalTimeStr} {segment._arrivalTimeZoneStr}
                    </Text>
                    {segment.arrivalTerminal && (
                        <Badge size="sm" variant="default" tt="none" style={terminalBadgeStyle}>
                            {`Terminal ${segment.arrivalTerminal}`}
                        </Badge>
                    )}
                </Box>
            </Group>
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
        <Paper {...cardContainerProps}>
            <SectionHeader
                tabler={IconPlane}
                title="Flight Information"
                subtitle={segments.length > 1 ? `${segments.length} segments` : undefined}
                endAction={
                    <>
                        {webhookStatus === 'active' && (
                            <Badge size="sm" color="green" tt="none">Webhooks Active</Badge>
                        )}
                        {webhookStatus === 'inactive' && (
                            <Badge size="sm" color="red" tt="none">Webhooks Inactive</Badge>
                        )}
                        <Button
                            size="compact-sm"
                            variant="default"
                            leftSection={<Icon lucide={RadioTower} size={16}/>}
                            onClick={checkWebhookStatus}
                            loading={webhookStatus === 'loading'}
                            style={{fontSize: '0.75rem'}}
                        >
                            {webhookStatus === 'loading' ? 'Checking...' : 'Check Webhooks'}
                        </Button>
                    </>
                }
            />
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <FlightSegmentRow segment={segment}/>
                    {index < segments.length - 1 && (
                        <Group
                            justify="center"
                            py={4}
                            style={{
                                ...sectionBorderStyle,
                                borderBottomWidth: 1,
                                borderBottomStyle: 'solid',
                                borderBottomColor: 'var(--mantine-color-default-border)',
                            }}
                        >
                            <Badge
                                size="sm"
                                color="orange"
                                tt="none"
                                leftSection={<Icon tabler={IconClock} size={12}/>}
                            >
                                {`${getConnectionTime(segment, segments[index + 1])} connection`}
                            </Badge>
                        </Group>
                    )}
                </React.Fragment>
            ))}
            {flight.notes && (
                <Box style={cardNotesContainerStyle}>
                    <Text fz="xs" c="dimmed" fw={500}>Notes:</Text>
                    <Text fz="sm">{flight.notes}</Text>
                </Box>
            )}
        </Paper>
    );
});
