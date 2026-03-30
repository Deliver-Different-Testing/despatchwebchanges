/**
 * React Additional Services Dialog
 *
 * A modern replacement for the AngularJS additional-services-dialog using MUI components.
 * Allows users to select additional services for a job and view the total cost.
 */

import React, {useState, useEffect, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AdditionalService, AdditionalServicesDialogProps } from './types';
import {formatCurrency} from '../../../utils/currencyUtils';

export const AdditionalServicesDialog: React.FC<AdditionalServicesDialogProps> = ({
    open,
    job,
    onClose,
    onLoadServices,
    onCalculateTotal,
    onSubmit,
    showToast,
}) => {
    const [services, setServices] = useState<AdditionalService[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isTotalCalculating, setIsTotalCalculating] = useState(false);
    const [totalCost, setTotalCost] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jobSpeedRate, setJobSpeedRate] = useState<AdditionalService | null>(null);

    const createJobSpeedRate = useCallback((): AdditionalService | null => {
        if (!job) return null;

        return {
            itemId: -1,
            clientId: job.clientId,
            name: `${job.speedName} rate`,
            description: `${job.speedName} rate`,
            perItem: false,
            rate: 0,
            onlyVan: false,
            selected: true,
        };
    }, [job]);

    const calculateTotal = useCallback(async (
        svcList: AdditionalService[],
        selIds: Set<number>
    ): Promise<void> => {
        if (!job) return;

        setIsTotalCalculating(true);

        try {
            const selectedServices = svcList.filter(s => selIds.has(s.itemId));
            const cost = await onCalculateTotal(selectedServices);

            setTotalCost(cost);
            setIsTotalCalculating(false);
            setJobSpeedRate(prev => prev ? { ...prev, rate: cost } : prev);
        } catch (error: unknown) {
            console.error('Error calculating total:', error);
            showToast(`Error calculating total: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setIsTotalCalculating(false);
        }
    }, [job, onCalculateTotal, showToast]);

    const loadServices = useCallback(async (): Promise<void> => {
        try {
            const svcList = await onLoadServices();

            // Get pre-selected service IDs
            const preSelectedIds = new Set(
                svcList.filter(s => s.selected).map(s => s.itemId)
            );

            // Create job speed rate entry
            const speedRate = createJobSpeedRate();

            setServices(svcList);
            setSelectedIds(preSelectedIds);
            setIsLoading(false);
            setJobSpeedRate(speedRate);

            // Calculate initial total if there are pre-selected services
            if (preSelectedIds.size > 0) {
                await calculateTotal(svcList, preSelectedIds);
            }
        } catch (error: unknown) {
            console.error('Error loading services:', error);
            showToast(`Error fetching services: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setIsLoading(false);
        }
    }, [onLoadServices, showToast, createJobSpeedRate, calculateTotal]);

    // Reset state and load services when dialog opens
    useEffect(() => {
        if (open) {
            setServices([]);
            setSelectedIds(new Set());
            setIsLoading(true);
            setIsTotalCalculating(false);
            setTotalCost(0);
            setIsSubmitting(false);
            setJobSpeedRate(null);
            loadServices();
        }
    }, [open, loadServices]);

    const handleRefresh = async (): Promise<void> => {
        setIsLoading(true);
        await loadServices();
    };

    const handleToggle = async (itemId: number): Promise<void> => {
        const newSelectedIds = new Set(selectedIds);

        if (newSelectedIds.has(itemId)) {
            newSelectedIds.delete(itemId);
        } else {
            newSelectedIds.add(itemId);
        }

        setSelectedIds(newSelectedIds);
        await calculateTotal(services, newSelectedIds);
    };

    const getSelectedServices = (): AdditionalService[] => {
        const selected = services.filter(s => selectedIds.has(s.itemId));

        // Add job speed rate to the display list
        if (jobSpeedRate) {
            return [jobSpeedRate, ...selected];
        }
        return selected;
    };

    const handleSubmit = async (): Promise<void> => {
        setIsSubmitting(true);

        try {
            // Filter out the job speed rate (itemId: -1) from submission
            const serviceIds = services
                .filter(s => selectedIds.has(s.itemId) && s.itemId !== -1)
                .map(s => s.itemId);

            await onSubmit(serviceIds, totalCost);
            showToast(
                `${serviceIds.length} total services have been added to job for $${totalCost.toFixed(2)}`,
                'success'
            );
            onClose();
        } catch (error: unknown) {
            console.error('Error booking services:', error);
            showToast(error instanceof Error ? error.message : 'Failed to add services.', 'error');
            setIsSubmitting(false);
        }
    };

    if (!job) return null;

    const selectedServices = getSelectedServices();
    const hasServices = services.length > 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: 600,
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ExtensionIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Additional Services
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Select extra services for this job
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleRefresh}
                    disabled={isLoading || isSubmitting}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                    title="Refresh Services"
                >
                    <RefreshIcon />
                </IconButton>
                <IconButton
                    onClick={onClose}
                    disabled={isSubmitting}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                    title="Close"
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                {isLoading ? (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 8,
                        }}
                    >
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Services Table */}
                        <TableContainer component={Paper} elevation={1}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell padding="checkbox" />
                                        <TableCell>
                                            <Typography fontWeight={600}>Name</Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography fontWeight={600}>Rate</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography fontWeight={600}>Description</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography fontWeight={600}>Per Item</Typography>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {services.map((service) => (
                                        <TableRow
                                            key={service.itemId}
                                            hover
                                            onClick={() => handleToggle(service.itemId)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedIds.has(service.itemId)}
                                                    onChange={() => handleToggle(service.itemId)}
                                                    disabled={isSubmitting}
                                                />
                                            </TableCell>
                                            <TableCell>{service.name}</TableCell>
                                            <TableCell align="right">
                                                {formatCurrency(service.rate)}
                                            </TableCell>
                                            <TableCell>{service.description}</TableCell>
                                            <TableCell align="center">
                                                {service.perItem && (
                                                    <CheckCircleIcon
                                                        fontSize="small"
                                                        color="success"
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {services.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                                <Typography color="text.secondary">
                                                    No services available
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Summary Card */}
                        {hasServices && (
                            <Card elevation={1} sx={{ maxWidth: '80%', mx: 'auto', width: '100%' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                mb: 1,
                                            }}
                                        >
                                            <Typography fontWeight={600} variant="subtitle1">
                                                Description
                                            </Typography>
                                            <Typography fontWeight={600} variant="subtitle1">
                                                Rate
                                            </Typography>
                                        </Box>

                                        {selectedServices.map((service) => (
                                            <Box
                                                key={service.itemId}
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    py: 0.5,
                                                }}
                                            >
                                                <Typography variant="body2">{service.name}</Typography>
                                                <Typography variant="body2">
                                                    {formatCurrency(service.rate)}
                                                </Typography>
                                            </Box>
                                        ))}

                                        {selectedServices.length === 0 && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ py: 1, textAlign: 'center' }}
                                            >
                                                No services selected
                                            </Typography>
                                        )}

                                        <Divider sx={{ my: 1 }} />

                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Typography fontWeight={600}>
                                                Total: (EXCL GST)
                                            </Typography>
                                            {isTotalCalculating ? (
                                                <CircularProgress size={20} />
                                            ) : (
                                                <Typography fontWeight={600}>
                                                    {formatCurrency(totalCost)}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}
                    </Box>
                )}
            </DialogContent>

            {/* Actions */}
            {!isLoading && (
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'white',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        disabled={isSubmitting}
                        sx={{ minWidth: 100 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        color="primary"
                        disabled={isSubmitting || isTotalCalculating}
                        startIcon={
                            isSubmitting ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : null
                        }
                        sx={{ minWidth: 100 }}
                    >
                        {isSubmitting ? 'Updating...' : 'Update'}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default AdditionalServicesDialog;
