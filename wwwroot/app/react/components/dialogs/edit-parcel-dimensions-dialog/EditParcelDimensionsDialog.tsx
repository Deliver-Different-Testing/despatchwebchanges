/**
 * Edit Parcel Dimensions Dialog
 *
 * React replacement for the AngularJS edit-parcel-dimensions-dialog.
 * Supports adding/deleting parcels, bulk-add, per-parcel dimension entry,
 * a visual timeline for navigating between parcels, and saving via API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Button,
    TextField,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Divider,
    InputAdornment,
    Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import InfoIcon from '@mui/icons-material/Info';

import { apiClient } from '../../../services/apiClient';
import {
    EditParcelDimensionsDialogProps,
    EditParcelDimensionsDialogResult,
    ParcelDimensions,
} from './types';

const MAX_DIMENSION = 999.9;
const MAX_NAME_LENGTH = 50;

function initializeParcel(): ParcelDimensions {
    return {
        itemName: '',
        length: undefined,
        depth: undefined,
        height: undefined,
        dimensions: '',
    };
}

function validateField(fieldName: string, value: unknown): string | null {
    switch (fieldName) {
        case 'itemName':
            if (typeof value === 'string' && value.length > MAX_NAME_LENGTH) {
                return `Name must be ${MAX_NAME_LENGTH} characters or less`;
            }
            return null;
        case 'length':
        case 'depth':
        case 'height': {
            if (value === undefined || value === null || value === '') return null;
            const num = typeof value === 'number' ? value : Number(value);
            if (isNaN(num)) {
                return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be a number`;
            }
            if (num <= 0) {
                return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be greater than 0`;
            }
            if (num > MAX_DIMENSION) {
                return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be ${MAX_DIMENSION} or less`;
            }
            return null;
        }
        default:
            return null;
    }
}

export const EditParcelDimensionsDialog: React.FC<EditParcelDimensionsDialogProps> = ({
    open,
    parcels: initialParcels,
    jobId,
    bulkJobId,
    isUsCustomer,
    onClose,
    onSubmit,
    showToast,
}) => {
    const [parcels, setParcels] = useState<ParcelDimensions[]>([]);
    const [selectedParcelIndex, setSelectedParcelIndex] = useState(0);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isParentJob, setIsParentJob] = useState(false);
    const [bulkAddCount, setBulkAddCount] = useState(1);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const dimensionsString = isUsCustomer ? 'inches' : 'cm';
    const dimensionUnit = isUsCustomer ? 'in' : 'cm';

    // Initialize parcels and check parent status on open
    useEffect(() => {
        if (!open) return;

        const initialized = initialParcels && initialParcels.length > 0
            ? initialParcels.map(p => ({
                ...p,
                length: typeof p.length === 'number' ? p.length : undefined,
                depth: typeof p.depth === 'number' ? p.depth : undefined,
                height: typeof p.height === 'number' ? p.height : undefined,
            }))
            : [initializeParcel()];

        setParcels(initialized);
        setSelectedParcelIndex(0);
        setIsFormDirty(false);
        setIsLoading(false);
        setIsParentJob(false);
        setBulkAddCount(1);
        setValidationErrors({});

        if (jobId) {
            apiClient.get<boolean>('job/IsJobParent', { jobId })
                .then(setIsParentJob)
                .catch(() => {});
        } else if (bulkJobId) {
            apiClient.get<boolean>('job/IsBulkJobParent', { bulkJobId })
                .then(setIsParentJob)
                .catch(() => {});
        } else {
            showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
        }
    }, [open, initialParcels, jobId, bulkJobId, showToast]);

    const validateCurrentParcel = useCallback((parcelsList: ParcelDimensions[], index: number): Record<string, string> => {
        const currentParcel = parcelsList[index];
        if (!currentParcel) return {};

        const errors: Record<string, string> = {};
        const fields = ['itemName', 'length', 'depth', 'height'] as const;

        for (const field of fields) {
            const error = validateField(field, currentParcel[field as keyof ParcelDimensions]);
            if (error) errors[field] = error;
        }

        return errors;
    }, []);

    const currentParcel = parcels[selectedParcelIndex] || null;
    const hasParcels = parcels.length > 0;

    const updateParcelField = useCallback((field: keyof ParcelDimensions, value: unknown) => {
        setParcels(prev => {
            const updated = [...prev];
            updated[selectedParcelIndex] = { ...updated[selectedParcelIndex], [field]: value };

            // Validate after update
            const errors = validateCurrentParcel(updated, selectedParcelIndex);
            setValidationErrors(errors);

            return updated;
        });
        setIsFormDirty(true);
    }, [selectedParcelIndex, validateCurrentParcel]);

    const addNewParcel = useCallback(() => {
        setParcels(prev => {
            const updated = [...prev, initializeParcel()];
            setSelectedParcelIndex(updated.length - 1);
            return updated;
        });
        setIsFormDirty(true);
        setValidationErrors({});
    }, []);

    const addBulkParcels = useCallback(() => {
        if (!bulkAddCount || bulkAddCount < 1) {
            showToast('Please enter a valid number of parcels to add', 'warning');
            return;
        }

        const count = Math.floor(bulkAddCount);
        setParcels(prev => {
            const newParcels = Array.from({ length: count }, () => initializeParcel());
            const updated = [...prev, ...newParcels];
            setSelectedParcelIndex(updated.length - 1);
            return updated;
        });
        setIsFormDirty(true);
        setBulkAddCount(1);
        setValidationErrors({});
        showToast(`Added ${count} ${count === 1 ? 'parcel' : 'parcels'}`, 'success');
    }, [bulkAddCount, showToast]);

    const deleteParcel = useCallback((index: number, event?: React.MouseEvent) => {
        if (event) event.stopPropagation();

        setParcels(prev => {
            const updated = [...prev];
            updated.splice(index, 1);

            if (updated.length === 0) {
                setSelectedParcelIndex(0);
                return [initializeParcel()];
            }

            if (index <= selectedParcelIndex) {
                setSelectedParcelIndex(Math.max(0, selectedParcelIndex - 1));
            }

            return updated;
        });
        setIsFormDirty(true);
        setValidationErrors({});
    }, [selectedParcelIndex]);

    const switchParcel = useCallback((index: number) => {
        if (index >= 0 && index < parcels.length) {
            setSelectedParcelIndex(index);
            const errors = validateCurrentParcel(parcels, index);
            setValidationErrors(errors);
        }
    }, [parcels, validateCurrentParcel]);

    const handleCancel = useCallback(() => {
        if (isFormDirty) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
            if (!confirmed) return;
        }
        onClose();
    }, [isFormDirty, onClose]);

    const handleSubmit = useCallback(async () => {
        const errors = validateCurrentParcel(parcels, selectedParcelIndex);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            showToast('Please fix validation errors before saving', 'warning');
            return;
        }

        setIsLoading(true);

        try {
            const updatedParcels = parcels.map(parcel => ({
                ...parcel,
                dimensions: parcel.length && parcel.depth && parcel.height
                    ? `${parcel.length} × ${parcel.depth} × ${parcel.height} ${dimensionUnit}`
                    : '',
            }));

            if (jobId) {
                await apiClient.post('job/UpdateJobPackages', { jobId, parcels: updatedParcels });
            } else if (bulkJobId) {
                await apiClient.post('job/UpdateBulkJobPackages', { bulkJobId, parcels: updatedParcels });
            } else {
                showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
                return;
            }

            const count = updatedParcels.length;
            showToast(`Successfully updated ${count} ${count === 1 ? 'parcel' : 'parcels'}`, 'success');

            const result: EditParcelDimensionsDialogResult = { parcels: updatedParcels };
            onSubmit(result);
        } catch (error: any) {
            console.error('An error occurred while updating packages:', error);
            showToast(error.message || 'Failed to update parcels', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [parcels, selectedParcelIndex, validateCurrentParcel, jobId, bulkJobId, dimensionUnit, showToast, onSubmit]);

    const isValid = Object.keys(validationErrors).length === 0;

    return (
        <Dialog open={open} onClose={handleCancel} fullWidth maxWidth="md">
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
                    <Inventory2OutlinedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Edit Dimensions
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleCancel}
                    disabled={isLoading}
                    sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Parent job banner */}
            {isParentJob && (
                <Alert severity="info" icon={<InfoIcon />} sx={{ borderRadius: 0 }}>
                    This is a child job. Parcel information has been inherited from the parent job.
                </Alert>
            )}

            {/* Empty state */}
            {!hasParcels && (
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Card sx={{ maxWidth: 500, textAlign: 'center' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
                            <Inventory2OutlinedIcon sx={{ fontSize: 64, color: 'primary.dark' }} />
                            <Typography variant="h5">No Parcels Added</Typography>
                            <Typography variant="body1" color="text.secondary">
                                Add parcels to begin entering dimensions
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <Button variant="contained" startIcon={<AddIcon />} onClick={addNewParcel}>
                                    Add Single Parcel
                                </Button>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TextField
                                        label="Quantity"
                                        type="number"
                                        size="small"
                                        value={bulkAddCount}
                                        onChange={(e) => setBulkAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                        slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                                        sx={{ width: 90 }}
                                    />
                                    <Button variant="outlined" startIcon={<AddBoxIcon />} onClick={addBulkParcels}>
                                        Add Multiple
                                    </Button>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Main content */}
            {hasParcels && (
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
                    {/* Current parcel header */}
                    <Card
                        sx={(theme) => ({
                            mx: 2,
                            mt: 2,
                            bgcolor: theme.palette.primary.main + '0D',
                            display: 'flex',
                            alignItems: 'center',
                            px: 2,
                            py: 1.5,
                            transition: 'box-shadow 0.2s',
                            '&:hover': { boxShadow: 2 },
                        })}
                    >
                        <Inventory2OutlinedIcon sx={{ color: 'primary.main', mr: 1.5 }} />
                        <Typography variant="subtitle1" sx={{ flex: 1 }}>
                            {currentParcel?.itemName || `Parcel ${selectedParcelIndex + 1}`}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title="Number of Additional Parcels To Add">
                                <TextField
                                    label="Qty"
                                    type="number"
                                    size="small"
                                    value={bulkAddCount}
                                    onChange={(e) => setBulkAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                    slotProps={{ htmlInput: { min: 1, max: 100, step: 1, style: { textAlign: 'center' } } }}
                                    sx={{ width: 70 }}
                                />
                            </Tooltip>
                            <Tooltip title="Add Multiple Parcels">
                                <IconButton color="primary" onClick={addBulkParcels}>
                                    <AddBoxIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Add Single Parcel">
                                <IconButton color="primary" onClick={addNewParcel}>
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Card>

                    {/* Parcel form */}
                    <Box sx={{ p: 2 }}>
                        <TextField
                            label="Item Name"
                            fullWidth
                            value={currentParcel?.itemName ?? ''}
                            onChange={(e) => updateParcelField('itemName', e.target.value)}
                            error={!!validationErrors.itemName}
                            helperText={validationErrors.itemName}
                            placeholder="Enter item name"
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            label="Barcode"
                            fullWidth
                            value={currentParcel?.barcode ?? ''}
                            onChange={(e) => updateParcelField('barcode', e.target.value)}
                            placeholder="Enter barcode"
                            sx={{ mb: 2 }}
                        />

                        <Card variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                Dimensions
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <TextField
                                    label="Length"
                                    type="number"
                                    value={currentParcel?.length ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        updateParcelField('length', val);
                                    }}
                                    error={!!validationErrors.length}
                                    helperText={validationErrors.length}
                                    placeholder="0.00"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { endAdornment: <InputAdornment position="end">{dimensionsString}</InputAdornment> },
                                    }}
                                    sx={{ flex: 1, minWidth: 120 }}
                                />
                                <TextField
                                    label="Width"
                                    type="number"
                                    value={currentParcel?.depth ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        updateParcelField('depth', val);
                                    }}
                                    error={!!validationErrors.depth}
                                    helperText={validationErrors.depth}
                                    placeholder="0.00"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { endAdornment: <InputAdornment position="end">{dimensionsString}</InputAdornment> },
                                    }}
                                    sx={{ flex: 1, minWidth: 120 }}
                                />
                                <TextField
                                    label="Height"
                                    type="number"
                                    value={currentParcel?.height ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        updateParcelField('height', val);
                                    }}
                                    error={!!validationErrors.height}
                                    helperText={validationErrors.height}
                                    placeholder="0.00"
                                    slotProps={{
                                        htmlInput: { min: 0, step: 0.01 },
                                        input: { endAdornment: <InputAdornment position="end">{dimensionsString}</InputAdornment> },
                                    }}
                                    sx={{ flex: 1, minWidth: 120 }}
                                />
                            </Box>
                        </Card>
                    </Box>

                    {/* Parcel Timeline */}
                    <Card variant="outlined" sx={{ mx: 2, mb: 2, p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ViewTimelineIcon sx={{ fontSize: 20 }} />
                                Parcel Timeline
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Total: {parcels.length} {parcels.length === 1 ? 'parcel' : 'parcels'}
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 1 }} />

                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflowX: 'auto',
                                minHeight: 90,
                                py: 2,
                                px: 1,
                            }}
                        >
                            {parcels.map((parcel, index) => (
                                <React.Fragment key={index}>
                                    {/* Parcel Step */}
                                    <Box
                                        onClick={() => switchParcel(index)}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            px: 1.5,
                                            minWidth: 80,
                                            transition: 'transform 0.15s',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                '& .delete-badge': { opacity: 1 },
                                                '& .step-circle': { boxShadow: 4 },
                                            },
                                        }}
                                    >
                                        <Box
                                            className="step-circle"
                                            sx={(theme) => ({
                                                position: 'relative',
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 500,
                                                boxShadow: 1,
                                                transition: 'all 0.2s',
                                                bgcolor: selectedParcelIndex === index
                                                    ? theme.palette.primary.main
                                                    : theme.palette.grey[50],
                                                color: selectedParcelIndex === index
                                                    ? theme.palette.primary.contrastText
                                                    : theme.palette.text.primary,
                                            })}
                                        >
                                            {index + 1}
                                            {parcels.length > 1 && (
                                                <Box
                                                    className="delete-badge"
                                                    onClick={(e) => deleteParcel(index, e)}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -6,
                                                        right: -6,
                                                        width: 20,
                                                        height: 20,
                                                        borderRadius: '50%',
                                                        bgcolor: 'error.main',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 14,
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        boxShadow: 1,
                                                        '&:hover': { bgcolor: 'error.dark', transform: 'scale(1.1)' },
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 14 }} />
                                                </Box>
                                            )}
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                mt: 1,
                                                textAlign: 'center',
                                                maxWidth: 100,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontWeight: selectedParcelIndex === index ? 600 : 400,
                                            }}
                                        >
                                            {parcel.itemName || `Parcel ${index + 1}`}
                                        </Typography>
                                    </Box>

                                    {/* Connector */}
                                    <Box
                                        sx={(theme) => ({
                                            height: 2,
                                            width: 40,
                                            bgcolor: theme.palette.grey[400],
                                            mx: 0.5,
                                            mt: -2,
                                        })}
                                    />
                                </React.Fragment>
                            ))}

                            {/* Add button */}
                            <Box
                                onClick={addNewParcel}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    px: 1.5,
                                    minWidth: 80,
                                    transition: 'transform 0.15s',
                                    '&:hover': { transform: 'translateY(-2px)' },
                                }}
                            >
                                <Box
                                    sx={(theme) => ({
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        border: '2px dashed',
                                        borderColor: theme.palette.grey[400],
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: theme.palette.grey[700],
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            bgcolor: theme.palette.primary.main + '0D',
                                        },
                                    })}
                                >
                                    <AddIcon />
                                </Box>
                                <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
                                    Add Single
                                </Typography>
                            </Box>
                        </Box>
                    </Card>
                </Box>
            )}

            {/* Actions */}
            {hasParcels && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={handleCancel} disabled={isLoading}>
                        Cancel
                    </Button>
                    {isLoading ? (
                        <CircularProgress size={20} />
                    ) : (
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={!isValid || isLoading}
                        >
                            Save
                        </Button>
                    )}
                </Box>
            )}
        </Dialog>
    );
};

export default EditParcelDimensionsDialog;
