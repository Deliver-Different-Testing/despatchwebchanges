/**
 * Price Breakdown Dialog
 *
 * Lists the pricing components that make up a job's charge, with inline
 * add/edit/delete and a live revenue/cost/margin summary.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Checkbox,
    Group,
    Loader,
    Paper,
    Stack,
    Table,
    Text,
    TextInput,
    Tooltip,
    ThemeIcon,
    alpha,
    NumberInput,
} from '@mantine/core';
import {
    Briefcase,
    CircleCheck,
    DollarSign,
    Fuel,
    Lock,
    Pencil,
    Plus,
    ReceiptText,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import {IconPackage} from '@tabler/icons-react';
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

export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
    costAmount?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface SuggestedFuelCharge {
    fuelChargeAmount: number;
    fuelCostAmount: number;
}

export interface PriceBreakdownDialogProps {
    open: boolean;
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
    isArchived?: boolean;
    /**
     * NZ handles fuel automatically elsewhere — the "Apply Fuel" option on manual charges
     * is only relevant (and only shown) for non-NZ tenants.
     */
    isUsCustomer?: boolean;
    /** When true the dialog opens in view-only mode: the breakdown table stays
     * visible, but all add/edit/delete/save controls are removed or disabled. */
    readOnly?: boolean;
    /** Split children: pricing is edited on the parent job, not here. Shows a
     * message + link back to the parent above the table; pair with readOnly. */
    managedElsewhere?: {parentJobNumber: string; onNavigateToParent: () => void};
    onClose: () => void;
    onSave: (totalAmount: number) => void;
    onAddItem: (item: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    onUpdateItem: (item: PriceBreakdown) => Promise<void>;
    onDeleteItem: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
    onGetSuggestedFuelCharge?: (chargeAmount: number) => Promise<SuggestedFuelCharge>;
    showToast?: ShowToastFn;
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string' && error.length > 0) {
        return error;
    }
    return fallback;
};

const calculateMargin = (revenue: number, cost: number): number => {
    if (revenue <= 0) return 0;
    return ((revenue - cost) / revenue) * 100;
};

/** The delete-confirmation modal needs to paint above the dialog that opened it. */
const CONFIRM_Z_INDEX = 300;

const moneyIcon = <Icon lucide={DollarSign} size={16}/>;

export const PriceBreakdownDialog: React.FC<PriceBreakdownDialogProps> = ({
    open,
    priceBreakdowns: initialBreakdowns,
    jobId,
    isPrebook,
    isArchived = false,
    isUsCustomer = false,
    readOnly = false,
    managedElsewhere,
    onClose,
    onSave,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
    onGetSuggestedFuelCharge,
    showToast,
}) => {
    const [priceBreakdowns, setPriceBreakdowns] = useState<PriceBreakdown[]>(initialBreakdowns);

    // Sync state when props change (e.g., when a new job is selected)
    useEffect(() => {
        setPriceBreakdowns(initialBreakdowns);
        // Reset editing state when data changes (new job selected)
        setIsEditing(false);
        setIsNew(false);
        setSelectedItem(null);
        setConfirmDelete(null);
    }, [initialBreakdowns]);

    const [isEditing, setIsEditing] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PriceBreakdown | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<PriceBreakdown | null>(null);

    const [formName, setFormName] = useState('');
    const [formAmount, setFormAmount] = useState<number | ''>('');
    const [formCostAmount, setFormCostAmount] = useState<number | ''>('');

    // Apply Fuel — only offered when adding a new item (US/non-NZ tenants only). Auto-suggests
    // a companion "<Name> Fuel" line's revenue/cost via GetSuggestedFuelCharge; the existing
    // PricingBreakdown sync trigger already rolls any charge named "...Fuel" into
    // FuelSurchargeAmount/CourierPayment, so no other backend change is needed.
    const [applyFuel, setApplyFuel] = useState(false);
    const [formFuelChargeAmount, setFormFuelChargeAmount] = useState<number | ''>('');
    const [formFuelCostAmount, setFormFuelCostAmount] = useState<number | ''>('');
    const [isFuelLoading, setIsFuelLoading] = useState(false);

    const totals = useMemo(() => {
        const totalRevenue = priceBreakdowns.reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalCost = priceBreakdowns.reduce((sum, item) => sum + (item.costAmount || 0), 0);
        const profit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
        return { totalRevenue, totalCost, profit, margin };
    }, [priceBreakdowns]);

    const formProfit = useMemo(() => {
        const revenue = typeof formAmount === 'number' ? formAmount : 0;
        const cost = typeof formCostAmount === 'number' ? formCostAmount : 0;
        return revenue - cost;
    }, [formAmount, formCostAmount]);

    const formMargin = useMemo(() => {
        const revenue = typeof formAmount === 'number' ? formAmount : 0;
        if (revenue <= 0) return 0;
        return calculateMargin(revenue, typeof formCostAmount === 'number' ? formCostAmount : 0);
    }, [formAmount, formCostAmount]);

    const handleAddNew = () => {
        setSelectedItem(null);
        setFormName('');
        setFormAmount('');
        setFormCostAmount('');
        setApplyFuel(false);
        setFormFuelChargeAmount('');
        setFormFuelCostAmount('');
        setIsNew(true);
        setIsEditing(true);
    };

    const handleEdit = (item: PriceBreakdown) => {
        setSelectedItem(item);
        setFormName(item.name);
        setFormAmount(item.amount);
        setFormCostAmount(item.costAmount ?? 0);
        // Apply Fuel only applies to adding a new (paired) line — not editing an existing one.
        setApplyFuel(false);
        setFormFuelChargeAmount('');
        setFormFuelCostAmount('');
        setIsNew(false);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setSelectedItem(null);
        setIsEditing(false);
        setIsNew(false);
    };

    const fetchSuggestedFuel = async (chargeAmount: number) => {
        if (!onGetSuggestedFuelCharge || chargeAmount <= 0) return;
        setIsFuelLoading(true);
        try {
            const suggestion = await onGetSuggestedFuelCharge(chargeAmount);
            setFormFuelChargeAmount(suggestion.fuelChargeAmount);
            setFormFuelCostAmount(suggestion.fuelCostAmount);
        } catch (error) {
            showToast?.(extractErrorMessage(error, 'Failed to calculate suggested fuel charge.'), 'error');
        } finally {
            setIsFuelLoading(false);
        }
    };

    const handleToggleApplyFuel = async (checked: boolean) => {
        setApplyFuel(checked);
        if (checked) {
            const amount = typeof formAmount === 'number' ? formAmount : 0;
            await fetchSuggestedFuel(amount);
        }
    };

    const handleSaveItem = async () => {
        if (!formName.trim()) return;

        setIsSaving(true);
        const wasNew = isNew;
        try {
            const amount = typeof formAmount === 'number' ? formAmount : 0;
            const costAmount = typeof formCostAmount === 'number' ? formCostAmount : 0;

            if (wasNew) {
                const newItem: Omit<PriceBreakdown, 'chargeId'> = {
                    name: formName,
                    amount,
                    costAmount,
                    isArchived,
                    ...(isPrebook ? { prebookJobId: jobId } : { childJobId: jobId }),
                };
                const chargeId = await onAddItem(newItem);
                const addedItems = [{ ...newItem, chargeId }];

                if (applyFuel) {
                    const fuelChargeAmount = typeof formFuelChargeAmount === 'number' ? formFuelChargeAmount : 0;
                    const fuelCostAmount = typeof formFuelCostAmount === 'number' ? formFuelCostAmount : 0;
                    const fuelItem: Omit<PriceBreakdown, 'chargeId'> = {
                        name: `${formName} Fuel`,
                        amount: fuelChargeAmount,
                        costAmount: fuelCostAmount,
                        isArchived,
                        ...(isPrebook ? { prebookJobId: jobId } : { childJobId: jobId }),
                    };
                    const fuelChargeId = await onAddItem(fuelItem);
                    addedItems.push({ ...fuelItem, chargeId: fuelChargeId });
                }

                setPriceBreakdowns([...priceBreakdowns, ...addedItems]);
                showToast?.(`Added "${formName}"${applyFuel ? ' and fuel charge' : ''}`, 'success');
            } else if (selectedItem) {
                const updatedItem: PriceBreakdown = {
                    ...selectedItem,
                    name: formName,
                    amount,
                    costAmount,
                    isArchived,
                };
                await onUpdateItem(updatedItem);
                setPriceBreakdowns(priceBreakdowns.map(item =>
                    item.chargeId === selectedItem.chargeId ? updatedItem : item
                ));
                showToast?.(`Updated "${formName}"`, 'success');
            }
            handleCancelEdit();
        } catch (error) {
            const action = wasNew ? 'add' : 'update';
            showToast?.(extractErrorMessage(error, `Failed to ${action} price item.`), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRequest = (item: PriceBreakdown) => {
        setConfirmDelete(item);
    };

    const handleCancelDelete = () => {
        if (isDeleting !== null) return;
        setConfirmDelete(null);
    };

    const handleConfirmDelete = async () => {
        const item = confirmDelete;
        if (!item) return;

        setIsDeleting(item.chargeId);
        try {
            await onDeleteItem(item.chargeId, jobId, isArchived);
            setPriceBreakdowns(priceBreakdowns.filter(pb => pb.chargeId !== item.chargeId));
            showToast?.(`Deleted "${item.name}"`, 'success');
            setConfirmDelete(null);
        } catch (error) {
            showToast?.(extractErrorMessage(error, 'Failed to delete price item.'), 'error');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSaveAndClose = () => {
        onSave(totals.totalRevenue);
    };

    const isFormValid = formName.trim().length > 0;
    const itemCountLabel = `${priceBreakdowns.length} ${priceBreakdowns.length === 1 ? 'item' : 'items'}`;

    return (
        <DialogShell opened={open} onClose={onClose} size={dialogSize.md} label="Price Breakdown">
            <DialogHeader
                icon={<Icon lucide={readOnly ? Lock : ReceiptText}/>}
                title="Price Breakdown"
                subtitle={
                    managedElsewhere ? 'Managed on the parent job'
                        : readOnly ? 'View only — this job is locked'
                        : 'Manage pricing components for this job'
                }
                onClose={onClose}
            />
            <Box>
                {managedElsewhere && !isEditing && (
                    <Box p="lg" pb={0} style={{backgroundColor: dialogContentBg}}>
                        <Alert icon={<Icon lucide={Briefcase}/>} color="gray" variant="light">
                            Pricing is managed on the parent job — no per-row edit, delete, or
                            Add Item here.{' '}
                            <Button
                                variant="subtle"
                                size="compact-sm"
                                onClick={managedElsewhere.onNavigateToParent}
                            >
                                {managedElsewhere.parentJobNumber}
                            </Button>
                        </Alert>
                    </Box>
                )}
                {!isEditing && priceBreakdowns.length > 0 && (
                    <PricingSummaryCards totals={totals}/>
                )}

                {/* List View */}
                {!isEditing && (
                    <Box p="lg" pt={priceBreakdowns.length > 0 ? 0 : 'lg'}>
                        {/* Action Bar */}
                        <Group justify="space-between" mb="md" wrap="nowrap">
                            <Group gap="sm" wrap="nowrap">
                                <Text fw={600} fz="lg">Price Items</Text>
                                {priceBreakdowns.length > 0 && (
                                    <Badge size="sm" color="gray" variant="light">{itemCountLabel}</Badge>
                                )}
                            </Group>
                            {!readOnly && (
                                <Button leftSection={<Icon lucide={Plus}/>} onClick={handleAddNew}>
                                    Add Item
                                </Button>
                            )}
                        </Group>

                        {/* Table */}
                        {priceBreakdowns.length > 0 ? (
                            <Paper withBorder radius="lg" style={{overflow: 'hidden'}}>
                                <Table highlightOnHover>
                                    <Table.Thead style={{backgroundColor: 'var(--mantine-color-gray-0)'}}>
                                        <Table.Tr>
                                            <Table.Th c="dimmed">Item Name</Table.Th>
                                            <Table.Th c="dimmed" ta="right">Revenue</Table.Th>
                                            <Table.Th c="dimmed" ta="right">Cost</Table.Th>
                                            <Table.Th c="dimmed" ta="right">Profit</Table.Th>
                                            <Table.Th c="dimmed" ta="center">Margin</Table.Th>
                                            <Table.Th c="dimmed" ta="center" w={100}>Actions</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {priceBreakdowns.map((item) => {
                                            const profit = (item.amount || 0) - (item.costAmount || 0);
                                            const margin = calculateMargin(item.amount || 0, item.costAmount || 0);
                                            return (
                                                <Table.Tr key={item.chargeId}>
                                                    <Table.Td>
                                                        <Group gap="sm" wrap="nowrap">
                                                            <ThemeIcon size={36} radius="md" variant="light" color="brand">
                                                                <Icon tabler={IconPackage} size={18}/>
                                                            </ThemeIcon>
                                                            <Box>
                                                                <Text size="sm" fw={500}>{item.name}</Text>
                                                                {item.childJobId === jobId && (
                                                                    <Badge
                                                                        size="xs"
                                                                        mt={4}
                                                                        leftSection={<Icon lucide={Briefcase} size={12}/>}
                                                                    >
                                                                        This Job
                                                                    </Badge>
                                                                )}
                                                            </Box>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td ta="right">
                                                        <Text size="sm" fw={500}>{formatCurrency(item.amount || 0)}</Text>
                                                    </Table.Td>
                                                    <Table.Td ta="right">
                                                        <Text size="sm" c="dimmed">{formatCurrency(item.costAmount || 0)}</Text>
                                                    </Table.Td>
                                                    <Table.Td ta="right">
                                                        <Text size="sm" fw={600} c={profit >= 0 ? 'green.6' : 'red.6'}>
                                                            {formatCurrency(profit)}
                                                        </Text>
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        {(item.amount || 0) > 0 && (
                                                            <Badge size="sm" fw={600} miw={50} color={getMarginColor(margin)}>
                                                                {margin.toFixed(0)}%
                                                            </Badge>
                                                        )}
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        <Group gap={4} justify="center" wrap="nowrap">
                                                            <ActionIcon
                                                                variant="light"
                                                                onClick={() => handleEdit(item)}
                                                                disabled={isDeleting !== null || readOnly}
                                                                aria-label={`Edit ${item.name}`}
                                                            >
                                                                <Icon lucide={Pencil} size={18}/>
                                                            </ActionIcon>
                                                            <ActionIcon
                                                                variant="light"
                                                                color="red"
                                                                onClick={() => handleDeleteRequest(item)}
                                                                disabled={isDeleting !== null || readOnly}
                                                                aria-label={`Delete ${item.name}`}
                                                                loading={isDeleting === item.chargeId}
                                                            >
                                                                <Icon lucide={Trash2} size={18}/>
                                                            </ActionIcon>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                    </Table.Tbody>
                                </Table>
                            </Paper>
                        ) : (
                            <Paper
                                p={40}
                                ta="center"
                                radius="lg"
                                style={{
                                    border: '2px dashed var(--mantine-color-default-border)',
                                    backgroundColor: 'var(--mantine-color-gray-0)',
                                }}
                            >
                                    {/* An empty-state glyph in a tinted disc is `ThemeIcon variant="light"`. */}
                                    <ThemeIcon size={72} radius="xl" variant="light" mx="auto" mb="md">
                                        <Icon lucide={ReceiptText} size={36}/>
                                    </ThemeIcon>
                                <Text fz="lg" c="dimmed" mb="xs">No price items yet</Text>
                                <Text size="sm" c="dimmed" mb="md">
                                    {readOnly
                                        ? 'There are no price breakdown items to view'
                                        : 'Start by adding your first price breakdown item'}
                                </Text>
                                {!readOnly && (
                                    <Button leftSection={<Icon lucide={Plus}/>} onClick={handleAddNew}>
                                        Add First Item
                                    </Button>
                                )}
                            </Paper>
                        )}
                    </Box>
                )}

                {/* Edit Form */}
                {isEditing && (
                    <Box p="lg">
                        <Paper withBorder radius="lg" style={{overflow: 'hidden'}}>
                            {/* Form Header */}
                            <Group
                                gap="sm"
                                px="lg"
                                py="md"
                                wrap="nowrap"
                                style={{
                                    backgroundColor: alpha('var(--mantine-color-brand-6)', 0.06),
                                    borderBottom: '1px solid var(--mantine-color-default-border)',
                                }}
                            >
                                <ThemeIcon size={40} radius="md" variant="default" c="brand.6">
                                    <Icon lucide={isNew ? Plus : Pencil}/>
                                </ThemeIcon>
                                <Text fw={600} fz="lg">{isNew ? 'Add New Price Item' : 'Edit Price Item'}</Text>
                            </Group>

                            {/* Form Body */}
                            <Stack gap="lg" p="lg">
                                <TextInput
                                    label="Item Name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.currentTarget.value)}
                                    required
                                    placeholder="e.g., Installation Services"
                                />

                                <Group gap="md" grow align="flex-start">
                                    <NumberInput
                                        label="Revenue Amount"
                                        value={formAmount}
                                        onChange={(value) => setFormAmount(value === '' || value == null ? '' : Number(value))}
                                        placeholder="0.00"
                                        description="Optional"
                                        min={0}
                                        step={0.01}
                                        decimalScale={2}
                                        leftSection={moneyIcon}
                                    />
                                    <NumberInput
                                        label="Cost Amount"
                                        value={formCostAmount}
                                        onChange={(value) => setFormCostAmount(value === '' || value == null ? '' : Number(value))}
                                        placeholder="0.00"
                                        description="Defaults to 0"
                                        min={0}
                                        step={0.01}
                                        decimalScale={2}
                                        leftSection={moneyIcon}
                                    />
                                </Group>

                                {/* Apply Fuel — non-NZ tenants only; NZ handles fuel automatically elsewhere */}
                                {isUsCustomer && isNew && (
                                    <Paper
                                        p="md"
                                        radius="md"
                                        style={{
                                            backgroundColor: alpha('var(--mantine-color-reflex-6)', 0.04),
                                            border: `1px solid ${alpha('var(--mantine-color-reflex-6)', 0.2)}`,
                                        }}
                                    >
                                        <Checkbox
                                            checked={applyFuel}
                                            onChange={(e) => handleToggleApplyFuel(e.currentTarget.checked)}
                                            disabled={typeof formAmount !== 'number' || formAmount <= 0}
                                            label={
                                                <Box>
                                                    <Text size="sm" fw={500}>Apply Fuel</Text>
                                                    <Text size="xs" c="dimmed">
                                                        Adds a companion &quot;{formName || 'Item'} Fuel&quot; line using this job&apos;s fuel rate
                                                    </Text>
                                                </Box>
                                            }
                                        />

                                        {applyFuel && (
                                            <Group gap="md" mt="md" align="flex-start" wrap="nowrap">
                                                <NumberInput
                                                    label="Fuel Charge Amount"
                                                    value={formFuelChargeAmount}
                                                    onChange={(value) => setFormFuelChargeAmount(value === '' || value == null ? '' : Number(value))}
                                                    placeholder="0.00"
                                                    description="Suggested — editable before saving"
                                                    disabled={isFuelLoading}
                                                    min={0}
                                                    step={0.01}
                                                    decimalScale={2}
                                                    leftSection={moneyIcon}
                                                    style={{flex: 1}}
                                                />
                                                <NumberInput
                                                    label="Fuel Cost Amount"
                                                    value={formFuelCostAmount}
                                                    onChange={(value) => setFormFuelCostAmount(value === '' || value == null ? '' : Number(value))}
                                                    placeholder="0.00"
                                                    description="Driver's share of the fuel charge"
                                                    disabled={isFuelLoading}
                                                    min={0}
                                                    step={0.01}
                                                    decimalScale={2}
                                                    leftSection={moneyIcon}
                                                    style={{flex: 1}}
                                                />
                                                <Tooltip label="Recalculate from the current Revenue Amount">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="gray"
                                                        mt={28}
                                                        aria-label="Recalculate suggested fuel"
                                                        onClick={() => fetchSuggestedFuel(typeof formAmount === 'number' ? formAmount : 0)}
                                                        disabled={isFuelLoading || typeof formAmount !== 'number' || formAmount <= 0}
                                                        loading={isFuelLoading}
                                                    >
                                                        <Icon lucide={RefreshCw}/>
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Group>
                                        )}
                                    </Paper>
                                )}

                                {/* Live Preview */}
                                {(typeof formAmount === 'number' || typeof formCostAmount === 'number') && (
                                    <Paper
                                        withBorder
                                        p="md"
                                        radius="md"
                                        style={{backgroundColor: 'var(--mantine-color-gray-0)'}}
                                    >
                                        <Text size="xs" tt="uppercase" c="dimmed" mb="sm" display="block" style={{letterSpacing: 1}}>
                                            Live Preview
                                        </Text>
                                        <Group gap={32} justify="center">
                                            <Box ta="center">
                                                <Text size="sm" c="dimmed" mb={4}>Profit</Text>
                                                <Text fz="h3" fw={700} c={formProfit >= 0 ? 'green.6' : 'red.6'}>
                                                    {formatCurrency(formProfit)}
                                                </Text>
                                            </Box>
                                            {typeof formAmount === 'number' && formAmount > 0 && (
                                                <Box ta="center">
                                                    <Text size="sm" c="dimmed" mb={4}>Margin</Text>
                                                    <Badge size="lg" fw={700} color={getMarginColor(formMargin)}>
                                                        {formMargin.toFixed(1)}%
                                                    </Badge>
                                                </Box>
                                            )}
                                        </Group>
                                    </Paper>
                                )}
                            </Stack>

                            {/* Form Actions */}
                            <Group
                                justify="flex-end"
                                gap="sm"
                                px="lg"
                                py="md"
                                style={{
                                    backgroundColor: 'var(--mantine-color-gray-0)',
                                    borderTop: '1px solid var(--mantine-color-default-border)',
                                }}
                            >
                                <Button variant="default" onClick={handleCancelEdit} disabled={isSaving} miw={100}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveItem}
                                    disabled={!isFormValid}
                                    loading={isSaving}
                                    leftSection={<Icon lucide={isNew ? Plus : CircleCheck}/>}
                                    miw={140}
                                >
                                    {isNew ? 'Add Item' : 'Save Changes'}
                                </Button>
                            </Group>
                        </Paper>
                    </Box>
                )}
            </Box>

            {/* Delete confirmation (in-dialog, not window.confirm) */}
            <DialogShell
                opened={confirmDelete !== null}
                onClose={handleCancelDelete}
                size={dialogSize.sm}
                label="Delete price item?"
                zIndex={CONFIRM_Z_INDEX}
            >
                <DialogHeader
                    icon={<Icon lucide={Trash2}/>}
                    title="Delete price item?"
                    onClose={handleCancelDelete}
                    closeDisabled={isDeleting !== null}
                    variant="error"
                />
                <Box p="lg">
                    <Text size="sm">
                        {confirmDelete
                            ? `"${confirmDelete.name}" will be removed from the breakdown and the job total will be recalculated.`
                            : ''}
                    </Text>
                </Box>
                <DialogFooter
                    onCancel={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    confirmLabel="Delete"
                    confirmColor="red"
                    confirmIcon={<Icon lucide={Trash2}/>}
                    submitting={isDeleting !== null}
                />
            </DialogShell>

            {/* Footer Actions */}
            {!isEditing && (
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
                        {priceBreakdowns.length > 0 && (
                            <>
                                {itemCountLabel} •{' '}
                                <Text component="span" fw={600} c="var(--mantine-color-text)">
                                    {formatCurrency(totals.totalRevenue)}
                                </Text>{' '}
                                total
                            </>
                        )}
                    </Text>
                    <Group gap="sm" wrap="nowrap">
                        <Button variant="default" onClick={onClose} miw={100}>
                            {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        {!readOnly && (
                            <Button
                                onClick={handleSaveAndClose}
                                leftSection={<Icon lucide={CircleCheck}/>}
                                miw={140}
                            >
                                Save &amp; Close
                            </Button>
                        )}
                    </Group>
                </Group>
            )}
        </DialogShell>
    );
};

export default PriceBreakdownDialog;
