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

import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Badge, Box, Group, Loader, NumberInput, Paper, Text} from '@mantine/core';
import {SegmentedToggle} from '../../common/segmented-toggle';
import {sectionLabelProps, sectionPaperProps} from '../shared/mantine';
import type {PartnerRateForJobResponse, PartnerRateQuote} from '../../../services/jobListApi';
import {PartnerRatePanelProps} from "./PartnerRatePanelProps";

export const PartnerRatePanel: React.FC<PartnerRatePanelProps> = ({
    partnerId,
    jobId,
    fetchRate,
    onRateChange,
    disabled,
    onServiceabilityChange,
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

    useEffect(() => {
        onServiceabilityChange?.(rateResult?.serviceAvailable === false);
    }, [rateResult, onServiceabilityChange]);

    const handleQuoteSelect = useCallback((index: number, quote: PartnerRateQuote) => {
        setSelectedQuoteIndex(index);
        setManualRate(quote.totalCharge.toFixed(2));
    }, []);

    if (loading) {
        return (
            <Group justify="center" gap="sm" py="lg">
                <Loader size={24} role="progressbar" aria-label="Looking up rate"/>
                <Text size="sm" c="dimmed">
                    Looking up rate...
                </Text>
            </Group>
        );
    }

    if (!rateResult) return null;

    // Only an explicit false is a verdict. null means IM couldn't reach the partner, and warning
    // on that would train operators to ignore the warning that actually matters.
    const laneUnserviceable = rateResult.serviceAvailable === false;
    const alternatives = rateResult.alternatives ?? [];

    return (
        <>
            {laneUnserviceable && (
                <Alert color="orange" variant="light" title="Partner cannot service this route" mb="md">
                    <Text size="sm" mb={alternatives.length > 0 ? 'xs' : 0}>
                        {rateResult.serviceabilityMessage
                            ?? 'The partner does not offer this speed between these locations.'}
                    </Text>
                    {alternatives.length > 0 && (
                        <>
                            <Text size="sm" fw={500}>
                                This partner can do:
                            </Text>
                            <Box component="ul" m={0} pl="md">
                                {alternatives.map((a) => (
                                    <li key={a.partnerServiceCode}>
                                        <Text size="sm">
                                            {a.partnerServiceCode} — {a.serviceName}
                                            {a.totalCharge != null
                                                && ` (${a.currency ?? ''} ${a.totalCharge.toFixed(2)})`}
                                            {a.transitDays != null && `, ${a.transitDays} day`}
                                        </Text>
                                    </li>
                                ))}
                            </Box>
                        </>
                    )}
                    <Text size="sm" mt="xs">
                        Change the job&apos;s speed, then send again — or send anyway and it may be
                        rejected.
                    </Text>
                </Alert>
            )}

            <Box>
                <Text {...sectionLabelProps}>Pricing</Text>

                {rateResult.source === 'rate_card' && rateResult.rateCardRate != null && (
                    <Paper {...sectionPaperProps}>
                        <Group gap="sm" align="center">
                            <Badge size="sm" color="brand">Rate Card</Badge>
                            <Text size="sm">
                                Pre-agreed rate: <strong>${rateResult.rateCardRate.toFixed(2)}</strong>
                            </Text>
                        </Group>
                    </Paper>
                )}

                {rateResult.source === 'live_quote' && rateResult.liveQuotes.length > 0 && (
                    <Paper {...sectionPaperProps}>
                        <Group gap="sm" align="center" mb="xs">
                            <Badge size="sm" color="brand">Live Quote</Badge>
                            <Text size="sm" c="dimmed">
                                {rateResult.liveQuotes.length} rate{rateResult.liveQuotes.length > 1 ? 's' : ''} from partner
                            </Text>
                        </Group>
                        <SegmentedToggle
                            aria-label="Live quote"
                            orientation="vertical"
                            variant="inline"
                            value={String(selectedQuoteIndex)}
                            onChange={(value) => {
                                const index = Number(value);
                                handleQuoteSelect(index, rateResult.liveQuotes[index]);
                            }}
                            data={rateResult.liveQuotes.map((quote, index) => ({
                                value: String(index),
                                label: (
                                    <Group gap="xs" align="center">
                                        <Text size="sm">
                                            {quote.serviceName} &mdash; <strong>${quote.totalCharge.toFixed(2)} {quote.currency}</strong>
                                        </Text>
                                        {quote.transitDays != null && (
                                            <Text size="xs" c="dimmed">
                                                ({quote.transitDays}d transit)
                                            </Text>
                                        )}
                                    </Group>
                                ),
                            }))}
                        />
                    </Paper>
                )}

                {rateResult.source === 'percentage' && rateResult.derivedRate != null && (
                    <Paper {...sectionPaperProps}>
                        <Group gap="sm" align="center">
                            <Badge size="sm" color="brand">Percentage</Badge>
                            <Text size="sm">
                                Partner will be paid <strong>${rateResult.derivedRate.toFixed(2)}</strong>
                                {rateResult.percentageOfClientCharge != null && (
                                    <> ({rateResult.percentageOfClientCharge}% of the job amount)</>
                                )}
                            </Text>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                            IM substitutes this rate at dispatch &mdash; any value you type below will be ignored.
                        </Text>
                    </Paper>
                )}

                {rateResult.source === 'cost_plus' && rateResult.liveQuotes.length > 0 && (
                    <Paper {...sectionPaperProps}>
                        <Group gap="sm" align="center" wrap="wrap">
                            <Badge size="sm" color="brand">Cost Plus</Badge>
                            <Text size="sm">
                                Partner quote: <strong>${rateResult.liveQuotes[0].totalCharge.toFixed(2)}</strong>
                                {rateResult.marginPercent != null && rateResult.derivedRevenue != null && (
                                    <> &middot; margin {rateResult.marginPercent}% &rarr; revenue <strong>${rateResult.derivedRevenue.toFixed(2)}</strong></>
                                )}
                            </Text>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                            IM will use the partner quote at dispatch and rewrite the job amount to the margin-adjusted revenue.
                        </Text>
                    </Paper>
                )}

                {rateResult.source === 'none' && (
                    <Paper {...sectionPaperProps}>
                        <Text size="sm" c="dimmed">
                            {rateResult.message ?? 'No pre-agreed rate or live quote available. Enter a rate manually.'}
                        </Text>
                    </Paper>
                )}
            </Box>
            <Box>
                <Text {...sectionLabelProps}>Agreed Rate</Text>
                <NumberInput
                    label="Agreed Rate"
                    value={manualRate}
                    onChange={(value) => {
                        setManualRate(value === '' || value === null ? '' : String(value));
                        setValidationError('');
                    }}
                    min={0}
                    step={0.01}
                    decimalScale={2}
                    // A left section, not `prefix` — `prefix` becomes part of the
                    // input's value, which is not what the currency marker means.
                    leftSection="$"
                    description={
                        rateResult.source === 'percentage' || rateResult.source === 'cost_plus'
                            ? 'IM will substitute this rate at dispatch — input is informational only'
                            : rateResult.source !== 'none'
                                ? 'You can override the suggested rate'
                                : 'Enter the rate agreed with the partner'
                    }
                    error={validationError || undefined}
                    disabled={disabled}
                />
            </Box>
        </>
    );
};

export default PartnerRatePanel;
