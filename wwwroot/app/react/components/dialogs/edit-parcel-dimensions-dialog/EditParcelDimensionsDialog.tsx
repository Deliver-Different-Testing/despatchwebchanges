import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActionIcon, Alert, Badge, Box, Button, Group, NumberInput, Table, Text, TextInput, Tooltip} from '@mantine/core';
import {ChevronDown, ChevronUp, Info, Minus, Plus, Trash2, TriangleAlert} from 'lucide-react';
import {IconPackage, IconLock} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {SegmentedToggle} from '../../common/segmented-toggle/SegmentedToggle';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogSize,
} from '../shared/mantine';

import {apiClient} from '../../../services/apiClient';
import {EditParcelDimensionsDialogProps, EditParcelDimensionsDialogResult, ParcelDimensions} from './types';

const MAX_NAME_LENGTH = 50;

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

/** One numeric cell of the dimensions grid — same field, different measurement. */
function DimensionCell({value, disabled, label, step = 0.01, onChange}: {
    value: string | number;
    disabled?: boolean;
    /** Names the input where the column header cannot — Weight and Volume. */
    label?: string;
    step?: number;
    onChange: (value: string) => void;
}) {
    return (
        <Table.Td>
            <NumberInput
                size="sm"
                min={0}
                step={step}
                /* The grid is dense and every cell is numeric; the steppers would
                   double the visual weight of the row for no reach they do not
                   already have from the keyboard. */
                hideControls
                disabled={disabled}
                aria-label={label}
                value={value}
                onChange={next => onChange(String(next))}
                placeholder="—"
            />
        </Table.Td>
    );
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
    readOnly = false,
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

    const saveBlockedReason = hasEmptyWeights
        ? 'All parcels must have a weight greater than 0'
        : weightMismatch
            ? 'Job weight must match parcel total before saving'
            : cubicMismatch
                ? 'Job volume must match parcel volume total before saving'
                : '';

    return (
        <DialogShell
            opened={open}
            onClose={handleCancel}
            size={dialogSize.lg}
            label="Edit Quantity"
        >
            <DialogHeader
                icon={readOnly ? <Icon tabler={IconLock}/> : <Icon tabler={IconPackage}/>}
                title="Edit Quantity"
                subtitle={readOnly
                    ? 'View only — this job is locked'
                    : `${groups.length} type${groups.length !== 1 ? 's' : ''} · ${totalParcels} parcel${totalParcels !== 1 ? 's' : ''} total`}
                onClose={handleCancel}
                closeDisabled={isLoading}
            />

            {isParentJob && (
                <Alert color="blue" variant="light" radius={0} icon={<Icon lucide={Info}/>}>
                    This is a child job. Parcel information has been inherited from the parent job.
                </Alert>
            )}

            {/* Table */}
            <Box p={16}>
                <Table striped={false} verticalSpacing={4} horizontalSpacing={8} stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{minWidth: 130}}>Name</Table.Th>
                            <Table.Th ta="center" w={80}>L ({dimensionUnit})</Table.Th>
                            <Table.Th ta="center" w={80}>W ({dimensionUnit})</Table.Th>
                            <Table.Th ta="center" w={80}>H ({dimensionUnit})</Table.Th>
                            <Table.Th ta="center" w={90}>Weight ({weightUnit})</Table.Th>
                            <Table.Th ta="center" w={90}>Volume ({volUnit})</Table.Th>
                            <Table.Th ta="center" w={110}>Qty</Table.Th>
                            <Table.Th w={72}/>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {groups.map(g => (
                            <React.Fragment key={g.id}>
                                <Table.Tr>
                                    <Table.Td>
                                        <TextInput
                                            size="sm"
                                            disabled={readOnly}
                                            value={g.itemName}
                                            onChange={e => updateGroup(g.id, 'itemName', e.currentTarget.value)}
                                            placeholder="Name"
                                            aria-label="Name"
                                            maxLength={MAX_NAME_LENGTH}
                                        />
                                        {g.representativeItemId != null && (itemTypesByItemId.get(g.representativeItemId) ?? []).length > 0 && (
                                            <Group gap={4} mt={4}>
                                                {(itemTypesByItemId.get(g.representativeItemId) ?? []).map((t, i) => (
                                                    <Badge key={i} size="xs" variant="light" color="blue">
                                                        {t.name} ×{t.quantity}
                                                    </Badge>
                                                ))}
                                            </Group>
                                        )}
                                    </Table.Td>
                                    <DimensionCell
                                        value={g.length}
                                        disabled={readOnly}
                                        label="Length"
                                        onChange={value => updateGroup(g.id, 'length', value)}
                                    />
                                    <DimensionCell
                                        value={g.depth}
                                        disabled={readOnly}
                                        label="Width"
                                        onChange={value => updateGroup(g.id, 'depth', value)}
                                    />
                                    <DimensionCell
                                        value={g.height}
                                        disabled={readOnly}
                                        label="Height"
                                        onChange={value => updateGroup(g.id, 'height', value)}
                                    />
                                    <DimensionCell
                                        value={g.weight}
                                        disabled={readOnly}
                                        label="Weight"
                                        step={0.001}
                                        onChange={value => updateGroup(g.id, 'weight', value)}
                                    />
                                    <DimensionCell
                                        value={g.cubic}
                                        disabled={readOnly}
                                        label="Volume"
                                        step={0.001}
                                        onChange={value => updateGroup(g.id, 'cubic', value)}
                                    />
                                    <Table.Td>
                                        <Group gap={4} justify="center" wrap="nowrap">
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                size="sm"
                                                aria-label="Decrease quantity"
                                                onClick={() => adjustQty(g.id, -1)}
                                                disabled={readOnly || g.barcodes.length <= 1}
                                            >
                                                <Icon lucide={Minus} size={16}/>
                                            </ActionIcon>
                                            <Text fz="sm" ta="center" style={{minWidth: 20}}>
                                                {g.barcodes.length}
                                            </Text>
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                size="sm"
                                                aria-label="Increase quantity"
                                                onClick={() => adjustQty(g.id, 1)}
                                                disabled={readOnly}
                                            >
                                                <Icon lucide={Plus} size={16}/>
                                            </ActionIcon>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={2} wrap="nowrap">
                                            <Tooltip label="Delete row">
                                                {/* A disabled control emits no pointer events, so the
                                                    tooltip needs something of its own to hang on. */}
                                                <span>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        aria-label="Delete row"
                                                        onClick={() => deleteGroup(g.id)}
                                                        disabled={readOnly}
                                                    >
                                                        <Icon lucide={Trash2} size={16}/>
                                                    </ActionIcon>
                                                </span>
                                            </Tooltip>
                                            <Tooltip label={g.expandedBarcodes ? 'Hide barcodes' : 'Show barcodes'}>
                                                <ActionIcon
                                                    variant="subtle"
                                                    color="gray"
                                                    size="sm"
                                                    aria-label={g.expandedBarcodes ? 'Hide barcodes' : 'Show barcodes'}
                                                    aria-expanded={g.expandedBarcodes}
                                                    onClick={() => toggleBarcodes(g.id)}
                                                >
                                                    <Icon lucide={g.expandedBarcodes ? ChevronUp : ChevronDown} size={16}/>
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>

                                {g.expandedBarcodes && g.barcodes.map((barcode, i) => (
                                    <Table.Tr key={`${g.id}-bc-${i}`} bg="var(--mantine-color-gray-0)">
                                        <Table.Td pl={32}>
                                            <Text fz="xs" c="dimmed">Item {i + 1}</Text>
                                        </Table.Td>
                                        <Table.Td colSpan={7}>
                                            <TextInput
                                                size="sm"
                                                disabled={readOnly}
                                                value={barcode}
                                                onChange={e => updateBarcode(g.id, i, e.currentTarget.value)}
                                                placeholder="Barcode"
                                                label="Barcode"
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </Table.Tbody>
                </Table>

                <Button
                    variant="subtle"
                    size="xs"
                    mt={12}
                    leftSection={<Icon lucide={Plus} size={16}/>}
                    onClick={addGroup}
                    disabled={readOnly}
                >
                    Add package type
                </Button>
            </Box>

            {/* Weight section */}
            <Group px={16} py={12} gap={16} align="flex-end" wrap="wrap"
                   style={{borderTop: '1px solid var(--mantine-color-default-border)'}}>
                {/*
                  * Exclusive and not clearable — the MUI group returned early on a
                  * null value to say so. That is the app's single-select grammar, and
                  * SegmentedToggle renders real radios, so re-picking the active
                  * option can no longer deselect it.
                  */}
                <SegmentedToggle
                    aria-label="How weights and dimensions are counted"
                    variant="inline"
                    value={isPerJob ? 'perJob' : 'perItem'}
                    onChange={value => {
                        setIsPerJob(value === 'perJob');
                        setIsFormDirty(true);
                    }}
                    data={[
                        {
                            value: 'perItem',
                            label: 'Per Item',
                            disabled: readOnly,
                            tooltip: "Per Item: each row's weight/dimensions apply to a single parcel and are multiplied by quantity",
                        },
                        {
                            value: 'perJob',
                            label: 'Per Job',
                            disabled: readOnly,
                            tooltip: "Per Job: each row's weight/dimensions already represent the whole job — quantity isn't multiplied in",
                        },
                    ]}
                />
                <NumberInput
                    size="sm"
                    w={150}
                    label="Job weight"
                    min={0}
                    step={0.001}
                    hideControls
                    disabled={readOnly}
                    value={targetWeight}
                    onChange={value => setTargetWeight(String(value))}
                    rightSection={<Text fz="sm" c="dimmed">{weightUnit}</Text>}
                    error={weightMismatch}
                />
                <Tooltip label="Scale individual item weights proportionally so they total the job weight">
                    <span>
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleMatchProportionally}
                            disabled={readOnly || isNaN(parseFloat(targetWeight)) || parseFloat(targetWeight) <= 0 || parcelTotal <= 0}
                        >
                            Match proportionally
                        </Button>
                    </span>
                </Tooltip>
                <NumberInput
                    size="sm"
                    w={150}
                    label="Job volume"
                    min={0}
                    step={0.001}
                    hideControls
                    disabled={readOnly}
                    value={targetCubic}
                    onChange={value => setTargetCubic(String(value))}
                    rightSection={<Text fz="sm" c="dimmed">{volUnit}</Text>}
                    error={cubicMismatch}
                />
                <Tooltip label="Scale individual item volumes proportionally so they total the job volume">
                    <span>
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleMatchCubicProportionally}
                            disabled={readOnly || isNaN(parseFloat(targetCubic)) || parseFloat(targetCubic) <= 0 || parcelCubicTotal <= 0}
                        >
                            Match proportionally
                        </Button>
                    </span>
                </Tooltip>
                <Box style={{flex: 1}}/>
                <Text fz="sm" c="dimmed">
                    Parcel total: <strong>{parcelTotal > 0 ? parcelTotal.toFixed(1) : '—'} {parcelTotal > 0 ? weightUnit : ''}</strong>
                    {' · '}
                    Volume total: <strong>{parcelCubicTotal > 0 ? parcelCubicTotal.toFixed(3) : '—'} {parcelCubicTotal > 0 ? volUnit : ''}</strong>
                </Text>
            </Group>

            {hasEmptyWeights && (
                <Alert color="red" variant="light" radius={0} py={4}>
                    All parcels must have a weight greater than 0 before saving.
                </Alert>
            )}
            {!hasEmptyWeights && weightMismatch && (
                <Alert color="yellow" variant="light" radius={0} py={4}>
                    Job weight ({(parseFloat(targetWeight) || 0).toFixed(1)} {weightUnit}) doesn&apos;t match parcel total ({parcelTotal.toFixed(1)} {weightUnit}). Adjust line item weights or click <strong>Match proportionally</strong>.
                </Alert>
            )}
            {cubicMismatch && (
                <Alert color="yellow" variant="light" radius={0} py={4}>
                    Job volume ({(parseFloat(targetCubic) || 0).toFixed(3)} {volUnit}) doesn&apos;t match parcel volume total ({parcelCubicTotal.toFixed(3)} {volUnit}). Adjust line item volumes or click <strong>Match proportionally</strong>.
                </Alert>
            )}

            {/* Footer */}
            <Tooltip label={saveBlockedReason} disabled={!saveBlockedReason}>
                <span>
                    <DialogFooter
                        onCancel={handleCancel}
                        onConfirm={handleSubmit}
                        cancelLabel={readOnly ? 'Close' : 'Cancel'}
                        confirmLabel={partnerMode ? 'Continue' : 'Save'}
                        confirmDisabled={hasEmptyWeights || weightMismatch || cubicMismatch}
                        submitting={isLoading}
                        hideConfirm={readOnly}
                    />
                </span>
            </Tooltip>

            {/* Discard confirmation */}
            <DialogShell
                opened={discardDialogOpen}
                onClose={() => setDiscardDialogOpen(false)}
                size={dialogSize.sm}
                label="Discard unsaved changes"
            >
                <DialogHeader
                    variant="warning"
                    icon={<Icon lucide={TriangleAlert}/>}
                    title="Discard unsaved changes"
                    subtitle="Changes will be permanently lost"
                    onClose={() => setDiscardDialogOpen(false)}
                />
                <Box p={24}>
                    <Text>Your changes to parcel dimensions haven&apos;t been saved and will be lost.</Text>
                </Box>
                <DialogFooter
                    onCancel={() => setDiscardDialogOpen(false)}
                    cancelLabel="Keep editing"
                    onConfirm={() => { setDiscardDialogOpen(false); onClose(); }}
                    confirmLabel="Discard"
                    confirmColor="red"
                />
            </DialogShell>
        </DialogShell>
    );
};

export default EditParcelDimensionsDialog;
