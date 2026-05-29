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
import type {SxProps, Theme} from '@mui/material';
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

const SECTION_LABEL_SX = {
    color: 'text.secondary',
    fontWeight: 500,
    mb: 1,
} satisfies SxProps<Theme>;

const SECTION_PAPER_SX = {
    bgcolor: 'white',
    borderRadius: 3,
    p: 2.5,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

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
                // Pre-fill the input with whatever rate IM is going to USE — not what the
                // operator might prefer to see. For Mode 2/3 the operator's typed value is
                // ignored anyway, so showing the substituted value upfront avoids surprise.
                if (result.source === 'rate_card' && result.rateCardRate != null) {
                    setManualRate(result.rateCardRate.toFixed(2));
                } else if (result.source === 'live_quote' && result.liveQuotes.length > 0) {
                    setManualRate(result.liveQuotes[0].totalCharge.toFixed(2));
                } else if (result.source === 'percentage' && result.derivedRate != null) {
                    setManualRate(result.derivedRate.toFixed(2));
                } else if (result.source === 'cost_plus' && result.liveQuotes.length > 0) {
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
                        flexShrink: 0,
                    }}
                >
                    <HandshakeIcon sx={{fontSize: 24}}/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>Send to Partner</Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Job {jobNo} &middot; {partnerName}
                    </Typography>
                </Box>
                <IconButton
                    aria-label="Close dialog"
                    onClick={onClose}
                    disabled={submitting}
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon/>
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {loading && (
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 3}}>
                            <CircularProgress size={24}/>
                            <Typography variant="body2" color="text.secondary">
                                Looking up rate...
                            </Typography>
                        </Box>
                    )}

                    {!loading && rateResult && (
                        <>
                            {/* Pricing section */}
                            <Box>
                                <Typography variant="body2" sx={SECTION_LABEL_SX}>Pricing</Typography>

                                {rateResult.source === 'rate_card' && rateResult.rateCardRate != null && (
                                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                                            <Chip label="Rate Card" size="small" color="primary" variant="outlined"/>
                                            <Typography variant="body2">
                                                Pre-agreed rate: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.rateCardRate.toFixed(2)}</Box>
                                            </Typography>
                                        </Box>
                                    </Paper>
                                )}

                                {rateResult.source === 'live_quote' && rateResult.liveQuotes.length > 0 && (
                                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1}}>
                                            <Chip label="Live Quote" size="small" color="primary" variant="outlined"/>
                                            <Typography variant="body2" color="text.secondary">
                                                {rateResult.liveQuotes.length} rate{rateResult.liveQuotes.length > 1 ? 's' : ''} from partner
                                            </Typography>
                                        </Box>
                                        <RadioGroup value={selectedQuoteIndex}>
                                            {rateResult.liveQuotes.map((quote, index) => (
                                                <FormControlLabel
                                                    key={index}
                                                    value={index}
                                                    onClick={() => handleQuoteSelect(index, quote)}
                                                    control={<Radio size="small"/>}
                                                    label={
                                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                            <Typography variant="body2">
                                                                {quote.serviceName} &mdash; <Box component="strong" sx={{fontWeight: 700}}>${quote.totalCharge.toFixed(2)} {quote.currency}</Box>
                                                            </Typography>
                                                            {quote.transitDays != null && (
                                                                <Typography variant="caption" color="text.disabled">
                                                                    ({quote.transitDays}d transit)
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                            ))}
                                        </RadioGroup>
                                    </Paper>
                                )}

                                {rateResult.source === 'percentage' && rateResult.derivedRate != null && (
                                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                                            <Chip label="Percentage" size="small" color="primary" variant="outlined"/>
                                            <Typography variant="body2">
                                                Partner will be paid <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRate.toFixed(2)}</Box>
                                                {rateResult.percentageOfClientCharge != null && (
                                                    <> ({rateResult.percentageOfClientCharge}% of the job amount)</>
                                                )}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.5}}>
                                            IM substitutes this rate at dispatch &mdash; any value you type below will be ignored.
                                        </Typography>
                                    </Paper>
                                )}

                                {rateResult.source === 'cost_plus' && rateResult.liveQuotes.length > 0 && (
                                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap'}}>
                                            <Chip label="Cost Plus" size="small" color="primary" variant="outlined"/>
                                            <Typography variant="body2">
                                                Partner quote: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.liveQuotes[0].totalCharge.toFixed(2)}</Box>
                                                {rateResult.marginPercent != null && rateResult.derivedRevenue != null && (
                                                    <> &middot; margin {rateResult.marginPercent}% &rarr; revenue <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRevenue.toFixed(2)}</Box></>
                                                )}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.5}}>
                                            IM will use the partner quote at dispatch and rewrite the job amount to the margin-adjusted revenue.
                                        </Typography>
                                    </Paper>
                                )}

                                {rateResult.source === 'none' && (
                                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                        <Typography variant="body2" color="text.secondary">
                                            {rateResult.message ?? 'No pre-agreed rate or live quote available. Enter a rate manually.'}
                                        </Typography>
                                    </Paper>
                                )}
                            </Box>

                            {/* Agreed Rate section */}
                            <Box>
                                <Typography variant="body2" sx={SECTION_LABEL_SX}>Agreed Rate</Typography>
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
                                    helperText={
                                        validationError ||
                                        (rateResult.source === 'percentage' || rateResult.source === 'cost_plus'
                                            ? 'IM will substitute this rate at dispatch — input is informational only'
                                            : rateResult.source !== 'none'
                                                ? 'You can override the suggested rate'
                                                : 'Enter the rate agreed with the partner')
                                    }
                                    error={!!validationError}
                                    fullWidth
                                    size="small"
                                    disabled={submitting}
                                    sx={{'& .MuiOutlinedInput-root': {bgcolor: 'white'}}}
                                />
                            </Box>

                            {submitError && (
                                <Alert severity="error">{submitError}</Alert>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>

            {/* Footer */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button
                    onClick={onClose}
                    variant="outlined"
                    disabled={submitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    disabled={loading || !isValid() || submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit"/> : <SendIcon/>}
                    sx={{minWidth: 100}}
                >
                    {submitting ? 'Sending...' : 'Confirm & Send'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
