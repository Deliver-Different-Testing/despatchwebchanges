/**
 * FlightAgentDataTable React Component
 *
 * Displays flight options or agent options based on job type.
 * Uses app theme colors for consistency with the dashboard.
 */

import React, {useMemo, useState} from 'react';
import {
    alpha,
    Box,
    Button,
    Collapse,
    IconButton,
    InputAdornment,
    keyframes,
    Menu,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import dayjs from 'dayjs';
import {
    Add as AddIcon,
    AirlineSeatReclineNormal as SeatIcon,
    Check as CheckIcon,
    ChevronRight as ChevronRightIcon,
    Clear as ClearIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Flight as FlightIcon,
    FlightLand as FlightLandIcon,
    FlightTakeoff as FlightTakeoffIcon,
    KeyboardArrowDown as SortDownIcon,
    KeyboardArrowUp as SortUpIcon,
    NavigateNext as NavigateNextIcon,
    PersonSearch as PersonSearchIcon,
    RequestQuote as RequestQuoteIcon,
    Schedule as ScheduleIcon,
    Search as SearchIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    SwapHoriz as SwapHorizIcon,
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

// Airline color palette - distinctive colors for major airlines
const AIRLINE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    // US Airlines
    'AA': { bg: '#B81D24', text: '#FFFFFF', border: '#8A161B' },      // American Airlines - Red
    'DL': { bg: '#003366', text: '#FFFFFF', border: '#002244' },      // Delta - Navy Blue
    'UA': { bg: '#0033A0', text: '#FFFFFF', border: '#002878' },      // United - Blue
    'WN': { bg: '#F9B612', text: '#304CB2', border: '#E5A30E' },      // Southwest - Yellow/Blue
    'B6': { bg: '#003876', text: '#FFFFFF', border: '#002B5C' },      // JetBlue - Blue
    'AS': { bg: '#01426A', text: '#FFFFFF', border: '#003050' },      // Alaska - Dark Blue
    'NK': { bg: '#FDE428', text: '#000000', border: '#E5CD22' },      // Spirit - Yellow
    'F9': { bg: '#00A651', text: '#FFFFFF', border: '#008942' },      // Frontier - Green
    'HA': { bg: '#4F2D7F', text: '#FFFFFF', border: '#3D2266' },      // Hawaiian - Purple
    // International
    'BA': { bg: '#075AAA', text: '#FFFFFF', border: '#054789' },      // British Airways - Blue
    'LH': { bg: '#05164D', text: '#FFC72C', border: '#030F33' },      // Lufthansa - Navy/Gold
    'AF': { bg: '#002157', text: '#FFFFFF', border: '#001840' },      // Air France - Dark Blue
    'EK': { bg: '#C8102E', text: '#FFFFFF', border: '#A00D25' },      // Emirates - Red
    'QF': { bg: '#E40000', text: '#FFFFFF', border: '#B50000' },      // Qantas - Red
    'SQ': { bg: '#F7A823', text: '#0C2340', border: '#E59A1F' },      // Singapore - Gold
    'CX': { bg: '#006564', text: '#FFFFFF', border: '#004D4C' },      // Cathay Pacific - Teal
    'NH': { bg: '#142B64', text: '#FFFFFF', border: '#0F2050' },      // ANA - Blue
    'JL': { bg: '#C8102E', text: '#FFFFFF', border: '#A00D25' },      // Japan Airlines - Red
    'KE': { bg: '#00256C', text: '#FFFFFF', border: '#001C52' },      // Korean Air - Blue
    'TK': { bg: '#C8102E', text: '#FFFFFF', border: '#A00D25' },      // Turkish - Red
    'LX': { bg: '#C8102E', text: '#FFFFFF', border: '#A00D25' },      // Swiss - Red
    'AC': { bg: '#F01428', text: '#FFFFFF', border: '#C81020' },      // Air Canada - Red
    'QR': { bg: '#5C0632', text: '#FFFFFF', border: '#460526' },      // Qatar - Burgundy
    'EY': { bg: '#BD8B13', text: '#1E1E1E', border: '#9A7210' },      // Etihad - Gold
    'VS': { bg: '#E30613', text: '#FFFFFF', border: '#B50510' },      // Virgin Atlantic - Red
};

// Generate consistent color for unknown airlines based on code
const getAirlineColor = (code: string): { bg: string; text: string; border: string } => {
    if (AIRLINE_COLORS[code]) {
        return AIRLINE_COLORS[code];
    }

    // Generate deterministic color from airline code
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate hue from hash (avoiding yellow-green range for readability)
    const hue = ((hash % 300) + 180) % 360;
    const saturation = 65 + (hash % 20);
    const lightness = 35 + (hash % 15);

    return {
        bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        text: '#FFFFFF',
        border: `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`,
    };
};

// Helper to format time from Dayjs or string
const formatTimeDisplay = (time: dayjs.Dayjs | string | undefined): string => {
    if (!time) return '--:--';
    const dayjsTime = dayjs.isDayjs(time) ? time : dayjs(time);
    if (!dayjsTime.isValid()) return '--:--';
    return dayjsTime.format('h:mm A');
};

// Animation keyframes
const slideIn = keyframes`
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const shimmer = keyframes`
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
`;

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
    const [hoveredFlight, setHoveredFlight] = useState<string | null>(null);

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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Airline badge with brand colors
    const AirlineBadge: React.FC<{ code: string; isCodeShare?: boolean }> = ({code, isCodeShare}) => {
        const colors = getAirlineColor(code);
        return (
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: '6px',
                    bgcolor: colors.bg,
                    border: `2px solid ${colors.border}`,
                    boxShadow: `0 2px 4px ${alpha(colors.bg, 0.3)}`,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: `0 4px 8px ${alpha(colors.bg, 0.4)}`,
                    },
                }}
            >
                <Typography
                    sx={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: colors.text,
                        letterSpacing: '0.08em',
                        textShadow: colors.text === '#FFFFFF' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                    }}
                >
                    {code}
                </Typography>
                {isCodeShare && (
                    <Typography
                        sx={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: alpha(colors.text, 0.7),
                        }}
                    >
                        *
                    </Typography>
                )}
            </Box>
        );
    };

    // Airport code display
    const AirportCode: React.FC<{ code: string; time: string; timezone?: string; isOrigin?: boolean }> = ({
                                                                                                              code,
                                                                                                              time,
                                                                                                              timezone,
                                                                                                              isOrigin
                                                                                                          }) => (
        <Box sx={{textAlign: isOrigin ? 'left' : 'right', minWidth: 70}}>
            <Typography
                sx={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                    letterSpacing: '0.1em',
                    lineHeight: 1,
                }}
            >
                {code}
            </Typography>
            <Typography
                sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: theme.palette.primary.main,
                    mt: 0.25,
                }}
            >
                {time}
            </Typography>
            {timezone && (
                <Typography
                    sx={{
                        fontSize: '0.6rem',
                        color: theme.palette.text.secondary,
                        textTransform: 'uppercase',
                    }}
                >
                    {timezone}
                </Typography>
            )}
        </Box>
    );

    // Flight route visualization
    const FlightRoute: React.FC<{ stops: number; duration: string; isNonstop: boolean }> = ({
                                                                                                stops,
                                                                                                duration,
                                                                                                isNonstop
                                                                                            }) => (
        <Box
            sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mx: 1.5,
                minWidth: 80,
            }}
        >
            {/* Duration */}
            <Typography
                sx={{
                    fontSize: '0.65rem',
                    color: theme.palette.text.secondary,
                    mb: 0.5,
                }}
            >
                {duration}
            </Typography>

            {/* Route line */}
            <Box sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
            }}>
                {/* Origin dot */}
                <Box
                    sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: theme.palette.primary.main,
                        flexShrink: 0,
                    }}
                />

                {/* Line with stops */}
                <Box
                    sx={{
                        flex: 1,
                        height: 2,
                        bgcolor: alpha(theme.palette.text.secondary, 0.3),
                        mx: 0.5,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-evenly',
                    }}
                >
                    {/* Stop indicators */}
                    {Array.from({length: stops}).map((_, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                bgcolor: theme.palette.warning.main,
                                border: `1px solid ${theme.palette.background.paper}`,
                            }}
                        />
                    ))}

                    {/* Plane icon */}
                    <FlightIcon
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%) rotate(90deg)',
                            fontSize: 12,
                            color: theme.palette.primary.main,
                        }}
                    />
                </Box>

                {/* Destination dot */}
                <Box
                    sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: isNonstop ? theme.palette.success.main : theme.palette.warning.main,
                        flexShrink: 0,
                    }}
                />
            </Box>

            {/* Stops label */}
            <Typography
                sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: isNonstop ? theme.palette.success.main : theme.palette.warning.main,
                    mt: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                {isNonstop ? 'NONSTOP' : `${stops} STOP${stops > 1 ? 'S' : ''}`}
            </Typography>
        </Box>
    );

    // Sort header button
    const SortHeader: React.FC<{
        label: string;
        sortKey: FlightSortKey;
        currentKey: FlightSortKey;
        direction: SortDirection;
        onClick: () => void;
        align?: 'left' | 'center' | 'right';
    }> = ({label, sortKey, currentKey, direction, onClick, align = 'left'}) => (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                gap: 0.25,
                cursor: 'pointer',
                userSelect: 'none',
                py: 0.5,
                '&:hover': {
                    '& .sort-label': {
                        color: theme.palette.text.primary,
                    },
                },
            }}
        >
            <Typography
                className="sort-label"
                sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: currentKey === sortKey ? theme.palette.primary.main : theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    transition: 'color 0.15s',
                }}
            >
                {label}
            </Typography>
            {currentKey === sortKey && (
                direction === 'asc' ?
                    <SortUpIcon sx={{fontSize: 12, color: theme.palette.primary.main}}/> :
                    <SortDownIcon sx={{fontSize: 12, color: theme.palette.primary.main}}/>
            )}
        </Box>
    );

    // Flight card component
    const FlightCard: React.FC<{ flight: FlightOption; index: number }> = ({flight, index}) => {
        const flightId = flight.connectionId || flight.flightNumber;
        const isExpanded = expandedFlights.has(flightId);
        const isHovered = hoveredFlight === flightId;

        return (
            <Box
                onMouseEnter={() => setHoveredFlight(flightId)}
                onMouseLeave={() => setHoveredFlight(null)}
                sx={{
                    bgcolor: theme.palette.background.paper,
                    borderRadius: '8px',
                    border: `1px solid ${isHovered ? alpha(theme.palette.primary.main, 0.3) : theme.palette.divider}`,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    animation: `${slideIn} 0.3s ease ${index * 0.05}s both`,
                    '&:hover': {
                        boxShadow: theme.shadows[2],
                    },
                }}
            >
                {/* Main content row */}
                <Box sx={{p: 1.5}}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                        {/* Airline & Flight Number */}
                        <Box sx={{minWidth: 85}}>
                            <AirlineBadge code={flight.airline} isCodeShare={flight.isCodeShare}/>
                            <Typography
                                sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: theme.palette.text.primary,
                                    mt: 0.5,
                                }}
                            >
                                {flight.flightNumber}
                            </Typography>
                        </Box>

                        {/* Route visualization */}
                        <Box sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 0,
                        }}>
                            <AirportCode
                                code={flight.departureAirport}
                                time={formatTimeDisplay(flight.departureTime)}
                                timezone={flight._departureTimeZoneStr}
                                isOrigin
                            />
                            <FlightRoute
                                stops={flight.stops}
                                duration={flight.elapsedTime ? formatMinutesToTime(flight.elapsedTime) : flight.duration}
                                isNonstop={flight.stops === 0}
                            />
                            <AirportCode
                                code={flight.arrivalAirport}
                                time={formatTimeDisplay(flight.arrivalTime)}
                                timezone={flight._arrivalTimeZoneStr}
                            />
                        </Box>

                        {/* Price & Actions */}
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 0.5,
                            ml: 1,
                        }}>
                            <Typography
                                sx={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: theme.palette.text.primary,
                                }}
                            >
                                {formatCurrency(flight.amount)}
                            </Typography>
                            <Box sx={{display: 'flex', gap: 0.5}}>
                                {flight.isMultiSegment && (
                                    <IconButton
                                        size="small"
                                        onClick={() => toggleFlightExpand(flightId)}
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: alpha(theme.palette.text.secondary, 0.1),
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                            },
                                        }}
                                    >
                                        {isExpanded ?
                                            <ExpandLessIcon sx={{fontSize: 14, color: theme.palette.text.secondary}}/> :
                                            <ExpandMoreIcon sx={{fontSize: 14, color: theme.palette.text.secondary}}/>
                                        }
                                    </IconButton>
                                )}
                                <Tooltip title="Assign Flight" arrow>
                                    <IconButton
                                        size="small"
                                        onClick={() => onAddFlightToJob(flight)}
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: alpha(theme.palette.success.main, 0.1),
                                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.success.main, 0.2),
                                            },
                                        }}
                                    >
                                        <AddIcon sx={{fontSize: 14, color: theme.palette.success.main}}/>
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </Box>

                    {/* Aircraft info line */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        mt: 1,
                        pt: 1,
                        borderTop: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Typography
                            sx={{
                                fontSize: '0.65rem',
                                color: theme.palette.text.secondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                            }}
                        >
                            <SeatIcon sx={{fontSize: 12}}/>
                            {flight.aircraft || 'Aircraft TBD'}
                        </Typography>
                        <Box sx={{flex: 1}}/>
                        {flight.serviceClasses?.length > 0 && (
                            <Typography
                                sx={{
                                    fontSize: '0.6rem',
                                    color: theme.palette.text.secondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {flight.serviceClasses.join(' / ')}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* Expanded segment details */}
                {flight.isMultiSegment && (
                    <Collapse in={isExpanded}>
                        <Box sx={{
                            bgcolor: alpha(theme.palette.grey[500], 0.05),
                            borderTop: `1px solid ${theme.palette.divider}`,
                            p: 1.5,
                        }}>
                            {renderSegmentDetails(flight.flightSegments)}
                        </Box>
                    </Collapse>
                )}
            </Box>
        );
    };

    const renderSegmentDetails = (segments: FlightSegment[]) => {
        return (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                {segments.map((segment, index) => {
                    const segmentColors = getAirlineColor(segment.carrierFsCode);
                    return (
                    <React.Fragment key={segment.segmentOrder}>
                        {/* Segment row */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            py: 0.5,
                        }}>
                            {/* Segment badge with airline color */}
                            <Box
                                sx={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    bgcolor: segmentColors.bg,
                                    border: `2px solid ${segmentColors.border}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: `0 1px 3px ${alpha(segmentColors.bg, 0.3)}`,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        color: segmentColors.text,
                                    }}
                                >
                                    {segment.segmentOrder + 1}
                                </Typography>
                            </Box>

                            {/* Flight info with airline badge */}
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: '4px',
                                    bgcolor: segmentColors.bg,
                                    minWidth: 55,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: segmentColors.text,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {segment.carrierFsCode}{segment.flightNumber}
                                </Typography>
                            </Box>

                            {/* Origin */}
                            <Box sx={{minWidth: 60}}>
                                <Typography sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: theme.palette.text.primary
                                }}>
                                    {segment.departureAirportFsCode}
                                </Typography>
                                <Typography sx={{fontSize: '0.65rem', color: theme.palette.primary.main, fontWeight: 500}}>
                                    {formatTimeDisplay(segment.departureTime)}
                                </Typography>
                            </Box>

                            {/* Arrow */}
                            <ChevronRightIcon sx={{fontSize: 14, color: theme.palette.text.secondary}}/>

                            {/* Destination */}
                            <Box sx={{minWidth: 60}}>
                                <Typography sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: theme.palette.text.primary
                                }}>
                                    {segment.arrivalAirportFsCode}
                                </Typography>
                                <Typography sx={{fontSize: '0.65rem', color: theme.palette.primary.main, fontWeight: 500}}>
                                    {formatTimeDisplay(segment.arrivalTime)}
                                </Typography>
                            </Box>

                            {/* Duration */}
                            <Typography
                                sx={{
                                    fontSize: '0.65rem',
                                    color: theme.palette.text.secondary,
                                    ml: 'auto',
                                }}
                            >
                                {formatMinutesToTime(segment.elapsedTime)}
                            </Typography>
                        </Box>

                        {/* Layover indicator */}
                        {index < segments.length - 1 && (
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                pl: 4.5,
                                py: 0.5,
                            }}>
                                <ScheduleIcon sx={{fontSize: 12, color: theme.palette.warning.main}}/>
                                <Typography
                                    sx={{
                                        fontSize: '0.6rem',
                                        fontWeight: 500,
                                        color: theme.palette.warning.main,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    {getConnectionTime(segment, segments[index + 1])} layover
                                    at {segment.arrivalAirportFsCode}
                                </Typography>
                            </Box>
                        )}
                    </React.Fragment>
                    );
                })}
            </Box>
        );
    };

    // Agent card component
    const AgentCard: React.FC<{ agent: AgentOption; index: number }> = ({agent, index}) => (
        <Box
            sx={{
                bgcolor: theme.palette.background.paper,
                borderRadius: '8px',
                border: `1px solid ${theme.palette.divider}`,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                animation: `${slideIn} 0.3s ease ${index * 0.05}s both`,
                transition: 'all 0.2s ease',
                '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    boxShadow: theme.shadows[1],
                },
            }}
        >
            {/* Agent info */}
            <Box sx={{flex: 1, minWidth: 0}}>
                <Typography
                    sx={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {agent.agentName}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 0.5}}>
                    {/* Ranking stars */}
                    <Box sx={{display: 'flex', gap: 0.25}}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            star <= (parseInt(agent.agentRanking) || 0) ?
                                <StarIcon key={star} sx={{fontSize: 12, color: theme.palette.warning.main}}/> :
                                <StarBorderIcon key={star} sx={{fontSize: 12, color: theme.palette.text.disabled}}/>
                        ))}
                    </Box>
                    {agent.agentNotes && (
                        <Typography
                            sx={{
                                fontSize: '0.65rem',
                                color: theme.palette.text.secondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 120,
                            }}
                        >
                            {agent.agentNotes}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Rate */}
            <Typography
                sx={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                }}
            >
                {formatCurrency(agent.agentRate)}
            </Typography>

            {/* Actions */}
            <Box sx={{display: 'flex', gap: 0.5}}>
                <Tooltip title="Send Quote Request" arrow>
                    <IconButton
                        size="small"
                        onClick={() => onSendQuoteRequest(agent)}
                        sx={{
                            width: 28,
                            height: 28,
                            bgcolor: alpha(theme.palette.text.secondary, 0.1),
                            '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                            },
                        }}
                    >
                        <RequestQuoteIcon sx={{fontSize: 14, color: theme.palette.text.secondary}}/>
                    </IconButton>
                </Tooltip>
                <Tooltip title="Assign Agent" arrow>
                    <IconButton
                        size="small"
                        onClick={() => onAddAgentToJob(agent)}
                        sx={{
                            width: 28,
                            height: 28,
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                            '&:hover': {
                                bgcolor: alpha(theme.palette.success.main, 0.2),
                            },
                        }}
                    >
                        <AddIcon sx={{fontSize: 14, color: theme.palette.success.main}}/>
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );

    // Loading skeleton
    const LoadingSkeleton = () => (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, p: 1.5}}>
            {[1, 2, 3, 4].map((i) => (
                <Box
                    key={i}
                    sx={{
                        height: 80,
                        borderRadius: '8px',
                        bgcolor: alpha(theme.palette.text.secondary, 0.08),
                        position: 'relative',
                        overflow: 'hidden',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.background.paper, 0.4)}, transparent)`,
                            backgroundSize: '200% 100%',
                            animation: `${shimmer} 1.5s infinite`,
                        },
                    }}
                />
            ))}
        </Box>
    );

    // Airport selector chip
    const AirportChip: React.FC<{
        icon: React.ReactNode;
        label: string;
        selected?: AirportSuggestion;
        onClick: (e: React.MouseEvent<HTMLElement>) => void;
    }> = ({icon, label, selected, onClick}) => (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.text.secondary, 0.05),
                border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.3) : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                },
            }}
        >
            {icon}
            <Typography
                sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
                }}
            >
                {selected ? formatAirportCodeForDropdown(selected.text) : label}
            </Typography>
        </Box>
    );

    const renderFlightSection = () => {
        if (flightsLoading) {
            return <LoadingSkeleton/>;
        }

        if (showNoJobSelectedMessage) {
            return (
                <NoData
                    title="No Job Selected"
                    message="Select a job to view available flights."
                    icon="flight_takeoff"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showJobHasAssignedFlightMessage) {
            return (
                <NoData
                    title="Flight Assigned"
                    message="A flight has been assigned to this job."
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
                    message="Airport information not available for this job."
                    icon="local_airport"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNoFlightsAvailableMessage) {
            return (
                <NoData
                    title="No Flights"
                    message={flightMessage || "No flights available."}
                    icon="flight_takeoff"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showFlightList) {
            return (
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    {/* Header controls */}
                    <Box sx={{
                        p: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                    }}>
                        {/* Airport selectors & Search */}
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                            <AirportChip
                                icon={<FlightTakeoffIcon sx={{fontSize: 14, color: theme.palette.primary.main}}/>}
                                label="FROM"
                                selected={selectedOutboundAirport}
                                onClick={(e) => setOutboundAnchorEl(e.currentTarget)}
                            />
                            <SwapHorizIcon sx={{fontSize: 14, color: theme.palette.text.secondary}}/>
                            <AirportChip
                                icon={<FlightLandIcon sx={{fontSize: 14, color: theme.palette.primary.main}}/>}
                                label="TO"
                                selected={selectedInboundAirport}
                                onClick={(e) => setInboundAnchorEl(e.currentTarget)}
                            />

                            <Box sx={{flex: 1}}/>

                            <TextField
                                size="small"
                                placeholder="Search..."
                                value={flightSearchText}
                                onChange={(e) => onFlightSearchChange(e.target.value)}
                                sx={{
                                    width: 140,
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: alpha(theme.palette.text.secondary, 0.05),
                                        borderRadius: '6px',
                                        '& fieldset': {
                                            borderColor: 'transparent',
                                        },
                                        '&:hover fieldset': {
                                            borderColor: alpha(theme.palette.primary.main, 0.3),
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: theme.palette.primary.main,
                                        },
                                    },
                                    '& .MuiOutlinedInput-input': {
                                        py: 0.75,
                                        fontSize: '0.75rem',
                                        color: theme.palette.text.primary,
                                        '&::placeholder': {
                                            color: theme.palette.text.secondary,
                                        },
                                    },
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{fontSize: 16, color: theme.palette.text.secondary}}/>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Box>

                        {/* Airline filter chips */}
                        <Box sx={{
                            display: 'flex',
                            gap: 0.75,
                            flexWrap: 'wrap',
                            maxHeight: 64,
                            overflow: 'auto',
                            py: 0.5,
                        }}>
                            <Box
                                onClick={() => onFilterFlightsByAirline(null)}
                                sx={{
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: '6px',
                                    bgcolor: !selectedAirline ? theme.palette.text.primary : alpha(theme.palette.text.secondary, 0.08),
                                    border: `2px solid ${!selectedAirline ? theme.palette.text.primary : theme.palette.divider}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: !selectedAirline ? `0 2px 4px ${alpha(theme.palette.text.primary, 0.25)}` : 'none',
                                    '&:hover': {
                                        transform: 'scale(1.05)',
                                        boxShadow: `0 2px 6px ${alpha(theme.palette.text.primary, 0.2)}`,
                                    },
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: !selectedAirline ? theme.palette.background.paper : theme.palette.text.secondary,
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    ALL
                                </Typography>
                            </Box>
                            {activeAirlineOptions?.map((airline) => {
                                const airlineColors = getAirlineColor(airline.text);
                                const isSelected = selectedAirline?.id === airline.id;
                                return (
                                <Tooltip key={airline.id} title={airline.fullAirlineName || airline.text} arrow>
                                    <Box
                                        onClick={() => onFilterFlightsByAirline(airline)}
                                        sx={{
                                            px: 1.25,
                                            py: 0.5,
                                            borderRadius: '6px',
                                            bgcolor: isSelected ? airlineColors.bg : alpha(airlineColors.bg, 0.1),
                                            border: `2px solid ${isSelected ? airlineColors.border : alpha(airlineColors.bg, 0.3)}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            boxShadow: isSelected ? `0 2px 6px ${alpha(airlineColors.bg, 0.4)}` : 'none',
                                            '&:hover': {
                                                transform: 'scale(1.05)',
                                                bgcolor: isSelected ? airlineColors.bg : alpha(airlineColors.bg, 0.2),
                                                boxShadow: `0 2px 6px ${alpha(airlineColors.bg, 0.3)}`,
                                            },
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                color: isSelected ? airlineColors.text : airlineColors.bg,
                                                letterSpacing: '0.05em',
                                                textShadow: isSelected && airlineColors.text === '#FFFFFF' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                                            }}
                                        >
                                            {airline.text}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                                );
                            })}
                        </Box>
                    </Box>

                    {/* Airport menus */}
                    <Menu
                        anchorEl={outboundAnchorEl}
                        open={Boolean(outboundAnchorEl)}
                        onClose={() => setOutboundAnchorEl(null)}
                    >
                        {selectedOutboundAirport && (
                            <MenuItem
                                onClick={() => {
                                    onOutboundAirportChange(null);
                                    setOutboundAnchorEl(null);
                                }}
                            >
                                <ClearIcon sx={{mr: 1, fontSize: 16}}/> Clear
                            </MenuItem>
                        )}
                        {outboundAirportOptions?.map((airport) => (
                            <MenuItem
                                key={airport.id}
                                onClick={() => {
                                    onOutboundAirportChange(airport);
                                    setOutboundAnchorEl(null);
                                }}
                                sx={{}}
                            >
                                {selectedOutboundAirport?.id === airport.id &&
                                    <CheckIcon sx={{mr: 1, fontSize: 16, color: theme.palette.primary.main}}/>}
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
                            <MenuItem
                                onClick={() => {
                                    onInboundAirportChange(null);
                                    setInboundAnchorEl(null);
                                }}
                            >
                                <ClearIcon sx={{mr: 1, fontSize: 16}}/> Clear
                            </MenuItem>
                        )}
                        {inboundAirportOptions?.map((airport) => (
                            <MenuItem
                                key={airport.id}
                                onClick={() => {
                                    onInboundAirportChange(airport);
                                    setInboundAnchorEl(null);
                                }}
                                sx={{}}
                            >
                                {selectedInboundAirport?.id === airport.id &&
                                    <CheckIcon sx={{mr: 1, fontSize: 16, color: theme.palette.primary.main}}/>}
                                {airport.text}
                            </MenuItem>
                        ))}
                    </Menu>

                    {/* Column headers */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 1.5,
                        py: 0.75,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Box sx={{minWidth: 85}}>
                            <SortHeader label="Flight" sortKey="flightNumber" currentKey={flightSortKey}
                                        direction={flightSortDirection}
                                        onClick={() => handleFlightSort('flightNumber')}/>
                        </Box>
                        <Box sx={{flex: 1, display: 'flex', justifyContent: 'space-between', px: 2}}>
                            <SortHeader label="Depart" sortKey="departureTime" currentKey={flightSortKey}
                                        direction={flightSortDirection}
                                        onClick={() => handleFlightSort('departureTime')}/>
                            <SortHeader label="Stops" sortKey="stops" currentKey={flightSortKey}
                                        direction={flightSortDirection} onClick={() => handleFlightSort('stops')}
                                        align="center"/>
                            <SortHeader label="Arrive" sortKey="arrivalTime" currentKey={flightSortKey}
                                        direction={flightSortDirection} onClick={() => handleFlightSort('arrivalTime')}
                                        align="right"/>
                        </Box>
                        <Box sx={{minWidth: 80, textAlign: 'right'}}>
                            <SortHeader label="Price" sortKey="amount" currentKey={flightSortKey}
                                        direction={flightSortDirection} onClick={() => handleFlightSort('amount')}
                                        align="right"/>
                        </Box>
                    </Box>

                    {/* Flight list */}
                    <Box sx={{
                        flex: 1,
                        overflow: 'auto',
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.75,
                    }}>
                        {sortedFlights.map((flight, index) => (
                            <FlightCard
                                key={`${flight.connectionId || flight.flightNumber}-${flight.departureTime?.valueOf()}-${index}`}
                                flight={flight}
                                index={index}
                            />
                        ))}
                    </Box>

                    {/* Footer actions */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 1,
                        p: 1,
                        borderTop: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button
                            size="small"
                            onClick={onLoadMoreFlights}
                            sx={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: theme.palette.text.secondary,
                                bgcolor: alpha(theme.palette.text.secondary, 0.1),
                                px: 2,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.main,
                                },
                            }}
                        >
                            Load More
                        </Button>
                        <Button
                            size="small"
                            onClick={onLoadNextDayFlights}
                            endIcon={<NavigateNextIcon sx={{fontSize: 14}}/>}
                            sx={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                px: 2,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                                },
                            }}
                        >
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
            return <LoadingSkeleton/>;
        }

        if (showNoAgentJobSelectedMessage) {
            return (
                <NoData
                    title="No Job Selected"
                    message="Select a job to view available agents."
                    icon="engineering"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showJobHasAssignedAgentMessage) {
            return (
                <NoData
                    title="Agent Assigned"
                    message="An agent has been assigned to this job."
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
                    message="Agent info not applicable for this job type."
                    icon="engineering"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showNoAgentsAvailableMessage) {
            return (
                <NoData
                    title="No Agents"
                    message={agentMessage || "No agents available."}
                    icon="engineering"
                    showAction={false}
                    isUsCustomer={isUsCustomer}
                />
            );
        }

        if (showAgentList) {
            return (
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    {/* Header */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}>
                        <Button
                            size="small"
                            startIcon={<PersonSearchIcon sx={{fontSize: 14}}/>}
                            onClick={onOpenAgentSearchDialog}
                            sx={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                px: 1.5,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                                },
                            }}
                        >
                            Search
                        </Button>
                    </Box>

                    {/* Agent list */}
                    <Box sx={{
                        flex: 1,
                        overflow: 'auto',
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.75,
                    }}>
                        {sortedAgents.map((agent, index) => (
                            <AgentCard key={agent.agentId} agent={agent} index={index}/>
                        ))}
                    </Box>
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
                bgcolor: theme.palette.background.default,
                borderRadius: '8px',
                overflow: 'hidden',
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: theme.shadows[1],
            }}
        >
            {!isDeliveryJobType ? renderFlightSection() : renderAgentSection()}
        </Box>
    );
};

export default FlightAgentDataTable;
