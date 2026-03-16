import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import { AiMarkdownRenderer } from '../../common/ai-summary-panel/AiMarkdownRenderer';
import { suggestCouriers, AiCourierSuggestionResponse, SuggestedCourier } from '../../../services/aiAssistantApi';

export interface AiCourierSuggestionsDialogProps {
    open: boolean;
    onClose: () => void;
    jobId: number;
    jobNo: string;
    onAssign: (courierId: number) => Promise<void>;
}

type DialogPhase = 'loading' | 'loaded' | 'error' | 'assigned';

export const AiCourierSuggestionsDialog: React.FC<AiCourierSuggestionsDialogProps> = ({
    open,
    onClose,
    jobId,
    jobNo,
    onAssign,
}) => {
    const [phase, setPhase] = useState<DialogPhase>('loading');
    const [data, setData] = useState<AiCourierSuggestionResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [assigningId, setAssigningId] = useState<number | null>(null);
    const [assignedName, setAssignedName] = useState('');

    const fetchSuggestions = useCallback(async () => {
        setPhase('loading');
        setErrorMessage('');
        try {
            const response = await suggestCouriers(jobId);
            setData(response);
            setPhase('loaded');
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to get courier suggestions');
            setPhase('error');
        }
    }, [jobId]);

    useEffect(() => {
        if (open) {
            fetchSuggestions();
        }
        return () => {
            setPhase('loading');
            setData(null);
            setAssigningId(null);
            setAssignedName('');
        };
    }, [open, fetchSuggestions]);

    const handleAssign = async (courier: SuggestedCourier) => {
        setAssigningId(courier.courierId);
        setErrorMessage('');
        try {
            await onAssign(courier.courierId);
            setAssignedName(courier.firstName || courier.code);
            setPhase('assigned');
            setTimeout(() => onClose(), 1200);
        } catch (err: unknown) {
            setAssigningId(null);
            setErrorMessage(err instanceof Error ? err.message : 'Failed to assign courier');
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    bgcolor: 'info.main',
                    color: 'info.contrastText',
                }}
            >
                <AutoAwesomeIcon sx={{ fontSize: 22 }} />
                <Typography
                    variant="h6"
                    sx={{ flex: 1, fontSize: '1.05rem', fontWeight: 500 }}
                >
                    AI Courier Suggestions — {jobNo}
                </Typography>
                <Chip
                    label="BETA"
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'inherit',
                        letterSpacing: '0.05em',
                    }}
                />
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{
                        color: 'inherit',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <DialogContent sx={{ flex: 1, overflow: 'auto', py: 2 }}>
                {/* Loading state */}
                {phase === 'loading' && (
                    <Box>
                        <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1 }} />
                        <Skeleton variant="text" width="90%" />
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="85%" sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            {[1, 2, 3].map((i) => (
                                <Skeleton
                                    key={i}
                                    variant="rounded"
                                    width={160}
                                    height={72}
                                    sx={{ borderRadius: 2 }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Error state */}
                {phase === 'error' && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMessage}
                        </Alert>
                        <Button variant="outlined" onClick={fetchSuggestions}>
                            Retry
                        </Button>
                    </Box>
                )}

                {/* Success — assigned */}
                {phase === 'assigned' && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckCircleIcon
                            sx={{ fontSize: 48, color: 'success.main', mb: 1 }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                            Assigned to {assignedName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Job {jobNo} has been dispatched
                        </Typography>
                    </Box>
                )}

                {/* Loaded state */}
                {phase === 'loaded' && data && (
                    <Box>
                        {/* AI Reasoning */}
                        <Box sx={{ mb: 2 }}>
                            <AiMarkdownRenderer content={data.summary} />
                        </Box>

                        {/* Assign error */}
                        {errorMessage && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {errorMessage}
                            </Alert>
                        )}

                        {/* Courier cards */}
                        {data.couriers.length > 0 ? (
                            <>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ mb: 1, fontWeight: 600 }}
                                >
                                    Quick Assign
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1.5,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    {data.couriers.map((courier) => (
                                        <Paper
                                            key={courier.courierId}
                                            variant="outlined"
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                px: 2,
                                                py: 1.5,
                                                borderRadius: 2,
                                                minWidth: 180,
                                                borderColor: 'divider',
                                                '&:hover': {
                                                    borderColor: 'info.light',
                                                    bgcolor: 'action.hover',
                                                },
                                            }}
                                        >
                                            <PersonIcon
                                                sx={{
                                                    color: 'info.main',
                                                    fontSize: 20,
                                                }}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 600,
                                                        lineHeight: 1.3,
                                                    }}
                                                    noWrap
                                                >
                                                    {courier.firstName}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {courier.code}
                                                </Typography>
                                            </Box>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="info"
                                                disabled={assigningId !== null}
                                                onClick={() =>
                                                    handleAssign(courier)
                                                }
                                                sx={{
                                                    minWidth: 64,
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {assigningId ===
                                                courier.courierId ? (
                                                    <CircularProgress
                                                        size={18}
                                                        color="inherit"
                                                    />
                                                ) : (
                                                    'Assign'
                                                )}
                                            </Button>
                                        </Paper>
                                    ))}
                                </Box>
                            </>
                        ) : (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                No matched couriers available for one-click
                                assignment. Use the suggestions above to find
                                and assign a courier manually.
                            </Alert>
                        )}
                    </Box>
                )}
            </DialogContent>

            {phase !== 'assigned' && (
                <DialogActions>
                    <Button onClick={onClose} color="inherit">
                        Close
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};
