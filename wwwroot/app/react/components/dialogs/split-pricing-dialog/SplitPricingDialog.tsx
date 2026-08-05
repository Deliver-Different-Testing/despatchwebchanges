/**
 * Split Pricing Dialog
 *
 * Shows how a job's price will divide across the two legs of a split, and asks the user to confirm
 * before anything is written. Shown after the meeting point and courier dialogs.
 *
 * An overall share sets the default for every line, and each line can then be given its own share —
 * a congestion charge only one courier's route incurred shouldn't follow the overall percentage.
 * Only shares are sent back; the server recomputes the amounts so rounding has a single owner.
 *
 * Two outcomes:
 *  - Confirm: { action: 'confirm', allocation, lineAllocation }
 *  - Cancel:  { action: 'cancel' } — the job is left unsplit
 */

import React, {useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DialogContent from '@mui/material/DialogContent';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx, sectionLabelSx, dialogFieldSx} from '../shared';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {
    SplitPricingAllocationItem,
    SplitPricingBasis,
    SplitPricingLineAllocationItem,
    SplitPricingPreview,
} from '../../../services/splitJobApi';

export type SplitPricingResult =
    | {
          action: 'confirm';
          allocation: SplitPricingAllocationItem[];
          /** Only the lines the user gave their own share; empty when the overall split covers all. */
          lineAllocation: SplitPricingLineAllocationItem[];
      }
    | {action: 'cancel'};

export interface SplitPricingDialogProps {
    open: boolean;
    jobNo: string;
    preview: SplitPricingPreview;
    onClose: (result: SplitPricingResult) => void;
}

const BASIS_LABELS: Record<SplitPricingBasis, string> = {
    RoadMiles: 'Split by road miles per leg',
    StraightLine: 'Split by straight-line distance per leg',
    UserConfirmed: 'Split by your adjusted shares',
    LegRates: 'Split by each leg’s calculated rate',
    EvenSplit: 'No distance available for either leg — split evenly',
};

/** Rounds to 2dp for display without accumulating float noise. */
function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Clamps a share field to 0–100, ignoring the NaN a cleared number input produces. */
function toShare(raw: string, fallback: number): number {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

function footerHint(state: {overriddenCount: number; edited: boolean; perLineEditable: boolean}): string {
    if (state.overriddenCount > 0) {
        const lines = `${state.overriddenCount} line${state.overriddenCount === 1 ? '' : 's'}`;
        return `${lines} set apart from the overall split — the exact amounts are recalculated on save.`;
    }
    if (state.edited) {
        return 'Adjusted shares — the exact line amounts are recalculated on save.';
    }
    return state.perLineEditable
        ? 'Adjust the overall share, or give a single charge its own share if only one leg incurred it.'
        : 'Adjust the share above if a leg should carry more of the total.';
}

export const SplitPricingDialog: React.FC<SplitPricingDialogProps> = ({
    open,
    jobNo,
    preview,
    onClose,
}) => {
    // Seeded from the preview; edited as a single share for leg 1, with leg 2 taking the remainder.
    const [firstShare, setFirstShare] = useState<number>(
        () => round2(preview.legs[0]?.sharePercent ?? 50),
    );
    // Leg 1's share for the lines the user singled out, keyed by parent line id.
    const [overrides, setOverrides] = useState<Record<number, number>>({});
    const [edited, setEdited] = useState(false);

    // Per-line shares only make sense for the two-leg case, and a synthesised line *is* the overall
    // split — there is nothing to weigh it against.
    const perLineEditable = preview.legs.length === 2 && !preview.isSynthesised;

    const shares = useMemo(() => {
        if (preview.legs.length !== 2) {
            return preview.legs.map((leg) => round2(leg.sharePercent));
        }
        return [round2(firstShare), round2(100 - firstShare)];
    }, [preview.legs, firstShare]);

    // Re-derive every line from the share that governs it, so the dialog never shows numbers that
    // disagree with what is about to be confirmed. The server redoes this with exact rounding.
    const rows = useMemo(
        () =>
            preview.parentLines.map((line) => {
                const overridden = overrides[line.pricingBreakdownId];
                const firstPercent = overridden ?? shares[0] ?? 0;
                // Only the two-leg case is editable; anything else keeps the server's own shares.
                const factors = preview.legs.map((_, index) =>
                    preview.legs.length === 2
                        ? (index === 0 ? firstPercent : 100 - firstPercent) / 100
                        : (shares[index] ?? 0) / 100,
                );

                return {
                    ...line,
                    firstPercent: round2(firstPercent),
                    isOverridden: overridden !== undefined,
                    amounts: factors.map((factor) => ({
                        revenue: round2(line.revenue * factor),
                        cost: round2(line.cost * factor),
                    })),
                };
            }),
        [preview.parentLines, preview.legs, overrides, shares],
    );

    // Each leg's totals — and therefore its effective share — come from its own lines, so an
    // overridden line moves the headline figures too.
    const legs = useMemo(
        () =>
            preview.legs.map((leg, index) => {
                const totalRevenue = round2(
                    rows.reduce((sum, row) => sum + (row.amounts[index]?.revenue ?? 0), 0),
                );
                const totalCost = round2(
                    rows.reduce((sum, row) => sum + (row.amounts[index]?.cost ?? 0), 0),
                );

                return {
                    ...leg,
                    sharePercent: shares[index] ?? leg.sharePercent,
                    effectivePercent: preview.parentTotalRevenue
                        ? round2((totalRevenue / preview.parentTotalRevenue) * 100)
                        : (shares[index] ?? leg.sharePercent),
                    totalRevenue,
                    totalCost,
                };
            }),
        [preview.legs, preview.parentTotalRevenue, rows, shares],
    );

    const hasCosts = preview.parentTotalCost !== 0;
    const overriddenCount = rows.filter((row) => row.isOverridden).length;

    const setLineShare = (pricingBreakdownId: number, value: number) => {
        setEdited(true);
        setOverrides((current) => ({...current, [pricingBreakdownId]: value}));
    };

    const resetLineShare = (pricingBreakdownId: number) => {
        setOverrides((current) => {
            const {[pricingBreakdownId]: _removed, ...rest} = current;
            return rest;
        });
    };

    const handleConfirm = () => {
        onClose({
            action: 'confirm',
            allocation: legs.map((leg) => ({sequence: leg.sequence, sharePercent: leg.sharePercent})),
            lineAllocation: rows
                .filter((row) => row.isOverridden)
                .flatMap((row) =>
                    preview.legs.map((leg, index) => ({
                        pricingBreakdownId: row.pricingBreakdownId,
                        sequence: leg.sequence,
                        sharePercent:
                            index === 0 ? row.firstPercent : round2(100 - row.firstPercent),
                    })),
                ),
        });
    };

    const handleCancel = () => onClose({action: 'cancel'});

    return (
        <DialogShell open={open} onClose={handleCancel}>
            <DialogHeader
                icon={<CallSplitIcon/>}
                title="Confirm Split Pricing"
                subtitle={`${jobNo} · ${formatCurrency(preview.parentTotalRevenue)} to divide`}
                onClose={handleCancel}
            />
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Alert severity={preview.basis === 'EvenSplit' ? 'warning' : 'info'}>
                        {BASIS_LABELS[preview.basis]}. The job total stays{' '}
                        {formatCurrency(preview.parentTotalRevenue)} — splitting does not change what
                        the client is invoiced.
                    </Alert>

                    {preview.isSynthesised && (
                        <Alert severity="info">
                            This job has no itemised price lines, so a single line is divided across
                            the legs.
                        </Alert>
                    )}

                    <Box>
                        <Typography variant="body2" sx={sectionLabelSx}>Overall split</Typography>
                        <Paper elevation={0} sx={sectionPaperSx}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 2,
                                }}
                            >
                                <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                                    {legs.map((leg) => (
                                        <Box
                                            key={leg.sequence}
                                            sx={{display: 'flex', alignItems: 'center', gap: 1}}
                                        >
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                {leg.jobNumber}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                label={`${leg.effectivePercent}%`}
                                            />
                                            {leg.miles > 0 && (
                                                <Typography
                                                    variant="caption"
                                                    sx={{color: 'text.secondary'}}
                                                >
                                                    {`${leg.miles} mi`}
                                                </Typography>
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                                {legs.length === 2 && (
                                    <TextField
                                        label="Share %"
                                        type="number"
                                        size="small"
                                        value={firstShare}
                                        onChange={(event) => {
                                            setEdited(true);
                                            setFirstShare(toShare(event.target.value, firstShare));
                                        }}
                                        slotProps={{htmlInput: {min: 0, max: 100, step: 0.5}}}
                                        sx={{...dialogFieldSx, width: 120}}
                                    />
                                )}
                            </Box>
                        </Paper>
                    </Box>

                    <Box>
                        <Typography variant="body2" sx={sectionLabelSx}>Line items</Typography>
                        <Paper elevation={0} sx={sectionPaperSx}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item</TableCell>
                                        {perLineEditable && (
                                            <TableCell align="right">Share %</TableCell>
                                        )}
                                        {legs.map((leg) => (
                                            <TableCell key={leg.sequence} align="right">
                                                {`Leg ${leg.letterSuffix}`}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.pricingBreakdownId}>
                                            <TableCell>{row.name}</TableCell>
                                            {perLineEditable && (
                                                <TableCell align="right">
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-end',
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={row.firstPercent}
                                                            onChange={(event) =>
                                                                setLineShare(
                                                                    row.pricingBreakdownId,
                                                                    toShare(
                                                                        event.target.value,
                                                                        row.firstPercent,
                                                                    ),
                                                                )
                                                            }
                                                            slotProps={{
                                                                htmlInput: {
                                                                    min: 0,
                                                                    max: 100,
                                                                    step: 0.5,
                                                                    'aria-label': `${row.name} share %`,
                                                                },
                                                            }}
                                                            sx={{...dialogFieldSx, width: 84}}
                                                        />
                                                        {row.isOverridden && (
                                                            <Tooltip title="Follow the overall split">
                                                                <IconButton
                                                                    size="small"
                                                                    aria-label={`Reset ${row.name} share`}
                                                                    onClick={() =>
                                                                        resetLineShare(
                                                                            row.pricingBreakdownId,
                                                                        )
                                                                    }
                                                                >
                                                                    <UndoIcon fontSize="small"/>
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            )}
                                            {row.amounts.map((amount, index) => (
                                                <TableCell key={legs[index]?.sequence} align="right">
                                                    {formatCurrency(amount.revenue)}
                                                    {hasCosts && (
                                                        <Typography
                                                            variant="caption"
                                                            component="div"
                                                            sx={{color: 'text.secondary'}}
                                                        >
                                                            cost {formatCurrency(amount.cost)}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 600}}>Leg total</TableCell>
                                        {perLineEditable && <TableCell/>}
                                        {legs.map((leg) => (
                                            <TableCell
                                                key={leg.sequence}
                                                align="right"
                                                sx={{fontWeight: 600}}
                                            >
                                                {formatCurrency(leg.totalRevenue)}
                                                {hasCosts && (
                                                    <Typography
                                                        variant="caption"
                                                        component="div"
                                                        sx={{
                                                            color: 'text.secondary',
                                                            fontWeight: 400,
                                                        }}
                                                    >
                                                        cost {formatCurrency(leg.totalCost)}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>
                    </Box>

                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                        {footerHint({overriddenCount, edited, perLineEditable})}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogFooter
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                confirmLabel="Confirm & Split"
                confirmIcon={<CheckIcon/>}
            />
        </DialogShell>
    );
};

export default SplitPricingDialog;
