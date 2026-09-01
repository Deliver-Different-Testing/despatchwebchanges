/**
 * FlightAgentDataTable React Component
 *
 * Displays flight options or agent options based on job type.
 * Styled to match the original AngularJS md-table layout.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {ActionIcon, Badge, Box, Button, Collapse, Group, Menu, Progress, Stack, Table, Text, TextInput, ThemeIcon, Tooltip, alpha} from '@mantine/core';
import {Check, ChevronDown, ChevronUp, FileText, HardHat, Info, Navigation, Plus, Search, UserSearch, X} from 'lucide-react';
import {IconPlane, IconPlaneArrival, IconPlaneDeparture, IconPlaneTilt} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';
import {SortableTh} from '../data-table';
import dayjs from 'dayjs';
import {NoData} from '../no-data/NoData';
import {AirportSuggestion, FlightAgentDataTableProps, FlightSegment} from './types';
import {openFlightDetailsDialog} from '../../dialogs/flight-details-dialog';
import {openAgentInfoDialog} from '../../dialogs/agent-info-dialog';
import {formatCurrency} from '../../../utils/currencyUtils';

type SortDirection = 'asc' | 'desc';
type FlightSortKey =
    'airline'
    | 'flightNumber'
    | 'departureTime'
    | 'arrivalTime'
    | 'elapsedTime'
    | 'stops'
    | 'amount'
    | 'aircraft';
type AgentSortKey = 'agentName' | 'agentRate' | 'agentRanking' | 'agentNotes';

// Airline colors matching the original CSS
const AIRLINE_COLORS: Record<string, { bg: string; text: string }> = {
    'AA': {bg: '#0078D2', text: '#FFFFFF'},
    'DL': {bg: '#E01A4F', text: '#FFFFFF'},
    'UA': {bg: '#002244', text: '#FFFFFF'},
    'WN': {bg: '#304CB2', text: '#FFFFFF'},
    'AC': {bg: '#D82F2F', text: '#FFFFFF'},
    'B6': {bg: '#003A70', text: '#FFFFFF'},
    'AS': {bg: '#0060AF', text: '#FFFFFF'},
    'WS': {bg: '#0F8ED0', text: '#FFFFFF'},
    'NK': {bg: '#FFC600', text: '#000000'},
    'F9': {bg: '#018A32', text: '#FFFFFF'},
    'TS': {bg: '#1F83BE', text: '#FFFFFF'},
    'HA': {bg: '#481D7D', text: '#FFFFFF'},
    'G4': {bg: '#FFC72C', text: '#000000'},
    'PD': {bg: '#00BDF2', text: '#FFFFFF'},
    'F8': {bg: '#59CAEE', text: '#000000'},
    'Y9': {bg: '#A3CE39', text: '#000000'},
};

const getAirlineColor = (code: string): { bg: string; text: string } => {
    return AIRLINE_COLORS[code] || {bg: '#757575', text: '#FFFFFF'};
};


const formatDateTime = (time: dayjs.Dayjs | string | undefined): string => {
    if (!time) return '--';
    const dayjsTime = dayjs.isDayjs(time) ? time : dayjs(time);
    if (!dayjsTime.isValid()) return '--';
    return dayjsTime.format('MM/DD HH:mm');
};



// Loading indicator - extracted to module level (rerender-no-inline-components)
// Mantine has no indeterminate progress bar; an animated full-width Section is the
// busy affordance and keeps role="progressbar".
const LoadingIndicator: React.FC = () => (
    <Progress.Root size={4} radius={0}>
        <Progress.Section value={100} animated aria-label="Loading"/>
    </Progress.Root>
);

// Row action button - extracted to module level (rerender-no-inline-components).
// Named to leave `ActionIcon` free for Mantine's component of that name.
const RowActionButton: React.FC<{
    icon: React.ReactNode;
    tooltip: string;
    onClick: () => void;
}> = ({icon, tooltip, onClick}) => (
    <Tooltip label={tooltip} position="left">
        <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onClick}
            aria-label={tooltip}
        >
            {icon}
        </ActionIcon>
    </Tooltip>
);

// Charter indicator chip - extracted to module level (rerender-no-inline-components)
const CharterChip: React.FC<{ description?: string }> = ({description}) => (
    <Tooltip label={description || 'Charter flight'} withArrow position="top">
        {/* `tt="none"` is required: Mantine's Badge uppercases its label by default. */}
        <Badge color="yellow" variant="filled" h={16} px={4} fz={9} fw={600} tt="none">
            Charter
        </Badge>
    </Tooltip>
);

// Airline chip component - extracted to module level (rerender-no-inline-components)
const AirlineChip: React.FC<{
    code: string;
    label?: string;
    tooltip?: string;
    isSelected?: boolean;
    isAllChip?: boolean;
    onClick: () => void;
}> = ({code, label, tooltip, isSelected, isAllChip, onClick}) => {
    const colors = isAllChip ? {bg: '#f5f5f5', text: 'rgba(0,0,0,0.87)'} : getAirlineColor(code);
    const button = (
        <Button
            onClick={onClick}
            h={24}
            radius={12}
            px={8}
            miw={0}
            leftSection={<Icon tabler={IconPlane} size={14}/>}
            styles={{
                // The chip's fill is per-airline data, so the hover tint has to be
                // computed here rather than themed. `--button-hover` is the supported
                // seam for that — a nested '&:hover' in `styles` lands as an inline
                // style and is silently dropped.
                root: {
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: isSelected
                        ? '2px solid var(--mantine-primary-color-filled)'
                        : '2px solid transparent',
                    boxShadow: isSelected ? 'var(--mantine-shadow-xs)' : 'none',
                    '--button-hover': alpha(colors.bg, 0.85),
                },
                label: {fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'},
                section: {marginInlineEnd: 2},
            }}
        >
            {label || code}
        </Button>
    );

    if (tooltip) {
        return (
            <Tooltip label={tooltip} withArrow position="top">
                {button}
            </Tooltip>
        );
    }

    return button;
};

// Airport picker - one component for what were two near-identical MUI menus.
// Mantine anchors to its own Menu.Target, so the `anchorEl` state both menus carried
// is gone rather than ported; the trigger now lives inside the menu it opens.
const AirportMenu: React.FC<{
    label: string;
    placeholder: string;
    icon: React.ReactNode;
    selected?: AirportSuggestion;
    options?: AirportSuggestion[];
    onChange: (airport: AirportSuggestion | null) => void;
    formatAirportCodeForDropdown: FlightAgentDataTableProps['formatAirportCodeForDropdown'];
}> = ({label, placeholder, icon, selected, options, onChange, formatAirportCodeForDropdown}) => (
    <Menu position="bottom-start" withinPortal>
        <Menu.Target>
            <Button
                aria-label={label}
                variant="default"
                h={24}
                radius={12}
                px={8}
                leftSection={icon}
                styles={{
                    label: {fontSize: 11, fontWeight: 500},
                    section: {marginInlineEnd: 2},
                }}
            >
                {selected ? formatAirportCodeForDropdown(selected.text) : placeholder}
            </Button>
        </Menu.Target>
        <Menu.Dropdown>
            {selected ? (
                <Menu.Item
                    leftSection={<Icon lucide={X} size={18}/>}
                    onClick={() => onChange(null)}
                >
                    Clear selection
                </Menu.Item>
            ) : null}
            {options?.map((airport) => (
                <Menu.Item
                    key={airport.id}
                    data-selected={selected?.id === airport.id}
                    // leftSection reserves the glyph column on every item, which is what
                    // the old fixed-width spacer Box was doing by hand.
                    leftSection={selected?.id === airport.id
                        ? <Icon lucide={Check} size={18}/>
                        : undefined}
                    onClick={() => onChange(airport)}
                >
                    {airport.text}
                </Menu.Item>
            ))}
        </Menu.Dropdown>
    </Menu>
);

// Segment details row - extracted to module level (rerender-no-inline-components)
// One end of a segment: the ringed glyph, the airport code, the time and an optional
// terminal. Departure and arrival were copy-pasted blocks differing only in glyph,
// ring colour and which fields they read.
const SegmentEndpoint: React.FC<{
    icon: React.ReactNode;
    color: string;
    code: string;
    time: React.ReactNode;
    terminal?: string;
}> = ({icon, color, code, time, terminal}) => (
    <Stack align="center" gap={0} miw={72}>
        <ThemeIcon
            size={32}
            radius="xl"
            variant="default"
            mb={4}
            style={{border: `2px solid ${color}`, color, boxShadow: `0 2px 4px ${alpha(color, 0.2)}`}}
        >
            {icon}
        </ThemeIcon>
        <Text fz={13} fw={700} style={{letterSpacing: '0.5px'}}>{code}</Text>
        <Text fz={11} fw={500} c="dimmed">{time}</Text>
        {terminal ? <Text fz={10} c="dimmed" mt={2}>Terminal {terminal}</Text> : null}
    </Stack>
);

// Segment details row - extracted to module level (rerender-no-inline-components)
const SegmentDetailsRow: React.FC<{
    segments: FlightSegment[];
    getConnectionTime: (firstSegment: FlightSegment, secondSegment: FlightSegment) => string;
    formatMinutesToTime: (minutes: number) => string;
}> = ({segments, getConnectionTime, formatMinutesToTime}) => {
    const primary = 'var(--mantine-primary-color-filled)';
    const success = 'var(--mantine-color-green-6)';
    const dash = `repeating-linear-gradient(90deg, ${primary}, ${primary} 4px, transparent 4px, transparent 8px)`;

    return (
        <div
            style={{
                padding: 16,
                backgroundColor: alpha(primary, 0.02),
                borderTop: `1px solid ${alpha(primary, 0.08)}`,
                borderBottom: `1px solid ${alpha(primary, 0.08)}`,
            }}
        >
            {/* Timeline container */}
            <Group align="stretch" gap={0} wrap="nowrap" style={{position: 'relative'}}>
                {segments.map((segment: FlightSegment, index: number) => (
                    <React.Fragment key={segment.segmentOrder}>
                        {/* Segment Card */}
                        <Group align="center" gap={12} wrap="nowrap" style={{flex: 1, minWidth: 0}}>
                            <SegmentEndpoint
                                icon={<Icon tabler={IconPlaneDeparture} size={16}/>}
                                color={primary}
                                code={segment.departureAirportFsCode}
                                time={formatDateTime(segment.departureTime)}
                                terminal={segment.departureTerminal}
                            />

                            {/* Flight path line with details */}
                            <Stack align="center" gap={0} mx={8} style={{flex: 1, minWidth: 80}}>
                                {/* Flight info chip */}
                                <Group
                                    gap={4}
                                    wrap="nowrap"
                                    px={8}
                                    py={2}
                                    mb={4}
                                    bg="var(--mantine-color-body)"
                                    style={{
                                        border: '1px solid var(--mantine-color-default-border)',
                                        borderRadius: 12,
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                    }}
                                >
                                    <Icon tabler={IconPlane} size={12} style={{color: primary, transform: 'rotate(90deg)'}}/>
                                    <Text fz={10} fw={600} c={primary}>
                                        {segment.carrierFsCode}{segment.flightNumber}
                                    </Text>
                                </Group>

                                {/* Dashed line */}
                                <Group gap={0} wrap="nowrap" align="center" w="100%" h={2}>
                                    <div style={{flex: 1, height: 2, background: dash, opacity: 0.5}}/>
                                    <Icon tabler={IconPlane} size={14} style={{color: primary, transform: 'rotate(90deg)', margin: '0 4px'}}/>
                                    <div style={{flex: 1, height: 2, background: dash, opacity: 0.5}}/>
                                </Group>

                                {/* Duration */}
                                <Text fz={10} fw={500} c="dimmed" mt={4}>
                                    {formatMinutesToTime(segment.elapsedTime)}
                                </Text>
                            </Stack>

                            <SegmentEndpoint
                                icon={<Icon tabler={IconPlaneArrival} size={16}/>}
                                color={success}
                                code={segment.arrivalAirportFsCode}
                                time={formatDateTime(segment.arrivalTime)}
                                terminal={segment.arrivalTerminal}
                            />
                        </Group>

                        {/* Connection/Layover indicator */}
                        {index < segments.length - 1 ? (
                            <Stack align="center" justify="center" mx={16} miw={80}>
                                <Group
                                    gap={4}
                                    wrap="nowrap"
                                    px={12}
                                    py={4}
                                    style={{
                                        backgroundColor: 'var(--mantine-color-yellow-0)',
                                        border: '1px solid var(--mantine-color-yellow-3)',
                                        borderRadius: 16,
                                    }}
                                >
                                    <Icon tabler={IconPlaneTilt} size={16} style={{color: 'var(--mantine-color-yellow-8)'}}/>
                                    <div style={{textAlign: 'center'}}>
                                        <Text fz={11} fw={600} c="var(--mantine-color-yellow-8)" lh={1.2}>
                                            {getConnectionTime(segment, segments[index + 1])}
                                        </Text>
                                        <Text fz={9} c="var(--mantine-color-yellow-6)" tt="uppercase" style={{letterSpacing: '0.5px'}}>
                                            Layover
                                        </Text>
                                    </div>
                                </Group>
                            </Stack>
                        ) : null}
                    </React.Fragment>
                ))}
            </Group>
        </div>
    );
};

// Flight filter bar - extracted to deduplicate (was copy-pasted in two branches)
const FlightFilterBar: React.FC<{
    activeAirlineOptions: FlightAgentDataTableProps['activeAirlineOptions'];
    selectedAirline: FlightAgentDataTableProps['selectedAirline'];
    selectedOutboundAirport: FlightAgentDataTableProps['selectedOutboundAirport'];
    selectedInboundAirport: FlightAgentDataTableProps['selectedInboundAirport'];
    outboundAirportOptions: FlightAgentDataTableProps['outboundAirportOptions'];
    inboundAirportOptions: FlightAgentDataTableProps['inboundAirportOptions'];
    includeNearbyAirports: FlightAgentDataTableProps['includeNearbyAirports'];
    onFilterFlightsByAirline: FlightAgentDataTableProps['onFilterFlightsByAirline'];
    onToggleNearbyAirports: FlightAgentDataTableProps['onToggleNearbyAirports'];
    onOutboundAirportChange: FlightAgentDataTableProps['onOutboundAirportChange'];
    onInboundAirportChange: FlightAgentDataTableProps['onInboundAirportChange'];
    formatAirportCodeForDropdown: FlightAgentDataTableProps['formatAirportCodeForDropdown'];
}> = ({
    activeAirlineOptions,
    selectedAirline,
    selectedOutboundAirport,
    selectedInboundAirport,
    outboundAirportOptions,
    inboundAirportOptions,
    includeNearbyAirports,
    onFilterFlightsByAirline,
    onToggleNearbyAirports,
    onOutboundAirportChange,
    onInboundAirportChange,
    formatAirportCodeForDropdown,
}) => {

    return (
        <>
            <Group
                gap={4}
                p={4}
                align="center"
                style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
            >
                <AirlineChip
                    code="ALL"
                    label="All"
                    tooltip="Show all airlines"
                    isAllChip
                    isSelected={!selectedAirline}
                    onClick={() => onFilterFlightsByAirline(null)}
                />
                {activeAirlineOptions?.map((airline) => (
                    <AirlineChip
                        key={airline.id}
                        code={airline.text}
                        tooltip={airline.fullAirlineName || airline.text}
                        isSelected={selectedAirline?.id === airline.id}
                        onClick={() => onFilterFlightsByAirline(airline)}
                    />
                ))}

                <div style={{flex: 1}}/>

                {/* Departure airport selector */}
                <AirportMenu
                    label="Departure airport"
                    placeholder="From"
                    icon={<Icon tabler={IconPlaneDeparture} size={14}/>}
                    selected={selectedOutboundAirport}
                    options={outboundAirportOptions}
                    onChange={onOutboundAirportChange}
                    formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                />

                <Text c="dimmed" fz={11}>→</Text>

                {/* Arrival airport selector */}
                <AirportMenu
                    label="Arrival airport"
                    placeholder="To"
                    icon={<Icon tabler={IconPlaneArrival} size={14}/>}
                    selected={selectedInboundAirport}
                    options={inboundAirportOptions}
                    onChange={onInboundAirportChange}
                    formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                />

                {/* Nearby-airport toggle: lets Cirium include flights from alternate airports near
                    the selected ones (useful for charters operating out of secondary fields). */}
                <Tooltip label="Include flights from nearby alternate airports" withArrow position="top">
                    <Button
                        onClick={() => onToggleNearbyAirports(!includeNearbyAirports)}
                        aria-pressed={includeNearbyAirports}
                        variant={includeNearbyAirports ? 'filled' : 'default'}
                        h={24}
                        radius={12}
                        px={8}
                        ml={4}
                        leftSection={<Icon lucide={Navigation} size={14}/>}
                        styles={{
                            label: {fontSize: 11, fontWeight: 500},
                            section: {marginInlineEnd: 2},
                        }}
                    >
                        Nearby
                    </Button>
                </Tooltip>
            </Group>

        </>
    );
};

export const FlightAgentDataTable: React.FC<FlightAgentDataTableProps> = ({
                                                                              isDeliveryJobType,
                                                                              flightsLoading,
                                                                              agentsLoading,
                                                                              filteredFlightOptions,
                                                                              flightSearchText,
                                                                              flightMessage,
                                                                              agentOptions,
                                                                              agentMessage,
                                                                              activeAirlineOptions,
                                                                              selectedAirline,
                                                                              includeNearbyAirports,
                                                                              outboundAirportOptions,
                                                                              inboundAirportOptions,
                                                                              selectedOutboundAirport,
                                                                              selectedInboundAirport,
                                                                              showNoJobSelectedMessage,
                                                                              showJobHasAssignedFlightMessage,
                                                                              showMissingAirportInfoMessage,
                                                                              showNoFlightsAvailableMessage,
                                                                              showFlightList,
                                                                              showNoAgentJobSelectedMessage,
                                                                              showJobHasAssignedAgentMessage,
                                                                              showNotDeliveryJobMessage,
                                                                              showNoAgentsAvailableMessage,
                                                                              showAgentList,
                                                                              onFlightSearchChange,
                                                                              onFilterFlightsByAirline,
                                                                              onToggleNearbyAirports,
                                                                              onOutboundAirportChange,
                                                                              onInboundAirportChange,
                                                                              onAddFlightToJob,
                                                                              onLoadMoreFlights,
                                                                              onLoadNextDayFlights,
                                                                              onAddAgentToJob,
                                                                              onSendQuoteRequest,
                                                                              onOpenAgentSearchDialog,
                                                                              onOpenRecoveryAgentDialog,
                                                                              formatAirportCodeForDropdown,
                                                                              getConnectionTime,
                                                                              formatMinutesToTime,
                                                                              isUsCustomer,
                                                                          }) => {
    const [expandedFlights, setExpandedFlights] = useState<Set<string>>(new Set());
    const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('arrivalTime');
    const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc');
    const [agentSortKey, setAgentSortKey] = useState<AgentSortKey>('agentName');
    const [agentSortDirection, setAgentSortDirection] = useState<SortDirection>('asc');

    const toggleFlightExpand = (flightId: string) => {
        setExpandedFlights(prev => {
            const newSet = new Set(prev);
            if (newSet.has(flightId)) {
                newSet.delete(flightId);
            } else {
                newSet.add(flightId);
            }
            return newSet;
        });
    };

    const handleFlightSort = useCallback((key: FlightSortKey) => {
        if (flightSortKey === key) {
            setFlightSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setFlightSortKey(key);
            setFlightSortDirection('asc');
        }
    }, [flightSortKey]);

    const handleAgentSort = useCallback((key: AgentSortKey) => {
        if (agentSortKey === key) {
            setAgentSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setAgentSortKey(key);
            setAgentSortDirection('asc');
        }
    }, [agentSortKey]);

    const sortedFlights = useMemo(() => {
        if (!filteredFlightOptions) return [];
        return [...filteredFlightOptions].sort((a, b) => {
            let aVal: string | number | Date;
            let bVal: string | number | Date;

            switch (flightSortKey) {
                case 'airline':
                    aVal = a.airline || '';
                    bVal = b.airline || '';
                    break;
                case 'flightNumber':
                    aVal = a.flightNumber || '';
                    bVal = b.flightNumber || '';
                    break;
                case 'departureTime':
                    aVal = a.departureTime?.valueOf() || 0;
                    bVal = b.departureTime?.valueOf() || 0;
                    break;
                case 'arrivalTime':
                    aVal = a.arrivalTime?.valueOf() || 0;
                    bVal = b.arrivalTime?.valueOf() || 0;
                    break;
                case 'elapsedTime':
                    aVal = a.elapsedTime || 0;
                    bVal = b.elapsedTime || 0;
                    break;
                case 'stops':
                    aVal = a.stops || 0;
                    bVal = b.stops || 0;
                    break;
                case 'amount':
                    aVal = a.amount || 0;
                    bVal = b.amount || 0;
                    break;
                case 'aircraft':
                    aVal = a.aircraft || '';
                    bVal = b.aircraft || '';
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return flightSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return flightSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredFlightOptions, flightSortKey, flightSortDirection]);

    const sortedAgents = useMemo(() => {
        if (!agentOptions) return [];
        return [...agentOptions].sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (agentSortKey) {
                case 'agentName':
                    aVal = a.agentName || '';
                    bVal = b.agentName || '';
                    break;
                case 'agentRate':
                    aVal = a.agentRate || 0;
                    bVal = b.agentRate || 0;
                    break;
                case 'agentRanking':
                    aVal = a.agentRanking || '';
                    bVal = b.agentRanking || '';
                    break;
                case 'agentNotes':
                    aVal = a.agentNotes || '';
                    bVal = b.agentNotes || '';
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return agentSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return agentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [agentOptions, agentSortKey, agentSortDirection]);



    const renderFlightSection = () => {
        if (flightsLoading) {
            return <LoadingIndicator/>;
        }

        if (showNoJobSelectedMessage) {
            return (
                <NoData
                    title="No Job Selected"
                    message="Please select a job to view available flights."
                    icon={<Icon tabler={IconPlaneDeparture}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showJobHasAssignedFlightMessage) {
            return (
                <NoData
                    title="Flight Already Assigned"
                    message="A flight has already been assigned to this job. This can be found in the job details widget."
                    icon={<Icon tabler={IconPlaneDeparture}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showMissingAirportInfoMessage) {
            return (
                <NoData
                    title="Missing Airport Info"
                    message="Airport information not applicable or not provided for this job."
                    icon={<Icon tabler={IconPlane}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNoFlightsAvailableMessage) {
            return (
                <Stack gap={0} h="100%">
                    <FlightFilterBar
                        activeAirlineOptions={activeAirlineOptions}
                        selectedAirline={selectedAirline}
                        selectedOutboundAirport={selectedOutboundAirport}
                        selectedInboundAirport={selectedInboundAirport}
                        outboundAirportOptions={outboundAirportOptions}
                        inboundAirportOptions={inboundAirportOptions}
                        includeNearbyAirports={includeNearbyAirports}
                        onFilterFlightsByAirline={onFilterFlightsByAirline}
                        onToggleNearbyAirports={onToggleNearbyAirports}
                        onOutboundAirportChange={onOutboundAirportChange}
                        onInboundAirportChange={onInboundAirportChange}
                        formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                    />

                    <NoData
                        title="No Flights Available"
                        message={flightMessage || "No flights available for the specified criteria."}
                        icon={<Icon tabler={IconPlaneDeparture}/>}
                        showAction={false}
                        isUsCustomer={isUsCustomer}
                    />
                </Stack>
            );
        }

        if (showFlightList) {
            return (
                <Stack gap={0} h="100%">
                    <FlightFilterBar
                        activeAirlineOptions={activeAirlineOptions}
                        selectedAirline={selectedAirline}
                        selectedOutboundAirport={selectedOutboundAirport}
                        selectedInboundAirport={selectedInboundAirport}
                        outboundAirportOptions={outboundAirportOptions}
                        inboundAirportOptions={inboundAirportOptions}
                        includeNearbyAirports={includeNearbyAirports}
                        onFilterFlightsByAirline={onFilterFlightsByAirline}
                        onToggleNearbyAirports={onToggleNearbyAirports}
                        onOutboundAirportChange={onOutboundAirportChange}
                        onInboundAirportChange={onInboundAirportChange}
                        formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                    />

                    {/* Search input - compact */}
                    <Box px={4} py={4} style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}>
                        <TextInput
                            size="xs"
                            placeholder="Search flights..."
                            value={flightSearchText}
                            onChange={(e) => onFlightSearchChange(e.currentTarget.value)}
                            leftSection={<Icon lucide={Search} size={16}/>}
                        />
                    </Box>

                    {/* Flight table - compact */}
                    <Table.ScrollContainer minWidth={0} type="native" style={{flex: 1, minHeight: 0}}>
                        <Table
                            stickyHeader
                            highlightOnHover
                            fz={11}
                            verticalSpacing={4}
                            horizontalSpacing={8}
                        >
                            <Table.Thead>
                                <Table.Tr>
                                    <SortableTh
                                        active={flightSortKey === 'airline'}
                                        direction={flightSortKey === 'airline' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('airline')}
                                    >
                                        Airline
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'flightNumber'}
                                        direction={flightSortKey === 'flightNumber' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('flightNumber')}
                                    >
                                        Flight
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'departureTime'}
                                        direction={flightSortKey === 'departureTime' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('departureTime')}
                                    >
                                        Depart
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'arrivalTime'}
                                        direction={flightSortKey === 'arrivalTime' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('arrivalTime')}
                                    >
                                        Arrive
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'elapsedTime'}
                                        direction={flightSortKey === 'elapsedTime' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('elapsedTime')}
                                    >
                                        Dur
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'stops'}
                                        direction={flightSortKey === 'stops' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('stops')}
                                    >
                                        Stops
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'amount'}
                                        direction={flightSortKey === 'amount' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('amount')}
                                    >
                                        Rate
                                    </SortableTh>
                                    <SortableTh
                                        active={flightSortKey === 'aircraft'}
                                        direction={flightSortKey === 'aircraft' ? flightSortDirection : 'asc'}
                                        onSort={() => handleFlightSort('aircraft')}
                                    >
                                        Aircraft
                                    </SortableTh>
                                    <SortableTh sortable={false} align="right">Act</SortableTh>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sortedFlights.map((flight, index) => {
                                    const flightId = flight.connectionId || flight.flightNumber;
                                    const isExpanded = expandedFlights.has(flightId);
                                    const airlineColor = getAirlineColor(flight.airline);

                                    return (
                                        <React.Fragment key={`${flightId}-${index}`}>
                                            <Table.Tr>
                                                <Table.Td>
                                                    <Group gap={2} wrap="nowrap">
                                                        <Text
                                                            fz={10}
                                                            fw={600}
                                                            px={4}
                                                            py={1}
                                                            style={{
                                                                borderRadius: 3,
                                                                backgroundColor: airlineColor.bg,
                                                                color: airlineColor.text,
                                                            }}
                                                        >
                                                            {flight.airline}
                                                        </Text>
                                                        {flight.isCodeShare && (
                                                            <Text fz={10} c="var(--mantine-color-yellow-6)">*</Text>
                                                        )}
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Group gap={2} wrap="nowrap">
                                                        <Text fz={11} fw={500}>
                                                            {flight.flightNumber}
                                                        </Text>
                                                        {flight.isCharter && (
                                                            <CharterChip description={flight.serviceTypeDescription}/>
                                                        )}
                                                        {flight.isMultiSegment && (
                                                            <ActionIcon
                                                                variant="subtle"
                                                                color="gray"
                                                                size="xs"
                                                                onClick={() => toggleFlightExpand(flightId)}
                                                                aria-label={isExpanded ? 'Collapse segments' : 'Expand segments'}
                                                                aria-expanded={isExpanded}
                                                            >
                                                                <Icon lucide={isExpanded ? ChevronUp : ChevronDown} size={14}/>
                                                            </ActionIcon>
                                                        )}
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fz={11}>
                                                        {formatDateTime(flight.departureTime)}
                                                    </Text>
                                                    <Text fz={10} fw={600}>
                                                        {flight.departureAirport}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fz={11}>
                                                        {formatDateTime(flight.arrivalTime)}
                                                    </Text>
                                                    <Text fz={10} fw={600}>
                                                        {flight.arrivalAirport}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fz={11}>
                                                        {flight.elapsedTime ? formatMinutesToTime(flight.elapsedTime) : flight.duration}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    {flight.stops === 0 ? (
                                                        <Text fz={10} fw={600} c="var(--mantine-color-green-6)">
                                                            Nonstop
                                                        </Text>
                                                    ) : (
                                                        <Badge
                                                            variant="light"
                                                            color="yellow"
                                                            size="xs"
                                                            radius={3}
                                                            tt="none"
                                                            fz={10}
                                                        >
                                                            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                                                        </Badge>
                                                    )}
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fz={11} fw={600}>
                                                        {formatCurrency(flight.amount)}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text fz={10}>
                                                        {flight.aircraft || '-'}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td align="right">
                                                    <Group gap={0} justify="flex-end" wrap="nowrap">
                                                        <RowActionButton
                                                            icon={<Icon lucide={Plus} size={16}/>}
                                                            tooltip="Assign Flight"
                                                            onClick={() => onAddFlightToJob(flight)}
                                                        />
                                                        <RowActionButton
                                                            icon={<Icon lucide={Info} size={16}/>}
                                                            tooltip="More Info"
                                                            onClick={() => openFlightDetailsDialog(flight as unknown as Parameters<typeof openFlightDetailsDialog>[0])}
                                                        />
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                            {flight.isMultiSegment && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={9} p={0} style={{border: 'none'}}>
                                                        <Collapse expanded={isExpanded}>
                                                            <SegmentDetailsRow segments={flight.flightSegments} getConnectionTime={getConnectionTime} formatMinutesToTime={formatMinutesToTime}/>
                                                        </Collapse>
                                                    </Table.Td>
                                                </Table.Tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {/* Footer actions - compact */}
                    <Group
                        gap={4}
                        p={4}
                        justify="flex-end"
                        style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
                    >
                        <Button variant="outline" size="compact-xs" onClick={onLoadMoreFlights} fz={11}>
                            More
                        </Button>
                        <Button variant="outline" size="compact-xs" onClick={onLoadNextDayFlights} fz={11}>
                            Next Day
                        </Button>
                    </Group>
                </Stack>
            );
        }

        return null;
    };

    const renderAgentSection = () => {
        if (agentsLoading) {
            return <LoadingIndicator/>;
        }

        if (showNoAgentJobSelectedMessage) {
            return (
                <NoData
                    title="No Job Selected"
                    message="Please select a job to view available agents."
                    icon={<Icon lucide={HardHat}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showJobHasAssignedAgentMessage) {
            return (
                <NoData
                    title="Agent Already Assigned"
                    message="An agent has already been assigned to this job. This can be found in the job details widget."
                    icon={<Icon lucide={HardHat}/>}
                    showAction={true}
                    actionText="Manage Recovery Agent(s)"
                    onAction={onOpenRecoveryAgentDialog}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNotDeliveryJobMessage) {
            return (
                <NoData
                    title="Not a Delivery Job"
                    message="Agent information is not applicable for this job. This section is only relevant for delivery jobs."
                    icon={<Icon lucide={HardHat}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNoAgentsAvailableMessage) {
            return (
                <NoData
                    title="No Agents Available"
                    message={agentMessage || "No agents available for the specified criteria."}
                    icon={<Icon lucide={HardHat}/>}
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showAgentList) {
            return (
                <Stack gap={0} h="100%">
                    {/* Header with search button - compact */}
                    <Group
                        p={4}
                        justify="flex-end"
                        style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
                    >
                        <Button
                            variant="filled"
                            size="compact-sm"
                            leftSection={<Icon lucide={UserSearch} size={16}/>}
                            onClick={onOpenAgentSearchDialog}
                            fz={11}
                        >
                            Search Agents
                        </Button>
                    </Group>

                    {/* Agent table - compact */}
                    <Table.ScrollContainer minWidth={0} type="native" style={{flex: 1, minHeight: 0}}>
                        <Table
                            stickyHeader
                            highlightOnHover
                            fz={11}
                            verticalSpacing={4}
                            horizontalSpacing={8}
                        >
                            <Table.Thead>
                                <Table.Tr>
                                    <SortableTh
                                        active={agentSortKey === 'agentName'}
                                        direction={agentSortKey === 'agentName' ? agentSortDirection : 'asc'}
                                        onSort={() => handleAgentSort('agentName')}
                                    >
                                        Agent
                                    </SortableTh>
                                    <SortableTh
                                        active={agentSortKey === 'agentRate'}
                                        direction={agentSortKey === 'agentRate' ? agentSortDirection : 'asc'}
                                        onSort={() => handleAgentSort('agentRate')}
                                    >
                                        Rate
                                    </SortableTh>
                                    <SortableTh
                                        active={agentSortKey === 'agentRanking'}
                                        direction={agentSortKey === 'agentRanking' ? agentSortDirection : 'asc'}
                                        onSort={() => handleAgentSort('agentRanking')}
                                    >
                                        Rank
                                    </SortableTh>
                                    <SortableTh
                                        active={agentSortKey === 'agentNotes'}
                                        direction={agentSortKey === 'agentNotes' ? agentSortDirection : 'asc'}
                                        onSort={() => handleAgentSort('agentNotes')}
                                    >
                                        Notes
                                    </SortableTh>
                                    <SortableTh sortable={false}>Act</SortableTh>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sortedAgents.map((agent) => (
                                    <Table.Tr key={agent.agentId}>
                                        <Table.Td>
                                            <Text fz={11} fw={500}>
                                                {agent.agentName}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text fz={11} fw={600}>
                                                {formatCurrency(agent.agentRate)}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text fz={11}>{agent.agentRanking}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text fz={10} maw={120} truncate>
                                                {agent.agentNotes || '-'}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={0} wrap="nowrap">
                                                <RowActionButton
                                                    icon={<Icon lucide={FileText} size={16}/>}
                                                    tooltip="Send Quote Request"
                                                    onClick={() => onSendQuoteRequest(agent)}
                                                />
                                                <RowActionButton
                                                    icon={<Icon lucide={Plus} size={16}/>}
                                                    tooltip="Assign Job"
                                                    onClick={() => onAddAgentToJob(agent)}
                                                />
                                                <RowActionButton
                                                    icon={<Icon lucide={Info} size={16}/>}
                                                    tooltip="More Info"
                                                    onClick={() => openAgentInfoDialog({agentId: agent.agentId})}
                                                />
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </Stack>
            );
        }

        return null;
    };

    return (
        <Stack gap={0} h="100%" bg="var(--mantine-color-body)" style={{overflow: 'hidden'}}>
            {!isDeliveryJobType ? renderFlightSection() : renderAgentSection()}
        </Stack>
    );
};

export default FlightAgentDataTable;
