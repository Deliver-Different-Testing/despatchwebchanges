/**
 * Send to Partner Dialog
 *
 * Shows the rate determination result (rate card, live quotes, or manual entry)
 * and lets the dispatcher confirm or override the rate before dispatching.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {alpha, useTheme} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
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
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'text.secondary',
    mb: '6px',
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
    const theme = useTheme();
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

    const chipSx = {
        background: alpha(theme.palette.primary.main, 0.08),
        color: theme.palette.primary.dark,
        border: `1.5px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        borderRadius: 5,
        fontSize: 13,
        fontWeight: 500,
        height: 24,
    } satisfies SxProps<Theme>;

    const calloutSx = {
        border: '1.5px solid',
        borderColor: 'grey.200',
        borderRadius: 2,
        bgcolor: 'grey.50',
        p: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    } satisfies SxProps<Theme>;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: 3.5,
                        overflow: 'hidden',
                        maxHeight: 'calc(100vh - 48px)',
                    },
                },
            }}
        >
            {/* Header */}
            <DialogTitle
                sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                    p: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{display: 'flex', alignItems: 'center', gap: '14px'}}>
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2.5,
                            background: alpha(theme.palette.primary.contrastText, 0.15),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <HandshakeIcon sx={{color: theme.palette.primary.contrastText, fontSize: 20}}/>
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                color: theme.palette.primary.contrastText,
                                fontWeight: 700,
                                fontSize: 17,
                                letterSpacing: '-0.2px',
                            }}
                        >
                            Send to Partner
                        </Typography>
                        <Typography
                            sx={{
                                color: alpha(theme.palette.primary.contrastText, 0.65),
                                fontSize: 13,
                                mt: '2px',
                            }}
                        >
                            Job {jobNo} &middot; {partnerName}
                        </Typography>
                    </Box>
                </Box>
                <IconButton
                    aria-label="Close dialog"
                    onClick={onClose}
                    disabled={submitting}
                    sx={{
                        background: alpha(theme.palette.primary.contrastText, 0.15),
                        color: alpha(theme.palette.primary.contrastText, 0.8),
                        width: 34,
                        height: 34,
                        '&:hover': {background: alpha(theme.palette.primary.contrastText, 0.25)},
                    }}
                >
                    <CloseIcon sx={{fontSize: 18}}/>
                </IconButton>
            </DialogTitle>

            {/* Content */}
            <DialogContent sx={{p: '20px 22px 8px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                {loading && (
                    <Box sx={{...calloutSx, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px', py: '20px'}}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: 13, color: 'text.secondary'}}>
                            Looking up rate...
                        </Typography>
                    </Box>
                )}

                {!loading && rateResult && (
                    <>
                        {/* Pricing Mode section */}
                        <Box sx={{mb: '14px'}}>
                            <Typography sx={SECTION_LABEL_SX}>Pricing Mode</Typography>

                            {/* Rate card result */}
                            {rateResult.source === 'rate_card' && rateResult.rateCardRate != null && (
                                <Box sx={calloutSx}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <Chip label="Rate Card" size="small" sx={chipSx}/>
                                        <Typography sx={{fontSize: 14, color: 'text.primary'}}>
                                            Pre-agreed rate: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.rateCardRate.toFixed(2)}</Box>
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Live quotes */}
                            {rateResult.source === 'live_quote' && rateResult.liveQuotes.length > 0 && (
                                <Box sx={calloutSx}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <Chip label="Live Quote" size="small" sx={chipSx}/>
                                        <Typography sx={{fontSize: 13, color: 'text.secondary'}}>
                                            {rateResult.liveQuotes.length} rate{rateResult.liveQuotes.length > 1 ? 's' : ''} from partner
                                        </Typography>
                                    </Box>
                                    <RadioGroup value={selectedQuoteIndex} sx={{gap: '4px', mt: '4px'}}>
                                        {rateResult.liveQuotes.map((quote, index) => {
                                            const isSelected = selectedQuoteIndex === index;
                                            return (
                                                <FormControlLabel
                                                    key={index}
                                                    value={index}
                                                    onClick={() => handleQuoteSelect(index, quote)}
                                                    control={<Radio size="small" sx={{p: '6px'}}/>}
                                                    sx={{
                                                        m: 0,
                                                        p: '6px 10px',
                                                        borderRadius: 1.5,
                                                        border: '1.5px solid',
                                                        borderColor: isSelected ? theme.palette.primary.main : 'grey.200',
                                                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        transition: 'border-color 0.15s ease, background-color 0.15s ease',
                                                        '& .MuiFormControlLabel-label': {flex: 1},
                                                    }}
                                                    label={
                                                        <Box sx={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                            <Typography sx={{fontSize: 13, color: 'text.primary'}}>
                                                                {quote.serviceName} &mdash; <Box component="strong" sx={{fontWeight: 700}}>${quote.totalCharge.toFixed(2)} {quote.currency}</Box>
                                                            </Typography>
                                                            {quote.transitDays != null && (
                                                                <Typography sx={{fontSize: 12, color: 'text.disabled'}}>
                                                                    ({quote.transitDays}d transit)
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                            );
                                        })}
                                    </RadioGroup>
                                </Box>
                            )}

                            {/* Mode 2 — Percentage of client charge */}
                            {rateResult.source === 'percentage' && rateResult.derivedRate != null && (
                                <Box sx={calloutSx}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <Chip label="Percentage" size="small" sx={chipSx}/>
                                        <Typography sx={{fontSize: 14, color: 'text.primary'}}>
                                            Partner will be paid <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRate.toFixed(2)}</Box>
                                            {rateResult.percentageOfClientCharge != null && (
                                                <> ({rateResult.percentageOfClientCharge}% of the job amount)</>
                                            )}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{fontSize: 12, color: 'text.disabled', mt: '2px'}}>
                                        IM substitutes this rate at dispatch &mdash; any value you type below will be ignored.
                                    </Typography>
                                </Box>
                            )}

                            {/* Mode 3 — Cost Plus */}
                            {rateResult.source === 'cost_plus' && rateResult.liveQuotes.length > 0 && (
                                <Box sx={calloutSx}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
                                        <Chip label="Cost Plus" size="small" sx={chipSx}/>
                                        <Typography sx={{fontSize: 14, color: 'text.primary'}}>
                                            Partner quote: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.liveQuotes[0].totalCharge.toFixed(2)}</Box>
                                            {rateResult.marginPercent != null && rateResult.derivedRevenue != null && (
                                                <> &middot; margin {rateResult.marginPercent}% &rarr; revenue <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRevenue.toFixed(2)}</Box></>
                                            )}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{fontSize: 12, color: 'text.disabled', mt: '2px'}}>
                                        IM will use the partner quote at dispatch and rewrite the job amount to the margin-adjusted revenue.
                                    </Typography>
                                </Box>
                            )}

                            {/* No rate found */}
                            {rateResult.source === 'none' && (
                                <Box sx={calloutSx}>
                                    <Typography sx={{fontSize: 13, color: 'text.secondary'}}>
                                        {rateResult.message ?? 'No pre-agreed rate or live quote available. Enter a rate manually.'}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Agreed Rate section */}
                        <Box sx={{mb: '14px'}}>
                            <Typography sx={SECTION_LABEL_SX}>Agreed Rate</Typography>
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
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        background: theme.palette.grey[50],
                                        fontSize: 14,
                                    },
                                }}
                            />
                        </Box>

                        {submitError && (
                            <Box
                                sx={{
                                    border: `1.5px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                    borderRadius: 2,
                                    bgcolor: alpha(theme.palette.error.main, 0.06),
                                    p: '10px 14px',
                                    mb: '8px',
                                }}
                            >
                                <Typography sx={{fontSize: 13, color: 'error.main', fontWeight: 500}}>
                                    {submitError}
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            {/* Footer */}
            <DialogActions
                sx={{
                    p: '14px 22px 18px',
                    borderTop: '1px solid',
                    borderColor: 'grey.200',
                }}
            >
                <Button
                    onClick={onClose}
                    disabled={submitting}
                    sx={{
                        borderRadius: 2,
                        border: '1.5px solid',
                        borderColor: 'grey.300',
                        background: 'transparent',
                        color: 'text.secondary',
                        fontSize: 14,
                        fontWeight: 600,
                        textTransform: 'none',
                        px: '18px',
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={loading || !isValid() || submitting}
                    startIcon={submitting ? <CircularProgress size={16} sx={{color: 'inherit'}}/> : <SendIcon sx={{fontSize: 16}}/>}
                    sx={{
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                        color: theme.palette.primary.contrastText,
                        fontSize: 14,
                        fontWeight: 700,
                        textTransform: 'none',
                        px: '20px',
                        '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 100%)`,
                        },
                        '&.Mui-disabled': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                            color: theme.palette.primary.contrastText,
                            opacity: 0.55,
                        },
                    }}
                >
                    {submitting ? 'Sending...' : 'Confirm & Send'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
