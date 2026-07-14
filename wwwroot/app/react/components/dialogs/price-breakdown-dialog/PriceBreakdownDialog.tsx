/**
 * React Price Breakdown Dialog
 *
 * A dialog for viewing and editing price breakdown items for a job.
 * Displays revenue, cost, and profit calculations with CRUD operations.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {formatCurrency} from '../../../utils/currencyUtils';
import type {ShowToastFn} from '../../../services/toastService';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InventoryIcon from '@mui/icons-material/Inventory2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RefreshIcon from '@mui/icons-material/Refresh';
import SavingsIcon from '@mui/icons-material/Savings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from '../shared/styles';

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

const getMarginColor = (margin: number): 'success' | 'warning' | 'error' => {
    if (margin >= 40) return 'success';
    if (margin >= 20) return 'warning';
    return 'error';
};

export const PriceBreakdownDialog: React.FC<PriceBreakdownDialogProps> = ({
    open,
    priceBreakdowns: initialBreakdowns,
    jobId,
    isPrebook,
    isArchived = false,
    isUsCustomer = false,
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

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: { overflow: 'hidden' },
                },
            }}
        >
            {/* Header */}
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <ReceiptLongIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>
                        Price Breakdown
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Manage pricing components for this job
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)},
                    })}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent sx={{ p: 0 }}>
                {/* Summary Cards */}
                {!isEditing && priceBreakdowns.length > 0 && (
                    <Box sx={{ p: 3, bgcolor: 'background.default' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            {/* Revenue Card */}
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    flex: 1,
                                    p: 2.5,
                                    borderRadius: 3,
                                    border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                                    bgcolor: alpha(theme.palette.success.main, 0.04),
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 52,
                                        height: 52,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.success.main, 0.12),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    })}
                                >
                                    <TrendingUpIcon sx={{ fontSize: 28, color: 'success.main' }} />
                                </Box>
                                <Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            fontWeight: 500
                                        }}>
                                        Total Revenue
                                    </Typography>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            fontWeight: 700,
                                            color: "success.dark"
                                        }}>
                                        {formatCurrency(totals.totalRevenue)}
                                    </Typography>
                                </Box>
                            </Paper>

                            {/* Cost Card */}
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    flex: 1,
                                    p: 2.5,
                                    borderRadius: 3,
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                                    bgcolor: alpha(theme.palette.warning.main, 0.04),
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 52,
                                        height: 52,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.warning.main, 0.12),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    })}
                                >
                                    <WalletIcon sx={{ fontSize: 28, color: 'warning.dark' }} />
                                </Box>
                                <Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            fontWeight: 500
                                        }}>
                                        Total Cost
                                    </Typography>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            fontWeight: 700,
                                            color: "warning.dark"
                                        }}>
                                        {formatCurrency(totals.totalCost)}
                                    </Typography>
                                </Box>
                            </Paper>

                            {/* Profit Card */}
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    flex: 1,
                                    p: 2.5,
                                    borderRadius: 3,
                                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                                    bgcolor: alpha(theme.palette.info.main, 0.04),
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 52,
                                        height: 52,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.info.main, 0.12),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    })}
                                >
                                    <SavingsIcon sx={{ fontSize: 28, color: 'info.main' }} />
                                </Box>
                                <Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            fontWeight: 500
                                        }}>
                                        Gross Profit
                                    </Typography>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            fontWeight: 700,
                                            color: "info.dark"
                                        }}>
                                        {formatCurrency(totals.profit)}
                                    </Typography>
                                    {totals.totalRevenue > 0 && (
                                        <Chip
                                            label={`${totals.margin.toFixed(1)}% margin`}
                                            size="small"
                                            color={getMarginColor(totals.margin)}
                                            sx={{ mt: 0.5, height: 22, fontSize: '0.7rem' }}
                                        />
                                    )}
                                </Box>
                            </Paper>
                        </Stack>
                    </Box>
                )}

                {/* List View */}
                {!isEditing && (
                    <Box sx={{ p: 3, pt: priceBreakdowns.length > 0 ? 0 : 3 }}>
                        {/* Action Bar */}
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Typography variant="h6" sx={{
                                    fontWeight: 600
                                }}>
                                    Price Items
                                </Typography>
                                {priceBreakdowns.length > 0 && (
                                    <Chip
                                        label={`${priceBreakdowns.length} ${priceBreakdowns.length === 1 ? 'item' : 'items'}`}
                                        size="small"
                                        sx={{ bgcolor: 'grey.100' }}
                                    />
                                )}
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddNew}
                                sx={{ borderRadius: 2 }}
                            >
                                Add Item
                            </Button>
                        </Box>

                        {/* Table */}
                        {priceBreakdowns.length > 0 ? (
                            <TableContainer
                                component={Paper}
                                elevation={0}
                                sx={(theme) => ({
                                    borderRadius: 3,
                                    border: `1px solid ${theme.palette.divider}`,
                                })}
                            >
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Item Name
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Revenue
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Cost
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Profit
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                Margin
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', width: 100 }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {priceBreakdowns.map((item, index) => {
                                            const profit = (item.amount || 0) - (item.costAmount || 0);
                                            const margin = calculateMargin(item.amount || 0, item.costAmount || 0);
                                            return (
                                                <TableRow
                                                    key={item.chargeId}
                                                    hover
                                                    sx={{
                                                        '&:last-child td': { border: 0 },
                                                        bgcolor: index % 2 === 0 ? 'white' : 'grey.25',
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Box
                                                                sx={(theme) => ({
                                                                    width: 36,
                                                                    height: 36,
                                                                    borderRadius: 1.5,
                                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                })}
                                                            >
                                                                <InventoryIcon fontSize="small" color="primary" />
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="body2" sx={{
                                                                    fontWeight: 500
                                                                }}>
                                                                    {item.name}
                                                                </Typography>
                                                                {item.childJobId === jobId && (
                                                                    <Chip
                                                                        icon={<WorkIcon sx={{ fontSize: 14 }} />}
                                                                        label="This Job"
                                                                        size="small"
                                                                        color="primary"
                                                                        sx={{ height: 20, mt: 0.5, '& .MuiChip-label': { px: 0.75 } }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" sx={{
                                                            fontWeight: 500
                                                        }}>
                                                            {formatCurrency(item.amount || 0)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" sx={{
                                                            color: "text.secondary"
                                                        }}>
                                                            {formatCurrency(item.costAmount || 0)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography
                                                            variant="body2"
                                                            color={profit >= 0 ? 'success.main' : 'error.main'}
                                                            sx={{
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {formatCurrency(profit)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {(item.amount || 0) > 0 && (
                                                            <Chip
                                                                label={`${margin.toFixed(0)}%`}
                                                                size="small"
                                                                color={getMarginColor(margin)}
                                                                sx={{ fontWeight: 600, minWidth: 50 }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={0.5} sx={{
                                                            justifyContent: "center"
                                                        }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEdit(item)}
                                                                disabled={isDeleting !== null}
                                                                sx={(theme) => ({
                                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                                                                })}
                                                            >
                                                                <EditIcon fontSize="small" color="primary" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleDeleteRequest(item)}
                                                                disabled={isDeleting !== null}
                                                                sx={(theme) => ({
                                                                    bgcolor: alpha(theme.palette.error.main, 0.08),
                                                                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.16) },
                                                                })}
                                                            >
                                                                {isDeleting === item.chargeId ? (
                                                                    <CircularProgress size={18} color="error" />
                                                                ) : (
                                                                    <DeleteIcon fontSize="small" color="error" />
                                                                )}
                                                            </IconButton>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    p: 5,
                                    textAlign: 'center',
                                    borderRadius: 3,
                                    border: `2px dashed ${theme.palette.divider}`,
                                    bgcolor: 'grey.50',
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 72,
                                        height: 72,
                                        borderRadius: '50%',
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mx: 'auto',
                                        mb: 2,
                                    })}
                                >
                                    <ReceiptLongIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                                </Box>
                                <Typography variant="h6" gutterBottom sx={{
                                    color: "text.secondary"
                                }}>
                                    No price items yet
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: "text.secondary",
                                        mb: 2
                                    }}>
                                    Start by adding your first price breakdown item
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddNew}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Add First Item
                                </Button>
                            </Paper>
                        )}
                    </Box>
                )}

                {/* Edit Form */}
                {isEditing && (
                    <Box sx={{ p: 3 }}>
                        <Paper
                            elevation={0}
                            sx={(theme) => ({
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                overflow: 'hidden',
                            })}
                        >
                            {/* Form Header */}
                            <Box
                                sx={(theme) => ({
                                    px: 3,
                                    py: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 40,
                                        height: 40,
                                        borderRadius: 2,
                                        bgcolor: 'background.paper',
                                        border: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    })}
                                >
                                    {isNew ? (
                                        <AddIcon color="primary" />
                                    ) : (
                                        <EditIcon color="primary" />
                                    )}
                                </Box>
                                <Typography variant="h6" sx={{
                                    fontWeight: 600
                                }}>
                                    {isNew ? 'Add New Price Item' : 'Edit Price Item'}
                                </Typography>
                            </Box>

                            {/* Form Body */}
                            <Box sx={{ p: 3 }}>
                                <Stack spacing={3}>
                                    <TextField
                                        label="Item Name"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        fullWidth
                                        required
                                        placeholder="e.g., Installation Services"
                                        slotProps={{
                                            input: {
                                                sx: { borderRadius: 2 },
                                            },
                                        }}
                                    />

                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <TextField
                                            label="Revenue Amount"
                                            type="number"
                                            value={formAmount}
                                            onChange={(e) => setFormAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                            fullWidth
                                            placeholder="0.00"
                                            helperText="Optional"
                                            slotProps={{
                                                htmlInput: {min: 0, step: 0.01},
                                                input: {
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <MoneyIcon color="action" fontSize="small" />
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 },
                                                },
                                            }}
                                        />
                                        <TextField
                                            label="Cost Amount"
                                            type="number"
                                            value={formCostAmount}
                                            onChange={(e) => setFormCostAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                            fullWidth
                                            placeholder="0.00"
                                            helperText="Defaults to 0"
                                            slotProps={{
                                                htmlInput: {min: 0, step: 0.01},
                                                input: {
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <MoneyIcon color="action" fontSize="small" />
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 },
                                                },
                                            }}
                                        />
                                    </Stack>

                                    {/* Apply Fuel — non-NZ tenants only; NZ handles fuel automatically elsewhere */}
                                    {isUsCustomer && isNew && (
                                        <Paper
                                            elevation={0}
                                            sx={(theme) => ({
                                                p: 2.5,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.info.main, 0.04),
                                                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                                            })}
                                        >
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={applyFuel}
                                                        onChange={(e) => handleToggleApplyFuel(e.target.checked)}
                                                        disabled={typeof formAmount !== 'number' || formAmount <= 0}
                                                        icon={<LocalGasStationIcon />}
                                                        checkedIcon={<LocalGasStationIcon color="info" />}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            Apply Fuel
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                            Adds a companion &quot;{formName || 'Item'} Fuel&quot; line using this job&apos;s fuel rate
                                                        </Typography>
                                                    </Box>
                                                }
                                            />

                                            {applyFuel && (
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2, alignItems: 'flex-start' }}>
                                                    <TextField
                                                        label="Fuel Charge Amount"
                                                        type="number"
                                                        value={formFuelChargeAmount}
                                                        onChange={(e) => setFormFuelChargeAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                                        fullWidth
                                                        placeholder="0.00"
                                                        helperText="Suggested — editable before saving"
                                                        disabled={isFuelLoading}
                                                        slotProps={{
                                                            htmlInput: {min: 0, step: 0.01},
                                                            input: {
                                                                startAdornment: (
                                                                    <InputAdornment position="start">
                                                                        <MoneyIcon color="action" fontSize="small" />
                                                                    </InputAdornment>
                                                                ),
                                                                sx: { borderRadius: 2 },
                                                            },
                                                        }}
                                                    />
                                                    <TextField
                                                        label="Fuel Cost Amount"
                                                        type="number"
                                                        value={formFuelCostAmount}
                                                        onChange={(e) => setFormFuelCostAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                                        fullWidth
                                                        placeholder="0.00"
                                                        helperText="Driver's share of the fuel charge"
                                                        disabled={isFuelLoading}
                                                        slotProps={{
                                                            htmlInput: {min: 0, step: 0.01},
                                                            input: {
                                                                startAdornment: (
                                                                    <InputAdornment position="start">
                                                                        <MoneyIcon color="action" fontSize="small" />
                                                                    </InputAdornment>
                                                                ),
                                                                sx: { borderRadius: 2 },
                                                            },
                                                        }}
                                                    />
                                                    <Tooltip title="Recalculate from the current Revenue Amount">
                                                        <span>
                                                            <IconButton
                                                                onClick={() => fetchSuggestedFuel(typeof formAmount === 'number' ? formAmount : 0)}
                                                                disabled={isFuelLoading || typeof formAmount !== 'number' || formAmount <= 0}
                                                                sx={{ mt: 1 }}
                                                            >
                                                                {isFuelLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                </Stack>
                                            )}
                                        </Paper>
                                    )}

                                    {/* Live Preview */}
                                    {(typeof formAmount === 'number' || typeof formCostAmount === 'number') && (
                                        <Paper
                                            elevation={0}
                                            sx={(theme) => ({
                                                p: 2.5,
                                                borderRadius: 2,
                                                bgcolor: 'grey.50',
                                                border: `1px solid ${theme.palette.divider}`,
                                            })}
                                        >
                                            <Typography
                                                variant="overline"
                                                sx={{
                                                    color: "text.secondary",
                                                    mb: 1.5,
                                                    display: 'block'
                                                }}>
                                                Live Preview
                                            </Typography>
                                            <Stack direction="row" spacing={4} sx={{
                                                justifyContent: "center"
                                            }}>
                                                <Box sx={{
                                                    textAlign: "center"
                                                }}>
                                                    <Typography variant="body2" gutterBottom sx={{
                                                        color: "text.secondary"
                                                    }}>
                                                        Profit
                                                    </Typography>
                                                    <Typography
                                                        variant="h5"
                                                        color={formProfit >= 0 ? 'success.main' : 'error.main'}
                                                        sx={{
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        {formatCurrency(formProfit)}
                                                    </Typography>
                                                </Box>
                                                {typeof formAmount === 'number' && formAmount > 0 && (
                                                    <Box sx={{
                                                        textAlign: "center"
                                                    }}>
                                                        <Typography variant="body2" gutterBottom sx={{
                                                            color: "text.secondary"
                                                        }}>
                                                            Margin
                                                        </Typography>
                                                        <Chip
                                                            label={`${formMargin.toFixed(1)}%`}
                                                            color={getMarginColor(formMargin)}
                                                            sx={{ fontWeight: 700, fontSize: '1rem', height: 36 }}
                                                        />
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Paper>
                                    )}
                                </Stack>
                            </Box>

                            {/* Form Actions */}
                            <Box
                                sx={(theme) => ({
                                    px: 3,
                                    py: 2,
                                    bgcolor: 'grey.50',
                                    borderTop: `1px solid ${theme.palette.divider}`,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 1.5,
                                })}
                            >
                                <Button
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                    variant="outlined"
                                    sx={{ borderRadius: 2, minWidth: 100 }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleSaveItem}
                                    disabled={!isFormValid || isSaving}
                                    startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : (isNew ? <AddIcon /> : <CheckCircleIcon />)}
                                    sx={{ borderRadius: 2, minWidth: 140 }}
                                >
                                    {isNew ? 'Add Item' : 'Save Changes'}
                                </Button>
                            </Box>
                        </Paper>
                    </Box>
                )}
            </DialogContent>
            {/* Delete confirmation (in-dialog, not window.confirm) */}
            <Dialog
                open={confirmDelete !== null}
                onClose={handleCancelDelete}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Delete price item?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDelete
                            ? `"${confirmDelete.name}" will be removed from the breakdown and the job total will be recalculated.`
                            : ''}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        onClick={handleCancelDelete}
                        disabled={isDeleting !== null}
                        variant="outlined"
                        sx={{ minWidth: 100 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        disabled={isDeleting !== null}
                        variant="contained"
                        color="error"
                        startIcon={isDeleting !== null
                            ? <CircularProgress size={16} color="inherit" />
                            : <DeleteIcon />}
                        sx={{ minWidth: 100 }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Footer Actions */}
            {!isEditing && (
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'background.paper',
                        borderTop: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>
                            {priceBreakdowns.length > 0 && (
                                <>
                                    {priceBreakdowns.length} {priceBreakdowns.length === 1 ? 'item' : 'items'} •{' '}
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontWeight: 600,
                                            color: "text.primary"
                                        }}>
                                        {formatCurrency(totals.totalRevenue)}
                                    </Typography>{' '}
                                    total
                                </>
                            )}
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                onClick={onClose}
                                variant="outlined"
                                sx={{ borderRadius: 2, minWidth: 100 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSaveAndClose}
                                startIcon={<CheckCircleIcon />}
                                sx={{ borderRadius: 2, minWidth: 140 }}
                            >
                                Save & Close
                            </Button>
                        </Stack>
                    </Box>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default PriceBreakdownDialog;
