/**
 * FlightAgentDataTable React Component
 *
 * Displays flight options or agent options based on job type.
 * Styled to match the original AngularJS md-table layout.
 */

import React, {useMemo, useState} from 'react';
import {
    alpha,
    Box,
    Button,
    Collapse,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import dayjs from 'dayjs';
import {
    Add as AddIcon,
    Check as CheckIcon,
    Clear as ClearIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Flight as FlightIcon,
    FlightLand as FlightLandIcon,
    FlightTakeoff as FlightTakeoffIcon,
    Info as InfoIcon,
    PersonSearch as PersonSearchIcon,
    RequestQuote as RequestQuoteIcon,
    Schedule as ScheduleIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import {NoData} from '../no-data/NoData';
import {AgentOption, AirportSuggestion, FlightAgentDataTableProps, FlightOption, FlightSegment,} from './types';

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
    const theme = useTheme();
    const [expandedFlights, setExpandedFlights] = useState<Set<string>>(new Set());
    const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('departureTime');
    const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc');
    const [agentSortKey, setAgentSortKey] = useState<AgentSortKey>('agentName');
    const [agentSortDirection, setAgentSortDirection] = useState<SortDirection>('asc');
    const [outboundAnchorEl, setOutboundAnchorEl] = useState<null | HTMLElement>(null);
    const [inboundAnchorEl, setInboundAnchorEl] = useState<null | HTMLElement>(null);

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

    const handleFlightSort = (key: FlightSortKey) => {
        if (flightSortKey === key) {
            setFlightSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setFlightSortKey(key);
            setFlightSortDirection('asc');
        }
    };

    const handleAgentSort = (key: AgentSortKey) => {
        if (agentSortKey === key) {
            setAgentSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setAgentSortKey(key);
            setAgentSortDirection('asc');
        }
    };

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

    const formatDateTime = (time: dayjs.Dayjs | string | undefined): string => {
        if (!time) return '--';
        const dayjsTime = dayjs.isDayjs(time) ? time : dayjs(time);
        if (!dayjsTime.isValid()) return '--';
        return dayjsTime.format('MM/DD/YYYY HH:mm');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // Airline chip component matching original styling
    const AirlineChip: React.FC<{
        code: string;
        label?: string;
        isSelected?: boolean;
        isAllChip?: boolean;
        onClick: () => void;
    }> = ({code, label, isSelected, isAllChip, onClick}) => {
        const colors = isAllChip ? {bg: '#f5f5f5', text: 'rgba(0,0,0,0.87)'} : getAirlineColor(code);
        return (
            <Button
                onClick={onClick}
                sx={{
                    height: 32,
                    borderRadius: '16px',
                    minWidth: 0,
                    px: 1.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: colors.bg,
                    color: colors.text,
                    textTransform: 'none',
                    border: isSelected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                    boxShadow: isSelected ? theme.shadows[2] : 'none',
                    '&:hover': {
                        bgcolor: alpha(colors.bg, 0.85),
                    },
                }}
            >
                <FlightIcon sx={{fontSize: 18}}/>
                <Typography sx={{fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap'}}>
                    {label || code}
                </Typography>
            </Button>
        );
    };

    // Action icon button
    const ActionIcon: React.FC<{
        icon: React.ReactNode;
        tooltip: string;
        onClick: () => void;
    }> = ({icon, tooltip, onClick}) => (
        <Tooltip title={tooltip} placement="left">
            <IconButton
                size="small"
                onClick={onClick}
                sx={{
                    color: theme.palette.text.secondary,
                    '&:hover': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                    },
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );

    // Segment details row for multi-segment flights
    const SegmentDetailsRow: React.FC<{ segments: FlightSegment[] }> = ({segments}) => (
        <TableRow>
            <TableCell colSpan={9} sx={{py: 0, bgcolor: alpha(theme.palette.grey[100], 0.5)}}>
                <Box sx={{py: 2, px: 2}}>
                    {segments.map((segment, index) => (
                        <Box key={segment.segmentOrder} sx={{mb: index < segments.length - 1 ? 2 : 0}}>
                            {/* Segment header */}
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 1}}>
                                <Typography sx={{fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary}}>
                                    Segment {segment.segmentOrder + 1} of {segments.length}
                                </Typography>
                                <Typography sx={{fontSize: 12, fontWeight: 600, color: theme.palette.primary.main}}>
                                    {segment.carrierFsCode}{segment.flightNumber}
                                </Typography>
                            </Box>

                            {/* Segment times */}
                            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 3}}>
                                {/* Departure */}
                                <Box sx={{minWidth: 140}}>
                                    <Typography sx={{fontSize: 13, fontWeight: 500}}>
                                        {formatDateTime(segment.departureTime)}
                                    </Typography>
                                    <Typography sx={{fontSize: 14, fontWeight: 700, color: theme.palette.primary.main}}>
                                        {segment.departureAirportFsCode}
                                    </Typography>
                                    {segment.departureTerminal && (
                                        <Typography sx={{fontSize: 11, color: theme.palette.text.secondary}}>
                                            Terminal {segment.departureTerminal}
                                        </Typography>
                                    )}
                                    {segment.departureAirportName && (
                                        <Typography sx={{fontSize: 11, color: theme.palette.text.secondary}}>
                                            {segment.departureAirportName}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Flight line */}
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    minWidth: 100
                                }}>
                                    <Typography sx={{fontSize: 11, color: theme.palette.text.secondary, mb: 0.5}}>
                                        {formatMinutesToTime(segment.elapsedTime)}
                                    </Typography>
                                    <Box sx={{
                                        width: 80,
                                        height: 2,
                                        bgcolor: theme.palette.divider,
                                        position: 'relative'
                                    }}>
                                        <FlightIcon sx={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%, -50%) rotate(90deg)',
                                            fontSize: 14,
                                            color: theme.palette.text.secondary,
                                        }}/>
                                    </Box>
                                    {segment.aircraftName && (
                                        <Typography sx={{fontSize: 11, color: theme.palette.text.secondary, mt: 0.5}}>
                                            {segment.aircraftName}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Arrival */}
                                <Box sx={{minWidth: 140}}>
                                    <Typography sx={{fontSize: 13, fontWeight: 500}}>
                                        {formatDateTime(segment.arrivalTime)}
                                    </Typography>
                                    <Typography sx={{fontSize: 14, fontWeight: 700, color: theme.palette.primary.main}}>
                                        {segment.arrivalAirportFsCode}
                                    </Typography>
                                    {segment.arrivalTerminal && (
                                        <Typography sx={{fontSize: 11, color: theme.palette.text.secondary}}>
                                            Terminal {segment.arrivalTerminal}
                                        </Typography>
                                    )}
                                    {segment.arrivalAirportName && (
                                        <Typography sx={{fontSize: 11, color: theme.palette.text.secondary}}>
                                            {segment.arrivalAirportName}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>

                            {/* Connection time */}
                            {index < segments.length - 1 && (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    mt: 1.5,
                                    pt: 1.5,
                                    borderTop: `1px dashed ${theme.palette.divider}`,
                                }}>
                                    <ScheduleIcon sx={{fontSize: 16, color: theme.palette.warning.main}}/>
                                    <Typography sx={{fontSize: 12, fontWeight: 500, color: theme.palette.warning.main}}>
                                        {getConnectionTime(segment, segments[index + 1])} layover
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            </TableCell>
        </TableRow>
    );

    // Loading indicator
    const LoadingIndicator = () => (
        <Box sx={{
            height: 4,
            width: '100%',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            position: 'relative',
            overflow: 'hidden',
        }}>
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '30%',
                bgcolor: theme.palette.primary.main,
                animation: 'loading 1.5s infinite ease-in-out',
                '@keyframes loading': {
                    '0%': {left: '-30%'},
                    '100%': {left: '100%'},
                },
            }}/>
        </Box>
    );

    const renderFlightSection = () => {
        if (flightsLoading) {
            return <LoadingIndicator/>;
        }

        if (showNoJobSelectedMessage) {
            return (
                <NoData
                    title="No Job Selected"
                    message="Please select a job to view available flights."
                    icon="flight_takeoff"
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
                    icon="flight_takeoff"
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
                    icon="local_airport"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNoFlightsAvailableMessage) {
            return (
                <NoData
                    title="No Flights Available"
                    message={flightMessage || "No flights available for the specified criteria."}
                    icon="flight_takeoff"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showFlightList) {
            return (
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    {/* Airline filter chips */}
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}>
                        <AirlineChip
                            code="ALL"
                            label="All"
                            isAllChip
                            isSelected={!selectedAirline}
                            onClick={() => onFilterFlightsByAirline(null)}
                        />
                        {activeAirlineOptions?.map((airline) => (
                            <AirlineChip
                                key={airline.id}
                                code={airline.text}
                                isSelected={selectedAirline?.id === airline.id}
                                onClick={() => onFilterFlightsByAirline(airline)}
                            />
                        ))}

                        <Box sx={{flex: 1}}/>

                        {/* Departure airport selector */}
                        <Button
                            onClick={(e) => setOutboundAnchorEl(e.currentTarget)}
                            sx={{
                                height: 32,
                                borderRadius: '16px',
                                px: 1.5,
                                bgcolor: alpha(theme.palette.text.secondary, 0.1),
                                color: theme.palette.text.primary,
                                textTransform: 'none',
                                '&:hover': {bgcolor: alpha(theme.palette.text.secondary, 0.2)},
                            }}
                        >
                            <FlightTakeoffIcon sx={{fontSize: 18, mr: 0.5}}/>
                            <Typography sx={{fontSize: 12, fontWeight: 500}}>
                                {selectedOutboundAirport ? formatAirportCodeForDropdown(selectedOutboundAirport.text) : 'From'}
                            </Typography>
                        </Button>

                        <Typography sx={{color: theme.palette.text.secondary}}>→</Typography>

                        {/* Arrival airport selector */}
                        <Button
                            onClick={(e) => setInboundAnchorEl(e.currentTarget)}
                            sx={{
                                height: 32,
                                borderRadius: '16px',
                                px: 1.5,
                                bgcolor: alpha(theme.palette.text.secondary, 0.1),
                                color: theme.palette.text.primary,
                                textTransform: 'none',
                                '&:hover': {bgcolor: alpha(theme.palette.text.secondary, 0.2)},
                            }}
                        >
                            <FlightLandIcon sx={{fontSize: 18, mr: 0.5}}/>
                            <Typography sx={{fontSize: 12, fontWeight: 500}}>
                                {selectedInboundAirport ? formatAirportCodeForDropdown(selectedInboundAirport.text) : 'To'}
                            </Typography>
                        </Button>
                    </Box>

                    {/* Airport menus */}
                    <Menu
                        anchorEl={outboundAnchorEl}
                        open={Boolean(outboundAnchorEl)}
                        onClose={() => setOutboundAnchorEl(null)}
                    >
                        {selectedOutboundAirport && (
                            <MenuItem onClick={() => {
                                onOutboundAirportChange(null);
                                setOutboundAnchorEl(null);
                            }}>
                                <ClearIcon sx={{mr: 1, fontSize: 18}}/> Clear selection
                            </MenuItem>
                        )}
                        {outboundAirportOptions?.map((airport) => (
                            <MenuItem
                                key={airport.id}
                                onClick={() => {
                                    onOutboundAirportChange(airport);
                                    setOutboundAnchorEl(null);
                                }}
                            >
                                {selectedOutboundAirport?.id === airport.id && (
                                    <CheckIcon sx={{mr: 1, fontSize: 18, color: theme.palette.primary.main}}/>
                                )}
                                {selectedOutboundAirport?.id !== airport.id && <Box sx={{width: 26}}/>}
                                {airport.text}
                            </MenuItem>
                        ))}
                    </Menu>

                    <Menu
                        anchorEl={inboundAnchorEl}
                        open={Boolean(inboundAnchorEl)}
                        onClose={() => setInboundAnchorEl(null)}
                    >
                        {selectedInboundAirport && (
                            <MenuItem onClick={() => {
                                onInboundAirportChange(null);
                                setInboundAnchorEl(null);
                            }}>
                                <ClearIcon sx={{mr: 1, fontSize: 18}}/> Clear selection
                            </MenuItem>
                        )}
                        {inboundAirportOptions?.map((airport) => (
                            <MenuItem
                                key={airport.id}
                                onClick={() => {
                                    onInboundAirportChange(airport);
                                    setInboundAnchorEl(null);
                                }}
                            >
                                {selectedInboundAirport?.id === airport.id && (
                                    <CheckIcon sx={{mr: 1, fontSize: 18, color: theme.palette.primary.main}}/>
                                )}
                                {selectedInboundAirport?.id !== airport.id && <Box sx={{width: 26}}/>}
                                {airport.text}
                            </MenuItem>
                        ))}
                    </Menu>

                    {/* Search input */}
                    <Box sx={{p: 1, borderBottom: `1px solid ${theme.palette.divider}`}}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search by flight number, airline, airport, or aircraft..."
                            value={flightSearchText}
                            onChange={(e) => onFlightSearchChange(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{fontSize: 20, color: theme.palette.text.secondary}}/>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: theme.palette.background.paper,
                                },
                            }}
                        />
                    </Box>

                    {/* Flight table */}
                    <TableContainer sx={{flex: 1, overflow: 'auto'}}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'airline'}
                                            direction={flightSortKey === 'airline' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('airline')}
                                        >
                                            Airline
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'flightNumber'}
                                            direction={flightSortKey === 'flightNumber' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('flightNumber')}
                                        >
                                            Flight No
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'departureTime'}
                                            direction={flightSortKey === 'departureTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('departureTime')}
                                        >
                                            Departure
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'arrivalTime'}
                                            direction={flightSortKey === 'arrivalTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('arrivalTime')}
                                        >
                                            Arrival
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'elapsedTime'}
                                            direction={flightSortKey === 'elapsedTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('elapsedTime')}
                                        >
                                            Duration
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'stops'}
                                            direction={flightSortKey === 'stops' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('stops')}
                                        >
                                            Stops
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'amount'}
                                            direction={flightSortKey === 'amount' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('amount')}
                                        >
                                            Rate
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'aircraft'}
                                            direction={flightSortKey === 'aircraft' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('aircraft')}
                                        >
                                            Aircraft
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedFlights.map((flight, index) => {
                                    const flightId = flight.connectionId || flight.flightNumber;
                                    const isExpanded = expandedFlights.has(flightId);
                                    const airlineColor = getAirlineColor(flight.airline);

                                    return (
                                        <React.Fragment key={`${flightId}-${index}`}>
                                            <TableRow
                                                hover
                                                sx={{
                                                    '&:hover': {bgcolor: alpha(theme.palette.primary.main, 0.04)},
                                                }}
                                            >
                                                <TableCell>
                                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                                        <Typography
                                                            sx={{
                                                                px: 1,
                                                                py: 0.25,
                                                                borderRadius: '4px',
                                                                bgcolor: airlineColor.bg,
                                                                color: airlineColor.text,
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {flight.airline}
                                                        </Typography>
                                                        {flight.isCodeShare && (
                                                            <Typography sx={{
                                                                fontSize: 14,
                                                                color: theme.palette.warning.main
                                                            }}>*</Typography>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                                        <Typography sx={{fontWeight: 500}}>
                                                            {flight.flightNumber}
                                                        </Typography>
                                                        {flight.isMultiSegment && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => toggleFlightExpand(flightId)}
                                                                sx={{p: 0.25}}
                                                            >
                                                                {isExpanded ? <ExpandLessIcon fontSize="small"/> :
                                                                    <ExpandMoreIcon fontSize="small"/>}
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{fontSize: 13}}>
                                                        {formatDateTime(flight.departureTime)}
                                                        {flight._departureTimeZoneStr && (
                                                            <Typography component="span" sx={{
                                                                fontSize: 11,
                                                                color: theme.palette.text.secondary,
                                                                ml: 0.5
                                                            }}>
                                                                ({flight._departureTimeZoneStr})
                                                            </Typography>
                                                        )}
                                                    </Typography>
                                                    <Typography sx={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: theme.palette.primary.main
                                                    }}>
                                                        {flight.departureAirport}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{fontSize: 13}}>
                                                        {formatDateTime(flight.arrivalTime)}
                                                        {flight._arrivalTimeZoneStr && (
                                                            <Typography component="span" sx={{
                                                                fontSize: 11,
                                                                color: theme.palette.text.secondary,
                                                                ml: 0.5
                                                            }}>
                                                                ({flight._arrivalTimeZoneStr})
                                                            </Typography>
                                                        )}
                                                    </Typography>
                                                    <Typography sx={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: theme.palette.primary.main
                                                    }}>
                                                        {flight.arrivalAirport}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {flight.elapsedTime ? formatMinutesToTime(flight.elapsedTime) : flight.duration}
                                                </TableCell>
                                                <TableCell>
                                                    {flight.stops === 0 ? (
                                                        <Typography sx={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: theme.palette.success.main
                                                        }}>
                                                            Nonstop
                                                        </Typography>
                                                    ) : (
                                                        <Typography sx={{
                                                            fontSize: 12,
                                                            px: 1,
                                                            py: 0.25,
                                                            borderRadius: '4px',
                                                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                                                            color: theme.palette.warning.dark,
                                                            display: 'inline-block',
                                                        }}>
                                                            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{fontWeight: 600}}>
                                                        {formatCurrency(flight.amount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{fontSize: 13}}>
                                                        {flight.aircraft || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{display: 'flex', gap: 0.5}}>
                                                        <ActionIcon
                                                            icon={<AddIcon fontSize="small"/>}
                                                            tooltip="Assign Flight"
                                                            onClick={() => onAddFlightToJob(flight)}
                                                        />
                                                        <ActionIcon
                                                            icon={<InfoIcon fontSize="small"/>}
                                                            tooltip="More Info"
                                                            onClick={() => {
                                                            }}
                                                        />
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                            {flight.isMultiSegment && (
                                                <TableRow>
                                                    <TableCell colSpan={9} sx={{p: 0, border: 'none'}}>
                                                        <Collapse in={isExpanded}>
                                                            <SegmentDetailsRow segments={flight.flightSegments}/>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Footer actions */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                        p: 1,
                        borderTop: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button variant="outlined" onClick={onLoadMoreFlights}>
                            Load More Flights
                        </Button>
                        <Button variant="outlined" onClick={onLoadNextDayFlights}>
                            Next Day
                        </Button>
                    </Box>
                </Box>
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
                    icon="engineering"
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
                    icon="engineering"
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
                    icon="engineering"
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
                    icon="engineering"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showAgentList) {
            return (
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    {/* Header with search button */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        p: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PersonSearchIcon/>}
                            onClick={onOpenAgentSearchDialog}
                        >
                            Search Agents
                        </Button>
                    </Box>

                    {/* Agent table */}
                    <TableContainer sx={{flex: 1, overflow: 'auto'}}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentName'}
                                            direction={agentSortKey === 'agentName' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentName')}
                                        >
                                            Agent Name
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentRate'}
                                            direction={agentSortKey === 'agentRate' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentRate')}
                                        >
                                            Rate
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentRanking'}
                                            direction={agentSortKey === 'agentRanking' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentRanking')}
                                        >
                                            Ranking
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentNotes'}
                                            direction={agentSortKey === 'agentNotes' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentNotes')}
                                        >
                                            Notes
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedAgents.map((agent) => (
                                    <TableRow
                                        key={agent.agentId}
                                        hover
                                        sx={{
                                            '&:hover': {bgcolor: alpha(theme.palette.primary.main, 0.04)},
                                        }}
                                    >
                                        <TableCell>
                                            <Typography sx={{fontWeight: 500}}>
                                                {agent.agentName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{fontWeight: 600}}>
                                                {formatCurrency(agent.agentRate)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{agent.agentRanking}</TableCell>
                                        <TableCell>
                                            <Typography
                                                sx={{
                                                    maxWidth: 200,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {agent.agentNotes || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{display: 'flex', gap: 0.5}}>
                                                <ActionIcon
                                                    icon={<RequestQuoteIcon fontSize="small"/>}
                                                    tooltip="Send Quote Request"
                                                    onClick={() => onSendQuoteRequest(agent)}
                                                />
                                                <ActionIcon
                                                    icon={<AddIcon fontSize="small"/>}
                                                    tooltip="Assign Job"
                                                    onClick={() => onAddAgentToJob(agent)}
                                                />
                                                <ActionIcon
                                                    icon={<InfoIcon fontSize="small"/>}
                                                    tooltip="More Info"
                                                    onClick={() => {
                                                    }}
                                                />
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            );
        }

        return null;
    };

    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: theme.palette.background.paper,
                overflow: 'hidden',
            }}
        >
            {!isDeliveryJobType ? renderFlightSection() : renderAgentSection()}
        </Box>
    );
};

export default FlightAgentDataTable;
