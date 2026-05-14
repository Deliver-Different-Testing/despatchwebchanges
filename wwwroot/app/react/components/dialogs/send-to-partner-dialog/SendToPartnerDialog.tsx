/**
 * Send to Partner Dialog
 *
 * Shows the rate determination result (rate card, live quotes, or manual entry)
 * and lets the dispatcher confirm or override the rate before dispatching.
 */

import React, {useState, useEffect, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import HandshakeIcon from '@mui/icons-material/Handshake';
import type {PartnerRateForJobResponse, PartnerRateQuote} from '../../../services/jobListApi';

export interface SendToPartnerDialogProps {
    open: boolean;
    partnerId: number;
    partnerName: string;
    jobId: number;
    jobNo: string;
    onClose: () => void;
    onConfirm: (agreedRate: number) => Promise<void>;
    fetchRate: (pairingId: number, jobId: number) => Promise<PartnerRateForJobResponse>;
}

export const SendToPartnerDialog: React.FC<SendToPartnerDialogProps> = ({
    open,
    partnerId,
    partnerName,
    jobId,
    jobNo,
    onClose,
    onConfirm,
    fetchRate,
}) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [rateResult, setRateResult] = useState<PartnerRateForJobResponse | null>(null);
    const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number>(0);
    const [manualRate, setManualRate] = useState('');
    const [validationError, setValidationError] = useState('');
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        if (!open) return;
        setRateResult(null);
        setManualRate('');
        setSelectedQuoteIndex(0);
        setValidationError('');
        setSubmitError('');
        setSubmitting(false);

        setLoading(true);
        fetchRate(partnerId, jobId)
            .then((result) => {
                setRateResult(result);
                if (result.source === 'rate_card' && result.rateCardRate != null) {
                    setManualRate(result.rateCardRate.toFixed(2));
                } else if (result.source === 'live_quote' && result.liveQuotes.length > 0) {
                    setManualRate(result.liveQuotes[0].totalCharge.toFixed(2));
                }
            })
            .catch(() => {
                setRateResult({rateCardRate: null, liveQuotes: [], source: 'none'});
            })
            .finally(() => setLoading(false));
    }, [open, partnerId, jobId, fetchRate]);

    const handleQuoteSelect = useCallback((index: number, quote: PartnerRateQuote) => {
        setSelectedQuoteIndex(index);
        setManualRate(quote.totalCharge.toFixed(2));
    }, []);

    const handleConfirm = useCallback(async () => {
        const rate = parseFloat(manualRate);
        if (isNaN(rate) || rate <= 0) {
            setValidationError('Please enter a valid rate greater than zero');
            return;
        }
        setValidationError('');
        setSubmitError('');
        setSubmitting(true);
        try {
            await onConfirm(rate);
        } catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'Failed to send job to partner';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    }, [manualRate, onConfirm]);

    const isValid = () => {
        const rate = parseFloat(manualRate);
        return !isNaN(rate) && rate > 0;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
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
                    <HandshakeIcon sx={{fontSize: 28}}/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h5" fontWeight={600}>
                        Send to Partner
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Job {jobNo} &rarr; {partnerName}
                    </Typography>
                </Box>
                <IconButton
                    aria-label="Close dialog"
                    onClick={onClose}
                    disabled={submitting}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon/>
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 3,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5,
                    })}
                >
                    {loading && (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                            <CircularProgress size={32}/>
                            <Typography sx={{ml: 2}} color="text.secondary">Looking up rate...</Typography>
                        </Box>
                    )}

                    {!loading && rateResult && (
                        <>
                            {/* Rate card result */}
                            {rateResult.source === 'rate_card' && rateResult.rateCardRate != null && (
                                <Alert severity="success" icon={false}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                        <Chip label="Rate Card" size="small" color="success"/>
                                        <Typography variant="body1">
                                            Pre-agreed rate: <strong>${rateResult.rateCardRate.toFixed(2)}</strong>
                                        </Typography>
                                    </Box>
                                </Alert>
                            )}

                            {/* Live quotes */}
                            {rateResult.source === 'live_quote' && rateResult.liveQuotes.length > 0 && (
                                <Box>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                                        <Chip label="Live Quote" size="small" color="info"/>
                                        <Typography variant="body2" color="text.secondary">
                                            {rateResult.liveQuotes.length} rate{rateResult.liveQuotes.length > 1 ? 's' : ''} from partner
                                        </Typography>
                                    </Box>
                                    <RadioGroup value={selectedQuoteIndex}>
                                        {rateResult.liveQuotes.map((quote, index) => (
                                            <FormControlLabel
                                                key={index}
                                                value={index}
                                                control={<Radio size="small"/>}
                                                onClick={() => handleQuoteSelect(index, quote)}
                                                label={
                                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                        <Typography variant="body2">
                                                            {quote.serviceName} — <strong>${quote.totalCharge.toFixed(2)} {quote.currency}</strong>
                                                        </Typography>
                                                        {quote.transitDays != null && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({quote.transitDays}d transit)
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                }
                                            />
                                        ))}
                                    </RadioGroup>
                                </Box>
                            )}

                            {/* No rate found */}
                            {rateResult.source === 'none' && (
                                <Alert severity="info">
                                    No pre-agreed rate or live quote available. Enter a rate manually.
                                </Alert>
                            )}

                            {/* Manual rate entry — always visible */}
                            <TextField
                                label="Agreed Rate"
                                type="number"
                                value={manualRate}
                                onChange={(e) => {
                                    setManualRate(e.target.value);
                                    setValidationError('');
                                }}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    },
                                    htmlInput: {min: 0, step: '0.01'},
                                }}
                                helperText={validationError || (rateResult.source !== 'none'
                                    ? 'You can override the suggested rate'
                                    : 'Enter the rate agreed with the partner')}
                                error={!!validationError}
                                fullWidth
                                size="small"
                                disabled={submitting}
                            />

                            {submitError && (
                                <Alert severity="error" variant="outlined" sx={{alignItems: 'flex-start'}}>
                                    {submitError}
                                </Alert>
                            )}
                        </>
                    )}
                </Paper>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'background.paper',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button onClick={onClose} variant="outlined" disabled={submitting} sx={{minWidth: 100}}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={loading || !isValid() || submitting}
                    startIcon={submitting ? <CircularProgress size={16}/> : <SendIcon/>}
                    sx={{minWidth: 140}}
                >
                    {submitting ? 'Sending...' : 'Confirm & Send'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
