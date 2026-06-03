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
import {formatCurrency} from '../../../utils/currencyUtils';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringIcon from '@mui/icons-material/Engineering';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NoteIcon from '@mui/icons-material/Note';
import FlightIcon from '@mui/icons-material/Flight';
import FlightOffIcon from '@mui/icons-material/AirplanemodeInactive';
import PlaceIcon from '@mui/icons-material/Place';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
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

function getRankingValue(ranking: string | undefined): number {
    if (!ranking) return 0;
    const rankNum = parseFloat(ranking);
    if (isNaN(rankNum)) return 0;
    return Math.round(rankNum);
}

function formatCoordinates(lat: number | undefined, lng: number | undefined): string {
    if (lat === undefined || lng === undefined) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

function formatCurrencyOrEmpty(value: number | undefined): string {
    if (value === undefined) return '';
    return formatCurrency(value);
}

export const AgentInfoDialog: React.FC<AgentInfoDialogProps> = ({open, agent, isLoading, onClose}) => {
    const rankingValue = getRankingValue(agent?.agentRanking);
    const maxStars = 5;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
                        minWidth: { xs: '95%', sm: '90%', md: 800 },
                        maxWidth: 900,
                        width: '80%',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <EngineeringIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>
                        Agent Details
                    </Typography>
                    {agent && (
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                            {agent.agentName}
                        </Typography>
                    )}
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Content */}
            <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : agent ? (
                    <Box sx={{ p: 3 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                gap: 3,
                            }}
                        >
                            {/* Left Column - Agent Details */}
                            <Box sx={{ flex: '0 0 60%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Basic Information Card */}
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        borderRadius: 3,
                                        border: `1px solid ${theme.palette.divider}`,
                                        overflow: 'hidden',
                                    })}
                                >
                                    <Box
                                        sx={(theme) => ({
                                            px: 2.5,
                                            py: 2,
                                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                        })}
                                    >
                                        <PersonIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                                        <Typography variant="subtitle1" sx={{
                                            fontWeight: 600
                                        }}>
                                            Basic Information
                                        </Typography>
                                    </Box>

                                    <Box
                                        sx={{
                                            p: 2.5,
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 3,
                                        }}
                                    >
                                        {/* Name */}
                                        <InfoField label="Name" value={agent.agentName} />

                                        {/* Rate */}
                                        <InfoField
                                            label="Rate"
                                            value={formatCurrencyOrEmpty(agent.agentRate)}
                                            valueColor="success.main"
                                            valueFontWeight={600}
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
                                                    display: 'block',
                                                    mb: 0.75,
                                                }}
                                            >
                                                Ranking
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                                {[...Array(maxStars)].map((_, index) => (
                                                    index < rankingValue ? (
                                                        <StarIcon
                                                            key={index}
                                                            sx={{ color: 'warning.main', fontSize: 20 }}
                                                        />
                                                    ) : (
                                                        <StarBorderIcon
                                                            key={index}
                                                            sx={{ color: 'grey.300', fontSize: 20 }}
                                                        />
                                                    )
                                                ))}
                                                {rankingValue === 0 && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "text.secondary",
                                                            ml: 1
                                                        }}>
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
                                                    display: 'block',
                                                    mb: 0.75,
                                                }}
                                            >
                                                Phone
                                            </Typography>
                                            {agent.agentPhone ? (
                                                <Box
                                                    component="a"
                                                    href={`tel:${agent.agentPhone}`}
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.75,
                                                        color: 'primary.main',
                                                        textDecoration: 'none',
                                                        '&:hover': { textDecoration: 'underline' },
                                                    }}
                                                >
                                                    <PhoneIcon sx={{ fontSize: 16 }} />
                                                    <Typography variant="body2">
                                                        {formatPhone(agent.agentPhone)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" sx={{
                                                    color: "text.secondary"
                                                }}>
                                                    Not provided
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Email */}
                                        <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                    display: 'block',
                                                    mb: 0.75,
                                                }}
                                            >
                                                Email
                                            </Typography>
                                            {agent.agentEmail ? (
                                                <Box
                                                    component="a"
                                                    href={`mailto:${agent.agentEmail}`}
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.75,
                                                        color: 'primary.main',
                                                        textDecoration: 'none',
                                                        '&:hover': { textDecoration: 'underline' },
                                                    }}
                                                >
                                                    <EmailIcon sx={{ fontSize: 16 }} />
                                                    <Typography variant="body2">
                                                        {agent.agentEmail}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" sx={{
                                                    color: "text.secondary"
                                                }}>
                                                    Not provided
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Address */}
                                        <Box sx={{ gridColumn: '1 / -1' }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'text.secondary',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontWeight: 500,
                                                    display: 'block',
                                                    mb: 0.75,
                                                }}
                                            >
                                                Address
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                                                <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                                                <Typography variant="body2">
                                                    {agent.address?.fullAddress || 'No address available'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>

                                {/* Notes Card */}
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        borderRadius: 3,
                                        border: `1px solid ${theme.palette.divider}`,
                                        overflow: 'hidden',
                                    })}
                                >
                                    <Box
                                        sx={(theme) => ({
                                            px: 2.5,
                                            py: 2,
                                            bgcolor: alpha(theme.palette.info.main, 0.04),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                        })}
                                    >
                                        <NoteIcon sx={{ color: 'info.main', fontSize: 22 }} />
                                        <Typography variant="subtitle1" sx={{
                                            fontWeight: 600
                                        }}>
                                            Notes
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 2.5 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                whiteSpace: 'pre-line',
                                                lineHeight: 1.7,
                                                color: agent.agentNotes ? 'text.primary' : 'text.secondary',
                                                fontStyle: agent.agentNotes ? 'normal' : 'italic',
                                            }}
                                        >
                                            {agent.agentNotes || 'No notes available.'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Box>

                            {/* Right Column - Airports */}
                            <Box sx={{ flex: '0 0 40%', minWidth: 0 }}>
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        borderRadius: 3,
                                        border: `1px solid ${theme.palette.divider}`,
                                        overflow: 'hidden',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    })}
                                >
                                    <Box
                                        sx={(theme) => ({
                                            px: 2.5,
                                            py: 2,
                                            bgcolor: alpha(theme.palette.success.main, 0.04),
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                        })}
                                    >
                                        <FlightIcon sx={{ color: 'success.main', fontSize: 22 }} />
                                        <Typography variant="subtitle1" sx={{
                                            fontWeight: 600
                                        }}>
                                            Assigned Airports
                                        </Typography>
                                        {agent.airports && agent.airports.length > 0 && (
                                            <Chip
                                                label={agent.airports.length}
                                                size="small"
                                                sx={{ ml: 'auto', bgcolor: 'success.main', color: 'white', fontWeight: 600, height: 24 }}
                                            />
                                        )}
                                    </Box>

                                    {agent.airports && agent.airports.length > 0 ? (
                                        <Box
                                            sx={{
                                                flex: 1,
                                                maxHeight: 420,
                                                overflowY: 'auto',
                                                '&::-webkit-scrollbar': { width: 6 },
                                                '&::-webkit-scrollbar-track': { bgcolor: 'grey.100' },
                                                '&::-webkit-scrollbar-thumb': {
                                                    bgcolor: 'grey.300',
                                                    borderRadius: 3,
                                                    '&:hover': { bgcolor: 'grey.400' },
                                                },
                                            }}
                                        >
                                            {agent.airports.map((airport, index) => (
                                                <Box
                                                    key={airport.code || index}
                                                    sx={(theme) => ({
                                                        p: 2,
                                                        borderBottom: index < agent.airports!.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                                        transition: 'background-color 0.15s',
                                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                                                    })}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                                        <Chip
                                                            label={airport.code}
                                                            size="small"
                                                            sx={(theme) => ({
                                                                bgcolor: theme.palette.primary.main,
                                                                color: 'white',
                                                                fontWeight: 700,
                                                                letterSpacing: 0.5,
                                                                fontSize: '0.75rem',
                                                            })}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            noWrap
                                                            sx={{
                                                                fontWeight: 500,
                                                                flex: 1
                                                            }}>
                                                            {airport.name}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 0.5 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                                                            <PlaceIcon sx={{ fontSize: 14 }} />
                                                            <Typography variant="caption">
                                                                {airport.city}, {airport.country}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                                                            <ScheduleIcon sx={{ fontSize: 14 }} />
                                                            <Typography variant="caption">
                                                                {airport.timezone}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
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
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                py: 6,
                                                px: 2,
                                            }}
                                        >
                                            <Box
                                                sx={(theme) => ({
                                                    width: 64,
                                                    height: 64,
                                                    borderRadius: '50%',
                                                    bgcolor: alpha(theme.palette.grey[500], 0.08),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    mb: 2,
                                                })}
                                            >
                                                <FlightOffIcon sx={{ fontSize: 32, color: 'grey.400' }} />
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "text.secondary",
                                                    fontStyle: "italic"
                                                }}>
                                                No airports assigned
                                            </Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                        <Typography sx={{
                            color: "text.secondary"
                        }}>No agent data available</Typography>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Helper component for info fields
interface InfoFieldProps {
    label: string;
    value: string;
    valueColor?: string;
    valueFontWeight?: number;
}

function InfoField({ label, value, valueColor, valueFontWeight }: InfoFieldProps): React.ReactElement {
    return (
        <Box>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 500,
                    display: 'block',
                    mb: 0.75,
                }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={{
                    color: valueColor || 'text.primary',
                    fontWeight: valueFontWeight || 400,
                }}
            >
                {value || 'Not provided'}
            </Typography>
        </Box>
    );
}

export default AgentInfoDialog;
