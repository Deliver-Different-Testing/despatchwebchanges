/**
 * FlightAgentDataTable React Component
 *
 * Displays flight options or agent options based on job type.
 * Replaces the AngularJS flightAgentDataTableBox partial.
 */

import React, { useState } from 'react';
import {
    Box,
    LinearProgress,
    TextField,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Chip,
    Menu,
    MenuItem,
    Divider,
    Tooltip,
    Collapse,
    Typography,
    TableSortLabel,
} from '@mui/material';
import {
    Search as SearchIcon,
    FlightTakeoff as FlightTakeoffIcon,
    FlightLand as FlightLandIcon,
    Flight as FlightIcon,
    Add as AddIcon,
    Info as InfoIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ArrowRightAlt as ArrowRightAltIcon,
    Clear as ClearIcon,
    Check as CheckIcon,
    PersonSearch as PersonSearchIcon,
    RequestQuote as RequestQuoteIcon,
    Schedule as ScheduleIcon,
    ConnectingAirports as ConnectingAirportsIcon,
} from '@mui/icons-material';
import { NoData } from '../no-data/NoData';
import {
    FlightAgentDataTableProps,
    FlightOption,
    FlightSegment,
    AgentOption,
    AirlineSuggestion,
    AirportSuggestion,
} from './types';

type SortDirection = 'asc' | 'desc';
type FlightSortKey = 'airline' | 'flightNumber' | 'departureTime' | 'arrivalTime' | 'elapsedTime' | 'stops' | 'amount' | 'aircraft';
type AgentSortKey = 'agentName' | 'agentRate' | 'agentRanking' | 'agentNotes';

export const FlightAgentDataTable: React.FC<FlightAgentDataTableProps> = ({
    isDeliveryJobType,
    currentJob,
    flightsLoading,
    agentsLoading,
    flightOptions,
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
    onOpenFlightMoreInfo,
    onLoadMoreFlights,
    onLoadNextDayFlights,
    onAddAgentToJob,
    onSendQuoteRequest,
    onOpenAgentMoreInfo,
    onOpenAgentSearchDialog,
    onOpenRecoveryAgentDialog,
    formatAirportCodeForDropdown,
    getConnectionTime,
    formatMinutesToTime,
    isUsCustomer,
}) => {
    // Local state for expanded flight segments
    const [expandedFlights, setExpandedFlights] = useState<Set<string>>(new Set());

    // Flight sort state
    const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('departureTime');
    const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc');

    // Agent sort state
    const [agentSortKey, setAgentSortKey] = useState<AgentSortKey>('agentName');
    const [agentSortDirection, setAgentSortDirection] = useState<SortDirection>('asc');

    // Airport menu state
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

    const sortedFlights = React.useMemo(() => {
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

    const sortedAgents = React.useMemo(() => {
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const renderFlightSection = () => {
        // Show loading
        if (flightsLoading) {
            return <LinearProgress />;
        }

        // No job selected
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

        // Flight already assigned
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

        // Missing airport info
        if (showMissingAirportInfoMessage) {
            return (
                <NoData
                    title="Missing Airport Info"
                    message="Airport information not applicable or not provided for this job. If needed, please update the job details with relevant airport data."
                    icon="local_airport"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        // No flights available
        if (showNoFlightsAvailableMessage) {
            return (
                <NoData
                    title="No Flights Available"
                    message={flightMessage || "No flights available for the selected criteria."}
                    icon="flight_takeoff"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        // Show flight list
        if (showFlightList) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Airline Filter Chips */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, flexWrap: 'wrap' }}>
                        {/* All Airlines Chip */}
                        <Chip
                            icon={<FlightIcon />}
                            label="All"
                            onClick={() => onFilterFlightsByAirline(null)}
                            color={!selectedAirline ? 'primary' : 'default'}
                            variant={!selectedAirline ? 'filled' : 'outlined'}
                            sx={{ fontWeight: !selectedAirline ? 'bold' : 'normal' }}
                        />

                        {/* Individual Airline Chips */}
                        {activeAirlineOptions?.map((airline) => (
                            <Tooltip key={airline.id} title={airline.fullAirlineName || airline.text}>
                                <Chip
                                    icon={<FlightIcon />}
                                    label={airline.text}
                                    onClick={() => onFilterFlightsByAirline(airline)}
                                    color={selectedAirline?.id === airline.id ? 'primary' : 'default'}
                                    variant={selectedAirline?.id === airline.id ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: selectedAirline?.id === airline.id ? 'bold' : 'normal' }}
                                />
                            </Tooltip>
                        ))}

                        <Box sx={{ flex: 1 }} />

                        {/* Departure Airport Menu */}
                        <Tooltip title={selectedOutboundAirport ? `Flights departing ${formatAirportCodeForDropdown(selectedOutboundAirport.text)}` : 'Nearby Outbound Airports'}>
                            <Chip
                                icon={<FlightTakeoffIcon />}
                                label={selectedOutboundAirport ? formatAirportCodeForDropdown(selectedOutboundAirport.text) : 'From'}
                                onClick={(e) => setOutboundAnchorEl(e.currentTarget)}
                                variant="outlined"
                            />
                        </Tooltip>
                        <Menu
                            anchorEl={outboundAnchorEl}
                            open={Boolean(outboundAnchorEl)}
                            onClose={() => setOutboundAnchorEl(null)}
                        >
                            {selectedOutboundAirport && (
                                <MenuItem onClick={() => { onOutboundAirportChange(null); setOutboundAnchorEl(null); }}>
                                    <ClearIcon sx={{ mr: 1 }} /> Clear selection
                                </MenuItem>
                            )}
                            {outboundAirportOptions?.map((airport) => (
                                <MenuItem
                                    key={airport.id}
                                    onClick={() => { onOutboundAirportChange(airport); setOutboundAnchorEl(null); }}
                                >
                                    {selectedOutboundAirport?.id === airport.id && <CheckIcon sx={{ mr: 1 }} />}
                                    {selectedOutboundAirport?.id !== airport.id && <Box sx={{ width: 24, mr: 1 }} />}
                                    {airport.text}
                                </MenuItem>
                            ))}
                        </Menu>

                        <ArrowRightAltIcon />

                        {/* Arrival Airport Menu */}
                        <Tooltip title={selectedInboundAirport ? `Flights arriving ${formatAirportCodeForDropdown(selectedInboundAirport.text)}` : 'Nearby Inbound Airports'}>
                            <Chip
                                icon={<FlightLandIcon />}
                                label={selectedInboundAirport ? formatAirportCodeForDropdown(selectedInboundAirport.text) : 'To'}
                                onClick={(e) => setInboundAnchorEl(e.currentTarget)}
                                variant="outlined"
                            />
                        </Tooltip>
                        <Menu
                            anchorEl={inboundAnchorEl}
                            open={Boolean(inboundAnchorEl)}
                            onClose={() => setInboundAnchorEl(null)}
                        >
                            {selectedInboundAirport && (
                                <MenuItem onClick={() => { onInboundAirportChange(null); setInboundAnchorEl(null); }}>
                                    <ClearIcon sx={{ mr: 1 }} /> Clear selection
                                </MenuItem>
                            )}
                            {inboundAirportOptions?.map((airport) => (
                                <MenuItem
                                    key={airport.id}
                                    onClick={() => { onInboundAirportChange(airport); setInboundAnchorEl(null); }}
                                >
                                    {selectedInboundAirport?.id === airport.id && <CheckIcon sx={{ mr: 1 }} />}
                                    {selectedInboundAirport?.id !== airport.id && <Box sx={{ width: 24, mr: 1 }} />}
                                    {airport.text}
                                </MenuItem>
                            ))}
                        </Menu>
                    </Box>

                    {/* Search Bar */}
                    <Box sx={{ p: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search by flight number, airline, airport, or aircraft..."
                            value={flightSearchText}
                            onChange={(e) => onFlightSearchChange(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    <Divider />

                    {/* Flight Table */}
                    <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
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
                                            D
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={flightSortKey === 'arrivalTime'}
                                            direction={flightSortKey === 'arrivalTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('arrivalTime')}
                                        >
                                            A
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
                                {sortedFlights.map((flight, index) => (
                                    <React.Fragment key={`${flight.connectionId || flight.flightNumber}-${flight.departureTime?.valueOf()}-${index}`}>
                                        <TableRow
                                            hover
                                            sx={{
                                                backgroundColor: flight.isMultiSegment ? 'action.hover' : 'inherit',
                                            }}
                                        >
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Chip
                                                        label={flight.airline}
                                                        size="small"
                                                        sx={{
                                                            fontWeight: 'bold',
                                                            textTransform: 'uppercase',
                                                        }}
                                                    />
                                                    {flight.isCodeShare && (
                                                        <Typography variant="caption" color="text.secondary">*</Typography>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {flight.flightNumber}
                                                    </Typography>
                                                    {flight.isMultiSegment && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => toggleFlightExpand(flight.connectionId || flight.flightNumber)}
                                                        >
                                                            {expandedFlights.has(flight.connectionId || flight.flightNumber)
                                                                ? <ExpandLessIcon fontSize="small" />
                                                                : <ExpandMoreIcon fontSize="small" />
                                                            }
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {flight._departureTimeStr} {flight._departureTimeZoneStr}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {flight.departureAirport}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {flight._arrivalTimeStr} {flight._arrivalTimeZoneStr}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {flight.arrivalAirport}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {flight.elapsedTime
                                                    ? formatMinutesToTime(flight.elapsedTime)
                                                    : flight.duration
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {flight.stops === 0 ? (
                                                    <Chip label="Nonstop" size="small" color="success" variant="outlined" />
                                                ) : (
                                                    <Chip
                                                        label={`${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>{formatCurrency(flight.amount)}</TableCell>
                                            <TableCell>{flight.aircraft}</TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Tooltip title="Assign Flight">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onAddFlightToJob(flight)}
                                                            color="primary"
                                                        >
                                                            <AddIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="More Info">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onOpenFlightMoreInfo(flight)}
                                                        >
                                                            <InfoIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>

                                        {/* Segment Details Row */}
                                        {flight.isMultiSegment && (
                                            <TableRow>
                                                <TableCell colSpan={9} sx={{ p: 0 }}>
                                                    <Collapse in={expandedFlights.has(flight.connectionId || flight.flightNumber)}>
                                                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                                                            {renderSegmentDetails(flight.flightSegments, getConnectionTime)}
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Footer Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 1 }}>
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

    const renderSegmentDetails = (
        segments: FlightSegment[],
        getConnectionTimeFn: (first: FlightSegment, second: FlightSegment) => string
    ) => {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {segments.map((segment, index) => (
                    <React.Fragment key={segment.segmentOrder}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {/* Segment Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Segment {segment.segmentOrder + 1} of {segments.length}
                                </Typography>
                                <Chip
                                    label={`${segment.carrierFsCode}${segment.flightNumber}`}
                                    size="small"
                                    variant="outlined"
                                />
                            </Box>

                            {/* Segment Journey */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                {/* Departure */}
                                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                                    <Typography variant="body2" fontWeight="medium">
                                        {segment._departureTimeStr} {segment._departureTimeZoneStr}
                                    </Typography>
                                    <Typography variant="h6" fontWeight="bold">
                                        {segment.departureAirportFsCode}
                                    </Typography>
                                    {segment.departureTerminal && (
                                        <Typography variant="caption" color="text.secondary">
                                            Terminal {segment.departureTerminal}
                                        </Typography>
                                    )}
                                    {segment.departureAirportName && (
                                        <Typography variant="caption" display="block" color="text.secondary">
                                            {segment.departureAirportName}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Flight Line */}
                                <Box sx={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatMinutesToTime(segment.elapsedTime)}
                                    </Typography>
                                    <Divider sx={{ my: 1 }}>
                                        <FlightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    </Divider>
                                    {segment.aircraftName && (
                                        <Typography variant="caption" color="text.secondary">
                                            {segment.aircraftName}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Arrival */}
                                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                                    <Typography variant="body2" fontWeight="medium">
                                        {segment._arrivalTimeStr} {segment._arrivalTimeZoneStr}
                                    </Typography>
                                    <Typography variant="h6" fontWeight="bold">
                                        {segment.arrivalAirportFsCode}
                                    </Typography>
                                    {segment.arrivalTerminal && (
                                        <Typography variant="caption" color="text.secondary">
                                            Terminal {segment.arrivalTerminal}
                                        </Typography>
                                    )}
                                    {segment.arrivalAirportName && (
                                        <Typography variant="caption" display="block" color="text.secondary">
                                            {segment.arrivalAirportName}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>

                            {/* Extra Details */}
                            <Box sx={{ display: 'flex', gap: 2, ml: 2 }}>
                                {segment.aircraftName && (
                                    <Typography variant="caption" color="text.secondary">
                                        {segment.aircraftName} ({segment.flightEquipmentIataCode})
                                    </Typography>
                                )}
                                {!segment.aircraftName && segment.flightEquipmentIataCode && (
                                    <Typography variant="caption" color="text.secondary">
                                        {segment.flightEquipmentIataCode}
                                    </Typography>
                                )}
                                {segment.stopsInSegment > 0 && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <ConnectingAirportsIcon fontSize="small" color="action" />
                                        <Typography variant="caption" color="text.secondary">
                                            {segment.stopsInSegment} stop{segment.stopsInSegment > 1 ? 's' : ''} in this flight
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Connection Time */}
                        {index < segments.length - 1 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                    py: 1,
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                }}
                            >
                                <ScheduleIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    {getConnectionTimeFn(segment, segments[index + 1])} layover
                                </Typography>
                            </Box>
                        )}
                    </React.Fragment>
                ))}
            </Box>
        );
    };

    const renderAgentSection = () => {
        // Show loading
        if (agentsLoading) {
            return <LinearProgress />;
        }

        // No job selected
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

        // Agent already assigned
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

        // Not a delivery job
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

        // No agents available
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

        // Show agent list
        if (showAgentList) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header with Search Button */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                        <Box sx={{ flex: 1 }} />
                        <Button
                            variant="contained"
                            startIcon={<PersonSearchIcon />}
                            onClick={onOpenAgentSearchDialog}
                        >
                            Search Agents
                        </Button>
                    </Box>

                    <Divider />

                    {/* Agent Table */}
                    <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
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
                                    <TableRow key={agent.agentId} hover>
                                        <TableCell>{agent.agentName}</TableCell>
                                        <TableCell>{formatCurrency(agent.agentRate)}</TableCell>
                                        <TableCell>{agent.agentRanking}</TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    maxWidth: 200,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {agent.agentNotes}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="Send Quote Request">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onSendQuoteRequest(agent)}
                                                    >
                                                        <RequestQuoteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Assign Job">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onAddAgentToJob(agent)}
                                                        color="primary"
                                                    >
                                                        <AddIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="More Info">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onOpenAgentMoreInfo(agent)}
                                                    >
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
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
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!isDeliveryJobType ? renderFlightSection() : renderAgentSection()}
        </Box>
    );
};

export default FlightAgentDataTable;
