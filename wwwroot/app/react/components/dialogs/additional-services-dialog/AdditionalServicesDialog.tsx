/**
 * React Additional Services Dialog
 *
 * A modern replacement for the AngularJS additional-services-dialog using MUI components.
 * Allows users to select additional services for a job and view the total cost.
 */

import React from 'react';
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

interface AdditionalServicesDialogState {
    services: AdditionalService[];
    selectedIds: Set<number>;
    isLoading: boolean;
    isTotalCalculating: boolean;
    totalCost: number;
    isSubmitting: boolean;
    jobSpeedRate: AdditionalService | null;
}

export class AdditionalServicesDialog extends React.Component<
    AdditionalServicesDialogProps,
    AdditionalServicesDialogState
> {
    constructor(props: AdditionalServicesDialogProps) {
        super(props);
        this.state = {
            services: [],
            selectedIds: new Set(),
            isLoading: props.open,
            isTotalCalculating: false,
            totalCost: 0,
            isSubmitting: false,
            jobSpeedRate: null,
        };
    }

    componentDidMount(): void {
        if (this.props.open) {
            this.loadServices();
        }
    }

    componentDidUpdate(prevProps: AdditionalServicesDialogProps): void {
        if (this.props.open && !prevProps.open) {
            this.setState({
                services: [],
                selectedIds: new Set(),
                isLoading: true,
                isTotalCalculating: false,
                totalCost: 0,
                isSubmitting: false,
                jobSpeedRate: null,
            });
            this.loadServices();
        }
    }

    private createJobSpeedRate(): AdditionalService | null {
        const { job } = this.props;
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
    }

    private loadServices = async (): Promise<void> => {
        const { onLoadServices, showToast } = this.props;
        try {
            const services = await onLoadServices();

            // Get pre-selected service IDs
            const preSelectedIds = new Set(
                services.filter(s => s.selected).map(s => s.itemId)
            );

            // Create job speed rate entry
            const jobSpeedRate = this.createJobSpeedRate();

            this.setState({
                services,
                selectedIds: preSelectedIds,
                isLoading: false,
                jobSpeedRate,
            });

            // Calculate initial total if there are pre-selected services
            if (preSelectedIds.size > 0) {
                await this.calculateTotal(services, preSelectedIds);
            }
        } catch (error: unknown) {
            console.error('Error loading services:', error);
            showToast(`Error fetching services: ${error instanceof Error ? error.message : String(error)}`, 'error');
            this.setState({ isLoading: false });
        }
    };

    private handleRefresh = async (): Promise<void> => {
        this.setState({ isLoading: true });
        await this.loadServices();
    };

    private handleToggle = async (itemId: number): Promise<void> => {
        const { services, selectedIds } = this.state;
        const newSelectedIds = new Set(selectedIds);

        if (newSelectedIds.has(itemId)) {
            newSelectedIds.delete(itemId);
        } else {
            newSelectedIds.add(itemId);
        }

        this.setState({ selectedIds: newSelectedIds });
        await this.calculateTotal(services, newSelectedIds);
    };

    private calculateTotal = async (
        services: AdditionalService[],
        selectedIds: Set<number>
    ): Promise<void> => {
        const { onCalculateTotal, showToast, job } = this.props;
        if (!job) return;

        this.setState({ isTotalCalculating: true });

        try {
            const selectedServices = services.filter(s => selectedIds.has(s.itemId));
            const totalCost = await onCalculateTotal(selectedServices);

            // Update job speed rate with the new total
            const { jobSpeedRate } = this.state;
            if (jobSpeedRate) {
                this.setState({
                    totalCost,
                    isTotalCalculating: false,
                    jobSpeedRate: { ...jobSpeedRate, rate: totalCost },
                });
            } else {
                this.setState({ totalCost, isTotalCalculating: false });
            }
        } catch (error: unknown) {
            console.error('Error calculating total:', error);
            showToast(`Error calculating total: ${error instanceof Error ? error.message : String(error)}`, 'error');
            this.setState({ isTotalCalculating: false });
        }
    };

    private getSelectedServices(): AdditionalService[] {
        const { services, selectedIds, jobSpeedRate } = this.state;
        const selected = services.filter(s => selectedIds.has(s.itemId));

        // Add job speed rate to the display list
        if (jobSpeedRate) {
            return [jobSpeedRate, ...selected];
        }
        return selected;
    }

    private handleSubmit = async (): Promise<void> => {
        const { onSubmit, onClose, showToast } = this.props;
        const { services, selectedIds, totalCost } = this.state;

        this.setState({ isSubmitting: true });

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
            this.setState({ isSubmitting: false });
        }
    };

    private formatCurrency(amount: number): string {
        return `$${amount.toFixed(2)}`;
    }

    render(): React.ReactNode {
        const { open, job, onClose } = this.props;
        const {
            services,
            selectedIds,
            isLoading,
            isTotalCalculating,
            totalCost,
            isSubmitting,
        } = this.state;

        if (!job) return null;

        const selectedServices = this.getSelectedServices();
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
                    </Box>
                    <IconButton
                        onClick={this.handleRefresh}
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
                                                onClick={() => this.handleToggle(service.itemId)}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedIds.has(service.itemId)}
                                                        onChange={() => this.handleToggle(service.itemId)}
                                                        disabled={isSubmitting}
                                                    />
                                                </TableCell>
                                                <TableCell>{service.name}</TableCell>
                                                <TableCell align="right">
                                                    {this.formatCurrency(service.rate)}
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
                                                        {this.formatCurrency(service.rate)}
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
                                                        {this.formatCurrency(totalCost)}
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
                            onClick={this.handleSubmit}
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
    }
}

export default AdditionalServicesDialog;
