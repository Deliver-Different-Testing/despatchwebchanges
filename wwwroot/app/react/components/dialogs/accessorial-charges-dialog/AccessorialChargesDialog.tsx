/**
 * Accessorial Charges Dialog
 *
 * Two-section layout:
 *  1. Applied Charges — table of charges already on the job, editable + deletable
 *  2. Add Charges     — table of available charges with checkboxes; bulk-add button
 */

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    Chip,
    IconButton,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableFooter,
    TableHead,
    TableRow,
    Checkbox,
    Paper,
    TextField,
    CircularProgress,
    Divider,
} from '@mui/material';
import {
    Close as CloseIcon,
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Lock as LockIcon,
    Save as SaveIcon,
    Receipt as ReceiptIcon,
} from '@mui/icons-material';
import {
    AccessorialChargeDto,
    JobAccessorialChargeDto,
    JobAccessorialChargeUpdateRequest,
    AccessorialChargesDialogProps,
    JobAccessorialChargeCreateRequest,
} from './types';
import { accessorialChargesApi } from '../../../services/accessorialChargesApi';

interface AppliedRowState {
    inputValue: string;
    itemCount: string;
    notes: string;
    overrideAmount: string;
    isDirty: boolean;
    isSaving: boolean;
    isDeleting: boolean;
}

interface DialogState {
    availableCharges: AccessorialChargeDto[];
    appliedCharges: JobAccessorialChargeDto[];
    appliedRowState: Record<number, AppliedRowState>;
    selectedIds: Set<number>;
    availableInputMap: Record<number, string>;
    availableNotesMap: Record<number, string>;
    missingInputIds: Set<number>;
    isLoadingAvailable: boolean;
    isLoadingApplied: boolean;
    isAddingCharges: boolean;
}

export class AccessorialChargesDialog extends React.Component<
    AccessorialChargesDialogProps,
    DialogState
> {
    // Snapshot of applied charges at dialog-open time. Used to compute the delta
    // between the initial state and the current state for percentage base calculations,
    // since job.amount is a stale prop that doesn't update mid-session.
    private initialAppliedCharges: JobAccessorialChargeDto[] | null = null;

    // Live ucjbAmount fetched from the DB at dialog-open time. More reliable than
    // this.props.job?.amount, which comes from the AngularJS scope and may not be
    // refreshed after the user deletes/updates charges and re-opens the dialog.
    private liveJobAmount: number | null = null;

    constructor(props: AccessorialChargesDialogProps) {
        super(props);
        this.state = {
            availableCharges: [],
            appliedCharges: [],
            appliedRowState: {},
            selectedIds: new Set(),
            availableInputMap: {},
            availableNotesMap: {},
            missingInputIds: new Set(),
            isLoadingAvailable: false,
            isLoadingApplied: false,
            isAddingCharges: false,
        };
    }

    componentDidUpdate(prevProps: AccessorialChargesDialogProps, prevState: DialogState): void {
        if (this.props.open && !prevProps.open) {
            this.reset();
            this.loadAll();
        }
        if (prevState.appliedRowState !== this.state.appliedRowState) {
            const hasDirtyRows = Object.values(this.state.appliedRowState).some(r => r.isDirty);
            if (hasDirtyRows) {
                this.recomputePercentageInputsFromState();
            }
        }
    }

    componentDidMount(): void {
        if (this.props.open) {
            this.loadAll();
        }
    }

    private reset(): void {
        this.initialAppliedCharges = null;
        this.liveJobAmount = null;
        this.setState({
            availableCharges: [],
            appliedCharges: [],
            appliedRowState: {},
            selectedIds: new Set(),
            availableInputMap: {},
            availableNotesMap: {},
            missingInputIds: new Set(),
            isLoadingAvailable: false,
            isLoadingApplied: false,
            isAddingCharges: false,
        });
    }

    private async loadAll(): Promise<JobAccessorialChargeDto[]> {
        const { job } = this.props;
        const [available, applied, liveAmount] = await Promise.all([
            this.loadAvailableCharges(),
            this.loadAppliedCharges(),
            job ? accessorialChargesApi.getJobAmount(job.id).catch(() => null) : Promise.resolve(null),
        ]);
        // Only set once per session (same principle as initialAppliedCharges).
        // Mid-session adds/delete update ucjbAmount via triggers, but the delta-based
        // calculation in initialAdjustedJobAmount relies on the value being stable.
        if (this.liveJobAmount === null && liveAmount !== null) this.liveJobAmount = liveAmount;
        this.computePercentageInputs(available ?? [], applied ?? []);
        return applied ?? [];
    }

    private computePercentageInputs(
        availableCharges: AccessorialChargeDto[],
        appliedCharges: JobAccessorialChargeDto[]
    ): void {
        const initial = this.initialAppliedCharges ?? [];

        const inputMap: Record<number, string> = {};
        for (const charge of availableCharges) {
            if (charge.chargeType !== 'percentage') continue;

            const initialNonPctTotal = initial
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < charge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
            const currentNonPctTotal = appliedCharges
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < charge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

            inputMap[charge.accessorialChargeId] = String(this.initialAdjustedJobAmount + currentNonPctTotal - initialNonPctTotal);
        }

        if (Object.keys(inputMap).length === 0) return;
        this.setState(prev => ({
            availableInputMap: { ...prev.availableInputMap, ...inputMap },
        }));
    }

    private recomputePercentageInputsFromState(): void {
        const { availableCharges, appliedCharges, appliedRowState } = this.state;
        const initial = this.initialAppliedCharges ?? [];

        const inputMap: Record<number, string> = {};
        for (const pctCharge of availableCharges) {
            if (pctCharge.chargeType !== 'percentage') continue;

            const initialNonPctTotal = initial
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

            let currentNonPctTotal = 0;
            let dirtyAdjustment = 0;
            for (const applied of appliedCharges) {
                if (applied.chargeType === 'percentage') continue;
                if (applied.calculationOrder >= pctCharge.calculationOrder) continue;

                currentNonPctTotal += applied.overrideAmount ?? applied.calculatedAmount ?? 0;

                const row = appliedRowState[applied.jobAccessorialChargeId];
                if (!row?.isDirty) continue;

                const savedAmount = applied.overrideAmount ?? applied.calculatedAmount ?? 0;
                const dirtyAmount = row.overrideAmount !== '' && !isNaN(parseFloat(row.overrideAmount))
                    ? parseFloat(row.overrideAmount)
                    : this.recalculate(applied, row);
                dirtyAdjustment += dirtyAmount - savedAmount;
            }

            inputMap[pctCharge.accessorialChargeId] = String(this.initialAdjustedJobAmount + currentNonPctTotal - initialNonPctTotal + dirtyAdjustment);
        }

        if (Object.keys(inputMap).length === 0) return;
        this.setState(prev => ({
            availableInputMap: { ...prev.availableInputMap, ...inputMap },
        }));
    }

    private loadAppliedCharges = async (): Promise<JobAccessorialChargeDto[] | null> => {
        const { job, showToast } = this.props;
        if (!job) return null;

        this.setState({ isLoadingApplied: true });
        try {
            const charges = await accessorialChargesApi.getAppliedCharges(job.id);
            const rowState: Record<number, AppliedRowState> = {};
            for (const c of charges) {
                rowState[c.jobAccessorialChargeId] = {
                    inputValue: c.inputValue != null ? String(c.inputValue) : '',
                    itemCount: String(c.itemCount ?? 1),
                    notes: c.notes ?? '',
                    overrideAmount: c.overrideAmount != null ? String(c.overrideAmount) : '',
                    isDirty: false,
                    isSaving: false,
                    isDeleting: false,
                };
            }
            if (this.initialAppliedCharges === null) {
                this.initialAppliedCharges = charges;
            }
            this.setState({ appliedCharges: charges, appliedRowState: rowState, isLoadingApplied: false });
            return charges;
        } catch (error: any) {
            showToast(`Error loading applied charges: ${error.message}`, 'error');
            this.setState({ isLoadingApplied: false });
            return null;
        }
    };

    private loadAvailableCharges = async (): Promise<AccessorialChargeDto[] | null> => {
        const { job, showToast } = this.props;
        if (!job) return null;

        this.setState({ isLoadingAvailable: true });
        try {
            const charges = await accessorialChargesApi.getAvailableCharges(
                job.accessorialChargeGroupId,
                job.id
            );
            const autoInputMap: Record<number, string> = {};
            for (const c of charges) {
                if (c.minimumQuantity != null) {
                    autoInputMap[c.accessorialChargeId] = String(c.minimumQuantity);
                }
                if (c.unitTypeName === 'Pounds' || c.unitTypeName === 'Kilograms') {
                    if (job.weight != null) autoInputMap[c.accessorialChargeId] = String(job.weight);
                } else if (c.unitTypeName === 'Quantity') {
                    if (job.quantity != null) autoInputMap[c.accessorialChargeId] = String(job.quantity);
                }
            }
            this.setState(prev => ({
                availableCharges: charges,
                availableInputMap: { ...autoInputMap, ...prev.availableInputMap },
                isLoadingAvailable: false,
            }));
            return charges;
        } catch (error: any) {
            showToast(`Error loading available charges: ${error.message}`, 'error');
            this.setState({ isLoadingAvailable: false });
            return null;
        }
    };

    private handleRefresh = async (): Promise<void> => {
        this.reset();
        await this.loadAll();
    };

    // ── Applied row handlers ──────────────────────────────────────────────────

    private setRowField(id: number, field: keyof AppliedRowState, value: any): void {
        this.setState(prev => ({
            appliedRowState: {
                ...prev.appliedRowState,
                [id]: {
                    ...prev.appliedRowState[id],
                    [field]: value,
                    isDirty: true,
                },
            },
        }));
    }

    private handleSaveRow = async (charge: JobAccessorialChargeDto): Promise<void> => {
        const { showToast } = this.props;
        const row = this.state.appliedRowState[charge.jobAccessorialChargeId];
        if (!row) return;

        const inputValue = row.inputValue !== '' ? parseFloat(row.inputValue) : undefined;
        const itemCount = row.itemCount !== '' ? parseInt(row.itemCount, 10) : 1;

        const overrideAmount = row.overrideAmount !== '' ? parseFloat(row.overrideAmount) : undefined;
        const request: JobAccessorialChargeUpdateRequest = {
            inputValue: isNaN(inputValue as number) ? undefined : inputValue,
            itemCount: isNaN(itemCount) ? 1 : itemCount,
            notes: row.notes || undefined,
            overrideAmount: overrideAmount !== undefined && !isNaN(overrideAmount) ? overrideAmount : undefined,
        };

        this.setState(prev => ({
            appliedRowState: {
                ...prev.appliedRowState,
                [charge.jobAccessorialChargeId]: { ...prev.appliedRowState[charge.jobAccessorialChargeId], isSaving: true },
            },
        }));

        try {
            const updated = await accessorialChargesApi.updateCharge(charge.jobAccessorialChargeId, request);
            this.setState(prev => {
                const updatedCharges = prev.appliedCharges.map(c =>
                    c.jobAccessorialChargeId === charge.jobAccessorialChargeId ? updated : c
                );
                return {
                    appliedCharges: updatedCharges,
                    appliedRowState: {
                        ...prev.appliedRowState,
                        [charge.jobAccessorialChargeId]: {
                            inputValue: updated.inputValue != null ? String(updated.inputValue) : '',
                            itemCount: String(updated.itemCount ?? 1),
                            notes: updated.notes ?? '',
                            overrideAmount: updated.overrideAmount != null ? String(updated.overrideAmount) : '',
                            isDirty: false,
                            isSaving: false,
                            isDeleting: false,
                        },
                    },
                };
            });
            showToast(`Charge "${charge.name}" updated.`, 'success');
            const applied = await this.loadAll();
            if (charge.chargeType !== 'percentage') await this.autoSavePercentageCharges(applied);
        } catch (error: any) {
            showToast(`Error saving charge: ${error.message}`, 'error');
            this.setState(prev => ({
                appliedRowState: {
                    ...prev.appliedRowState,
                    [charge.jobAccessorialChargeId]: { ...prev.appliedRowState[charge.jobAccessorialChargeId], isSaving: false },
                },
            }));
        }
    };

    private handleDeleteRow = async (charge: JobAccessorialChargeDto): Promise<void> => {
        const { showToast } = this.props;

        this.setState(prev => ({
            appliedRowState: {
                ...prev.appliedRowState,
                [charge.jobAccessorialChargeId]: { ...prev.appliedRowState[charge.jobAccessorialChargeId], isDeleting: true },
            },
        }));

        try {
            await accessorialChargesApi.deleteCharge(charge.jobAccessorialChargeId);
            this.setState(prev => {
                const updated = { ...prev.appliedRowState };
                delete updated[charge.jobAccessorialChargeId];
                return {
                    appliedCharges: prev.appliedCharges.filter(c => c.jobAccessorialChargeId !== charge.jobAccessorialChargeId),
                    appliedRowState: updated,
                };
            });
            showToast(`Charge "${charge.name}" removed.`, 'success');
            const applied = await this.loadAll();
            await this.autoSavePercentageCharges(applied);
        } catch (error: any) {
            showToast(`Error deleting charge: ${error.message}`, 'error');
            this.setState(prev => ({
                appliedRowState: {
                    ...prev.appliedRowState,
                    [charge.jobAccessorialChargeId]: { ...prev.appliedRowState[charge.jobAccessorialChargeId], isDeleting: false },
                },
            }));
        }
    };

    // ── Add charges handlers ──────────────────────────────────────────────────

    private handleToggleAvailable = (chargeId: number): void => {
        this.setState(prev => {
            const next = new Set(prev.selectedIds);
            if (next.has(chargeId)) next.delete(chargeId);
            else next.add(chargeId);
            return { selectedIds: next };
        });
    };

    private handleAvailableNoteChange = (chargeId: number, value: string): void => {
        this.setState(prev => ({
            availableNotesMap: { ...prev.availableNotesMap, [chargeId]: value },
        }));
    };

    private handleAppliedInputBlur = (jobAccessorialChargeId: number, minimumQuantity: number | undefined): void => {
        if (!minimumQuantity) return;
        const row = this.state.appliedRowState[jobAccessorialChargeId];
        if (!row) return;
        const val = parseFloat(row.inputValue ?? '');
        if (!isNaN(val) && val < minimumQuantity) {
            this.setRowField(jobAccessorialChargeId, 'inputValue', String(minimumQuantity));
        }
    };

    private handleAvailableInputBlur = (chargeId: number): void => {
        const { availableCharges, availableInputMap } = this.state;
        const charge = availableCharges.find(c => c.accessorialChargeId === chargeId);
        if (!charge?.minimumQuantity) return;
        const val = parseFloat(availableInputMap[chargeId] ?? '');
        if (!isNaN(val) && val < charge.minimumQuantity) {
            this.setState(prev => ({
                availableInputMap: { ...prev.availableInputMap, [chargeId]: String(charge.minimumQuantity) },
            }));
        }
    };

    private handleAvailableInputChange = (chargeId: number, value: string): void => {
        this.setState(prev => {
            const missingInputIds = new Set(prev.missingInputIds);
            missingInputIds.delete(chargeId);
            return { availableInputMap: { ...prev.availableInputMap, [chargeId]: value }, missingInputIds };
        });
    };

    private handleAddSelected = async (): Promise<void> => {
        const { job, showToast } = this.props;
        const { availableCharges, selectedIds, availableInputMap, availableNotesMap } = this.state;
        if (!job || selectedIds.size === 0) return;

        const selectedCharges = availableCharges.filter(c => selectedIds.has(c.accessorialChargeId));

        const missing = selectedCharges.filter(c => {
            if (c.chargeType === 'flat' || this.isAutoPopulated(c)) return false;
            const raw = availableInputMap[c.accessorialChargeId];
            return raw === undefined || raw === '' || isNaN(parseFloat(raw));
        });
        if (missing.length > 0) {
            this.setState({ missingInputIds: new Set(missing.map(c => c.accessorialChargeId)) });
            return;
        }

        const toAdd: JobAccessorialChargeCreateRequest[] = selectedCharges
            .sort((a, b) => a.calculationOrder - b.calculationOrder)
            .map(c => {
                const raw = availableInputMap[c.accessorialChargeId];
                const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : NaN;
                return {
                    accessorialChargeId: c.accessorialChargeId,
                    inputValue: !isNaN(parsed) ? parsed : undefined,
                    itemCount: 1,
                    notes: availableNotesMap[c.accessorialChargeId] || undefined,
                };
            });

        this.setState({ isAddingCharges: true });
        try {
            await accessorialChargesApi.addCharges(job.id, toAdd);
            this.setState({ selectedIds: new Set(), availableInputMap: {}, availableNotesMap: {}, isAddingCharges: false });
            showToast(`${toAdd.length} charge(s) added.`, 'success');
            const applied = await this.loadAll();
            await this.autoSavePercentageCharges(applied);
        } catch (error: any) {
            showToast(`Error adding charges: ${error.message}`, 'error');
            this.setState({ isAddingCharges: false });
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static calculateAmount(
        charge: {
            chargeType: string;
            baseRate?: number;
            ratePerUnit?: number;
            percentageRate?: number;
            freeAllowance?: number;
            unitTypeName?: string;
            freeAllowanceUnitTypeName?: string;
            minimumQuantity?: number;
            minimumCharge?: number;
            maximumCharge?: number;
        },
        inputValue: number,
        itemCount: number = 1
    ): number {
        let amount = 0;
        switch (charge.chargeType) {
            case 'flat':
                amount = charge.baseRate ?? 0;
                break;
            case 'per_unit':
            case 'hourly': {
                let billable = inputValue;
                if (charge.freeAllowance != null) {
                    let freeAllowance = charge.freeAllowance;
                    const inputUnit = (charge.unitTypeName ?? '').toLowerCase();
                    const freeUnit = (charge.freeAllowanceUnitTypeName ?? '').toLowerCase();
                    if (inputUnit === 'hour' && freeUnit === 'minute') freeAllowance /= 60;
                    else if (inputUnit === 'minute' && freeUnit === 'hour') freeAllowance *= 60;
                    billable = Math.max(0, billable - freeAllowance);
                }
                if (charge.minimumQuantity != null && billable < charge.minimumQuantity) billable = charge.minimumQuantity;
                amount = billable * itemCount * (charge.ratePerUnit ?? 0);
                break;
            }
            case 'percentage':
                amount = inputValue * ((charge.percentageRate ?? 0) / 100);
                break;
            case 'quote_based':
                amount = inputValue;
                break;
        }
        if (charge.minimumCharge != null && amount < charge.minimumCharge) amount = charge.minimumCharge;
        if (charge.maximumCharge != null && amount > charge.maximumCharge) amount = charge.maximumCharge;
        return amount;
    }

    private recalculate(charge: JobAccessorialChargeDto, row: AppliedRowState): number {
        const inputValue = row.inputValue !== '' ? parseFloat(row.inputValue) : 0;
        const itemCount = row.itemCount !== '' ? parseInt(row.itemCount, 10) : 1;
        return AccessorialChargesDialog.calculateAmount(charge, inputValue, itemCount);
    }

    private formatCurrency(amount?: number): string {
        if (amount == null) return '—';
        return `$${amount.toFixed(2)}`;
    }

    private static readonly AUTO_UNIT_TYPES = ['Pounds', 'Kilograms', 'Quantity'];

    private isAutoPopulated(charge: { chargeType: string; unitTypeName?: string }): boolean {
        return AccessorialChargesDialog.AUTO_UNIT_TYPES.includes(charge.unitTypeName ?? '') ||
            charge.chargeType === 'percentage';
    }

    private getPercentageCalculationNote(charge: AccessorialChargeDto): string | null {
        if (charge.chargeType !== 'percentage') return null;
        const { availableCharges } = this.state;
        if (!availableCharges.length) return null;
        const orders = availableCharges.map(c => c.calculationOrder ?? 0);
        const minOrder = Math.min(...orders);
        const maxOrder = Math.max(...orders);
        const currentOrder = charge.calculationOrder ?? 0;
        if (currentOrder === maxOrder && currentOrder !== minOrder) return 'Applied after all other charges';
        if (currentOrder === minOrder && currentOrder !== maxOrder) return 'Applied before all other charges';
        if (currentOrder !== minOrder && currentOrder !== maxOrder) return 'Applied after charges with lower calculation order';
        return null;
    }

    // Strips initial pct charge amounts from ucjbAmount so the base reflects freight + non-pct only.
    // Uses liveJobAmount (fetched from DB at open) rather than the stale AngularJS prop.
    private get initialAdjustedJobAmount(): number {
        const initial = this.initialAppliedCharges ?? [];
        const initialPctTotal = initial
            .filter(c => c.chargeType === 'percentage')
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
        return (this.liveJobAmount ?? 0) - initialPctTotal;
    }

    private computePercentageBase(
        pctCharge: JobAccessorialChargeDto,
        appliedCharges: JobAccessorialChargeDto[]
    ): number {
        const initial = this.initialAppliedCharges ?? [];
        const initialNonPctTotal = initial
            .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
        const currentNonPctTotal = appliedCharges
            .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

        // Use the snapshot inputValue (not the current DB value) as the anchor.
        // Auto-saves update the DB mid-session, so using the current value breaks add/delete symmetry.
        // New charges (not in snapshot) fall back to initialAdjustedJobAmount.
        const initialPctCharge = initial.find(c => c.jobAccessorialChargeId === pctCharge.jobAccessorialChargeId);
        const anchor = initialPctCharge?.inputValue != null
            ? initialPctCharge.inputValue
            : this.initialAdjustedJobAmount;

        return anchor + currentNonPctTotal - initialNonPctTotal;
    }

    private async autoSavePercentageCharges(appliedCharges: JobAccessorialChargeDto[]): Promise<void> {
        const { showToast } = this.props;
        const percentageCharges = appliedCharges.filter(
            c => c.chargeType === 'percentage' && c.overrideAmount == null
        );
        if (percentageCharges.length === 0) return;

        let didSave = false;
        for (const charge of percentageCharges) {
            const newBase = this.computePercentageBase(charge, appliedCharges);
            if (Math.abs(newBase - (charge.inputValue ?? 0)) < 0.01) continue;

            try {
                await accessorialChargesApi.updateCharge(charge.jobAccessorialChargeId, {
                    inputValue: newBase,
                    itemCount: charge.itemCount,
                    notes: charge.notes || undefined,
                    overrideAmount: undefined,
                });
                didSave = true;
            } catch (error: any) {
                showToast(`Error updating percentage charge "${charge.name}": ${error.message}`, 'error');
            }
        }

        if (didSave) {
            await this.loadAppliedCharges();
        }
    }

    private formatChargeType(chargeType: string): string {
        switch (chargeType) {
            case 'flat':        return 'Flat fee';
            case 'per_unit':
            case 'hourly':      return 'Per unit';
            case 'percentage':  return 'Percentage';
            case 'quote_based': return 'Quote based';
            default:            return chargeType;
        }
    }

    private stageColor(stage?: string): 'info' | 'warning' | 'default' {
        switch (stage) {
            case 'booking':  return 'info';
            case 'dispatch': return 'warning';
            default:         return 'default';
        }
    }

    private renderLimits(charge: {
        minimumCharge?: number;
        maximumCharge?: number;
        minimumQuantity?: number;
        freeAllowance?: number;
        freeAllowanceUnitTypeName?: string;
        unitTypeName?: string;
    }): React.ReactNode {
        const lines: string[] = [];
        if (charge.freeAllowance != null) {
            const unit = charge.freeAllowanceUnitTypeName ?? charge.unitTypeName ?? '';
            lines.push(`${charge.freeAllowance}${unit ? ` ${unit.toLowerCase()}` : ''} included`);
        }
        if (charge.minimumCharge != null) lines.push(`Min charge: ${this.formatCurrency(charge.minimumCharge)}`);
        if (charge.maximumCharge != null) lines.push(`Max charge: ${this.formatCurrency(charge.maximumCharge)}`);
        if (charge.minimumQuantity != null) lines.push(`Min qty: ${charge.minimumQuantity}`);
        if (lines.length === 0) return null;
        return (
            <>
                {lines.map((line, i) => (
                    <Typography key={i} variant="caption" color="text.secondary" display="block">
                        {line}
                    </Typography>
                ))}
            </>
        );
    }

    private get selectedTotal(): number {
        const { availableCharges, selectedIds } = this.state;
        return availableCharges
            .filter(c => selectedIds.has(c.accessorialChargeId))
            .reduce((sum, c) => {
                if (c.chargeType === 'flat') return sum + (c.baseRate ?? 0);
                return sum;
            }, 0);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    render(): React.ReactNode {
        const { open, onClose } = this.props;
        const {
            appliedCharges,
            appliedRowState,
            availableCharges,
            selectedIds,
            availableInputMap,
            availableNotesMap,
            missingInputIds,
            isLoadingAvailable,
            isLoadingApplied,
            isAddingCharges,
        } = this.state;

        const isLoading = isLoadingAvailable || isLoadingApplied;

        return (
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    elevation: 24,
                    sx: { borderRadius: 2, overflow: 'hidden', minWidth: 700 },
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
                        <ReceiptIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={600}>
                            Accessorial Charges
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={this.handleRefresh}
                        disabled={isLoading || isAddingCharges}
                        sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                        title="Refresh"
                    >
                        <RefreshIcon />
                    </IconButton>
                    <IconButton
                        onClick={onClose}
                        sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                        title="Close"
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress size={40} />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Section 1 — Applied Charges */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                                    Applied Charges
                                </Typography>
                                <TableContainer component={Paper} elevation={1}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                                                <TableCell><Typography fontWeight={600}>Service</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Stage</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Input / Units</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={600}>Amount</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Notes</Typography></TableCell>
                                                <TableCell align="center"><Typography fontWeight={600}>Actions</Typography></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {appliedCharges.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        <Box
                                                            sx={{
                                                                bgcolor: 'grey.100',
                                                                borderRadius: 1,
                                                                p: 2,
                                                                textAlign: 'center',
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                fontStyle="italic"
                                                            >
                                                                No charges have been applied to this job.
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                [...appliedCharges].sort((a, b) => a.name.localeCompare(b.name)).map(charge => {
                                                    const row = appliedRowState[charge.jobAccessorialChargeId];
                                                    if (!row) return null;
                                                    const needsInput = charge.chargeType !== 'flat';
                                                    return (
                                                        <TableRow
                                                            key={charge.jobAccessorialChargeId}
                                                            sx={{
                                                                bgcolor: row.isDirty
                                                                    ? 'rgba(255, 244, 229, 0.8)'
                                                                    : 'inherit',
                                                            }}
                                                        >
                                                            <TableCell>
                                                                <Typography variant="body2">{charge.name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {this.formatChargeType(charge.chargeType)}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>
                                                                {charge.addedAtStage ? (
                                                                    <Chip
                                                                        label={charge.addedAtStage.replace('_', ' ').toUpperCase()}
                                                                        size="small"
                                                                        color={this.stageColor(charge.addedAtStage)}
                                                                        sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}
                                                                    />
                                                                ) : '—'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {needsInput ? (
                                                                    <Box>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            <TextField
                                                                                size="small"
                                                                                type="number"
                                                                                value={row.inputValue}
                                                                                onChange={e =>
                                                                                    this.setRowField(
                                                                                        charge.jobAccessorialChargeId,
                                                                                        'inputValue',
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onBlur={() => this.handleAppliedInputBlur(charge.jobAccessorialChargeId, charge.minimumQuantity)}
                                                                                sx={{ width: 90 }}
                                                                                disabled={row.isSaving || row.isDeleting || this.isAutoPopulated(charge)}
                                                                                inputProps={charge.minimumQuantity != null ? { min: charge.minimumQuantity } : undefined}
                                                                            />
                                                                            {charge.unitTypeName && (
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                    {this.isAutoPopulated(charge) && (
                                                                                        <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                                                    )}
                                                                                    <Typography variant="body2" color="text.secondary">
                                                                                        {charge.unitTypeName}
                                                                                    </Typography>
                                                                                </Box>
                                                                            )}
                                                                            {(charge.chargeType === 'hourly' || charge.chargeType === 'per_unit') && charge.ratePerUnit != null && (
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    × {this.formatCurrency(charge.ratePerUnit)}
                                                                                </Typography>
                                                                            )}
                                                                            {charge.chargeType === 'percentage' && charge.percentageRate != null && (
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    × {charge.percentageRate}%
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                        {this.renderLimits(charge)}
                                                                    </Box>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Flat fee
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                                    {this.formatCurrency(
                                                                        row.overrideAmount !== ''
                                                                            ? parseFloat(row.overrideAmount)
                                                                            : row.isDirty
                                                                            ? this.recalculate(charge, row)
                                                                            : (charge.overrideAmount ?? charge.calculatedAmount ?? undefined)
                                                                    )}
                                                                </Typography>
                                                                <TextField
                                                                    size="small"
                                                                    label="Override"
                                                                    type="number"
                                                                    value={row.overrideAmount}
                                                                    onChange={e => this.setRowField(charge.jobAccessorialChargeId, 'overrideAmount', e.target.value)}
                                                                    sx={{ width: 110 }}
                                                                    disabled={row.isSaving || row.isDeleting}
                                                                    placeholder="Optional"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <TextField
                                                                    size="small"
                                                                    placeholder="Notes"
                                                                    value={row.notes}
                                                                    onChange={e =>
                                                                        this.setRowField(
                                                                            charge.jobAccessorialChargeId,
                                                                            'notes',
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    sx={{ minWidth: 140 }}
                                                                    disabled={row.isSaving || row.isDeleting}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                                    {row.isDirty && (
                                                                        <IconButton
                                                                            size="small"
                                                                            color="success"
                                                                            onClick={() => this.handleSaveRow(charge)}
                                                                            disabled={row.isSaving || row.isDeleting}
                                                                            title="Save"
                                                                        >
                                                                            {row.isSaving ? (
                                                                                <CircularProgress size={16} />
                                                                            ) : (
                                                                                <SaveIcon fontSize="small" />
                                                                            )}
                                                                        </IconButton>
                                                                    )}
                                                                    <IconButton
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={() => this.handleDeleteRow(charge)}
                                                                        disabled={row.isSaving || row.isDeleting}
                                                                        title="Remove"
                                                                    >
                                                                        {row.isDeleting ? (
                                                                            <CircularProgress size={16} />
                                                                        ) : (
                                                                            <DeleteIcon fontSize="small" />
                                                                        )}
                                                                    </IconButton>
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                        {appliedCharges.length > 0 && (
                                            <TableFooter>
                                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                    <TableCell colSpan={4} />
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">Total</Typography>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {this.formatCurrency(
                                                                appliedCharges.reduce((sum, c) =>
                                                                    sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0)
                                                            )}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell colSpan={2} />
                                                </TableRow>
                                            </TableFooter>
                                        )}
                                    </Table>
                                </TableContainer>
                            </Box>

                            <Divider />

                            {/* Section 2 — Add Charges */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                                    Add Charges
                                </Typography>
                                <TableContainer component={Paper} elevation={1}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                                                <TableCell padding="checkbox" />
                                                <TableCell><Typography fontWeight={600}>Service</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Description</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Calculation</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={600}>Amount</Typography></TableCell>
                                                <TableCell><Typography fontWeight={600}>Notes</Typography></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {availableCharges.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6}>
                                                        <Box
                                                            sx={{
                                                                bgcolor: 'grey.100',
                                                                borderRadius: 1,
                                                                p: 2,
                                                                textAlign: 'center',
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                fontStyle="italic"
                                                            >
                                                                No charges available for this group.
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>

                                            ) : (
                                                [...availableCharges].filter(c => !c.alreadyApplied).sort((a, b) => a.name.localeCompare(b.name)).map(charge => {
                                                    const isSelected = selectedIds.has(charge.accessorialChargeId);
                                                    return (
                                                        <TableRow
                                                            key={charge.accessorialChargeId}
                                                            hover
                                                            onClick={() => this.handleToggleAvailable(charge.accessorialChargeId)}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                bgcolor: isSelected ? 'rgba(76, 175, 80, 0.08)' : 'inherit',
                                                            }}
                                                        >
                                                            <TableCell padding="checkbox">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    disabled={isAddingCharges}
                                                                    onChange={() =>
                                                                        this.handleToggleAvailable(charge.accessorialChargeId)
                                                                    }
                                                                    onClick={e => e.stopPropagation()}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                                                                    {charge.name}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {charge.description}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell onClick={e => e.stopPropagation()}>
                                                                {charge.chargeType === 'flat' ? (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Flat fee
                                                                    </Typography>
                                                                ) : (
                                                                    <Box>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            <TextField
                                                                                size="small"
                                                                                type="number"
                                                                                value={availableInputMap[charge.accessorialChargeId] ?? ''}
                                                                                onChange={e => this.handleAvailableInputChange(charge.accessorialChargeId, e.target.value)}
                                                                                onBlur={() => this.handleAvailableInputBlur(charge.accessorialChargeId)}
                                                                                sx={{ width: 90 }}
                                                                                disabled={!isSelected || isAddingCharges || this.isAutoPopulated(charge)}
                                                                                inputProps={charge.minimumQuantity != null ? { min: charge.minimumQuantity } : undefined}
                                                                                error={isSelected && missingInputIds.has(charge.accessorialChargeId)}
                                                                                helperText={isSelected && missingInputIds.has(charge.accessorialChargeId) ? 'Required' : undefined}
                                                                            />
                                                                            {charge.unitTypeName && (
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                    {this.isAutoPopulated(charge) && (
                                                                                        <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                                                    )}
                                                                                    <Typography variant="body2" color="text.secondary">
                                                                                        {charge.unitTypeName}
                                                                                    </Typography>
                                                                                </Box>
                                                                            )}
                                                                            {(charge.chargeType === 'hourly' || charge.chargeType === 'per_unit') && charge.ratePerUnit != null && (
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    × {this.formatCurrency(charge.ratePerUnit)}
                                                                                </Typography>
                                                                            )}
                                                                            {charge.chargeType === 'percentage' && charge.percentageRate != null && (
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    × {charge.percentageRate}%
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                        {this.renderLimits(charge)}
                                                                        {(() => {
                                                                            const note = this.getPercentageCalculationNote(charge);
                                                                            return note ? (
                                                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                                                                    {note}
                                                                                </Typography>
                                                                            ) : null;
                                                                        })()}
                                                                    </Box>
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                {(() => {
                                                                    const raw = availableInputMap[charge.accessorialChargeId];
                                                                    const inputVal = raw !== undefined && raw !== '' ? parseFloat(raw) : NaN;
                                                                    if (charge.chargeType === 'flat') return this.formatCurrency(charge.baseRate);
                                                                    if (isNaN(inputVal)) return '—';
                                                                    return this.formatCurrency(
                                                                        AccessorialChargesDialog.calculateAmount(charge, inputVal)
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell onClick={e => e.stopPropagation()}>
                                                                <TextField
                                                                    size="small"
                                                                    placeholder="Notes"
                                                                    value={availableNotesMap[charge.accessorialChargeId] ?? ''}
                                                                    onChange={e =>
                                                                        this.handleAvailableNoteChange(
                                                                            charge.accessorialChargeId,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    sx={{ minWidth: 120 }}
                                                                    disabled={!isSelected || isAddingCharges}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
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
                        <Button onClick={onClose} variant="outlined">
                            Close
                        </Button>
                        {selectedIds.size > 0 && (
                            <Button
                                onClick={this.handleAddSelected}
                                variant="contained"
                                color="primary"
                                disabled={isAddingCharges}
                                startIcon={isAddingCharges ? <CircularProgress size={16} color="inherit" /> : null}
                            >
                                {isAddingCharges
                                    ? 'Adding...'
                                    : `Add Selected Charges${this.selectedTotal > 0 ? ` (${this.formatCurrency(this.selectedTotal)})` : ''}`}
                            </Button>
                        )}
                    </DialogActions>
                )}
            </Dialog>
        );
    }
}

export default AccessorialChargesDialog;
