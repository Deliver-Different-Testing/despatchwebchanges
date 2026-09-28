/**
 * FlightAgentDataTable React Component
 *
 * Displays flight options or agent options based on job type.
 * Styled to match the original AngularJS md-table layout.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {alpha, useTheme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import ConnectingAirportsIcon from '@mui/icons-material/ConnectingAirports';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlightIcon from '@mui/icons-material/Flight';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import InfoIcon from '@mui/icons-material/Info';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SearchIcon from '@mui/icons-material/Search';
import {NoData} from '../no-data/NoData';
import {FlightAgentDataTableProps, FlightSegment} from './types';
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

// Compact table cell styles
const compactCellSx = {
    py: 0.5,
    px: 1,
    fontSize: '0.75rem',
    lineHeight: 1.3,
};

const compactHeaderSx = {
    py: 0.5,
    px: 1,
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

const compactHeaderActionSx = {...compactHeaderSx, width: 'auto', textAlign: 'right', pr: 0.5};
const compactCellActionSx = {...compactCellSx, width: 'auto', textAlign: 'right', pr: 0.5};

// Hoisted sx constants for table row cells rendered in .map() loops (rerender-memo-with-default-value)
const flightNumberSx = {fontWeight: 500, fontSize: 11} as const;
const fontSize11Sx = {fontSize: 11} as const;
const fontSize10Sx = {fontSize: 10} as const;
const rateSx = {fontWeight: 600, fontSize: 11} as const;
const airportCodeSx = {fontSize: 10, fontWeight: 600} as const;
const nonstopSx = {fontSize: 10, fontWeight: 600} as const;
const stopsBadgeSx = {fontSize: 10, px: 0.5, py: 0.125, borderRadius: '3px', display: 'inline-block'} as const;
const flexCenterGapSx = {display: 'flex', alignItems: 'center', gap: 0.25} as const;
const flexEndSx = {display: 'flex', gap: 0, justifyContent: 'flex-end'} as const;
const agentNotesSx = {maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10} as const;
const agentActionsSx = {display: 'flex', gap: 0} as const;
const noSegmentBorderSx = {p: 0, border: 'none'} as const;

// Loading indicator - extracted to module level (rerender-no-inline-components)
const LoadingIndicator: React.FC = () => {
    const theme = useTheme();
    return (
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
};

// Action icon button - extracted to module level (rerender-no-inline-components)
const ActionIcon: React.FC<{
    icon: React.ReactNode;
    tooltip: string;
    onClick: () => void;
}> = ({icon, tooltip, onClick}) => {
    const theme = useTheme();
    return (
        <Tooltip title={tooltip} placement="left">
            <IconButton
                size="small"
                onClick={onClick}
                sx={{
                    p: 0.25,
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
};

// Airline chip component - extracted to module level (rerender-no-inline-components)
const AirlineChip: React.FC<{
    code: string;
    label?: string;
    tooltip?: string;
    isSelected?: boolean;
    isAllChip?: boolean;
    onClick: () => void;
}> = ({code, label, tooltip, isSelected, isAllChip, onClick}) => {
    const theme = useTheme();
    const colors = isAllChip ? {bg: '#f5f5f5', text: 'rgba(0,0,0,0.87)'} : getAirlineColor(code);
    const button = (
        <Button
            onClick={onClick}
            sx={{
                height: 24,
                borderRadius: '12px',
                minWidth: 0,
                px: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                bgcolor: colors.bg,
                color: colors.text,
                textTransform: 'none',
                border: isSelected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                boxShadow: isSelected ? theme.shadows[1] : 'none',
                '&:hover': {
                    bgcolor: alpha(colors.bg, 0.85),
                },
            }}
        >
            <FlightIcon sx={{fontSize: 14}}/>
            <Typography sx={{fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'}}>
                {label || code}
            </Typography>
        </Button>
    );

    if (tooltip) {
        return (
            <Tooltip title={tooltip} arrow placement="top">
                {button}
            </Tooltip>
        );
    }

    return button;
};

// Segment details row - extracted to module level (rerender-no-inline-components)
const SegmentDetailsRow: React.FC<{
    segments: FlightSegment[];
    getConnectionTime: (firstSegment: FlightSegment, secondSegment: FlightSegment) => string;
    formatMinutesToTime: (minutes: number) => string;
}> = ({segments, getConnectionTime, formatMinutesToTime}) => {
    const theme = useTheme();
    return (
        <Box sx={{
            py: 2,
            px: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
        }}>
            {/* Timeline container */}
            <Box sx={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 0,
                position: 'relative',
            }}>
                {segments.map((segment: FlightSegment, index: number) => (
                    <React.Fragment key={segment.segmentOrder}>
                        {/* Segment Card */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            flex: 1,
                            minWidth: 0,
                        }}>
                            {/* Departure */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 72,
                            }}>
                                <Box sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.background.paper,
                                    border: `2px solid ${theme.palette.primary.main}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 0.5,
                                    boxShadow: `0 2px 4px ${alpha(theme.palette.primary.main, 0.2)}`,
                                }}>
                                    <FlightTakeoffIcon sx={{fontSize: 16, color: theme.palette.primary.main}}/>
                                </Box>
                                <Typography sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: theme.palette.text.primary,
                                    letterSpacing: '0.5px',
                                }}>
                                    {segment.departureAirportFsCode}
                                </Typography>
                                <Typography sx={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: theme.palette.text.secondary,
                                }}>
                                    {formatDateTime(segment.departureTime)}
                                </Typography>
                                {segment.departureTerminal ? (
                                    <Typography sx={{
                                        fontSize: 10,
                                        color: theme.palette.text.disabled,
                                        mt: 0.25,
                                    }}>
                                        Terminal {segment.departureTerminal}
                                    </Typography>
                                ) : null}
                            </Box>

                            {/* Flight path line with details */}
                            <Box sx={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                minWidth: 80,
                                mx: 1,
                            }}>
                                {/* Flight info chip */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: '12px',
                                    px: 1,
                                    py: 0.25,
                                    mb: 0.5,
                                    boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.05)}`,
                                }}>
                                    <FlightIcon sx={{
                                        fontSize: 12,
                                        color: theme.palette.primary.main,
                                        transform: 'rotate(90deg)',
                                    }}/>
                                    <Typography sx={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: theme.palette.primary.main,
                                    }}>
                                        {segment.carrierFsCode}{segment.flightNumber}
                                    </Typography>
                                </Box>

                                {/* Dashed line */}
                                <Box sx={{
                                    width: '100%',
                                    height: 2,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    <Box sx={{
                                        flex: 1,
                                        height: 2,
                                        background: `repeating-linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.main} 4px, transparent 4px, transparent 8px)`,
                                        opacity: 0.5,
                                    }}/>
                                    <FlightIcon sx={{
                                        fontSize: 14,
                                        color: theme.palette.primary.main,
                                        transform: 'rotate(90deg)',
                                        mx: 0.5,
                                    }}/>
                                    <Box sx={{
                                        flex: 1,
                                        height: 2,
                                        background: `repeating-linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.main} 4px, transparent 4px, transparent 8px)`,
                                        opacity: 0.5,
                                    }}/>
                                </Box>

                                {/* Duration */}
                                <Typography sx={{
                                    fontSize: 10,
                                    color: theme.palette.text.secondary,
                                    mt: 0.5,
                                    fontWeight: 500,
                                }}>
                                    {formatMinutesToTime(segment.elapsedTime)}
                                </Typography>
                            </Box>

                            {/* Arrival */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 72,
                            }}>
                                <Box sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.background.paper,
                                    border: `2px solid ${theme.palette.success.main}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 0.5,
                                    boxShadow: `0 2px 4px ${alpha(theme.palette.success.main, 0.2)}`,
                                }}>
                                    <FlightLandIcon sx={{fontSize: 16, color: theme.palette.success.main}}/>
                                </Box>
                                <Typography sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: theme.palette.text.primary,
                                    letterSpacing: '0.5px',
                                }}>
                                    {segment.arrivalAirportFsCode}
                                </Typography>
                                <Typography sx={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: theme.palette.text.secondary,
                                }}>
                                    {formatDateTime(segment.arrivalTime)}
                                </Typography>
                                {segment.arrivalTerminal ? (
                                    <Typography sx={{
                                        fontSize: 10,
                                        color: theme.palette.text.disabled,
                                        mt: 0.25,
                                    }}>
                                        Terminal {segment.arrivalTerminal}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Box>

                        {/* Connection/Layover indicator */}
                        {index < segments.length - 1 ? (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 2,
                                minWidth: 80,
                            }}>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                    borderRadius: '16px',
                                    px: 1.5,
                                    py: 0.5,
                                }}>
                                    <ConnectingAirportsIcon sx={{
                                        fontSize: 16,
                                        color: theme.palette.warning.dark,
                                    }}/>
                                    <Box sx={{textAlign: 'center'}}>
                                        <Typography sx={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: theme.palette.warning.dark,
                                            lineHeight: 1.2,
                                        }}>
                                            {getConnectionTime(segment, segments[index + 1])}
                                        </Typography>
                                        <Typography sx={{
                                            fontSize: 9,
                                            color: theme.palette.warning.main,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}>
                                            Layover
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        ) : null}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
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
    onFilterFlightsByAirline: FlightAgentDataTableProps['onFilterFlightsByAirline'];
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
    onFilterFlightsByAirline,
    onOutboundAirportChange,
    onInboundAirportChange,
    formatAirportCodeForDropdown,
}) => {
    const theme = useTheme();
    const [outboundAnchorEl, setOutboundAnchorEl] = useState<null | HTMLElement>(null);
    const [inboundAnchorEl, setInboundAnchorEl] = useState<null | HTMLElement>(null);

    return (
        <>
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.5,
                p: 0.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
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

                <Box sx={{flex: 1}}/>

                {/* Departure airport selector */}
                <Button
                    onClick={(e) => setOutboundAnchorEl(e.currentTarget)}
                    sx={{
                        height: 24,
                        borderRadius: '12px',
                        px: 1,
                        bgcolor: alpha(theme.palette.text.secondary, 0.1),
                        color: theme.palette.text.primary,
                        textTransform: 'none',
                        '&:hover': {bgcolor: alpha(theme.palette.text.secondary, 0.2)},
                    }}
                >
                    <FlightTakeoffIcon sx={{fontSize: 14, mr: 0.25}}/>
                    <Typography sx={{fontSize: 11, fontWeight: 500}}>
                        {selectedOutboundAirport ? formatAirportCodeForDropdown(selectedOutboundAirport.text) : 'From'}
                    </Typography>
                </Button>

                <Typography sx={{color: theme.palette.text.secondary, fontSize: 11}}>→</Typography>

                {/* Arrival airport selector */}
                <Button
                    onClick={(e) => setInboundAnchorEl(e.currentTarget)}
                    sx={{
                        height: 24,
                        borderRadius: '12px',
                        px: 1,
                        bgcolor: alpha(theme.palette.text.secondary, 0.1),
                        color: theme.palette.text.primary,
                        textTransform: 'none',
                        '&:hover': {bgcolor: alpha(theme.palette.text.secondary, 0.2)},
                    }}
                >
                    <FlightLandIcon sx={{fontSize: 14, mr: 0.25}}/>
                    <Typography sx={{fontSize: 11, fontWeight: 500}}>
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
                {selectedOutboundAirport ? (
                    <MenuItem onClick={() => {
                        onOutboundAirportChange(null);
                        setOutboundAnchorEl(null);
                    }}>
                        <ClearIcon sx={{mr: 1, fontSize: 18}}/> Clear selection
                    </MenuItem>
                ) : null}
                {outboundAirportOptions?.map((airport) => (
                    <MenuItem
                        key={airport.id}
                        onClick={() => {
                            onOutboundAirportChange(airport);
                            setOutboundAnchorEl(null);
                        }}
                    >
                        {selectedOutboundAirport?.id === airport.id ? (
                            <CheckIcon sx={{mr: 1, fontSize: 18, color: theme.palette.primary.main}}/>
                        ) : (
                            <Box sx={{width: 26}}/>
                        )}
                        {airport.text}
                    </MenuItem>
                ))}
            </Menu>

            <Menu
                anchorEl={inboundAnchorEl}
                open={Boolean(inboundAnchorEl)}
                onClose={() => setInboundAnchorEl(null)}
            >
                {selectedInboundAirport ? (
                    <MenuItem onClick={() => {
                        onInboundAirportChange(null);
                        setInboundAnchorEl(null);
                    }}>
                        <ClearIcon sx={{mr: 1, fontSize: 18}}/> Clear selection
                    </MenuItem>
                ) : null}
                {inboundAirportOptions?.map((airport) => (
                    <MenuItem
                        key={airport.id}
                        onClick={() => {
                            onInboundAirportChange(airport);
                            setInboundAnchorEl(null);
                        }}
                    >
                        {selectedInboundAirport?.id === airport.id ? (
                            <CheckIcon sx={{mr: 1, fontSize: 18, color: theme.palette.primary.main}}/>
                        ) : (
                            <Box sx={{width: 26}}/>
                        )}
                        {airport.text}
                    </MenuItem>
                ))}
            </Menu>
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
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    <FlightFilterBar
                        activeAirlineOptions={activeAirlineOptions}
                        selectedAirline={selectedAirline}
                        selectedOutboundAirport={selectedOutboundAirport}
                        selectedInboundAirport={selectedInboundAirport}
                        outboundAirportOptions={outboundAirportOptions}
                        inboundAirportOptions={inboundAirportOptions}
                        onFilterFlightsByAirline={onFilterFlightsByAirline}
                        onOutboundAirportChange={onOutboundAirportChange}
                        onInboundAirportChange={onInboundAirportChange}
                        formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                    />

                    <NoData
                        title="No Flights Available"
                        message={flightMessage || "No flights available for the specified criteria."}
                        icon="flight_takeoff"
                        showAction={false}
                        isUsCustomer={isUsCustomer}
                    />
                </Box>
            );
        }

        if (showFlightList) {
            return (
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    <FlightFilterBar
                        activeAirlineOptions={activeAirlineOptions}
                        selectedAirline={selectedAirline}
                        selectedOutboundAirport={selectedOutboundAirport}
                        selectedInboundAirport={selectedInboundAirport}
                        outboundAirportOptions={outboundAirportOptions}
                        inboundAirportOptions={inboundAirportOptions}
                        onFilterFlightsByAirline={onFilterFlightsByAirline}
                        onOutboundAirportChange={onOutboundAirportChange}
                        onInboundAirportChange={onInboundAirportChange}
                        formatAirportCodeForDropdown={formatAirportCodeForDropdown}
                    />

                    {/* Search input - compact */}
                    <Box sx={{px: 0.5, py: 0.5, borderBottom: `1px solid ${theme.palette.divider}`}}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search flights..."
                            value={flightSearchText}
                            onChange={(e) => onFlightSearchChange(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{fontSize: 16, color: theme.palette.text.secondary}}/>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: theme.palette.background.paper,
                                    fontSize: '0.75rem',
                                },
                                '& .MuiOutlinedInput-input': {
                                    py: 0.5,
                                    px: 0.5,
                                },
                            }}
                        />
                    </Box>

                    {/* Flight table - compact */}
                    <TableContainer sx={{flex: 1, overflow: 'auto'}}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'airline'}
                                            direction={flightSortKey === 'airline' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('airline')}
                                        >
                                            Airline
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'flightNumber'}
                                            direction={flightSortKey === 'flightNumber' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('flightNumber')}
                                        >
                                            Flight
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'departureTime'}
                                            direction={flightSortKey === 'departureTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('departureTime')}
                                        >
                                            Depart
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'arrivalTime'}
                                            direction={flightSortKey === 'arrivalTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('arrivalTime')}
                                        >
                                            Arrive
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'elapsedTime'}
                                            direction={flightSortKey === 'elapsedTime' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('elapsedTime')}
                                        >
                                            Dur
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'stops'}
                                            direction={flightSortKey === 'stops' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('stops')}
                                        >
                                            Stops
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'amount'}
                                            direction={flightSortKey === 'amount' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('amount')}
                                        >
                                            Rate
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={flightSortKey === 'aircraft'}
                                            direction={flightSortKey === 'aircraft' ? flightSortDirection : 'asc'}
                                            onClick={() => handleFlightSort('aircraft')}
                                        >
                                            Aircraft
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderActionSx}>Act</TableCell>
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
                                                <TableCell sx={compactCellSx}>
                                                    <Box sx={flexCenterGapSx}>
                                                        <Typography
                                                            sx={{
                                                                px: 0.5,
                                                                py: 0.125,
                                                                borderRadius: '3px',
                                                                bgcolor: airlineColor.bg,
                                                                color: airlineColor.text,
                                                                fontSize: 10,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {flight.airline}
                                                        </Typography>
                                                        {flight.isCodeShare && (
                                                            <Typography sx={{
                                                                fontSize: 10,
                                                                color: theme.palette.warning.main
                                                            }}>*</Typography>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Box sx={flexCenterGapSx}>
                                                        <Typography sx={flightNumberSx}>
                                                            {flight.flightNumber}
                                                        </Typography>
                                                        {flight.isMultiSegment && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => toggleFlightExpand(flightId)}
                                                                sx={{p: 0}}
                                                            >
                                                                {isExpanded ? <ExpandLessIcon sx={{fontSize: 14}}/> :
                                                                    <ExpandMoreIcon sx={{fontSize: 14}}/>}
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Typography sx={fontSize11Sx}>
                                                        {formatDateTime(flight.departureTime)}
                                                    </Typography>
                                                    <Typography sx={{
                                                        ...airportCodeSx,
                                                        color: theme.palette.text.primary
                                                    }}>
                                                        {flight.departureAirport}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Typography sx={fontSize11Sx}>
                                                        {formatDateTime(flight.arrivalTime)}
                                                    </Typography>
                                                    <Typography sx={{
                                                        ...airportCodeSx,
                                                        color: theme.palette.text.primary
                                                    }}>
                                                        {flight.arrivalAirport}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Typography sx={fontSize11Sx}>
                                                        {flight.elapsedTime ? formatMinutesToTime(flight.elapsedTime) : flight.duration}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    {flight.stops === 0 ? (
                                                        <Typography sx={{
                                                            ...nonstopSx,
                                                            color: theme.palette.success.main
                                                        }}>
                                                            Nonstop
                                                        </Typography>
                                                    ) : (
                                                        <Typography sx={{
                                                            ...stopsBadgeSx,
                                                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                                                            color: theme.palette.warning.dark,
                                                        }}>
                                                            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Typography sx={rateSx}>
                                                        {formatCurrency(flight.amount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={compactCellSx}>
                                                    <Typography sx={fontSize10Sx}>
                                                        {flight.aircraft || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={compactCellActionSx}>
                                                    <Box sx={flexEndSx}>
                                                        <ActionIcon
                                                            icon={<AddIcon sx={{fontSize: 16}}/>}
                                                            tooltip="Assign Flight"
                                                            onClick={() => onAddFlightToJob(flight)}
                                                        />
                                                        <ActionIcon
                                                            icon={<InfoIcon sx={{fontSize: 16}}/>}
                                                            tooltip="More Info"
                                                            onClick={() => openFlightDetailsDialog(flight as unknown as Parameters<typeof openFlightDetailsDialog>[0])}
                                                        />
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                            {flight.isMultiSegment && (
                                                <TableRow>
                                                    <TableCell colSpan={9} sx={noSegmentBorderSx}>
                                                        <Collapse in={isExpanded}>
                                                            <SegmentDetailsRow segments={flight.flightSegments} getConnectionTime={getConnectionTime} formatMinutesToTime={formatMinutesToTime}/>
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

                    {/* Footer actions - compact */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 0.5,
                        p: 0.5,
                        borderTop: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button variant="outlined" size="small" onClick={onLoadMoreFlights} sx={{fontSize: 11, py: 0.25}}>
                            More
                        </Button>
                        <Button variant="outlined" size="small" onClick={onLoadNextDayFlights} sx={{fontSize: 11, py: 0.25}}>
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
                    {/* Header with search button - compact */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        p: 0.5,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<PersonSearchIcon sx={{fontSize: 16}}/>}
                            onClick={onOpenAgentSearchDialog}
                            sx={{fontSize: 11}}
                        >
                            Search Agents
                        </Button>
                    </Box>

                    {/* Agent table - compact */}
                    <TableContainer sx={{flex: 1, overflow: 'auto'}}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentName'}
                                            direction={agentSortKey === 'agentName' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentName')}
                                        >
                                            Agent
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentRate'}
                                            direction={agentSortKey === 'agentRate' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentRate')}
                                        >
                                            Rate
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentRanking'}
                                            direction={agentSortKey === 'agentRanking' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentRanking')}
                                        >
                                            Rank
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>
                                        <TableSortLabel
                                            active={agentSortKey === 'agentNotes'}
                                            direction={agentSortKey === 'agentNotes' ? agentSortDirection : 'asc'}
                                            onClick={() => handleAgentSort('agentNotes')}
                                        >
                                            Notes
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={compactHeaderSx}>Act</TableCell>
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
                                        <TableCell sx={compactCellSx}>
                                            <Typography sx={flightNumberSx}>
                                                {agent.agentName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={compactCellSx}>
                                            <Typography sx={rateSx}>
                                                {formatCurrency(agent.agentRate)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={compactCellSx}>
                                            <Typography sx={fontSize11Sx}>{agent.agentRanking}</Typography>
                                        </TableCell>
                                        <TableCell sx={compactCellSx}>
                                            <Typography sx={agentNotesSx}>
                                                {agent.agentNotes || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={compactCellSx}>
                                            <Box sx={agentActionsSx}>
                                                <ActionIcon
                                                    icon={<RequestQuoteIcon sx={{fontSize: 16}}/>}
                                                    tooltip="Send Quote Request"
                                                    onClick={() => onSendQuoteRequest(agent)}
                                                />
                                                <ActionIcon
                                                    icon={<AddIcon sx={{fontSize: 16}}/>}
                                                    tooltip="Assign Job"
                                                    onClick={() => onAddAgentToJob(agent)}
                                                />
                                                <ActionIcon
                                                    icon={<InfoIcon sx={{fontSize: 16}}/>}
                                                    tooltip="More Info"
                                                    onClick={() => openAgentInfoDialog({agentId: agent.agentId})}
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
