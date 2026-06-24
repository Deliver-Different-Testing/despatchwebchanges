import React, { useState, useCallback } from 'react';
import { alpha } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BugReportIcon from '@mui/icons-material/BugReport';
import PersonIcon from '@mui/icons-material/Person';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import type { IClearListDebugViewModel } from '../../../../interfaces/job.interface';
import { apiClient } from '../../../services/apiClient';

async function fetchClearListDebug(courierId: number): Promise<IClearListDebugViewModel> {
    return apiClient.get<IClearListDebugViewModel>('/courier/ClearListDebug', { courierId });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 500,
                    minWidth: 160,
                    pt: 0.25,
                }}
            >
                {label}
            </Typography>
            <Typography variant="body2" component="div" sx={{ flex: 1 }}>
                {value ?? (
                    <Typography variant="body2" component="span" sx={{
                        color: "text.disabled"
                    }}>
                        N/A
                    </Typography>
                )}
            </Typography>
        </Box>
    );
}

export function ClearListDebugButton({ courierId }: { courierId: number }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<IClearListDebugViewModel | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpen = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(true);
        setLoading(true);
        setError(null);
        try {
            const result = await fetchClearListDebug(courierId);
            setData(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load debug info');
        } finally {
            setLoading(false);
        }
    }, [courierId]);

    const handleClose = useCallback(() => {
        setOpen(false);
    }, []);

    return (
        <>
            <Tooltip title="Clear list debug info">
                <IconButton
                    size="small"
                    onClick={handleOpen}
                    sx={{ p: '2px', opacity: 0.6, '&:hover': { opacity: 1 } }}
                >
                    <InfoOutlinedIcon sx={{ fontSize: '0.875rem' }} />
                </IconButton>
            </Tooltip>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                slotProps={{
                    paper: {
                        elevation: 24,
                        sx: {
                            borderRadius: 2,
                            overflow: 'hidden',
                            minWidth: 480,
                            maxWidth: 600,
                        },
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={(theme) => ({
                        background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
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
                        <BugReportIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{
                            fontWeight: 600
                        }}>
                            Clear List Debug
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                            Driver placement diagnostics
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={handleClose}
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
                    {loading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                            <CircularProgress size={40} />
                        </Box>
                    )}
                    {error && (
                        <Box sx={{ p: 3 }}>
                            <Alert severity="error">{error}</Alert>
                        </Box>
                    )}
                    {data && !loading && <DebugContent data={data} />}
                </DialogContent>
            </Dialog>
        </>
    );
}

function SectionCard({
    icon,
    title,
    color,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    color: string;
    children: React.ReactNode;
}) {
    return (
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
                    bgcolor: alpha((theme.palette as any)[color.split('.')[0]]?.main ?? theme.palette.primary.main, 0.04),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                })}
            >
                {icon}
                <Typography variant="subtitle1" sx={{
                    fontWeight: 600
                }}>
                    {title}
                </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
                {children}
            </Box>
        </Paper>
    );
}

function DebugContent({ data }: { data: IClearListDebugViewModel }) {
    const gpsStale = data.gpsAgeMinutes != null && data.gpsAgeMinutes > 3;

    return (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Explanation */}
            <Alert severity="info">
                <Typography variant="body2">{data.explanation}</Typography>
            </Alert>
            {/* Courier Info */}
            <SectionCard
                icon={<PersonIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
                title="Courier"
                color="primary"
            >
                <InfoRow label="Code" value={data.courierCode} />
                <InfoRow label="Name" value={data.courierName} />
                <InfoRow label="Channel ID" value={data.channelId} />
                <InfoRow label="Fleet" value={data.fleetName} />
                <InfoRow label="Logged In" value={
                    data.isLoggedIn
                        ? <Chip label="Yes" color="success" size="small" />
                        : <Chip label="No" color="default" size="small" />
                } />
                {data.loginTime && <InfoRow label="Login Time" value={data.loginTime} />}
            </SectionCard>
            {/* GPS Info */}
            <SectionCard
                icon={<GpsFixedIcon sx={{ color: 'success.main', fontSize: 22 }} />}
                title="GPS Location"
                color="success"
            >
                <InfoRow label="Polygon ID" value={data.gpsPolygonId} />
                <InfoRow label="Polygon Name" value={data.gpsPolygonName} />
                {data.gpsPolygonSuburbs.length > 0 && (
                    <InfoRow label="Suburbs in Polygon" value={
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {data.gpsPolygonSuburbs.map(s => (
                                <Chip key={s} label={s} size="small" />
                            ))}
                        </Box>
                    } />
                )}
                <InfoRow label="Lat/Lng" value={
                    data.gpsLatitude != null ? `${data.gpsLatitude}, ${data.gpsLongitude}` : null
                } />
                <InfoRow label="GPS Age" value={
                    data.gpsAgeMinutes != null
                        ? <Chip
                            label={`${data.gpsAgeMinutes} min ago`}
                            color={gpsStale ? 'warning' : 'success'}
                            size="small"
                        />
                        : null
                } />
                {data.gpsTimestamp && <InfoRow label="GPS Timestamp" value={data.gpsTimestamp} />}
            </SectionCard>
            {/* Admin Assignment */}
            <SectionCard
                icon={<AssignmentIcon sx={{ color: 'info.main', fontSize: 22 }} />}
                title="Admin Assignment (TblClearListAreaOrder)"
                color="info"
            >
                <InfoRow label="Assigned Area" value={data.assignedClearListAreaName} />
                <InfoRow label="Status" value={data.assignedStatusLabel} />
                <Typography variant="caption" sx={{
                    color: "text.secondary"
                }}>
                    This controls the row position (top/middle/bottom), NOT which area column the driver appears in.
                </Typography>
            </SectionCard>
            {/* Polygon-to-Area Mappings */}
            <SectionCard
                icon={<MapIcon sx={{ color: 'warning.main', fontSize: 22 }} />}
                title="Polygon Area Mappings"
                color="warning"
            >
                <Typography
                    variant="caption"
                    sx={{
                        color: "text.secondary",
                        display: 'block',
                        mb: 1.5
                    }}>
                    Which clear list areas this courier's GPS polygon is linked to. The driver appears in areas where
                    the channel matches.
                </Typography>
                {data.polygonAreaMappings.length === 0 ? (
                    <Alert severity="warning">
                        No polygon-to-area mappings found. This driver's GPS polygon is not linked to any clear list area.
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {data.polygonAreaMappings.map(m => (
                            <Box
                                key={m.clearListAreaId}
                                sx={(theme) => ({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    p: 1,
                                    borderRadius: 1,
                                    border: `1px solid ${theme.palette.divider}`,
                                    ...(m.channelMatches
                                        ? {
                                            bgcolor: alpha(theme.palette.success.main, 0.06),
                                            borderColor: theme.palette.success.light,
                                        }
                                        : {
                                            bgcolor: 'action.hover',
                                        }
                                    ),
                                })}
                            >
                                <Typography variant="body2" sx={{
                                    fontWeight: 600
                                }}>
                                    {m.clearListAreaName}
                                </Typography>
                                <Chip
                                    label={`Ch: ${m.areaChannelId}`}
                                    size="small"
                                />
                                <Chip
                                    label={m.channelMatches ? 'Channel Match' : 'No Match'}
                                    color={m.channelMatches ? 'success' : 'default'}
                                    size="small"
                                />
                            </Box>
                        ))}
                    </Box>
                )}
            </SectionCard>
        </Box>
    );
}
