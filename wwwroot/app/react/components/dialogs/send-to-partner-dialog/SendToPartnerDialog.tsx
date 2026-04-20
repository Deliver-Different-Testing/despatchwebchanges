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
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setRateResult(null);
        setManualRate('');
        setSelectedQuoteIndex(0);
        setError('');
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
            setError('Please enter a valid rate greater than zero');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            await onConfirm(rate);
        } catch {
            setError('Failed to send job to partner');
        } finally {
            setSubmitting(false);
        }
    }, [manualRate, onConfirm]);

    const isValid = () => {
        const rate = parseFloat(manualRate);
        return !isNaN(rate) && rate > 0;
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2}}>
                <Box>
                    <Typography variant="h6">Send to Partner</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Job {jobNo} &rarr; {partnerName}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small" disabled={submitting}>
                    <CloseIcon/>
                </IconButton>
            </Box>

            <DialogContent>
                {loading && (
                    <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                        <CircularProgress size={32}/>
                        <Typography sx={{ml: 2}} color="text.secondary">Looking up rate...</Typography>
                    </Box>
                )}

                {!loading && rateResult && (
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
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
                                setError('');
                            }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            inputProps={{min: 0, step: '0.01'}}
                            helperText={rateResult.source !== 'none'
                                ? 'You can override the suggested rate'
                                : 'Enter the rate agreed with the partner'}
                            error={!!error}
                            fullWidth
                            size="small"
                            disabled={submitting}
                        />

                        {error && <Typography variant="caption" color="error">{error}</Typography>}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{px: 3, pb: 2}}>
                <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={loading || !isValid() || submitting}
                    startIcon={submitting ? <CircularProgress size={16}/> : <SendIcon/>}
                >
                    {submitting ? 'Sending...' : 'Confirm & Send'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
