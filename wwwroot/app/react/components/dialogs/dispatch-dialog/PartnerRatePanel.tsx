/**
 * PartnerRatePanel
 *
 * Renders the rate determination result for a given (partner, job) pair and
 * lets the dispatcher confirm or override the agreed rate. Extracted from the
 * original SendToPartnerDialog so it can sit inside the universal DispatchDialog.
 *
 * The panel owns its own rate state (loading, rateResult, manualRate, validation)
 * and emits the chosen rate + validity upward via onRateChange so the parent
 * dialog can drive the Confirm button.
 */

import React, {useEffect, useState, useCallback} from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import type {SxProps, Theme} from '@mui/material';
import type {PartnerRateForJobResponse, PartnerRateQuote} from '../../../services/jobListApi';

export interface PartnerRatePanelProps {
    partnerId: number;
    jobId: number;
    fetchRate: (pairingId: number, jobId: number) => Promise<PartnerRateForJobResponse>;
    /** Called whenever the operator-chosen rate or its validity changes. */
    onRateChange: (rate: number, valid: boolean) => void;
    /** Disables the rate input (used while the parent submits). */
    disabled?: boolean;
}

const SECTION_LABEL_SX = {
    color: 'text.secondary',
    fontWeight: 500,
    mb: 1,
} satisfies SxProps<Theme>;

const SECTION_PAPER_SX = {
    bgcolor: 'background.paper',
    borderRadius: 3,
    p: 2.5,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

export const PartnerRatePanel: React.FC<PartnerRatePanelProps> = ({
    partnerId,
    jobId,
    fetchRate,
    onRateChange,
    disabled,
}) => {
    const [loading, setLoading] = useState(false);
    const [rateResult, setRateResult] = useState<PartnerRateForJobResponse | null>(null);
    const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number>(0);
    const [manualRate, setManualRate] = useState('');
    const [validationError, setValidationError] = useState('');

    // Emit the current rate + validity upward whenever it changes so the
    // parent's Confirm button stays in sync.
    useEffect(() => {
        const rate = parseFloat(manualRate);
        const valid = !isNaN(rate) && rate > 0;
        onRateChange(valid ? rate : 0, valid);
    }, [manualRate, onRateChange]);

    useEffect(() => {
        if (!partnerId || !jobId) return;
        setRateResult(null);
        setManualRate('');
        setSelectedQuoteIndex(0);
        setValidationError('');
        setLoading(true);

        fetchRate(partnerId, jobId)
            .then((result) => {
                setRateResult(result);
                // Pre-fill with the rate IM will actually use — for Mode 2/3 the
                // operator's typed value is ignored, so showing the substituted
                // value upfront avoids surprise.
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
    }, [partnerId, jobId, fetchRate]);

    const handleQuoteSelect = useCallback((index: number, quote: PartnerRateQuote) => {
        setSelectedQuoteIndex(index);
        setManualRate(quote.totalCharge.toFixed(2));
    }, []);

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 3}}>
                <CircularProgress size={24}/>
                <Typography variant="body2" sx={{
                    color: "text.secondary"
                }}>
                    Looking up rate...
                </Typography>
            </Box>
        );
    }

    if (!rateResult) return null;

    return (
        <>
            <Box>
                <Typography variant="body2" sx={SECTION_LABEL_SX}>Pricing</Typography>

                {rateResult.source === 'rate_card' && rateResult.rateCardRate != null && (
                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                            <Chip label="Rate Card" size="small" color="primary"/>
                            <Typography variant="body2">
                                Pre-agreed rate: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.rateCardRate.toFixed(2)}</Box>
                            </Typography>
                        </Box>
                    </Paper>
                )}

                {rateResult.source === 'live_quote' && rateResult.liveQuotes.length > 0 && (
                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1}}>
                            <Chip label="Live Quote" size="small" color="primary"/>
                            <Typography variant="body2" sx={{
                                color: "text.secondary"
                            }}>
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
                                                <Typography variant="caption" sx={{
                                                    color: "text.disabled"
                                                }}>
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
                            <Chip label="Percentage" size="small" color="primary"/>
                            <Typography variant="body2">
                                Partner will be paid <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRate.toFixed(2)}</Box>
                                {rateResult.percentageOfClientCharge != null && (
                                    <> ({rateResult.percentageOfClientCharge}% of the job amount)</>
                                )}
                            </Typography>
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.disabled",
                                display: 'block',
                                mt: 0.5
                            }}>
                            IM substitutes this rate at dispatch &mdash; any value you type below will be ignored.
                        </Typography>
                    </Paper>
                )}

                {rateResult.source === 'cost_plus' && rateResult.liveQuotes.length > 0 && (
                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap'}}>
                            <Chip label="Cost Plus" size="small" color="primary"/>
                            <Typography variant="body2">
                                Partner quote: <Box component="strong" sx={{fontWeight: 700}}>${rateResult.liveQuotes[0].totalCharge.toFixed(2)}</Box>
                                {rateResult.marginPercent != null && rateResult.derivedRevenue != null && (
                                    <> &middot; margin {rateResult.marginPercent}% &rarr; revenue <Box component="strong" sx={{fontWeight: 700}}>${rateResult.derivedRevenue.toFixed(2)}</Box></>
                                )}
                            </Typography>
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.disabled",
                                display: 'block',
                                mt: 0.5
                            }}>
                            IM will use the partner quote at dispatch and rewrite the job amount to the margin-adjusted revenue.
                        </Typography>
                    </Paper>
                )}

                {rateResult.source === 'none' && (
                    <Paper elevation={0} sx={SECTION_PAPER_SX}>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>
                            {rateResult.message ?? 'No pre-agreed rate or live quote available. Enter a rate manually.'}
                        </Typography>
                    </Paper>
                )}
            </Box>
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
                    disabled={disabled}
                    sx={{'& .MuiOutlinedInput-root': {bgcolor: 'background.paper'}}}
                />
            </Box>
        </>
    );
};

export default PartnerRatePanel;
