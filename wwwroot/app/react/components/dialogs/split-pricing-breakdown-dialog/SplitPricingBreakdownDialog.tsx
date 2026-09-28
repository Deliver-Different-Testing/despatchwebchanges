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
} from '@mantine/core';
import {
    CircleCheck,
    DollarSign,
    Lock,
    Plus,
    ReceiptText,
    Split,
    Trash2,
} from 'lucide-react';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {ShowToastFn} from '../../../services/toastService';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell,
    DialogHeader,
    DialogFooter,
    dialogContentBg,
    dialogSize,
    getMarginColor,
    PricingSummaryCards,
} from '../shared/mantine';
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
    /** True for a split child (shows the parent's breakdown) or a locked job — view only. */
    readOnly?: boolean;
    /** The viewing split child's own leg, highlighted among the legs shown. */
    highlightLegId?: number;
}

export interface SplitModeProps {
    mode: 'split';
    open: boolean;
    jobNo: string;
    preview: SplitPricingPreview;
    /** Courier name for each leg in `preview.legs` order; missing/null renders as "Unassigned". */
    legCourierNames?: (string | null)[];
    onClose: (result: SplitPricingResult) => void;
    showToast?: ShowToastFn;
}

export type SplitPricingBreakdownDialogProps = EditModeProps | SplitModeProps;

type ShareEdits = Record<number, Record<number, number>>;
type CostOverrideEdits = Record<number, Record<number, number | null>>;

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
    legLetter: string;
    jobOrDistanceText: string;
    label: string;
    subtitle: string;
    subtitleUnassigned: boolean;
    costLocked: boolean;
    costLockReason: string | null;
    overallSharePercent: number;
}

interface NormalizedBreakdown {
    items: NormalizedItem[];
    legs: NormalizedLeg[];
    revenueLocked: boolean;
    shareLocked: boolean;
}

const BASIS_LABELS: Record<SplitPricingBasis, string> = {
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
        legs: breakdown.legs.map((leg, index) => ({
            legKey: leg.jobId,
            legLetter: String.fromCharCode(65 + index),
            jobOrDistanceText: leg.jobNumber,
            label: leg.jobNumber,
            subtitle: leg.driverName ?? 'Unassigned',
            subtitleUnassigned: leg.driverName == null,
            costLocked: leg.costLocked,
            costLockReason: leg.costLockReason,
            overallSharePercent: 0,
        })),
        revenueLocked: breakdown.locks.revenueLocked,
        shareLocked: breakdown.locks.shareLocked,
    };
}

function normalizeSplitPreview(
    preview: SplitPricingPreview,
    legCourierNames: (string | null)[] = [],
): NormalizedBreakdown {
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
        legs: preview.legs.map((leg, index) => {
            const distanceText = leg.distance > 0 ? `road distance ${leg.distance} ${preview.distanceUnit}` : '';
            const courierName = legCourierNames[index] ?? null;
            const courierText = courierName ?? 'Unassigned';
            return {
                legKey: leg.sequence,
                legLetter: leg.letterSuffix,
                jobOrDistanceText: leg.distance > 0 ? `${leg.distance} ${preview.distanceUnit}` : '',
                label: `Leg ${leg.letterSuffix}`,
                subtitle: distanceText ? `${distanceText} · ${courierText}` : courierText,
                subtitleUnassigned: courierName == null,
                costLocked: false,
                costLockReason: null,
                overallSharePercent: leg.sharePercent,
            };
        }),
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

const moneyIcon = <Icon lucide={DollarSign} size={16}/>;

const LEG_HUES: Record<string, string> = {
    A: 'var(--mantine-color-reflex-6)',
    B: 'var(--mantine-color-green-7)',
    C: 'var(--mantine-color-orange-8)',
    D: 'var(--mantine-color-grape-6)',
};
const DEFAULT_LEG_HUE = 'var(--mantine-color-gray-6)';

export const SplitPricingBreakdownDialog: React.FC<SplitPricingBreakdownDialogProps> = (props) => {
    const {open, showToast} = props;
    const isEdit = props.mode === 'edit';
    const readOnly = props.mode === 'edit' && !!props.readOnly;
    const canEdit = isEdit && !readOnly;
    // Adding/deleting items only goes through the live PricingBreakdown endpoints; an archived
    // parent's existing items stay editable within the §7.5 locks.
    const canChangeItems = canEdit && !(props.mode === 'edit' && props.breakdown.isArchived);
    const highlightLegId = props.mode === 'edit' ? props.highlightLegId : undefined;

    const initialBreakdown = useMemo(
        () => (props.mode === 'edit'
            ? normalizeEditBreakdown(props.breakdown)
            : normalizeSplitPreview(props.preview, props.legCourierNames)),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-normalize only when the source data changes
        [props.mode === 'edit' ? props.breakdown : props.preview],
    );

    const [breakdownState, setBreakdownState] = useState(initialBreakdown);
    const [revenueEdits, setRevenueEdits] = useState<Record<number, number>>({});
    const [nameEdits, setNameEdits] = useState<Record<number, string>>({});
    const [shareEdits, setShareEdits] = useState<ShareEdits>({});
    const [legShareEdits, setLegShareEdits] = useState<Record<number, number>>({});
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
        setNameEdits({});
        setShareEdits({});
        setLegShareEdits({});
        setCostOverrideEdits({});
        setOpenShareItemId(null);
    }, [initialBreakdown]);

    const legKeys = useMemo(() => breakdownState.legs.map((leg) => leg.legKey), [breakdownState.legs]);
    const {revenueLocked, shareLocked} = breakdownState;
    const hasLegShareDefault = Object.keys(legShareEdits).length > 0;

    const rows = useMemo(() => breakdownState.items.map((item) => {
        const allocationByLeg = new Map(item.allocations.map((a) => [a.legKey, a]));
        const revenue = revenueEdits[item.pricingBreakdownId] ?? item.revenue;
        const name = nameEdits[item.pricingBreakdownId] ?? item.name;
        const itemShareOverride = shareEdits[item.pricingBreakdownId];
        const shares = legKeys.map((legKey) =>
            itemShareOverride?.[legKey] ?? legShareEdits[legKey] ?? allocationByLeg.get(legKey)?.sharePercent ?? 0);
        const previewRevenues = distributeAmount(revenue, shares, isEdit ? 'largest' : 'last');
        const totalDerivedCost = item.allocations.reduce((sum, a) => sum + (a.derivedCost ?? 0), 0);
        const previewCosts = distributeAmount(totalDerivedCost, shares, isEdit ? 'largest' : 'last');

        const cells = legKeys.map((legKey, index) => {
            const allocation = allocationByLeg.get(legKey);
            const pendingOverride = costOverrideEdits[item.pricingBreakdownId]?.[legKey];
            const effectiveOverride = pendingOverride !== undefined ? pendingOverride : (allocation?.costOverride ?? null);
            const derivedCost = previewCosts[index] ?? 0;
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

        return {item, name, revenue, cells, totalCost, totalDerivedCost, profit, margin, hasItemShareOverride: itemShareOverride !== undefined};
    }), [breakdownState.items, legKeys, revenueEdits, nameEdits, shareEdits, legShareEdits, costOverrideEdits, isEdit]);

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
        const shareValue = legShareEdits[leg.legKey] ?? (isEdit ? sharePercent : leg.overallSharePercent);
        return {leg, revenue, cost, margin, sharePercent, shareValue};
    }), [breakdownState.legs, rows, totals.totalRevenue, legShareEdits, isEdit]);

    const legShareTotal = useMemo(
        () => Math.round(legSummaries.reduce((sum, l) => sum + l.shareValue, 0)),
        [legSummaries],
    );

    const legRevenueSum = useMemo(() => legSummaries.reduce((sum, l) => sum + l.revenue, 0), [legSummaries]);
    const legsReconcile = Math.abs(legRevenueSum - totals.totalRevenue) < 0.005;

    const hasPendingEdits = Object.keys(revenueEdits).length > 0
        || Object.keys(nameEdits).length > 0
        || Object.keys(shareEdits).length > 0
        || hasLegShareDefault
        || Object.keys(costOverrideEdits).length > 0;

    const handleRevenueChange = (itemId: number, value: number) => {
        setRevenueEdits((prev) => ({...prev, [itemId]: value}));
    };

    const handleNameChange = (itemId: number, value: string) => {
        setNameEdits((prev) => ({...prev, [itemId]: value}));
    };

    const handleShareChange = (itemId: number, changedLegKey: number, newValue: number) => {
        const row = rows.find((r) => r.item.pricingBreakdownId === itemId);
        if (!row) return;
        const currentShares = row.cells.map((c) => c.sharePercent);
        const changedIndex = legKeys.indexOf(changedLegKey);
        if (changedIndex < 0) return;
        const normalized = normalizeShares(currentShares, changedIndex, newValue);
        const legShareMap: Record<number, number> = {};
        legKeys.forEach((legKey, i) => {
            legShareMap[legKey] = normalized[i];
        });
        setShareEdits((prev) => ({...prev, [itemId]: legShareMap}));
    };

    const handleResetItemShare = (itemId: number) => {
        setShareEdits((prev) => {
            const next = {...prev};
            delete next[itemId];
            return next;
        });
    };

    const handleLegShareChange = (changedLegKey: number, newValue: number) => {
        const currentValues = legSummaries.map((s) => s.shareValue);
        const changedIndex = legKeys.indexOf(changedLegKey);
        if (changedIndex < 0) return;
        const normalized = normalizeShares(currentValues, changedIndex, newValue);
        const nextLegShareEdits: Record<number, number> = {};
        legKeys.forEach((legKey, i) => {
            nextLegShareEdits[legKey] = normalized[i];
        });
        setLegShareEdits(nextLegShareEdits);
    };

    const handleCostChange = (itemId: number, changedLegKey: number, value: number) => {
        setCostOverrideEdits((prev) => ({...prev, [itemId]: {...prev[itemId], [changedLegKey]: value}}));

        const row = rows.find((r) => r.item.pricingBreakdownId === itemId);
        const changedIndex = legKeys.indexOf(changedLegKey);
        if (!row || changedIndex < 0 || row.totalDerivedCost <= 0) return;

        const newSharePercent = (value / row.totalDerivedCost) * 100;
        const currentShares = row.cells.map((c) => c.sharePercent);
        const normalized = normalizeShares(currentShares, changedIndex, newSharePercent);
        const legShareMap: Record<number, number> = {};
        legKeys.forEach((legKey, i) => {
            legShareMap[legKey] = normalized[i];
        });
        setShareEdits((prev) => ({...prev, [itemId]: legShareMap}));
    };

    const handleResetCost = (itemId: number, legKey: number) => {
        setCostOverrideEdits((prev) => ({...prev, [itemId]: {...prev[itemId], [legKey]: null}}));
        // The cost edit may have synced this item's share (handleCostChange); undo that too.
        setShareEdits((prev) => {
            const next = {...prev};
            delete next[itemId];
            return next;
        });
    };

    const handleSaveEdit = async () => {
        if (props.mode !== 'edit') return;
        setIsSaving(true);
        try {
            const touchedItemIds = new Set([
                ...Object.keys(revenueEdits).map(Number),
                ...Object.keys(nameEdits).map(Number),
            ]);
            const itemRevenues: SplitPricingItemRevenueUpdate[] = Array.from(touchedItemIds).map((id) => {
                const original = breakdownState.items.find((i) => i.pricingBreakdownId === id);
                return {
                    pricingBreakdownId: id,
                    revenue: revenueEdits[id] ?? original?.revenue ?? 0,
                    ...(nameEdits[id] !== undefined ? {name: nameEdits[id]} : {}),
                };
            });

            const allocations: SplitPricingAllocationUpdate[] = [];
            breakdownState.items.forEach((item) => {
                const itemId = item.pricingBreakdownId;
                const perItemShareMap = shareEdits[itemId];
                if (perItemShareMap) {
                    legKeys.forEach((legKey) => {
                        if (perItemShareMap[legKey] !== undefined) {
                            allocations.push({pricingBreakdownId: itemId, legJobId: legKey, sharePercent: perItemShareMap[legKey]});
                        }
                    });
                } else if (hasLegShareDefault) {
                    legKeys.forEach((legKey) => {
                        allocations.push({pricingBreakdownId: itemId, legJobId: legKey, sharePercent: legShareEdits[legKey]});
                    });
                }
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

            await props.onSave({
                jobId: props.breakdown.jobId,
                isArchived: props.breakdown.isArchived ?? false,
                itemRevenues,
                allocations,
            });
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
            sharePercent: legShareEdits[leg.legKey] ?? leg.overallSharePercent,
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
            label={isEdit ? 'Price Breakdown' : 'Confirm Split Pricing'}
        >
            <DialogHeader
                icon={<Icon lucide={isEdit ? ReceiptText : Split}/>}
                title={isEdit ? 'Price Breakdown' : 'Confirm Split Pricing'}
                subtitle={isEdit
                    ? (readOnly
                        ? `The parent’s original items, split across ${legKeys.length} legs — view only`
                        : `The parent’s original items, split across ${legKeys.length} legs — each leg’s cost is derived and editable below`)
                    : `${(props as SplitModeProps).jobNo} · ${formatCurrency(totals.totalRevenue)} to divide`}
                onClose={handleCancel}
            />

            <Box p="lg" pb={0} style={{backgroundColor: dialogContentBg}}>
                {props.mode === 'split' ? (
                    <>
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
                    </>
                ) : (
                    <Alert color="cyan" variant="light">
                        Pricing for every leg is managed here, on the parent job. The child jobs
                        show these figures read-only, so the parent and its legs can&apos;t drift
                        out of sync.
                        {readOnly && ' You are viewing this job’s leg below, highlighted.'}
                    </Alert>
                )}
            </Box>

            <PricingSummaryCards totals={totals}/>

            <Box p="lg" pt={0}>
                <Group justify="space-between" mb="sm" wrap="wrap">
                    <Text fw={600} fz="lg">Legs</Text>
                    <Badge size="sm" variant="light" color={legShareTotal === 100 ? 'gray' : 'red'}>
                        Shares total {legShareTotal}%
                    </Badge>
                </Group>
                <Group gap="sm" mb="lg" wrap="wrap">
                    {legSummaries.map(({leg, revenue, cost, margin, shareValue}) => {
                        const hue = LEG_HUES[leg.legLetter] ?? DEFAULT_LEG_HUE;
                        const isUnassigned = leg.subtitleUnassigned;
                        const isHighlighted = leg.legKey === highlightLegId;
                        return (
                            <Paper
                                key={leg.legKey}
                                withBorder
                                radius="md"
                                p="sm"
                                style={{
                                    flex: '1 1 200px',
                                    borderLeft: `3px solid ${hue}`,
                                    ...(isHighlighted
                                        ? {outline: `2px solid ${hue}`, outlineOffset: -1, backgroundColor: 'var(--mantine-color-gray-0)'}
                                        : {}),
                                }}
                            >
                                <Group gap={6} wrap="nowrap" mb={2}>
                                    <Badge size="sm" radius="sm" style={{backgroundColor: hue, color: 'white'}}>
                                        Leg {leg.legLetter}
                                    </Badge>
                                    <Text fw={700} size="sm">{leg.jobOrDistanceText}</Text>
                                    {isHighlighted && <Badge size="xs" variant="filled" color="gray">This job</Badge>}
                                </Group>
                                {leg.subtitle && (
                                    <Text
                                        size="xs"
                                        c={isUnassigned ? 'orange' : 'dimmed'}
                                        fw={isUnassigned ? 600 : 400}
                                        mb={6}
                                    >
                                        {leg.subtitle}
                                    </Text>
                                )}
                                <Group gap="md" wrap="nowrap" mt={4}>
                                    {[['Revenue', formatCurrency(revenue)], ['Cost', formatCurrency(cost)]].map(([k, v]) => (
                                        <Stack gap={0} key={k}>
                                            <Text size="xs" c="dimmed" fw={700} tt="uppercase">{k}</Text>
                                            <Text size="sm" fw={700}>{v}</Text>
                                        </Stack>
                                    ))}
                                    <Stack gap={0}>
                                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Margin</Text>
                                        <Badge size="sm" color={getMarginColor(margin)}>{margin.toFixed(1)}%</Badge>
                                    </Stack>
                                </Group>
                                <Group
                                    gap="xs"
                                    wrap="nowrap"
                                    mt={8}
                                    pt={8}
                                    style={{borderTop: '1px dashed var(--mantine-color-gray-3)'}}
                                >
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Share %</Text>
                                    <NumberInput
                                        aria-label={`Share % for ${leg.label}`}
                                        value={Math.round(shareValue)}
                                        onChange={(value) => handleLegShareChange(
                                            leg.legKey, value === '' || value == null ? 0 : Number(value),
                                        )}
                                        min={0}
                                        max={100}
                                        step={1}
                                        disabled={shareLocked || readOnly}
                                        size="xs"
                                        w={70}
                                    />
                                </Group>
                                {leg.costLocked && (
                                    <Badge
                                        mt={8}
                                        size="xs"
                                        variant="outline"
                                        color="gray"
                                        leftSection={<Icon lucide={Lock} size={10}/>}
                                    >
                                        {leg.costLockReason ?? 'Locked'}
                                    </Badge>
                                )}
                            </Paper>
                        );
                    })}
                </Group>

                <Group justify="space-between" mb="md" wrap="nowrap">
                    <Text fw={600} fz="lg">Price Items</Text>
                    {canChangeItems && (
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

                {canChangeItems && isAdding && (
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
                                <Table.Th c="dimmed" ta="center">Share</Table.Th>
                                {breakdownState.legs.map((leg) => (
                                    <Table.Th key={leg.legKey} c="dimmed" ta="right" miw={130}>
                                        <Stack gap={0} align="flex-end">
                                            <Group gap={4} wrap="nowrap">
                                                <Text size="xs" fw={700} c="dimmed">{leg.label} cost</Text>
                                                {leg.costLocked && <Icon lucide={Lock} size={12}/>}
                                            </Group>
                                            {leg.subtitle && (
                                                <Text fz={9} c={leg.costLocked ? 'orange' : 'dimmed'} fw={500} tt="none">
                                                    {leg.subtitle}
                                                </Text>
                                            )}
                                        </Stack>
                                    </Table.Th>
                                ))}
                                <Table.Th c="dimmed" ta="right">Total Cost</Table.Th>
                                <Table.Th c="dimmed" ta="right">Profit</Table.Th>
                                <Table.Th c="dimmed" ta="center">Margin</Table.Th>
                                {canChangeItems && <Table.Th c="dimmed" ta="center" w={60}/>}
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map(({item, name, revenue, cells, totalCost, profit, margin, hasItemShareOverride}) => (
                                <React.Fragment key={item.pricingBreakdownId}>
                                    <Table.Tr>
                                        <Table.Td className={classes.itemCell}>
                                            {canEdit ? (
                                                <TextInput
                                                    aria-label={`Name for ${item.name}`}
                                                    value={name}
                                                    onChange={(e) => handleNameChange(item.pricingBreakdownId, e.currentTarget.value)}
                                                    variant="unstyled"
                                                    size="sm"
                                                    styles={{input: {fontWeight: 500}}}
                                                />
                                            ) : (
                                                <Text size="sm" fw={500}>{name}</Text>
                                            )}
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
                                                disabled={revenueLocked || readOnly}
                                                hideControls
                                                size="xs"
                                            />
                                        </Table.Td>
                                        <Table.Td ta="center">
                                            <Button
                                                variant="default"
                                                size="compact-xs"
                                                aria-expanded={openShareItemId === item.pricingBreakdownId}
                                                onClick={() => setOpenShareItemId(
                                                    openShareItemId === item.pricingBreakdownId ? null : item.pricingBreakdownId,
                                                )}
                                                disabled={shareLocked || readOnly}
                                            >
                                                {cells.map((c) => Math.round(c.sharePercent)).join(' / ')}
                                            </Button>
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
                                                        disabled={readOnly || breakdownState.legs.find((l) => l.legKey === cell.legKey)?.costLocked}
                                                        hideControls
                                                        size="xs"
                                                    />
                                                    <Text size="xs" c="dimmed">rev {formatCurrency(cell.revenue)}</Text>
                                                    {cell.isOverridden && (
                                                        <Group gap={4} wrap="nowrap">
                                                            <Text size="xs" c="orange">
                                                                was {formatCurrency(cell.derivedCost)}
                                                            </Text>
                                                            {canEdit && (
                                                                <Button
                                                                    variant="subtle"
                                                                    size="compact-xs"
                                                                    onClick={() => handleResetCost(item.pricingBreakdownId, cell.legKey)}
                                                                >
                                                                    Reset
                                                                </Button>
                                                            )}
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
                                        {canChangeItems && (
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
                                            <Table.Td colSpan={cells.length + (canChangeItems ? 7 : 6)}>
                                                <Group gap="lg" wrap="wrap" p="sm" align="flex-end">
                                                    <Text size="xs" fw={600} c="dimmed">Share of &quot;{name}&quot; per leg</Text>
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
                                                            disabled={shareLocked || readOnly}
                                                            size="xs"
                                                            w={110}
                                                            rightSection={<Text size="xs" c="dimmed">%</Text>}
                                                        />
                                                    ))}
                                                    {canEdit && hasItemShareOverride && (
                                                        <Button
                                                            variant="subtle"
                                                            size="compact-xs"
                                                            onClick={() => handleResetItemShare(item.pricingBreakdownId)}
                                                            disabled={shareLocked}
                                                        >
                                                            Reset to overall split
                                                        </Button>
                                                    )}
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

            {canEdit && (
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
                    total • legs re-sum to{' '}
                    <Text component="span" fw={600} c={legsReconcile ? 'var(--mantine-color-text)' : 'red'}>
                        {formatCurrency(legRevenueSum)}
                    </Text>{' '}
                    {legsReconcile ? '✓' : '✕'}
                </Text>
                <Group gap="sm" wrap="nowrap">
                    {readOnly ? (
                        <Button onClick={handleCancel} miw={100}>
                            Close
                        </Button>
                    ) : (
                        <>
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
                        </>
                    )}
                </Group>
            </Group>
        </DialogShell>
    );
};

export default SplitPricingBreakdownDialog;
