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
import {alpha, useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringIcon from '@mui/icons-material/Engineering';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FlightIcon from '@mui/icons-material/Flight';
import FlightOffIcon from '@mui/icons-material/AirplanemodeInactive';
import PlaceIcon from '@mui/icons-material/Place';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { AgentInfo, AirportViewModel, AddressViewModel } from '../../../interfaces';
import {DialogShell, sectionPaperSx, sectionLabelSx} from '../shared';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from '../shared/styles';

// Re-export interfaces for backward compatibility
export type { AgentInfo, AirportViewModel, AddressViewModel };

const TITLE_ID = 'agent-info-title';

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
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const rankingValue = getRankingValue(agent?.agentRanking);

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullScreen={fullScreen}
            aria-labelledby={TITLE_ID}
            slotProps={{
                paper: {
                    sx: { borderRadius: fullScreen ? 0 : 3.5, overflow: 'hidden' },
                },
            }}
        >
            {/* Header */}
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <EngineeringIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography id={TITLE_ID} variant="h6" sx={{ fontWeight: 600 }}>
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
                    aria-label="Close dialog"
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)},
                    })}
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
                    <Box
                        sx={{
                            p: 3,
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 3,
                        }}
                    >
                        {/* Left Column - Agent Details */}
                        <Box sx={{ flex: '1 1 60%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Basic Information */}
                            <Box>
                                <Typography variant="body2" sx={sectionLabelSx}>
                                    Basic Information
                                </Typography>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        ...sectionPaperSx,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 3,
                                    }}
                                >
                                    <InfoField label="Name" value={agent.agentName} />

                                    <InfoField
                                        label="Rate"
                                        value={formatCurrencyOrEmpty(agent.agentRate)}
                                        valueColor="success.main"
                                        valueFontWeight={600}
                                    />

                                    {/* Ranking */}
                                    <Box>
                                        <FieldLabel>Ranking</FieldLabel>
                                        {rankingValue > 0 ? (
                                            <Rating
                                                value={rankingValue}
                                                max={5}
                                                precision={1}
                                                readOnly
                                                size="small"
                                                aria-label={`Ranking: ${rankingValue} out of 5`}
                                            />
                                        ) : (
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                No ranking
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Phone */}
                                    <Box>
                                        <FieldLabel>Phone</FieldLabel>
                                        {agent.agentPhone ? (
                                            <Link
                                                href={`tel:${agent.agentPhone}`}
                                                underline="hover"
                                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
                                            >
                                                <PhoneIcon sx={{ fontSize: 16 }} />
                                                <Typography variant="body2" component="span">
                                                    {formatPhone(agent.agentPhone)}
                                                </Typography>
                                            </Link>
                                        ) : (
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                Not provided
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Email */}
                                    <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                                        <FieldLabel>Email</FieldLabel>
                                        {agent.agentEmail ? (
                                            <Link
                                                href={`mailto:${agent.agentEmail}`}
                                                underline="hover"
                                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
                                            >
                                                <EmailIcon sx={{ fontSize: 16 }} />
                                                <Typography variant="body2" component="span">
                                                    {agent.agentEmail}
                                                </Typography>
                                            </Link>
                                        ) : (
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                Not provided
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Address */}
                                    <Box sx={{ gridColumn: '1 / -1' }}>
                                        <FieldLabel>Address</FieldLabel>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                                            <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                                            <Typography variant="body2">
                                                {agent.address?.fullAddress || 'No address available'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Box>

                            {/* Notes */}
                            <Box>
                                <Typography variant="body2" sx={sectionLabelSx}>
                                    Notes
                                </Typography>
                                <Paper elevation={0} sx={sectionPaperSx}>
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
                                </Paper>
                            </Box>
                        </Box>

                        {/* Right Column - Airports */}
                        <Box sx={{ flex: '1 1 40%', minWidth: 0 }}>
                            <Box
                                sx={{
                                    mb: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <FlightIcon sx={{ color: 'success.main', fontSize: 18 }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    Assigned Airports
                                </Typography>
                                {agent.airports && agent.airports.length > 0 && (
                                    <Chip
                                        label={agent.airports.length}
                                        size="small"
                                        color="success"
                                        sx={{ ml: 'auto', fontWeight: 600, height: 24 }}
                                    />
                                )}
                            </Box>
                            <Paper elevation={0} sx={{ ...sectionPaperSx, p: 0, overflow: 'hidden' }}>
                                {agent.airports && agent.airports.length > 0 ? (
                                    <Box
                                        role="region"
                                        aria-label="Assigned airports"
                                        tabIndex={0}
                                        sx={{ maxHeight: 420, overflowY: 'auto' }}
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
                                                        color="primary"
                                                        sx={{ fontWeight: 700, letterSpacing: 0.5, fontSize: '0.75rem' }}
                                                    />
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{ fontWeight: 500, flex: 1 }}
                                                    >
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
                                            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                                        >
                                            No airports assigned
                                        </Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                        <Typography sx={{ color: 'text.secondary' }}>No agent data available</Typography>
                    </Box>
                )}
            </DialogContent>
            {!isLoading && (
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'background.paper',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    <Button variant="outlined" onClick={onClose} sx={{ minWidth: 100 }}>
                        Close
                    </Button>
                </DialogActions>
            )}
        </DialogShell>
    );
};

// Field label shared by the basic-info grid cells
function FieldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
    return (
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
            {children}
        </Typography>
    );
}

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
            <FieldLabel>{label}</FieldLabel>
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
