/**
 * React Agent Info Dialog
 *
 * A modern replacement for the AngularJS agent-info-dialog using MUI components.
 * Displays comprehensive information about a dispatch agent including:
 * - Basic info (name, rate, ranking, contact)
 * - Address
 * - Notes
 * - Assigned airports with details
 */

import React from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    IconButton,
    Typography,
    Tooltip,
    CircularProgress,
    Chip,
} from '@mui/material';
import {
    Close as CloseIcon,
    Engineering as EngineeringIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocationOn as LocationOnIcon,
    Note as NoteIcon,
    Flight as FlightIcon,
    AirplanemodeInactive as FlightOffIcon,
    Place as PlaceIcon,
    Schedule as ScheduleIcon,
    MyLocation as MyLocationIcon,
    Star as StarIcon,
} from '@mui/icons-material';
import { AgentInfo, AirportViewModel, AddressViewModel } from '../../../interfaces';

// Re-export interfaces for backward compatibility
export type { AgentInfo, AirportViewModel, AddressViewModel };

export interface AgentInfoDialogProps {
    open: boolean;
    agent: AgentInfo | null;
    isLoading: boolean;
    onClose: () => void;
}

// Helper functions
function formatPhone(phone: string | undefined): string {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
    }
    return phone;
}

function getRankingArray(ranking: string | undefined): number[] {
    if (!ranking) return [];
    const rankNum = parseFloat(ranking);
    if (isNaN(rankNum)) return [];
    return new Array(Math.round(rankNum)).fill(0);
}

function formatCoordinates(lat: number | undefined, lng: number | undefined): string {
    if (lat === undefined || lng === undefined) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

function formatCurrency(value: number | undefined): string {
    if (value === undefined) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
}

// Styled components using sx prop
const sectionHeaderSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    p: 2,
    pb: 1.5,
    borderBottom: 1,
    borderColor: 'divider',
    bgcolor: 'grey.50',
};

const iconSx = {
    color: 'grey.600',
    fontSize: 20,
};

export class AgentInfoDialog extends React.Component<AgentInfoDialogProps> {
    render(): React.ReactNode {
        const { open, agent, isLoading, onClose } = this.props;

        return (
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: { xs: '95%', sm: '90%', md: 800 },
                        maxWidth: 900,
                        width: '80%',
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={(theme) => ({
                        background: `linear-gradient(135deg, ${theme.palette.grey[600]} 0%, ${theme.palette.grey[700]} 100%)`,
                        color: 'white',
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    })}
                >
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <EngineeringIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={600}>
                            Agent Details{agent ? `: ${agent.agentName}` : ''}
                        </Typography>
                    </Box>
                    <Tooltip title="Close">
                        <IconButton
                            onClick={onClose}
                            sx={{
                                color: 'white',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 0, bgcolor: 'grey.100' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                            <CircularProgress size={40} />
                        </Box>
                    ) : agent ? (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                p: 2,
                                gap: 2,
                            }}
                        >
                            {/* Agent Details Section */}
                            <Box sx={{ flex: '0 0 60%', minWidth: 0 }}>
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        boxShadow: 1,
                                        overflow: 'hidden',
                                        height: '100%',
                                    }}
                                >
                                    {/* Basic Information Header */}
                                    <Box sx={sectionHeaderSx}>
                                        <PersonIcon sx={iconSx} />
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            Basic Information
                                        </Typography>
                                    </Box>

                                    {/* Info Grid */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 2.5,
                                        }}
                                    >
                                        {/* Name */}
                                        <InfoItem label="Name" value={agent.agentName} />

                                        {/* Rate */}
                                        <InfoItem
                                            label="Rate"
                                            value={formatCurrency(agent.agentRate)}
                                            valueProps={{
                                                sx: {
                                                    fontWeight: 600,
                                                    color: 'success.main',
                                                    fontSize: '1.1rem',
                                                },
                                            }}
                                        />

                                        {/* Ranking */}
                                        <Box>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Ranking
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                                                {getRankingArray(agent.agentRanking).map((_, index) => (
                                                    <StarIcon
                                                        key={index}
                                                        sx={{ color: '#fbbf24', fontSize: 18 }}
                                                    />
                                                ))}
                                                {getRankingArray(agent.agentRanking).length === 0 && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        No ranking
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Phone */}
                                        <Box>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Phone
                                            </Typography>
                                            {agent.agentPhone ? (
                                                <Box
                                                    component="a"
                                                    href={`tel:${agent.agentPhone}`}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        color: 'grey.700',
                                                        textDecoration: 'none',
                                                        mt: 0.5,
                                                        '&:hover': { color: 'grey.900' },
                                                    }}
                                                >
                                                    <PhoneIcon sx={{ fontSize: 16 }} />
                                                    <Typography variant="body2">
                                                        {formatPhone(agent.agentPhone)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    Not provided
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Email */}
                                        <Box>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Email
                                            </Typography>
                                            {agent.agentEmail ? (
                                                <Box
                                                    component="a"
                                                    href={`mailto:${agent.agentEmail}`}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        color: 'grey.700',
                                                        textDecoration: 'none',
                                                        mt: 0.5,
                                                        '&:hover': { color: 'grey.900' },
                                                    }}
                                                >
                                                    <EmailIcon sx={{ fontSize: 16 }} />
                                                    <Typography variant="body2">
                                                        {agent.agentEmail}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    Not provided
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Address - Full Width */}
                                        <Box sx={{ gridColumn: '1 / -1' }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Address
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 0.5,
                                                    mt: 0.5,
                                                }}
                                            >
                                                <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25, flexShrink: 0 }} />
                                                <Typography variant="body2">
                                                    {agent.address?.fullAddress || 'No address available'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Notes Section */}
                                    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                                        <Box sx={sectionHeaderSx}>
                                            <NoteIcon sx={iconSx} />
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                Notes
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                p: 2,
                                                bgcolor: 'grey.50',
                                                whiteSpace: 'pre-line',
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            <Typography variant="body2">
                                                {agent.agentNotes || 'No notes available.'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Airports Section */}
                            <Box sx={{ flex: '0 0 40%', minWidth: 0 }}>
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        boxShadow: 1,
                                        overflow: 'hidden',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {/* Airports Header */}
                                    <Box sx={sectionHeaderSx}>
                                        <FlightIcon sx={iconSx} />
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            Assigned Airports
                                        </Typography>
                                    </Box>

                                    {/* Airports List */}
                                    {agent.airports && agent.airports.length > 0 ? (
                                        <Box
                                            sx={{
                                                maxHeight: 400,
                                                overflowY: 'auto',
                                                '&::-webkit-scrollbar': { width: 6 },
                                                '&::-webkit-scrollbar-track': { bgcolor: 'grey.100' },
                                                '&::-webkit-scrollbar-thumb': {
                                                    bgcolor: 'grey.400',
                                                    borderRadius: 3,
                                                    '&:hover': { bgcolor: 'grey.500' },
                                                },
                                            }}
                                        >
                                            {agent.airports.map((airport, index) => (
                                                <Box
                                                    key={airport.code || index}
                                                    sx={{
                                                        p: 2,
                                                        borderBottom: 1,
                                                        borderColor: 'divider',
                                                        transition: 'background-color 0.15s',
                                                        '&:hover': { bgcolor: 'action.hover' },
                                                        '&:last-child': { borderBottom: 0 },
                                                    }}
                                                >
                                                    {/* Airport Header */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                                        <Chip
                                                            label={airport.code}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: 'grey.700',
                                                                color: 'white',
                                                                fontWeight: 600,
                                                                letterSpacing: 0.5,
                                                                fontSize: '0.75rem',
                                                            }}
                                                        />
                                                        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                                                            {airport.name}
                                                        </Typography>
                                                    </Box>

                                                    {/* Airport Location */}
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.75,
                                                            mb: 1.5,
                                                            color: 'text.secondary',
                                                        }}
                                                    >
                                                        <PlaceIcon sx={{ fontSize: 16 }} />
                                                        <Typography variant="caption">
                                                            {airport.city}, {airport.country}
                                                        </Typography>
                                                    </Box>

                                                    {/* Airport Details */}
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.75,
                                                                color: 'text.secondary',
                                                            }}
                                                        >
                                                            <ScheduleIcon sx={{ fontSize: 14 }} />
                                                            <Typography variant="caption">
                                                                {airport.timezone}
                                                            </Typography>
                                                        </Box>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.75,
                                                                color: 'text.secondary',
                                                            }}
                                                        >
                                                            <MyLocationIcon sx={{ fontSize: 14 }} />
                                                            <Typography variant="caption">
                                                                {formatCoordinates(airport.latitude, airport.longitude)}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                py: 6,
                                                px: 2,
                                                color: 'text.secondary',
                                            }}
                                        >
                                            <FlightOffIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
                                            <Typography variant="body2" fontStyle="italic">
                                                No airports assigned
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                            <Typography color="text.secondary">No agent data available</Typography>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        );
    }
}

// Helper component for info items
interface InfoItemProps {
    label: string;
    value: string;
    valueProps?: {
        sx?: object;
    };
}

function InfoItem({ label, value, valueProps }: InfoItemProps): React.ReactElement {
    return (
        <Box>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 500,
                }}
            >
                {label}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, ...valueProps?.sx }}>
                {value || 'Not provided'}
            </Typography>
        </Box>
    );
}

export default AgentInfoDialog;
