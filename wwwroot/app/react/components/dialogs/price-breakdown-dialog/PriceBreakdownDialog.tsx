/**
 * React Price Breakdown Dialog
 *
 * A dialog for viewing and editing price breakdown items for a job.
 * Displays revenue, cost, and profit calculations with CRUD operations.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {formatCurrency} from '../../../utils/currencyUtils';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
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
import Typography from '@mui/material/Typography';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InventoryIcon from '@mui/icons-material/Inventory2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SavingsIcon from '@mui/icons-material/Savings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';

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

export interface PriceBreakdownDialogProps {
    open: boolean;
    priceBreakdowns: PriceBreakdown[];
    jobId: number;
    isPrebook: boolean;
    isArchived?: boolean;
    onClose: () => void;
    onSave: (totalAmount: number) => void;
    onAddItem: (item: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
    onUpdateItem: (item: PriceBreakdown) => Promise<void>;
    onDeleteItem: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
}


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
    onClose,
    onSave,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
}) => {
    const [priceBreakdowns, setPriceBreakdowns] = useState<PriceBreakdown[]>(initialBreakdowns);

    // Sync state when props change (e.g., when a new job is selected)
    useEffect(() => {
        setPriceBreakdowns(initialBreakdowns);
        // Reset editing state when data changes (new job selected)
        setIsEditing(false);
        setIsNew(false);
        setSelectedItem(null);
    }, [initialBreakdowns]);

    const [isEditing, setIsEditing] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PriceBreakdown | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    const [formName, setFormName] = useState('');
    const [formAmount, setFormAmount] = useState<number | ''>('');
    const [formCostAmount, setFormCostAmount] = useState<number | ''>('');

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
        setIsNew(true);
        setIsEditing(true);
    };

    const handleEdit = (item: PriceBreakdown) => {
        setSelectedItem(item);
        setFormName(item.name);
        setFormAmount(item.amount);
        setFormCostAmount(item.costAmount ?? 0);
        setIsNew(false);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setSelectedItem(null);
        setIsEditing(false);
        setIsNew(false);
    };

    const handleSaveItem = async () => {
        if (!formName.trim()) return;

        setIsSaving(true);
        try {
            const amount = typeof formAmount === 'number' ? formAmount : 0;
            const costAmount = typeof formCostAmount === 'number' ? formCostAmount : 0;

            if (isNew) {
                const newItem: Omit<PriceBreakdown, 'chargeId'> = {
                    name: formName,
                    amount,
                    costAmount,
                    isArchived,
                    ...(isPrebook ? { prebookJobId: jobId } : { childJobId: jobId }),
                };
                const chargeId = await onAddItem(newItem);
                setPriceBreakdowns([...priceBreakdowns, { ...newItem, chargeId }]);
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
            }
            handleCancelEdit();
        } catch (error) {
            console.error('Error saving price breakdown:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (item: PriceBreakdown) => {
        if (!window.confirm('Are you sure you want to delete this price breakdown?')) return;

        setIsDeleting(item.chargeId);
        try {
            await onDeleteItem(item.chargeId, jobId, isArchived);
            setPriceBreakdowns(priceBreakdowns.filter(pb => pb.chargeId !== item.chargeId));
        } catch (error) {
            console.error('Error deleting price breakdown:', error);
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSaveAndClose = () => {
        onSave(totals.totalRevenue);
    };

    const isFormValid = formName.trim() && formCostAmount !== '';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: { borderRadius: 3, overflow: 'hidden' },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ReceiptLongIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" fontWeight={600}>
                        Price Breakdown
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Manage pricing components for this job
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
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
                                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                        Total Revenue
                                    </Typography>
                                    <Typography variant="h5" fontWeight={700} color="success.dark">
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
                                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                        Total Cost
                                    </Typography>
                                    <Typography variant="h5" fontWeight={700} color="warning.dark">
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
                                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                        Gross Profit
                                    </Typography>
                                    <Typography variant="h5" fontWeight={700} color="info.dark">
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
                                <Typography variant="h6" fontWeight={600}>
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
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {item.name}
                                                                </Typography>
                                                                {item.childJobId === jobId && (
                                                                    <Chip
                                                                        icon={<WorkIcon sx={{ fontSize: 14 }} />}
                                                                        label="This Job"
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="outlined"
                                                                        sx={{ height: 20, mt: 0.5, '& .MuiChip-label': { px: 0.75 } }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {formatCurrency(item.amount || 0)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" color="text.secondary">
                                                            {formatCurrency(item.costAmount || 0)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight={600}
                                                            color={profit >= 0 ? 'success.main' : 'error.main'}
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
                                                        <Stack direction="row" spacing={0.5} justifyContent="center">
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
                                                                onClick={() => handleDelete(item)}
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
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No price items yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                                        bgcolor: 'white',
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
                                <Typography variant="h6" fontWeight={600}>
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
                                            required
                                            placeholder="0.00"
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
                                            <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                                                Live Preview
                                            </Typography>
                                            <Stack direction="row" spacing={4} justifyContent="center">
                                                <Box textAlign="center">
                                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                                        Profit
                                                    </Typography>
                                                    <Typography
                                                        variant="h5"
                                                        fontWeight={700}
                                                        color={formProfit >= 0 ? 'success.main' : 'error.main'}
                                                    >
                                                        {formatCurrency(formProfit)}
                                                    </Typography>
                                                </Box>
                                                {typeof formAmount === 'number' && formAmount > 0 && (
                                                    <Box textAlign="center">
                                                        <Typography variant="body2" color="text.secondary" gutterBottom>
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

            {/* Footer Actions */}
            {!isEditing && (
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'white',
                        borderTop: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            {priceBreakdowns.length > 0 && (
                                <>
                                    {priceBreakdowns.length} {priceBreakdowns.length === 1 ? 'item' : 'items'} •{' '}
                                    <Typography component="span" fontWeight={600} color="text.primary">
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
