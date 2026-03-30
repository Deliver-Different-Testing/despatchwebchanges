import React, { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import type { IClearListDebugViewModel } from '../../../../interfaces/job.interface';

async function fetchClearListDebug(courierId: number): Promise<IClearListDebugViewModel> {
    const response = await fetch(`/courier/ClearListDebug?courierId=${courierId}`);
    if (!response.ok) throw new Error(`Failed to fetch debug info: ${response.statusText}`);
    return response.json();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 160, color: 'text.secondary' }}>
                {label}:
            </Typography>
            <Typography variant="body2" component="div" sx={{ flex: 1 }}>
                {value ?? <span style={{ color: '#999' }}>N/A</span>}
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
        } catch (err: any) {
            setError(err.message || 'Failed to load debug info');
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
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Clear List Debug
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {data && !loading && <DebugContent data={data} />}
                </DialogContent>
            </Dialog>
        </>
    );
}

function DebugContent({ data }: { data: IClearListDebugViewModel }) {
    const gpsStale = data.gpsAgeMinutes != null && data.gpsAgeMinutes > 3;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Explanation */}
            <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                <Typography variant="body2">{data.explanation}</Typography>
            </Alert>

            {/* Courier Info */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Courier
                </Typography>
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
            </Box>

            <Divider />

            {/* GPS Info */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    GPS Location
                </Typography>
                <InfoRow label="Polygon ID" value={data.gpsPolygonId} />
                <InfoRow label="Polygon Name" value={data.gpsPolygonName} />
                {data.gpsPolygonSuburbs.length > 0 && (
                    <InfoRow label="Suburbs in Polygon" value={
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {data.gpsPolygonSuburbs.map(s => (
                                <Chip key={s} label={s} size="small" variant="outlined" />
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
            </Box>

            <Divider />

            {/* Admin Assignment */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Admin Assignment (TblClearListAreaOrder)
                </Typography>
                <InfoRow label="Assigned Area" value={data.assignedClearListAreaName} />
                <InfoRow label="Status" value={data.assignedStatusLabel} />
                <Typography variant="caption" color="text.secondary">
                    This controls the row position (top/middle/bottom), NOT which area column the driver appears in.
                </Typography>
            </Box>

            <Divider />

            {/* Polygon-to-Area Mappings */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Polygon Area Mappings
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
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
                            <Box key={m.clearListAreaId} sx={{
                                display: 'flex', alignItems: 'center', gap: 1,
                                p: 1, borderRadius: 1,
                                backgroundColor: m.channelMatches ? 'success.50' : 'grey.100',
                                border: '1px solid',
                                borderColor: m.channelMatches ? 'success.200' : 'grey.300',
                            }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {m.clearListAreaName}
                                </Typography>
                                <Chip
                                    label={`Ch: ${m.areaChannelId}`}
                                    size="small"
                                    variant="outlined"
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
            </Box>
        </Box>
    );
}
