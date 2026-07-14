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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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

import {alpha} from '@mui/material/styles';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../shared/styles';
import {apiClient} from '../../../services/apiClient';
import {EditParcelDimensionsDialogProps, EditParcelDimensionsDialogResult, ParcelDimensions} from './types';

const MAX_NAME_LENGTH = 50;

const noSpinnerSx = {
    '& input::-webkit-outer-spin-button': {display: 'none'},
    '& input::-webkit-inner-spin-button': {display: 'none'},
    '& input[type=number]': {MozAppearance: 'textfield'},
} as const;

interface ParcelItemType {
    name: string;
    quantity: number;
}

interface ParcelGroup {
    id: string;
    itemName: string;
    length: string;
    depth: string;
    height: string;
    weight: string;
    cubic: string;
    barcodes: string[];
    expandedBarcodes: boolean;
    representativeItemId?: number;
}

function newGroup(): ParcelGroup {
    return {
        id: Math.random().toString(36).slice(2),
        itemName: '',
        length: '',
        depth: '',
        height: '',
        weight: '',
        cubic: '',
        barcodes: [''],
        expandedBarcodes: false,
    };
}

function nextBarcodeStart(groups: ParcelGroup[], jobNumber: string | number): number {
    const prefix = `${jobNumber}-`;
    let max = 0;
    for (const g of groups) {
        for (const bc of g.barcodes) {
            if (bc.startsWith(prefix)) {
                const n = parseInt(bc.slice(prefix.length), 10);
                if (!isNaN(n) && n > max) max = n;
            }
        }
    }
    return max + 1;
}

function parcelsToGroups(parcels: ParcelDimensions[], isPerJob: boolean): ParcelGroup[] {
    if (!parcels || parcels.length === 0) return [newGroup()];

    const map = new Map<string, ParcelGroup>();

    for (const p of parcels) {
        const key = `${p.itemName ?? ''}|${p.length ?? ''}|${p.depth ?? ''}|${p.height ?? ''}|${p.weight ?? ''}`;
        if (map.has(key)) {
            const existing = map.get(key)!;
            existing.barcodes.push(p.barcode ?? '');
            // Per Job: the stored per-parcel weight/volume were divided across barcodes when
            // saved — sum them back up so the row displays the job-total contribution again,
            // instead of the shrunken per-parcel value (which would otherwise keep dividing
            // further every time the dialog is reopened and re-saved).
            if (isPerJob) {
                if (p.weight != null) {
                    existing.weight = String((parseFloat(existing.weight || '0') || 0) + p.weight);
                }
                if (p.cubic != null) {
                    existing.cubic = String((parseFloat(existing.cubic || '0') || 0) + p.cubic);
                }
            }
        } else {
            map.set(key, {
                id: Math.random().toString(36).slice(2),
                itemName: p.itemName ?? '',
                length: p.length != null ? String(p.length) : '',
                depth: p.depth != null ? String(p.depth) : '',
                height: p.height != null ? String(p.height) : '',
                weight: p.weight != null ? String(p.weight) : '',
                cubic: p.cubic != null ? String(p.cubic) : '',
                barcodes: [p.barcode ?? ''],
                expandedBarcodes: false,
                representativeItemId: p.itemId,
            });
        }
    }

    return Array.from(map.values());
}

// Matches the cubic formula used at booking time (booking repo's stockSize calc):
// L × W × H × factor, where factor converts in³ → ft³ for US tenants or cm³ → m³ for NZ.
// Used only to auto-suggest a starting Volume value from freshly entered dimensions —
// Volume itself is a plain editable field from then on, same as Weight.
const CUBIC_FACTOR_US = 0.000579;
const CUBIC_FACTOR_NZ = 0.000001;

function groupsToParcels(groups: ParcelGroup[], dimensionUnit: string, isPerJob: boolean): ParcelDimensions[] {
    return groups.flatMap(g => {
        const length = g.length !== '' ? parseFloat(g.length) : undefined;
        const depth = g.depth !== '' ? parseFloat(g.depth) : undefined;
        const height = g.height !== '' ? parseFloat(g.height) : undefined;
        const rowWeight = g.weight !== '' ? parseFloat(g.weight) : undefined;
        const rowCubic = g.cubic !== '' ? parseFloat(g.cubic) : undefined;
        // Per Job: the entered weight/volume are the row's total contribution to the job, but
        // each barcode is still stored as its own parcel record — split them evenly so summing
        // the stored per-parcel values reconstructs the entered total instead of multiplying it
        // by quantity (parcelsToGroups sums them back up on reopen, so this round-trips cleanly).
        // Dimensions themselves are per-box measurements and aren't split.
        const weight = isPerJob && rowWeight != null && g.barcodes.length > 0
            ? Math.round((rowWeight / g.barcodes.length) * 10000) / 10000
            : rowWeight;
        const cubic = isPerJob && rowCubic != null && g.barcodes.length > 0
            ? Math.round((rowCubic / g.barcodes.length) * 10000) / 10000
            : rowCubic;
        const dimensions = length && depth && height
            ? `${length} × ${depth} × ${height} ${dimensionUnit}`
            : '';

        return g.barcodes.map(barcode => ({
            itemName: g.itemName,
            length,
            depth,
            height,
            weight,
            cubic,
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
    jobNumber,
    isUsCustomer,
    jobWeight,
    calculateDimsOncePerJob = false,
    partnerMode = false,
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
    const [targetCubic, setTargetCubic] = useState('');
    const [itemTypesByItemId, setItemTypesByItemId] = useState<Map<number, ParcelItemType[]>>(new Map());
    const [isPerJob, setIsPerJob] = useState(false);

    const dimensionUnit = isUsCustomer ? 'in' : 'cm';
    const weightUnit = isUsCustomer ? 'lbs' : 'kg';
    const volUnit = isUsCustomer ? 'ft³' : 'm³';

    useEffect(() => {
        if (!open) return;

        const loadedGroups = parcelsToGroups(initialParcels, calculateDimsOncePerJob);
        setGroups(loadedGroups);
        setIsFormDirty(false);
        setIsLoading(false);
        setIsParentJob(false);
        setTargetWeight(jobWeight != null ? String(jobWeight) : '');
        // Computed directly from the freshly loaded groups (not left to the parcelCubicTotal
        // sync effect below) — if the volume total happens to be unchanged from the last time
        // this dialog was open, that effect's dependency wouldn't change either, so it would
        // never re-fire and targetCubic would stay stuck at whatever it's reset to here.
        const loadedCubicTotal = loadedGroups.reduce((sum, g) => {
            const c = parseFloat(g.cubic);
            if (isNaN(c)) return sum;
            return sum + (calculateDimsOncePerJob ? c : c * g.barcodes.length);
        }, 0);
        setTargetCubic(loadedCubicTotal > 0 ? String(Math.round(loadedCubicTotal * 1000) / 1000) : '');
        setItemTypesByItemId(new Map());
        setIsPerJob(calculateDimsOncePerJob);

        if (jobId) {
            apiClient.get<boolean>('job/IsJobParent', {jobId}).then(setIsParentJob).catch(() => {});
        } else if (bulkJobId) {
            apiClient.get<boolean>('job/IsBulkJobParent', {bulkJobId}).then(setIsParentJob).catch(() => {});
        } else {
            showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
        }

        const itemTypeParams = jobId ? {jobId} : bulkJobId ? {bulkJobId} : null;
        if (itemTypeParams) {
            apiClient.get<Array<{itemId: number; name: string; quantity: number}>>('job/GetJobItemTypes', itemTypeParams)
                .then(items => {
                    const map = new Map<number, ParcelItemType[]>();
                    for (const item of items) {
                        if (!map.has(item.itemId)) map.set(item.itemId, []);
                        map.get(item.itemId)!.push({name: item.name, quantity: item.quantity});
                    }
                    setItemTypesByItemId(map);
                })
                .catch(() => {});
        }
    }, [open, initialParcels, jobId, bulkJobId, showToast, jobWeight, calculateDimsOncePerJob]);

    const updateGroup = useCallback((id: string, field: keyof Pick<ParcelGroup, 'itemName' | 'length' | 'depth' | 'height' | 'weight' | 'cubic'>, value: string) => {
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;
            const next = {...g, [field]: value};
            // Auto-suggest a volume from freshly entered dimensions, but only while Volume is
            // still blank — once the user has typed a volume themselves, dimension edits don't
            // overwrite it (Volume is its own editable field, same as Weight).
            if ((field === 'length' || field === 'depth' || field === 'height') && next.cubic === '') {
                const length = next.length !== '' ? parseFloat(next.length) : undefined;
                const depth = next.depth !== '' ? parseFloat(next.depth) : undefined;
                const height = next.height !== '' ? parseFloat(next.height) : undefined;
                if (length && depth && height) {
                    const cubicFactor = isUsCustomer ? CUBIC_FACTOR_US : CUBIC_FACTOR_NZ;
                    next.cubic = String(Math.round(length * depth * height * cubicFactor * 1000) / 1000);
                }
            }
            return next;
        }));
        setIsFormDirty(true);
    }, [isUsCustomer]);

    const adjustQty = useCallback((id: string, delta: number) => {
        setGroups(prev => {
            let next = jobNumber ? nextBarcodeStart(prev, jobNumber) : 0;
            return prev.map(g => {
                if (g.id !== id) return g;
                const newQty = g.barcodes.length + delta;
                if (newQty < 1) return g;
                const barcodes = [...g.barcodes];
                if (delta > 0) {
                    for (let i = 0; i < delta; i++) barcodes.push(jobNumber ? `${jobNumber}-${next++}` : '');
                } else {
                    barcodes.splice(barcodes.length + delta, -delta);
                }
                return {...g, barcodes};
            });
        });
        setIsFormDirty(true);
    }, [jobNumber]);

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
        setGroups(prev => {
            const g = newGroup();
            if (jobNumber) g.barcodes = [`${jobNumber}-${nextBarcodeStart(prev, jobNumber)}`];
            return [...prev, g];
        });
        setIsFormDirty(true);
    }, [jobNumber]);

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

    // Per Job: each row's weight already represents its full contribution to the job,
    // so it isn't multiplied by quantity (mirrors the pricing SP's SET @Quantity = 1).
    const parcelTotal = useMemo(() =>
        groups.reduce((sum, g) => {
            const w = parseFloat(g.weight);
            if (isNaN(w)) return sum;
            return sum + (isPerJob ? w : w * g.barcodes.length);
        }, 0),
    [groups, isPerJob]);

    // Same per-job/per-item treatment as weight, now that Volume is directly editable.
    const parcelCubicTotal = useMemo(() =>
        groups.reduce((sum, g) => {
            const c = parseFloat(g.cubic);
            if (isNaN(c)) return sum;
            return sum + (isPerJob ? c : c * g.barcodes.length);
        }, 0),
    [groups, isPerJob]);

    // Keep job weight in sync with parcel total as the user edits dimension rows
    useEffect(() => {
        if (parcelTotal > 0) setTargetWeight(String(Math.round(parcelTotal * 10) / 10));
    }, [parcelTotal]);

    // Same convenience sync for volume now that it's directly editable.
    useEffect(() => {
        if (parcelCubicTotal > 0) setTargetCubic(String(Math.round(parcelCubicTotal * 1000) / 1000));
    }, [parcelCubicTotal]);

    const hasEmptyWeights = groups.some(g => { const w = parseFloat(g.weight); return isNaN(w) || w <= 0; });
    const weightMismatch = !hasEmptyWeights && parcelTotal > 0 && Math.abs((parseFloat(targetWeight) || 0) - parcelTotal) > 1;
    // Volume is optional (unlike weight), so there's no "hasEmptyWeights"-equivalent gate —
    // only flag a mismatch when there's actually a volume total to reconcile against.
    const cubicMismatch = parcelCubicTotal > 0 && Math.abs((parseFloat(targetCubic) || 0) - parcelCubicTotal) > 0.01;

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

    // Independent of weight's Match proportionally — you might want to reconcile one
    // without touching the other.
    const handleMatchCubicProportionally = useCallback(() => {
        const target = parseFloat(targetCubic);
        if (isNaN(target) || target <= 0 || parcelCubicTotal <= 0) return;
        const scale = target / parcelCubicTotal;
        setGroups(prev => prev.map(g => {
            const c = parseFloat(g.cubic);
            if (isNaN(c) || c === 0) return g;
            return {...g, cubic: String(Math.round(c * scale * 1000) / 1000)};
        }));
        setIsFormDirty(true);
    }, [targetCubic, parcelCubicTotal]);

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
            const updatedParcels = groupsToParcels(groups, dimensionUnit, isPerJob);

            // Partner mode: skip the direct API call and the success toast — the
            // caller wires the captured parcels into the change-request dialog so
            // the user can add a reason and the partner can approve. Bulk jobs
            // never enter partner mode (they have no inter-tenant pairing).
            if (partnerMode) {
                const result: EditParcelDimensionsDialogResult = {parcels: updatedParcels, totalWeight: parcelTotal, calculateDimsOncePerJob: isPerJob};
                onSubmit(result);
                return;
            }

            if (jobId) {
                await apiClient.post('job/UpdateJobPackages', {jobId, parcels: updatedParcels, weight: parcelTotal > 0 ? parcelTotal : undefined, calculateDimsOncePerJob: isPerJob});
            } else if (bulkJobId) {
                await apiClient.post('job/UpdateBulkJobPackages', {bulkJobId, parcels: updatedParcels, calculateDimsOncePerJob: isPerJob});
            } else {
                showToast('No JobId or BulkJobId was provided. Something went wrong.', 'error');
                return;
            }

            showToast(`Successfully updated ${totalParcels} ${totalParcels === 1 ? 'parcel' : 'parcels'}`, 'success');
            const result: EditParcelDimensionsDialogResult = {parcels: updatedParcels, totalWeight: parcelTotal, calculateDimsOncePerJob: isPerJob};
            onSubmit(result);
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to update parcels', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [groups, dimensionUnit, jobId, bulkJobId, partnerMode, totalParcels, parcelTotal, isPerJob, showToast, onSubmit]);

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
                    ...headerChromeSx(theme),
                    flexShrink: 0,
                })}
            >
                <Box sx={(theme) => headerChipSx(theme)}>
                    <Inventory2OutlinedIcon/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{
                        fontWeight: 600
                    }}>Edit Quantity</Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {groups.length} type{groups.length !== 1 ? 's' : ''} · {totalParcels} parcel{totalParcels !== 1 ? 's' : ''} total
                    </Typography>
                </Box>
                <IconButton onClick={handleCancel} disabled={isLoading} sx={(theme) => ({
                    color: headerOnColor(theme),
                    '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                })}>
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
                            <TableCell align="center" sx={{width: 90}}>Weight ({weightUnit})</TableCell>
                            <TableCell align="center" sx={{width: 90}}>Volume ({volUnit})</TableCell>
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
                                            slotProps={{htmlInput: {maxLength: MAX_NAME_LENGTH}}}
                                        />
                                        {g.representativeItemId != null && (itemTypesByItemId.get(g.representativeItemId) ?? []).length > 0 && (
                                            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5}}>
                                                {(itemTypesByItemId.get(g.representativeItemId) ?? []).map((t, i) => (
                                                    <Box key={i} sx={(theme) => ({fontSize: 11, bgcolor: alpha(theme.palette.info.main, 0.1), border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`, borderRadius: 1.25, px: 0.75, py: 0.25, color: theme.palette.info.dark, whiteSpace: 'nowrap', lineHeight: 1.6})}>
                                                        {t.name} ×{t.quantity}
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}
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
                                            slotProps={{htmlInput: numInput}}
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
                                            slotProps={{htmlInput: numInput}}
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
                                            slotProps={{htmlInput: numInput}}
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
                                            slotProps={{htmlInput: {min: 0, step: 0.001, 'aria-label': 'Weight'}}}
                                            sx={noSpinnerSx}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={g.cubic}
                                            onChange={e => updateGroup(g.id, 'cubic', e.target.value)}
                                            onWheel={e => e.currentTarget.blur()}
                                            placeholder="—"
                                            slotProps={{htmlInput: {min: 0, step: 0.001, 'aria-label': 'Volume'}}}
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
                                            <Typography variant="caption" sx={{
                                                color: "text.secondary"
                                            }}>
                                                Item {i + 1}
                                            </Typography>
                                        </TableCell>
                                        <TableCell colSpan={7}>
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
                <Tooltip title={isPerJob
                    ? 'Per Job: each row\'s weight/dimensions already represent the whole job — quantity isn\'t multiplied in'
                    : 'Per Item: each row\'s weight/dimensions apply to a single parcel and are multiplied by quantity'}
                >
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={isPerJob ? 'perJob' : 'perItem'}
                        onChange={(_e, value) => {
                            if (value === null) return;
                            setIsPerJob(value === 'perJob');
                            setIsFormDirty(true);
                        }}
                    >
                        <ToggleButton value="perItem">Per Item</ToggleButton>
                        <ToggleButton value="perJob">Per Job</ToggleButton>
                    </ToggleButtonGroup>
                </Tooltip>
                <TextField
                    size="small"
                    label="Job weight"
                    type="number"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    slotProps={{
                        input: {endAdornment: <InputAdornment position="end">{weightUnit}</InputAdornment>},
                        htmlInput: {min: 0, step: 0.001},
                    }}
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
                <TextField
                    size="small"
                    label="Job volume"
                    type="number"
                    value={targetCubic}
                    onChange={e => setTargetCubic(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    slotProps={{
                        input: {endAdornment: <InputAdornment position="end">{volUnit}</InputAdornment>},
                        htmlInput: {min: 0, step: 0.001},
                    }}
                    sx={{...noSpinnerSx, width: 150}}
                    error={cubicMismatch}
                />
                <Tooltip title="Scale individual item volumes proportionally so they total the job volume">
                    <span>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleMatchCubicProportionally}
                            disabled={isNaN(parseFloat(targetCubic)) || parseFloat(targetCubic) <= 0 || parcelCubicTotal <= 0}
                        >
                            Match proportionally
                        </Button>
                    </span>
                </Tooltip>
                <Box sx={{flex: 1}} />
                <Typography variant="body2" sx={{
                    color: "text.secondary"
                }}>
                    Parcel total: <strong>{parcelTotal > 0 ? parcelTotal.toFixed(1) : '—'} {parcelTotal > 0 ? weightUnit : ''}</strong>
                    {' · '}
                    Volume total: <strong>{parcelCubicTotal > 0 ? parcelCubicTotal.toFixed(3) : '—'} {parcelCubicTotal > 0 ? volUnit : ''}</strong>
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
            {cubicMismatch && (
                <Alert severity="warning" sx={{borderRadius: 0, flexShrink: 0, py: 0.25, '& .MuiAlert-message': {py: 0.5}}}>
                    Job volume ({(parseFloat(targetCubic) || 0).toFixed(3)} {volUnit}) doesn't match parcel volume total ({parcelCubicTotal.toFixed(3)} {volUnit}). Adjust line item volumes or click <strong>Match proportionally</strong>.
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
                    <Tooltip title={hasEmptyWeights ? 'All parcels must have a weight greater than 0' : weightMismatch ? 'Job weight must match parcel total before saving' : cubicMismatch ? 'Job volume must match parcel volume total before saving' : ''}>
                        <span>
                            <Button variant="contained" onClick={handleSubmit} disabled={hasEmptyWeights || weightMismatch || cubicMismatch}>
                                {partnerMode ? 'Continue' : 'Save'}
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
                    sx={(theme) => headerChromeSx(theme, 'warning')}
                >
                    <Box sx={(theme) => headerChipSx(theme, 'warning')}>
                        <WarningAmberIcon/>
                    </Box>
                    <Box sx={{flex: 1}}>
                        <Typography variant="h6" sx={{
                            fontWeight: 600
                        }}>Discard unsaved changes</Typography>
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>Changes will be permanently lost</Typography>
                    </Box>
                    <IconButton onClick={() => setDiscardDialogOpen(false)} sx={(theme) => ({
                        color: headerOnColor(theme, 'warning'),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1, 'warning')}
                    })}>
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
