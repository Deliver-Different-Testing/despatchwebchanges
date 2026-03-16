/**
 * React Swap PODs Dialog
 *
 * Allows operators to move a POD signature from one job to another,
 * correcting cases where a driver signed off the wrong job.
 *
 * Two-phase flow:
 *   Phase 1 — Input:   Enter second job number and validate
 *   Phase 2 — Confirm: Review both job numbers and confirm the swap
 */

import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type {ShowToastFn} from '../../../services/toastService';

export interface SwapPodsDialogProps {
    open: boolean;
    jobNo: string;
    onClose: () => void;
    onValidate: (jobNo: string) => Promise<boolean>;
    onSwap: (job1: string, job2: string) => Promise<void>;
    showToast: ShowToastFn;
}

type Phase = 'input' | 'confirm';

export function SwapPodsDialog({
    open,
    jobNo,
    onClose,
    onValidate,
    onSwap,
    showToast,
}: SwapPodsDialogProps): React.ReactElement | null {
    const [secondJobNo, setSecondJobNo] = useState('');
    const [phase, setPhase] = useState<Phase>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when the dialog opens
    React.useEffect(() => {
        if (open) {
            setSecondJobNo('');
            setPhase('input');
            setLoading(false);
            setError(null);
        }
    }, [open]);

    const handleValidate = async (): Promise<void> => {
        const trimmed = secondJobNo.trim();
        if (!trimmed) {
            setError('Please enter a job number.');
            return;
        }

        if (trimmed === jobNo) {
            setError('The second job cannot be the same as the current job.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const isValid = await onValidate(trimmed);
            if (isValid) {
                setPhase('confirm');
            } else {
                setError(`Job ${trimmed} is not eligible for a POD swap.`);
            }
        } catch {
            setError('Failed to validate job. Please check the job number and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSwap = async (): Promise<void> => {
        setLoading(true);
        try {
            await onSwap(jobNo, secondJobNo.trim());
            showToast('PODs swapped successfully.', 'success');
            onClose();
        } catch {
            showToast('An error occurred while swapping PODs. Please try again.', 'error');
            setLoading(false);
        }
    };

    const handleBackToInput = (): void => {
        setPhase('input');
        setError(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Enter' && phase === 'input' && !loading) {
            handleValidate();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: 440,
                        maxWidth: 520,
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
                    <SwapHorizIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        Swap PODs
                    </Typography>
                    <Typography variant="caption" sx={{opacity: 0.85}}>
                        Move a POD signature between two jobs
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={loading}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                {/* Info banner */}
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 2,
                        mb: 3,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.info.main, 0.08),
                        borderLeft: `4px solid ${theme.palette.info.main}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                    })}
                >
                    <InfoIcon sx={(theme) => ({color: theme.palette.info.dark, fontSize: 20, mt: 0.1})} />
                    <Typography variant="body2" color="text.primary">
                        This will move the POD signature from <strong>{jobNo}</strong> to the job you specify, and vice versa.
                    </Typography>
                </Paper>

                {phase === 'input' ? (
                    /* Phase 1 — Input */
                    <Box>
                        {/* Current job (read-only) */}
                        <TextField
                            fullWidth
                            label="Current job"
                            value={jobNo}
                            disabled
                            size="small"
                            sx={{
                                mb: 2,
                                '& .MuiOutlinedInput-root': {bgcolor: 'white'},
                            }}
                        />

                        {/* Second job input */}
                        <TextField
                            fullWidth
                            label="Second job number"
                            placeholder="Enter job number"
                            value={secondJobNo}
                            onChange={(e) => {
                                setSecondJobNo(e.target.value);
                                if (error) setError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            error={!!error}
                            helperText={error ?? ' '}
                            autoFocus
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {bgcolor: 'white'},
                            }}
                        />
                    </Box>
                ) : (
                    /* Phase 2 — Confirm */
                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            p: 2.5,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: 'white',
                        })}
                    >
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                            <CheckCircleIcon color="success" sx={{fontSize: 20}} />
                            <Typography variant="subtitle2" fontWeight={600}>
                                Ready to swap
                            </Typography>
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                            <Box
                                sx={(theme) => ({
                                    flex: 1,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                    textAlign: 'center',
                                })}
                            >
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Job 1
                                </Typography>
                                <Typography variant="h6" fontWeight={700} color="primary.main">
                                    {jobNo}
                                </Typography>
                            </Box>
                            <SwapHorizIcon sx={{color: 'text.secondary', fontSize: 28}} />
                            <Box
                                sx={(theme) => ({
                                    flex: 1,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                    textAlign: 'center',
                                })}
                            >
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Job 2
                                </Typography>
                                <Typography variant="h6" fontWeight={700} color="primary.main">
                                    {secondJobNo.trim()}
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                )}
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                {phase === 'input' ? (
                    <>
                        <Button
                            onClick={onClose}
                            variant="outlined"
                            disabled={loading}
                            sx={{minWidth: 90}}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleValidate}
                            variant="contained"
                            disabled={loading || !secondJobNo.trim()}
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SwapHorizIcon />}
                            sx={{minWidth: 110}}
                        >
                            {loading ? 'Validating...' : 'Validate'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={handleBackToInput}
                            variant="outlined"
                            disabled={loading}
                            sx={{minWidth: 90}}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleConfirmSwap}
                            variant="contained"
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SwapHorizIcon />}
                            sx={{minWidth: 140}}
                        >
                            {loading ? 'Swapping...' : 'Confirm Swap'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default SwapPodsDialog;
