/**
 * Split Pricing Dialog
 *
 * Shows how a job's price will divide across the two legs of a split, and asks the user to confirm
 * before anything is written. Shown after the meeting point and courier dialogs.
 *
 * The share per leg is editable — the two are constrained to total 100% — and the per-line figures
 * re-derive from it. Only the shares are sent back; the server recomputes the lines so rounding has
 * a single owner.
 *
 * Two outcomes:
 *  - Confirm: { action: 'confirm', allocation }
 *  - Cancel:  { action: 'cancel' } — the job is left unsplit
 */

import React, {useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogContent from '@mui/material/DialogContent';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckIcon from '@mui/icons-material/Check';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx, dialogFieldSx} from '../shared';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {
    SplitPricingAllocationItem,
    SplitPricingBasis,
    SplitPricingPreview,
} from '../../../services/splitJobApi';

export type SplitPricingResult =
    | {action: 'confirm'; allocation: SplitPricingAllocationItem[]}
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
    const [edited, setEdited] = useState(false);

    const shares = useMemo(() => {
        if (preview.legs.length !== 2) {
            return preview.legs.map((leg) => round2(leg.sharePercent));
        }
        const first = Math.min(100, Math.max(0, firstShare));
        return [round2(first), round2(100 - first)];
    }, [preview.legs, firstShare]);

    // The undivided parent amount behind each line, recovered by summing the legs the server
    // proposed. Line order and count match across legs because every leg gets a copy of every line.
    const parentLines = useMemo(
        () =>
            (preview.legs[0]?.lines ?? []).map((_, lineIndex) => ({
                revenue: preview.legs.reduce((sum, l) => sum + (l.lines[lineIndex]?.revenue ?? 0), 0),
                cost: preview.legs.reduce((sum, l) => sum + (l.lines[lineIndex]?.cost ?? 0), 0),
            })),
        [preview.legs],
    );

    // Re-derive the displayed figures from the edited shares, so the dialog never shows numbers that
    // disagree with the share the user is about to confirm.
    const legs = useMemo(
        () =>
            preview.legs.map((leg, index) => {
                const share = shares[index] ?? leg.sharePercent;
                const factor = share / 100;
                return {
                    ...leg,
                    sharePercent: share,
                    lines: leg.lines.map((line, lineIndex) => ({
                        ...line,
                        revenue: round2((parentLines[lineIndex]?.revenue ?? 0) * factor),
                        cost: round2((parentLines[lineIndex]?.cost ?? 0) * factor),
                    })),
                    totalRevenue: round2(preview.parentTotalRevenue * factor),
                    totalCost: round2(preview.parentTotalCost * factor),
                };
            }),
        [preview, shares, parentLines],
    );

    const handleConfirm = () => {
        onClose({
            action: 'confirm',
            allocation: legs.map((leg) => ({sequence: leg.sequence, sharePercent: leg.sharePercent})),
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

                    {legs.map((leg, index) => (
                        <Paper key={leg.sequence} elevation={0} sx={sectionPaperSx}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 2,
                                    mb: 1.5,
                                }}
                            >
                                <Box>
                                    <Typography variant="body2" sx={{fontWeight: 600}}>
                                        {leg.jobNumber}
                                    </Typography>
                                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                        {/* "of the trip" only while the share still reflects the
                                            mileage — once edited it no longer explains the split. */}
                                        {leg.miles > 0
                                            ? `${leg.miles} mi · ${leg.sharePercent}% ${edited ? 'of the total' : 'of the trip'}`
                                            : `${leg.sharePercent}% of the total`}
                                    </Typography>
                                </Box>
                                {index === 0 && legs.length === 2 ? (
                                    <TextField
                                        label="Share %"
                                        type="number"
                                        size="small"
                                        value={firstShare}
                                        onChange={(event) => {
                                            setEdited(true);
                                            setFirstShare(Number(event.target.value));
                                        }}
                                        slotProps={{htmlInput: {min: 0, max: 100, step: 0.5}}}
                                        sx={{...dialogFieldSx, width: 120}}
                                    />
                                ) : (
                                    <Chip
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        label={`${leg.sharePercent}%`}
                                    />
                                )}
                            </Box>

                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item</TableCell>
                                        <TableCell align="right">Revenue</TableCell>
                                        <TableCell align="right">Cost</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {leg.lines.map((line) => (
                                        <TableRow key={line.name}>
                                            <TableCell>{line.name}</TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(line.revenue)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(line.cost)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 600}}>Leg total</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 600}}>
                                            {formatCurrency(leg.totalRevenue)}
                                        </TableCell>
                                        <TableCell align="right" sx={{fontWeight: 600}}>
                                            {formatCurrency(leg.totalCost)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>
                    ))}

                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                        {edited
                            ? 'Adjusted shares — the exact line amounts are recalculated on save.'
                            : 'Adjust the share above if a leg should carry more of the total.'}
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
