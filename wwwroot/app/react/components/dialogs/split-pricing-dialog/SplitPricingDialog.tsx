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
import {
    ActionIcon, Alert, Badge, Box, Group, Paper, Stack, Table, Text, TextInput, Tooltip,
} from '@mantine/core';
import {Check, Split, Undo2} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell, DialogHeader, DialogFooter, dialogSize, dialogContentBg, sectionPaperProps, sectionLabelProps,
} from '../shared/mantine';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {SplitPricingBasis} from '../../../services/splitJobApi';
import {SplitPricingAllocationItem} from "../../../interfaces/splitJobs";
import type {SplitPricingLineAllocationItem, SplitPricingPreview} from '../../../interfaces/splitJobs';

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
    // Unit-neutral wording — the tenant's own unit is shown against each leg.
    RoadMiles: 'Split by road distance per leg',
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
        <DialogShell opened={open} onClose={handleCancel} size={dialogSize.md}>
            <DialogHeader
                icon={<Icon lucide={Split}/>}
                title="Confirm Split Pricing"
                subtitle={`${jobNo} · ${formatCurrency(preview.parentTotalRevenue)} to divide`}
                onClose={handleCancel}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg, display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-lg)'}}>
                <Alert color={preview.basis === 'EvenSplit' ? 'orange' : 'cyan'} variant="light">
                    {BASIS_LABELS[preview.basis]}. The job total stays{' '}
                    {formatCurrency(preview.parentTotalRevenue)} — splitting does not change what
                    the client is invoiced.
                </Alert>

                {preview.isSynthesised && (
                    <Alert color="cyan" variant="light">
                        This job has no itemised price lines, so a single line is divided across
                        the legs.
                    </Alert>
                )}

                <Box>
                    <Text {...sectionLabelProps}>Overall split</Text>
                    <Paper {...sectionPaperProps}>
                        <Group justify="space-between" align="center" gap="md">
                            <Stack gap="xs">
                                {legs.map((leg) => (
                                    <Group key={leg.sequence} gap="xs">
                                        <Text fz="sm" fw={600}>{leg.jobNumber}</Text>
                                        <Badge size="sm" variant="outline" color="brand">
                                            {`${leg.effectivePercent}%`}
                                        </Badge>
                                        {leg.distance > 0 && (
                                            <Text fz="xs" c="dimmed">
                                                {`${leg.distance} ${preview.distanceUnit}`}
                                            </Text>
                                        )}
                                    </Group>
                                ))}
                            </Stack>
                            {legs.length === 2 && (
                                <TextInput
                                    label="Share %"
                                    type="number"
                                    w={120}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={firstShare}
                                    onChange={(event) => {
                                        setEdited(true);
                                        setFirstShare(toShare(event.currentTarget.value, firstShare));
                                    }}
                                />
                            )}
                        </Group>
                    </Paper>
                </Box>

                <Box>
                    <Text {...sectionLabelProps}>Line items</Text>
                    <Paper {...sectionPaperProps}>
                        <Table verticalSpacing="xs" horizontalSpacing="xs">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th scope="col">Item</Table.Th>
                                    {perLineEditable && (
                                        <Table.Th scope="col" ta="right">Share %</Table.Th>
                                    )}
                                    {legs.map((leg) => (
                                        <Table.Th key={leg.sequence} scope="col" ta="right">
                                            {`Leg ${leg.letterSuffix}`}
                                        </Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {rows.map((row) => (
                                    <Table.Tr key={row.pricingBreakdownId}>
                                        <Table.Td>{row.name}</Table.Td>
                                        {perLineEditable && (
                                            <Table.Td ta="right">
                                                <Group gap={4} justify="flex-end" wrap="nowrap">
                                                    <TextInput
                                                        type="number"
                                                        w={84}
                                                        min={0}
                                                        max={100}
                                                        step={0.5}
                                                        aria-label={`${row.name} share %`}
                                                        value={row.firstPercent}
                                                        onChange={(event) =>
                                                            setLineShare(
                                                                row.pricingBreakdownId,
                                                                toShare(
                                                                    event.currentTarget.value,
                                                                    row.firstPercent,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                    {row.isOverridden && (
                                                        <Tooltip label="Follow the overall split">
                                                            <ActionIcon
                                                                variant="subtle"
                                                                color="gray"
                                                                size="sm"
                                                                aria-label={`Reset ${row.name} share`}
                                                                onClick={() =>
                                                                    resetLineShare(row.pricingBreakdownId)
                                                                }
                                                            >
                                                                <Icon lucide={Undo2} size={16}/>
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                        )}
                                        {row.amounts.map((amount, index) => (
                                            <Table.Td key={legs[index]?.sequence} ta="right">
                                                {formatCurrency(amount.revenue)}
                                                {hasCosts && (
                                                    <Text component="div" fz="xs" c="dimmed">
                                                        cost {formatCurrency(amount.cost)}
                                                    </Text>
                                                )}
                                            </Table.Td>
                                        ))}
                                    </Table.Tr>
                                ))}
                                <Table.Tr>
                                    <Table.Td fw={600}>Leg total</Table.Td>
                                    {perLineEditable && <Table.Td/>}
                                    {legs.map((leg) => (
                                        <Table.Td key={leg.sequence} ta="right" fw={600}>
                                            {formatCurrency(leg.totalRevenue)}
                                            {hasCosts && (
                                                <Text component="div" fz="xs" fw={400} c="dimmed">
                                                    cost {formatCurrency(leg.totalCost)}
                                                </Text>
                                            )}
                                        </Table.Td>
                                    ))}
                                </Table.Tr>
                            </Table.Tbody>
                        </Table>
                    </Paper>
                </Box>

                <Text fz="xs" c="dimmed">
                    {footerHint({overriddenCount, edited, perLineEditable})}
                </Text>
            </Box>
            <DialogFooter
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                confirmLabel="Confirm & Split"
                confirmIcon={<Icon lucide={Check}/>}
            />
        </DialogShell>
    );
};

export default SplitPricingDialog;
