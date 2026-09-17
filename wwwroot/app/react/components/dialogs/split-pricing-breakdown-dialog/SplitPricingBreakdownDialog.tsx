/**
 * Split Pricing Breakdown Dialog
 *
 * The shared grid behind both split modes (docs/pricing/job-splitting-price-breakdown.md §8):
 * `mode="edit"` is the parent's original price items with one editable cost column per leg,
 * replacing the flat Part A / Part B breakdown for a split parent (§3). `mode="split"` is the
 * pre-split "Confirm Split Pricing" preview, so an operator can get pricing right at the moment
 * of splitting instead of fixing it afterwards.
 *
 * Every edit (revenue, share, cost override) batches locally. In edit mode it saves in one call
 * on Save & Close; in split mode it's carried in the Confirm & Split result and applied when the
 * job is actually split. Add/remove item is edit-mode only, and is its own immediate mutation —
 * there's nothing to add/remove before the job exists.
 *
 * Note on scope: the pre-split screen previously offered a single "overall share" control that
 * moved every line's share together (`SplitPricingDialog.tsx`, retired by this unification). The
 * shared grid instead exposes only the per-item Share % control, matching the surface edit mode
 * already used — an item's own share is set directly rather than defaulted from an overall dial.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Group,
    NumberInput,
    Paper,
    Stack,
    Table,
    Text,
    TextInput,
    ThemeIcon,
} from '@mantine/core';
import {
    CircleCheck,
    DollarSign,
    Lock,
    PiggyBank,
    Plus,
    ReceiptText,
    Split,
    Trash2,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {ShowToastFn} from '../../../services/toastService';
import {Icon} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, dialogSize, SummaryCard} from '../shared/mantine';
import type {
    SplitPriceBreakdown,
    SplitPricingAllocationItem,
    SplitPricingAllocationUpdate,
    SplitPricingItemRevenueUpdate,
    SplitPricingLineAllocationItem,
    SplitPricingPreview,
    UpdateSplitPricingBreakdownRequest,
} from '../../../interfaces/splitJobs';
import type {SplitPricingBasis} from '../../../services/splitJobApi';
import {computeDialogWidth, distributeAmount, normalizeShares} from './splitPricingBreakdownCalc';
import classes from './SplitPricingBreakdownDialog.module.css';

export type SplitPricingResult =
    | {
          action: 'confirm';
          allocation: SplitPricingAllocationItem[];
          /** Only the lines the user adjusted; empty when every line follows the overall split. */
          lineAllocation: SplitPricingLineAllocationItem[];
      }
    | {action: 'cancel'};

export interface EditModeProps {
    mode: 'edit';
    open: boolean;
    breakdown: SplitPriceBreakdown;
    onClose: () => void;
    onSave: (request: UpdateSplitPricingBreakdownRequest) => Promise<void>;
    onAddItem: (name: string, revenue: number) => Promise<SplitPriceBreakdown>;
    onDeleteItem: (pricingBreakdownId: number) => Promise<SplitPriceBreakdown>;
    showToast?: ShowToastFn;
}

export interface SplitModeProps {
    mode: 'split';
    open: boolean;
    jobNo: string;
    preview: SplitPricingPreview;
    onClose: (result: SplitPricingResult) => void;
    showToast?: ShowToastFn;
}

export type SplitPricingBreakdownDialogProps = EditModeProps | SplitModeProps;

type ShareEdits = Record<number, Record<number, number>>;
type CostOverrideEdits = Record<number, Record<number, number | null>>;

/** The grid's own view of one item/leg pair — normalized so both modes render identically. */
interface NormalizedAllocation {
    legKey: number;
    sharePercent: number;
    revenue: number;
    cost: number | null;
    costOverride: number | null;
    derivedCost: number | null;
}

interface NormalizedItem {
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    allocations: NormalizedAllocation[];
}

interface NormalizedLeg {
    legKey: number;
    label: string;
    subtitle: string;
    costLocked: boolean;
    costLockReason: string | null;
    /**
     * Split mode only: the preview's own proposed overall share (e.g. mileage-derived), sent as
     * `SplitPricingAllocationItem.sharePercent` on Confirm & Split. Deliberately NOT the actual
     * blended result of any per-line overrides (`legSummaries`' computed share) — that value feeds
     * the *default* split for every untouched line, so a line-level override must never bleed back
     * into it. Unused in edit mode.
     */
    overallSharePercent: number;
}

interface NormalizedBreakdown {
    items: NormalizedItem[];
    legs: NormalizedLeg[];
    revenueLocked: boolean;
    shareLocked: boolean;
}

const BASIS_LABELS: Record<SplitPricingBasis, string> = {
    // Unit-neutral wording — the tenant's own unit is shown against each leg.
    RoadMiles: 'Split by road distance per leg',
    StraightLine: 'Split by straight-line distance per leg',
    UserConfirmed: 'Split by your adjusted shares',
    LegRates: 'Split by each leg’s calculated rate',
    EvenSplit: 'No distance available for either leg — split evenly',
};

function normalizeEditBreakdown(breakdown: SplitPriceBreakdown): NormalizedBreakdown {
    return {
        items: breakdown.items.map((item) => ({
            pricingBreakdownId: item.pricingBreakdownId,
            name: item.name,
            revenue: item.revenue,
            allocations: item.allocations.map((a) => ({
                legKey: a.legJobId,
                sharePercent: a.sharePercent,
                revenue: a.revenue,
                cost: a.cost,
                costOverride: a.costOverride,
                derivedCost: a.derivedCost,
            })),
        })),
        legs: breakdown.legs.map((leg) => ({
            legKey: leg.jobId,
            label: leg.jobNumber,
            subtitle: leg.driverName ?? 'Unassigned',
            costLocked: leg.costLocked,
            costLockReason: leg.costLockReason,
            overallSharePercent: 0, // edit mode never produces a SplitPricingResult; unused
        })),
        revenueLocked: breakdown.locks.revenueLocked,
        shareLocked: breakdown.locks.shareLocked,
    };
}

/** Pre-split: nothing can be invoiced/settled before the job exists, so nothing is locked yet. */
function normalizeSplitPreview(preview: SplitPricingPreview): NormalizedBreakdown {
    return {
        items: preview.parentLines.map((line) => ({
            pricingBreakdownId: line.pricingBreakdownId,
            name: line.name,
            revenue: line.revenue,
            allocations: preview.legs.map((leg) => {
                const legLine = leg.lines.find((l) => l.pricingBreakdownId === line.pricingBreakdownId);
                const cost = legLine?.cost ?? 0;
                return {
                    legKey: leg.sequence,
                    sharePercent: leg.sharePercent,
                    revenue: legLine?.revenue ?? 0,
                    cost,
                    costOverride: null,
                    derivedCost: cost,
                };
            }),
        })),
        legs: preview.legs.map((leg) => ({
            legKey: leg.sequence,
            label: `Leg ${leg.letterSuffix}`,
            subtitle: leg.distance > 0 ? `${leg.distance} ${preview.distanceUnit}` : '',
            costLocked: false,
            costLockReason: null,
            overallSharePercent: leg.sharePercent,
        })),
        revenueLocked: false,
        shareLocked: false,
    };
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

const getMarginColor = (margin: number): string => {
    if (margin >= 40) return 'green';
    if (margin >= 20) return 'orange';
    return 'red';
};

const moneyIcon = <Icon lucide={DollarSign} size={16}/>;

export const SplitPricingBreakdownDialog: React.FC<SplitPricingBreakdownDialogProps> = (props) => {
    const {open, showToast} = props;
    const isEdit = props.mode === 'edit';

    const initialBreakdown = useMemo(
        () => (props.mode === 'edit' ? normalizeEditBreakdown(props.breakdown) : normalizeSplitPreview(props.preview)),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-normalize only when the source data changes
        [props.mode === 'edit' ? props.breakdown : props.preview],
    );

    const [breakdownState, setBreakdownState] = useState(initialBreakdown);
    const [revenueEdits, setRevenueEdits] = useState<Record<number, number>>({});
    const [shareEdits, setShareEdits] = useState<ShareEdits>({});
    const [costOverrideEdits, setCostOverrideEdits] = useState<CostOverrideEdits>({});
    const [openShareItemId, setOpenShareItemId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addName, setAddName] = useState('');
    const [addRevenue, setAddRevenue] = useState<number | ''>('');
    const [isAddSaving, setIsAddSaving] = useState(false);
    const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setBreakdownState(initialBreakdown);
        setRevenueEdits({});
        setShareEdits({});
        setCostOverrideEdits({});
        setOpenShareItemId(null);
    }, [initialBreakdown]);

    const legKeys = useMemo(() => breakdownState.legs.map((leg) => leg.legKey), [breakdownState.legs]);
    const {revenueLocked, shareLocked} = breakdownState;

    const rows = useMemo(() => breakdownState.items.map((item) => {
        const allocationByLeg = new Map(item.allocations.map((a) => [a.legKey, a]));
        const revenue = revenueEdits[item.pricingBreakdownId] ?? item.revenue;
        const shares = legKeys.map((legKey) =>
            shareEdits[item.pricingBreakdownId]?.[legKey] ?? allocationByLeg.get(legKey)?.sharePercent ?? 0);
        const previewRevenues = distributeAmount(revenue, shares);

        const cells = legKeys.map((legKey, index) => {
            const allocation = allocationByLeg.get(legKey);
            const pendingOverride = costOverrideEdits[item.pricingBreakdownId]?.[legKey];
            const effectiveOverride = pendingOverride !== undefined ? pendingOverride : (allocation?.costOverride ?? null);
            const derivedCost = allocation?.derivedCost ?? 0;
            const cost = effectiveOverride ?? derivedCost;
            return {
                legKey,
                revenue: previewRevenues[index] ?? 0,
                cost,
                derivedCost,
                isOverridden: effectiveOverride !== null,
                sharePercent: shares[index],
            };
        });

        const totalCost = cells.reduce((sum, c) => sum + c.cost, 0);
        const profit = revenue - totalCost;
        const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;

        return {item, revenue, cells, totalCost, profit, margin};
    }), [breakdownState.items, legKeys, revenueEdits, shareEdits, costOverrideEdits]);

    const totals = useMemo(() => {
        const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
        const totalCost = rows.reduce((sum, r) => sum + r.totalCost, 0);
        const profit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;
        return {totalRevenue, totalCost, profit, margin};
    }, [rows]);

    const legSummaries = useMemo(() => breakdownState.legs.map((leg, index) => {
        const revenue = rows.reduce((sum, r) => sum + (r.cells[index]?.revenue ?? 0), 0);
        const cost = rows.reduce((sum, r) => sum + (r.cells[index]?.cost ?? 0), 0);
        const margin = revenue > 0 ? (((revenue - cost) / revenue) * 100) : 0;
        const sharePercent = totals.totalRevenue > 0 ? (revenue / totals.totalRevenue) * 100 : 0;
        return {leg, revenue, cost, margin, sharePercent};
    }), [breakdownState.legs, rows, totals.totalRevenue]);

    const hasPendingEdits = Object.keys(revenueEdits).length > 0
        || Object.keys(shareEdits).length > 0
        || Object.keys(costOverrideEdits).length > 0;

    const handleRevenueChange = (itemId: number, value: number) => {
        setRevenueEdits((prev) => ({...prev, [itemId]: value}));
    };

    const handleShareChange = (itemId: number, changedLegKey: number, newValue: number) => {
        const item = breakdownState.items.find((i) => i.pricingBreakdownId === itemId);
        if (!item) return;
        const allocationByLeg = new Map(item.allocations.map((a) => [a.legKey, a]));
        const currentShares = legKeys.map((legKey) =>
            shareEdits[itemId]?.[legKey] ?? allocationByLeg.get(legKey)?.sharePercent ?? 0);
        const changedIndex = legKeys.indexOf(changedLegKey);
        if (changedIndex < 0) return;
        const normalized = normalizeShares(currentShares, changedIndex, newValue);
        const legShareMap: Record<number, number> = {};
        legKeys.forEach((legKey, i) => {
            legShareMap[legKey] = normalized[i];
        });
        setShareEdits((prev) => ({...prev, [itemId]: legShareMap}));
    };

    const handleCostChange = (itemId: number, legKey: number, value: number) => {
        setCostOverrideEdits((prev) => ({...prev, [itemId]: {...prev[itemId], [legKey]: value}}));
    };

    const handleResetCost = (itemId: number, legKey: number) => {
        setCostOverrideEdits((prev) => ({...prev, [itemId]: {...prev[itemId], [legKey]: null}}));
    };

    const handleSaveEdit = async () => {
        if (props.mode !== 'edit') return;
        setIsSaving(true);
        try {
            const itemRevenues: SplitPricingItemRevenueUpdate[] = Object.entries(revenueEdits)
                .map(([id, revenue]) => ({pricingBreakdownId: Number(id), revenue}));

            const allocations: SplitPricingAllocationUpdate[] = [];
            Object.entries(shareEdits).forEach(([itemId, legShareMap]) => {
                legKeys.forEach((legKey) => {
                    if (legShareMap[legKey] !== undefined) {
                        allocations.push({
                            pricingBreakdownId: Number(itemId),
                            legJobId: legKey,
                            sharePercent: legShareMap[legKey],
                        });
                    }
                });
            });
            Object.entries(costOverrideEdits).forEach(([itemId, legCostMap]) => {
                Object.entries(legCostMap).forEach(([legKey, override]) => {
                    if (override === null) {
                        allocations.push({pricingBreakdownId: Number(itemId), legJobId: Number(legKey), resetCostOverride: true});
                    } else if (override !== undefined) {
                        allocations.push({pricingBreakdownId: Number(itemId), legJobId: Number(legKey), costOverride: override});
                    }
                });
            });

            await props.onSave({jobId: props.breakdown.jobId, itemRevenues, allocations});
            showToast?.('Split pricing breakdown saved', 'success');
            props.onClose();
        } catch (error) {
            showToast?.(extractErrorMessage(error, 'Failed to save the split pricing breakdown.'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmSplit = () => {
        if (props.mode !== 'split') return;

        const allocation: SplitPricingAllocationItem[] = breakdownState.legs.map((leg) => ({
            sequence: leg.legKey,
            sharePercent: leg.overallSharePercent,
        }));

        const touchedItemIds = new Set([
            ...Object.keys(shareEdits).map(Number),
            ...Object.keys(costOverrideEdits).map(Number),
        ]);
        const lineAllocation: SplitPricingLineAllocationItem[] = [];
        touchedItemIds.forEach((itemId) => {
            const row = rows.find((r) => r.item.pricingBreakdownId === itemId);
            if (!row) return;
            row.cells.forEach((cell) => {
                const override = costOverrideEdits[itemId]?.[cell.legKey];
                lineAllocation.push({
                    pricingBreakdownId: itemId,
                    sequence: cell.legKey,
                    sharePercent: cell.sharePercent,
                    ...(override !== undefined && override !== null ? {costOverride: override} : {}),
                });
            });
        });

        props.onClose({action: 'confirm', allocation, lineAllocation});
    };

    const handleCancel = () => {
        if (props.mode === 'split') {
            props.onClose({action: 'cancel'});
        } else {
            props.onClose();
        }
    };

    const handleAddItem = async () => {
        if (props.mode !== 'edit' || !addName.trim()) return;
        setIsAddSaving(true);
        try {
            const revenue = typeof addRevenue === 'number' ? addRevenue : 0;
            const refreshed = await props.onAddItem(addName, revenue);
            setBreakdownState(normalizeEditBreakdown(refreshed));
            setIsAdding(false);
            setAddName('');
            setAddRevenue('');
            showToast?.(`Added "${addName}"`, 'success');
        } catch (error) {
            showToast?.(extractErrorMessage(error, 'Failed to add price item.'), 'error');
        } finally {
            setIsAddSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (props.mode !== 'edit' || confirmDeleteItemId === null) return;
        setIsDeleting(true);
        try {
            const refreshed = await props.onDeleteItem(confirmDeleteItemId);
            setBreakdownState(normalizeEditBreakdown(refreshed));
            setConfirmDeleteItemId(null);
            showToast?.('Price item deleted', 'success');
        } catch (error) {
            showToast?.(extractErrorMessage(error, 'Failed to delete price item.'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const deletingItemName = breakdownState.items.find((i) => i.pricingBreakdownId === confirmDeleteItemId)?.name;

    return (
        <DialogShell
            opened={open}
            onClose={handleCancel}
            size={computeDialogWidth(legKeys.length)}
            maw="95vw"
            label={isEdit ? 'Split Pricing Breakdown' : 'Confirm Split Pricing'}
        >
            <DialogHeader
                icon={<Icon lucide={isEdit ? ReceiptText : Split}/>}
                title={isEdit ? 'Split Pricing Breakdown' : 'Confirm Split Pricing'}
                subtitle={isEdit
                    ? 'The parent’s original items — each leg’s cost is derived and editable below'
                    : `${(props as SplitModeProps).jobNo} · ${formatCurrency(totals.totalRevenue)} to divide`}
                onClose={handleCancel}
            />

            {props.mode === 'split' && (
                <Box p="lg" pb={0} style={{backgroundColor: dialogContentBg}}>
                    <Alert color={props.preview.basis === 'EvenSplit' ? 'orange' : 'cyan'} variant="light">
                        {BASIS_LABELS[props.preview.basis]}. The job total stays{' '}
                        {formatCurrency(totals.totalRevenue)} — splitting does not change what the
                        client is invoiced.
                    </Alert>
                    {props.preview.isSynthesised && (
                        <Alert color="cyan" variant="light" mt="sm">
                            This job has no itemised price lines, so a single line is divided across
                            the legs.
                        </Alert>
                    )}
                </Box>
            )}

            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Group gap="md" grow align="stretch" wrap="wrap">
                    <SummaryCard
                        color="green"
                        icon={<Icon lucide={TrendingUp} size={28}/>}
                        label="Total Revenue"
                        value={formatCurrency(totals.totalRevenue)}
                    />
                    <SummaryCard
                        color="orange"
                        icon={<Icon lucide={Wallet} size={28}/>}
                        label="Total Cost"
                        value={formatCurrency(totals.totalCost)}
                    />
                    <SummaryCard
                        color="reflex"
                        icon={<Icon lucide={PiggyBank} size={28}/>}
                        label="Gross Profit"
                        value={formatCurrency(totals.profit)}
                        footer={totals.totalRevenue > 0 ? (
                            <Badge size="sm" mt={4} color={getMarginColor(totals.margin)}>
                                {totals.margin.toFixed(1)}% margin
                            </Badge>
                        ) : undefined}
                    />
                </Group>
            </Box>

            <Box p="lg" pt={0}>
                {/* Leg summary strip */}
                <Group gap="sm" mb="lg" wrap="wrap">
                    {legSummaries.map(({leg, revenue, cost, margin, sharePercent}) => (
                        <Paper key={leg.legKey} withBorder radius="md" p="sm" style={{flex: '1 1 200px'}}>
                            <Group justify="space-between" wrap="nowrap" mb={4}>
                                <Text fw={600} size="sm">{leg.label}</Text>
                                {leg.costLocked && (
                                    <Badge
                                        size="xs"
                                        color="gray"
                                        leftSection={<Icon lucide={Lock} size={10}/>}
                                    >
                                        {leg.costLockReason ?? 'Locked'}
                                    </Badge>
                                )}
                            </Group>
                            {leg.subtitle && <Text size="xs" c="dimmed" mb={6}>{leg.subtitle}</Text>}
                            <Group justify="space-between" wrap="nowrap">
                                <Text size="xs" c="dimmed">{sharePercent.toFixed(0)}% share</Text>
                                <Badge size="sm" color={getMarginColor(margin)}>{margin.toFixed(1)}%</Badge>
                            </Group>
                            <Group justify="space-between" wrap="nowrap" mt={4}>
                                <Text size="sm" fw={500}>{formatCurrency(revenue)}</Text>
                                <Text size="sm" c="dimmed">{formatCurrency(cost)}</Text>
                            </Group>
                        </Paper>
                    ))}
                </Group>

                <Group justify="space-between" mb="md" wrap="nowrap">
                    <Text fw={600} fz="lg">Price Items</Text>
                    {isEdit && (
                        <Button
                            leftSection={<Icon lucide={Plus}/>}
                            size="sm"
                            onClick={() => setIsAdding(true)}
                            disabled={revenueLocked}
                        >
                            Add Item
                        </Button>
                    )}
                </Group>

                {isEdit && isAdding && (
                    <Paper withBorder radius="md" p="md" mb="md">
                        <Group gap="md" align="flex-end" wrap="wrap">
                            <TextInput
                                label="Item Name"
                                value={addName}
                                onChange={(e) => setAddName(e.currentTarget.value)}
                                required
                                style={{flex: 2, minWidth: 180}}
                            />
                            <NumberInput
                                label="Revenue"
                                value={addRevenue}
                                onChange={(value) => setAddRevenue(value === '' || value == null ? '' : Number(value))}
                                min={0}
                                step={0.01}
                                decimalScale={2}
                                leftSection={moneyIcon}
                                style={{flex: 1, minWidth: 140}}
                            />
                            <Group gap="xs">
                                <Button variant="default" onClick={() => setIsAdding(false)} disabled={isAddSaving}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddItem}
                                    disabled={!addName.trim()}
                                    loading={isAddSaving}
                                >
                                    Add
                                </Button>
                            </Group>
                        </Group>
                    </Paper>
                )}

                <Paper withBorder radius="lg" className={classes.scrollArea}>
                    <Table>
                        <Table.Thead style={{backgroundColor: 'var(--mantine-color-gray-0)'}}>
                            <Table.Tr>
                                <Table.Th className={`${classes.itemCell} ${classes.headerCell}`} c="dimmed">Item</Table.Th>
                                <Table.Th className={`${classes.revenueCell} ${classes.headerCell}`} c="dimmed" ta="right">Revenue</Table.Th>
                                {breakdownState.legs.map((leg) => (
                                    <Table.Th key={leg.legKey} c="dimmed" ta="right" miw={130}>
                                        {leg.label} cost
                                        {leg.costLocked && <Icon lucide={Lock} size={12}/>}
                                    </Table.Th>
                                ))}
                                <Table.Th c="dimmed" ta="right">Total Cost</Table.Th>
                                <Table.Th c="dimmed" ta="right">Profit</Table.Th>
                                <Table.Th c="dimmed" ta="center">Margin</Table.Th>
                                {isEdit && <Table.Th c="dimmed" ta="center" w={60}/>}
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map(({item, revenue, cells, totalCost, profit, margin}) => (
                                <React.Fragment key={item.pricingBreakdownId}>
                                    <Table.Tr>
                                        <Table.Td className={classes.itemCell}>
                                            <Stack gap={2}>
                                                <Text size="sm" fw={500}>{item.name}</Text>
                                                <Button
                                                    variant="subtle"
                                                    size="compact-xs"
                                                    onClick={() => setOpenShareItemId(
                                                        openShareItemId === item.pricingBreakdownId ? null : item.pricingBreakdownId,
                                                    )}
                                                    disabled={shareLocked}
                                                >
                                                    Share %
                                                </Button>
                                            </Stack>
                                        </Table.Td>
                                        <Table.Td className={classes.revenueCell} ta="right">
                                            <NumberInput
                                                aria-label={`Revenue for ${item.name}`}
                                                value={revenue}
                                                onChange={(value) => handleRevenueChange(
                                                    item.pricingBreakdownId, value === '' || value == null ? 0 : Number(value),
                                                )}
                                                min={0}
                                                step={0.01}
                                                decimalScale={2}
                                                disabled={revenueLocked}
                                                hideControls
                                                size="xs"
                                            />
                                        </Table.Td>
                                        {cells.map((cell) => (
                                            <Table.Td key={cell.legKey} ta="right">
                                                <Stack gap={2} align="flex-end">
                                                    <NumberInput
                                                        aria-label={`Cost for ${item.name}, leg ${cell.legKey}`}
                                                        value={cell.cost}
                                                        onChange={(value) => handleCostChange(
                                                            item.pricingBreakdownId, cell.legKey,
                                                            value === '' || value == null ? 0 : Number(value),
                                                        )}
                                                        min={0}
                                                        step={0.01}
                                                        decimalScale={2}
                                                        disabled={breakdownState.legs.find((l) => l.legKey === cell.legKey)?.costLocked}
                                                        hideControls
                                                        size="xs"
                                                    />
                                                    <Text size="xs" c="dimmed">rev {formatCurrency(cell.revenue)}</Text>
                                                    {cell.isOverridden && (
                                                        <Group gap={4} wrap="nowrap">
                                                            <Text size="xs" c="orange">
                                                                was {formatCurrency(cell.derivedCost)}
                                                            </Text>
                                                            <Button
                                                                variant="subtle"
                                                                size="compact-xs"
                                                                onClick={() => handleResetCost(item.pricingBreakdownId, cell.legKey)}
                                                            >
                                                                Reset
                                                            </Button>
                                                        </Group>
                                                    )}
                                                </Stack>
                                            </Table.Td>
                                        ))}
                                        <Table.Td ta="right">
                                            <Text size="sm" c="dimmed">{formatCurrency(totalCost)}</Text>
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            <Text size="sm" fw={600} c={profit >= 0 ? 'green.6' : 'red.6'}>
                                                {formatCurrency(profit)}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td ta="center">
                                            {revenue > 0 && (
                                                <Badge size="sm" fw={600} miw={50} color={getMarginColor(margin)}>
                                                    {margin.toFixed(0)}%
                                                </Badge>
                                            )}
                                        </Table.Td>
                                        {isEdit && (
                                            <Table.Td ta="center">
                                                <ActionIcon
                                                    variant="light"
                                                    color="red"
                                                    aria-label={`Delete ${item.name}`}
                                                    onClick={() => setConfirmDeleteItemId(item.pricingBreakdownId)}
                                                    disabled={revenueLocked}
                                                >
                                                    <Icon lucide={Trash2} size={16}/>
                                                </ActionIcon>
                                            </Table.Td>
                                        )}
                                    </Table.Tr>
                                    {openShareItemId === item.pricingBreakdownId && (
                                        <Table.Tr>
                                            <Table.Td colSpan={cells.length + (isEdit ? 5 : 4)}>
                                                <Group gap="lg" wrap="wrap" p="sm">
                                                    <Text size="xs" fw={600} c="dimmed">Share of &quot;{item.name}&quot; per leg</Text>
                                                    {cells.map((cell) => (
                                                        <NumberInput
                                                            key={cell.legKey}
                                                            label={breakdownState.legs.find((l) => l.legKey === cell.legKey)?.label}
                                                            value={cell.sharePercent}
                                                            onChange={(value) => handleShareChange(
                                                                item.pricingBreakdownId, cell.legKey,
                                                                value === '' || value == null ? 0 : Number(value),
                                                            )}
                                                            min={0}
                                                            max={100}
                                                            step={1}
                                                            disabled={shareLocked}
                                                            size="xs"
                                                            w={110}
                                                            rightSection={<Text size="xs" c="dimmed">%</Text>}
                                                        />
                                                    ))}
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Box>

            {isEdit && (
                <DialogShell
                    opened={confirmDeleteItemId !== null}
                    onClose={() => (!isDeleting ? setConfirmDeleteItemId(null) : undefined)}
                    size={dialogSize.sm}
                    label="Delete price item?"
                    zIndex={300}
                >
                    <DialogHeader
                        icon={<Icon lucide={Trash2}/>}
                        title="Delete price item?"
                        onClose={() => setConfirmDeleteItemId(null)}
                        closeDisabled={isDeleting}
                        variant="error"
                    />
                    <Box p="lg">
                        <Text size="sm">
                            {deletingItemName
                                ? `"${deletingItemName}" will be removed from every leg and the totals recalculated.`
                                : ''}
                        </Text>
                    </Box>
                    <DialogFooter
                        onCancel={() => setConfirmDeleteItemId(null)}
                        onConfirm={handleConfirmDelete}
                        confirmLabel="Delete"
                        confirmColor="red"
                        confirmIcon={<Icon lucide={Trash2}/>}
                        submitting={isDeleting}
                    />
                </DialogShell>
            )}

            <Group
                justify="space-between"
                px="lg"
                py="md"
                wrap="nowrap"
                style={{
                    backgroundColor: 'var(--mantine-color-white)',
                    borderTop: '1px solid var(--mantine-color-gray-3)',
                }}
            >
                <Text size="sm" c="dimmed">
                    {rows.length} {rows.length === 1 ? 'item' : 'items'} •{' '}
                    <Text component="span" fw={600} c="var(--mantine-color-text)">
                        {formatCurrency(totals.totalRevenue)}
                    </Text>{' '}
                    total
                </Text>
                <Group gap="sm" wrap="nowrap">
                    <Button variant="default" onClick={handleCancel} miw={100}>
                        Cancel
                    </Button>
                    <Button
                        onClick={isEdit ? handleSaveEdit : handleConfirmSplit}
                        leftSection={<Icon lucide={isEdit ? CircleCheck : Split}/>}
                        loading={isSaving}
                        disabled={isEdit && !hasPendingEdits}
                        miw={140}
                    >
                        {isEdit ? 'Save & Close' : 'Confirm & Split'}
                    </Button>
                </Group>
            </Group>
        </DialogShell>
    );
};

export default SplitPricingBreakdownDialog;
