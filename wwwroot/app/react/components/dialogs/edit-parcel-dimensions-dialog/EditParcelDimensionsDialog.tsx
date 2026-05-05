import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {apiClient} from '../../../services/apiClient';
import {EditParcelDimensionsDialogProps, EditParcelDimensionsDialogResult, ParcelDimensions} from './types';

const MAX_NAME_LENGTH = 50;

const noSpinnerSx = {
    '& input::-webkit-outer-spin-button': {display: 'none'},
    '& input::-webkit-inner-spin-button': {display: 'none'},
    '& input[type=number]': {MozAppearance: 'textfield'},
} as const;

interface ParcelGroup {
    id: string;
    itemName: string;
    length: string;
    depth: string;
    height: string;
    weight: string;
    barcodes: string[];
    expandedBarcodes: boolean;
}

function newGroup(): ParcelGroup {
    return {
        id: Math.random().toString(36).slice(2),
        itemName: '',
        length: '',
        depth: '',
        height: '',
        weight: '',
        barcodes: [''],
        expandedBarcodes: false,
    };
}

function parcelsToGroups(parcels: ParcelDimensions[]): ParcelGroup[] {
    if (!parcels || parcels.length === 0) return [newGroup()];

    const map = new Map<string, ParcelGroup>();

    for (const p of parcels) {
        const key = `${p.itemName ?? ''}|${p.length ?? ''}|${p.depth ?? ''}|${p.height ?? ''}|${p.weight ?? ''}`;
        if (map.has(key)) {
            map.get(key)!.barcodes.push(p.barcode ?? '');
        } else {
            map.set(key, {
                id: Math.random().toString(36).slice(2),
                itemName: p.itemName ?? '',
                length: p.length != null ? String(p.length) : '',
                depth: p.depth != null ? String(p.depth) : '',
                height: p.height != null ? String(p.height) : '',
                weight: p.weight != null ? String(p.weight) : '',
                barcodes: [p.barcode ?? ''],
                expandedBarcodes: false,
            });
        }
    }

    return Array.from(map.values());
}

function groupsToParcels(groups: ParcelGroup[], dimensionUnit: string): ParcelDimensions[] {
    return groups.flatMap(g => {
        const length = g.length !== '' ? parseFloat(g.length) : undefined;
        const depth = g.depth !== '' ? parseFloat(g.depth) : undefined;
        const height = g.height !== '' ? parseFloat(g.height) : undefined;
        const weight = g.weight !== '' ? parseFloat(g.weight) : undefined;
        const dimensions = length && depth && height
            ? `${length} × ${depth} × ${height} ${dimensionUnit}`
            : '';

        return g.barcodes.map(barcode => ({
            itemName: g.itemName,
            length,
            depth,
            height,
            weight,
            dimensions,
            barcode: barcode || undefined,
        }));
    });
}

export const EditParcelDimensionsDialog: React.FC<EditParcelDimensionsDialogProps> = ({
    open,
    parcels: initialParcels,
    jobId,
    bulkJobId,
    isUsCustomer,
    jobWeight,
    onClose,
    onSubmit,
    showToast,
}) => {
    const [groups, setGroups] = useState<ParcelGroup[]>([]);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isParentJob, setIsParentJob] = useState(false);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [targetWeight, setTargetWeight] = useState('');

    const dimensionUnit = isUsCustomer ? 'in' : 'cm';
    const weightUnit = isUsCustomer ? 'lbs' : 'kg';

    useEffect(() => {
        if (!open) return;

        setGroups(parcelsToGroups(initialParcels));
        setIsFormDirty(false);
        setIsLoading(false);
        setIsParentJob(false);
        setTargetWeight(jobWeight != null ? String(jobWeight) : '');

        if (jobId) {
            apiClient.get<boolean>('job/IsJobParent', {jobId}).then(setIsParentJob).catch(() => {});
        } else if (bulkJobId) {
            apiClient.get<boolean>('job/IsBulkJobParent', {bulkJobId}).then(setIsParentJob).catch(() => {});
        } else {
            showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
        }
    }, [open, initialParcels, jobId, bulkJobId, showToast, jobWeight]);

    const updateGroup = useCallback((id: string, field: keyof Pick<ParcelGroup, 'itemName' | 'length' | 'depth' | 'height' | 'weight'>, value: string) => {
        setGroups(prev => prev.map(g => g.id === id ? {...g, [field]: value} : g));
        setIsFormDirty(true);
    }, []);

    const adjustQty = useCallback((id: string, delta: number) => {
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;
            const newQty = g.barcodes.length + delta;
            if (newQty < 1) return g;
            const barcodes = [...g.barcodes];
            if (delta > 0) {
                for (let i = 0; i < delta; i++) barcodes.push('');
            } else {
                barcodes.splice(barcodes.length + delta, -delta);
            }
            return {...g, barcodes};
        }));
        setIsFormDirty(true);
    }, []);

    const updateBarcode = useCallback((id: string, index: number, value: string) => {
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;
            const barcodes = [...g.barcodes];
            barcodes[index] = value;
            return {...g, barcodes};
        }));
        setIsFormDirty(true);
    }, []);

    const addGroup = useCallback(() => {
        setGroups(prev => [...prev, newGroup()]);
        setIsFormDirty(true);
    }, []);

    const deleteGroup = useCallback((id: string) => {
        setGroups(prev => {
            const filtered = prev.filter(g => g.id !== id);
            return filtered.length > 0 ? filtered : [newGroup()];
        });
        setIsFormDirty(true);
    }, []);

    const toggleBarcodes = useCallback((id: string) => {
        setGroups(prev => prev.map(g => g.id === id ? {...g, expandedBarcodes: !g.expandedBarcodes} : g));
    }, []);

    const totalParcels = groups.reduce((sum, g) => sum + g.barcodes.length, 0);

    const parcelTotal = useMemo(() =>
        groups.reduce((sum, g) => {
            const w = parseFloat(g.weight);
            return sum + (isNaN(w) ? 0 : w * g.barcodes.length);
        }, 0),
    [groups]);

    // Keep job weight in sync with parcel total as the user edits dimension rows
    useEffect(() => {
        if (parcelTotal > 0) setTargetWeight(String(Math.round(parcelTotal * 10) / 10));
    }, [parcelTotal]);

    const hasEmptyWeights = groups.some(g => { const w = parseFloat(g.weight); return isNaN(w) || w <= 0; });
    const weightMismatch = !hasEmptyWeights && parcelTotal > 0 && Math.abs((parseFloat(targetWeight) || 0) - parcelTotal) > 1;

    const handleMatchProportionally = useCallback(() => {
        const target = parseFloat(targetWeight);
        if (isNaN(target) || target <= 0 || parcelTotal <= 0) return;
        const scale = target / parcelTotal;
        setGroups(prev => prev.map(g => {
            const w = parseFloat(g.weight);
            if (isNaN(w) || w === 0) return g;
            return {...g, weight: String(Math.round(w * scale * 10) / 10)};
        }));
        setIsFormDirty(true);
    }, [targetWeight, parcelTotal]);

    const handleCancel = useCallback(() => {
        if (isFormDirty) {
            setDiscardDialogOpen(true);
        } else {
            onClose();
        }
    }, [isFormDirty, onClose]);

    const handleSubmit = useCallback(async () => {
        setIsLoading(true);
        try {
            const updatedParcels = groupsToParcels(groups, dimensionUnit);

            if (jobId) {
                await apiClient.post('job/UpdateJobPackages', {jobId, parcels: updatedParcels, weight: parcelTotal > 0 ? parcelTotal : undefined});
            } else if (bulkJobId) {
                await apiClient.post('job/UpdateBulkJobPackages', {bulkJobId, parcels: updatedParcels});
            } else {
                showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
                return;
            }

            showToast(`Successfully updated ${totalParcels} ${totalParcels === 1 ? 'parcel' : 'parcels'}`, 'success');
            const result: EditParcelDimensionsDialogResult = {parcels: updatedParcels, totalWeight: parcelTotal};
            onSubmit(result);
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to update parcels', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [groups, dimensionUnit, jobId, bulkJobId, totalParcels, parcelTotal, showToast, onSubmit]);

    const numInput = {min: 0, step: 0.01};

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            fullWidth
            maxWidth="md"
            slotProps={{paper: {sx: {maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}}}
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
                    flexShrink: 0,
                })}
            >
                <Box sx={{width: 44, height: 44, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Inventory2OutlinedIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>Edit Dimensions</Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {groups.length} type{groups.length !== 1 ? 's' : ''} · {totalParcels} parcel{totalParcels !== 1 ? 's' : ''} total
                    </Typography>
                </Box>
                <IconButton onClick={handleCancel} disabled={isLoading} sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {isParentJob && (
                <Alert severity="info" icon={<InfoIcon />} sx={{borderRadius: 0, flexShrink: 0}}>
                    This is a child job. Parcel information has been inherited from the parent job.
                </Alert>
            )}

            {/* Table */}
            <Box sx={{flex: 1, overflowY: 'auto', p: 2}}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{minWidth: 130}}>Name</TableCell>
                            <TableCell align="center" sx={{width: 80}}>L ({dimensionUnit})</TableCell>
                            <TableCell align="center" sx={{width: 80}}>W ({dimensionUnit})</TableCell>
                            <TableCell align="center" sx={{width: 80}}>H ({dimensionUnit})</TableCell>
                            <TableCell align="center" sx={{width: 90}}>Weight (kg)</TableCell>
                            <TableCell align="center" sx={{width: 110}}>Qty</TableCell>
                            <TableCell sx={{width: 72}} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {groups.map(g => (
                            <React.Fragment key={g.id}>
                                <TableRow>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={g.itemName}
                                            onChange={e => updateGroup(g.id, 'itemName', e.target.value)}
                                            placeholder="Name"
                                            inputProps={{maxLength: MAX_NAME_LENGTH}}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={g.length}
                                            onChange={e => updateGroup(g.id, 'length', e.target.value)}
                                            onWheel={e => e.currentTarget.blur()}
                                            placeholder="—"
                                            inputProps={numInput}
                                            sx={noSpinnerSx}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={g.depth}
                                            onChange={e => updateGroup(g.id, 'depth', e.target.value)}
                                            onWheel={e => e.currentTarget.blur()}
                                            placeholder="—"
                                            inputProps={numInput}
                                            sx={noSpinnerSx}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={g.height}
                                            onChange={e => updateGroup(g.id, 'height', e.target.value)}
                                            onWheel={e => e.currentTarget.blur()}
                                            placeholder="—"
                                            inputProps={numInput}
                                            sx={noSpinnerSx}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={g.weight}
                                            onChange={e => updateGroup(g.id, 'weight', e.target.value)}
                                            onWheel={e => e.currentTarget.blur()}
                                            placeholder="—"
                                            inputProps={{min: 0, step: 0.001}}
                                            sx={noSpinnerSx}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5}}>
                                            <IconButton size="small" aria-label="Decrease quantity" onClick={() => adjustQty(g.id, -1)} disabled={g.barcodes.length <= 1}>
                                                <RemoveIcon fontSize="small" />
                                            </IconButton>
                                            <Typography variant="body2" sx={{minWidth: 20, textAlign: 'center'}}>
                                                {g.barcodes.length}
                                            </Typography>
                                            <IconButton size="small" aria-label="Increase quantity" onClick={() => adjustQty(g.id, 1)}>
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.25}}>
                                            <Tooltip title="Delete row">
                                                <IconButton size="small" aria-label="Delete row" color="error" onClick={() => deleteGroup(g.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={g.expandedBarcodes ? 'Hide barcodes' : 'Show barcodes'}>
                                                <IconButton size="small" onClick={() => toggleBarcodes(g.id)}>
                                                    {g.expandedBarcodes ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>

                                {g.expandedBarcodes && g.barcodes.map((barcode, i) => (
                                    <TableRow key={`${g.id}-bc-${i}`} sx={{bgcolor: 'action.hover'}}>
                                        <TableCell sx={{pl: 4}}>
                                            <Typography variant="caption" color="text.secondary">
                                                Item {i + 1}
                                            </Typography>
                                        </TableCell>
                                        <TableCell colSpan={6}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                value={barcode}
                                                onChange={e => updateBarcode(g.id, i, e.target.value)}
                                                placeholder="Barcode"
                                                label="Barcode"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>

                <Box sx={{mt: 1.5}}>
                    <Button size="small" startIcon={<AddIcon />} onClick={addGroup}>
                        Add package type
                    </Button>
                </Box>
            </Box>

            {/* Weight section */}
            <Box sx={{px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, flexWrap: 'wrap'}}>
                <TextField
                    size="small"
                    label="Job weight"
                    type="number"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    inputProps={{min: 0, step: 0.001}}
                    slotProps={{input: {endAdornment: <InputAdornment position="end">{weightUnit}</InputAdornment>}}}
                    sx={{...noSpinnerSx, width: 150}}
                    error={weightMismatch}
                />
                <Tooltip title="Scale individual item weights proportionally so they total the job weight">
                    <span>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleMatchProportionally}
                            disabled={isNaN(parseFloat(targetWeight)) || parseFloat(targetWeight) <= 0 || parcelTotal <= 0}
                        >
                            Match proportionally
                        </Button>
                    </span>
                </Tooltip>
                <Box sx={{flex: 1}} />
                <Typography variant="body2" color="text.secondary">
                    Parcel total: <strong>{parcelTotal > 0 ? parcelTotal.toFixed(1) : '—'} {parcelTotal > 0 ? weightUnit : ''}</strong>
                </Typography>
            </Box>

            {hasEmptyWeights && (
                <Alert severity="error" sx={{borderRadius: 0, flexShrink: 0, py: 0.25, '& .MuiAlert-message': {py: 0.5}}}>
                    All parcels must have a weight greater than 0 before saving.
                </Alert>
            )}
            {!hasEmptyWeights && weightMismatch && (
                <Alert severity="warning" sx={{borderRadius: 0, flexShrink: 0, py: 0.25, '& .MuiAlert-message': {py: 0.5}}}>
                    Job weight ({(parseFloat(targetWeight) || 0).toFixed(1)} {weightUnit}) doesn't match parcel total ({parcelTotal.toFixed(1)} {weightUnit}). Adjust line item weights or click <strong>Match proportionally</strong>.
                </Alert>
            )}

            {/* Footer */}
            <Box sx={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0}}>
                <Button onClick={handleCancel} disabled={isLoading}>
                    Cancel
                </Button>
                {isLoading ? (
                    <CircularProgress size={20} />
                ) : (
                    <Tooltip title={hasEmptyWeights ? 'All parcels must have a weight greater than 0' : weightMismatch ? 'Job weight must match parcel total before saving' : ''}>
                        <span>
                            <Button variant="contained" onClick={handleSubmit} disabled={hasEmptyWeights || weightMismatch}>
                                Save
                            </Button>
                        </span>
                    </Tooltip>
                )}
            </Box>

            {/* Discard confirmation */}
            <Dialog
                open={discardDialogOpen}
                onClose={() => setDiscardDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <Box
                    sx={(theme) => ({
                        background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                        color: 'white',
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    })}
                >
                    <Box sx={{width: 44, height: 44, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <WarningAmberIcon sx={{fontSize: 24}} />
                    </Box>
                    <Box sx={{flex: 1}}>
                        <Typography variant="h6" fontWeight={600}>Discard unsaved changes</Typography>
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>Changes will be permanently lost</Typography>
                    </Box>
                    <IconButton onClick={() => setDiscardDialogOpen(false)} sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <DialogContent>
                    <DialogContentText sx={{mt: 1}}>
                        Your changes to parcel dimensions haven't been saved and will be lost.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{px: 3, py: 2, borderTop: 1, borderColor: 'divider'}}>
                    <Button autoFocus onClick={() => setDiscardDialogOpen(false)}>Keep editing</Button>
                    <Button onClick={() => { setDiscardDialogOpen(false); onClose(); }} color="error">Discard</Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};

export default EditParcelDimensionsDialog;
