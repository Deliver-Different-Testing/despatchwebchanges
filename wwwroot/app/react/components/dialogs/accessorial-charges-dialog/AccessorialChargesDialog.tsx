/**
 * Accessorial Charges Dialog
 *
 * Two-section layout:
 *  1. Applied Charges — table of charges already on the job, editable + deletable
 *  2. Add Charges     — table of available charges with checkboxes; bulk-add button
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formatCurrencyOrDash as formatCurrency} from '../../../utils/currencyUtils';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import ReceiptIcon from '@mui/icons-material/Receipt';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import {
    AccessorialChargeDto,
    AccessorialChargesDialogProps,
    JobAccessorialChargeCreateRequest,
    JobAccessorialChargeDto,
    JobAccessorialChargeUpdateRequest,
    PortionJobInfo,
} from './types';
import {accessorialChargesApi} from '../../../services/accessorialChargesApi';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../shared/styles';
import {AiDraftButton} from '../../common/ai-draft-button/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {analyzePricing, PricingAnalysisResponse} from '../../../services/aiAssistantApi';

interface AppliedRowState {
    inputValue: string;
    itemCount: string;
    notes: string;
    overrideAmount: string;
    isDirty: boolean;
    isSaving: boolean;
    isDeleting: boolean;
}

const AUTO_UNIT_TYPES = ['Pounds', 'Kilograms', 'Quantity'];

function calculateAmount(
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


function formatChargeType(chargeType: string): string {
    switch (chargeType) {
        case 'flat':        return 'Flat fee';
        case 'per_unit':
        case 'hourly':      return 'Per unit';
        case 'percentage':  return 'Percentage';
        case 'quote_based': return 'Quote based';
        default:            return chargeType;
    }
}

function stageColor(stage?: string): 'info' | 'warning' | 'default' {
    switch (stage) {
        case 'booking':  return 'info';
        case 'dispatch': return 'warning';
        default:         return 'default';
    }
}

function isAutoPopulated(charge: { chargeType: string; unitTypeName?: string }): boolean {
    return AUTO_UNIT_TYPES.includes(charge.unitTypeName ?? '') ||
        charge.chargeType === 'percentage';
}

function renderLimits(charge: {
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
    if (charge.minimumCharge != null) lines.push(`Min charge: ${formatCurrency(charge.minimumCharge)}`);
    if (charge.maximumCharge != null) lines.push(`Max charge: ${formatCurrency(charge.maximumCharge)}`);
    if (charge.minimumQuantity != null) lines.push(`Min qty: ${charge.minimumQuantity}`);
    if (lines.length === 0) return null;
    return (
        <>
            {lines.map((line, i) => (
                <Typography
                    key={i}
                    variant="caption"
                    sx={{
                        color: "text.secondary",
                        display: "block"
                    }}>
                    {line}
                </Typography>
            ))}
        </>
    );
}

export const AccessorialChargesDialog: React.FC<AccessorialChargesDialogProps> = ({
    open,
    onClose,
    job,
    showToast,
}) => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [availableCharges, setAvailableCharges] = useState<AccessorialChargeDto[]>([]);
    const [appliedCharges, setAppliedCharges] = useState<JobAccessorialChargeDto[]>([]);
    const [appliedRowState, setAppliedRowState] = useState<Record<number, AppliedRowState>>({});
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [availableInputMap, setAvailableInputMap] = useState<Record<number, string>>({});
    const [availableNotesMap, setAvailableNotesMap] = useState<Record<number, string>>({});
    const [missingInputIds, setMissingInputIds] = useState<Set<number>>(new Set());
    const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
    const [isLoadingApplied, setIsLoadingApplied] = useState(false);
    const [isAddingCharges, setIsAddingCharges] = useState(false);
    const [activePortionJobId, setActivePortionJobId] = useState<number | null>(null);

    // Auto-Mate pricing analysis (anomaly + suggested charges).
    const {runDraft: runSuggest, isDrafting: isSuggesting} = useAiDraft();
    const [pricingResult, setPricingResult] = useState<PricingAnalysisResponse | null>(null);

    // ── Refs (instance fields) ────────────────────────────────────────────────

    // Snapshot of applied charges at dialog-open time. Used to compute the delta
    // between the initial state and the current state for percentage base calculations,
    // since job.amount is a stale prop that doesn't update mid-session.
    const initialAppliedChargesRef = useRef<JobAccessorialChargeDto[] | null>(null);

    // Live ucjbAmount fetched from the DB at dialog-open time. More reliable than
    // props.job?.amount, which comes from the AngularJS scope and may not be
    // refreshed after the user deletes/updates charges and re-opens the dialog.
    const liveJobAmountRef = useRef<number | null>(null);

    // We need refs for state that is accessed inside async functions to avoid stale closures.
    const availableChargesRef = useRef(availableCharges);
    availableChargesRef.current = availableCharges;
    const appliedChargesRef = useRef(appliedCharges);
    appliedChargesRef.current = appliedCharges;
    const appliedRowStateRef = useRef(appliedRowState);
    appliedRowStateRef.current = appliedRowState;
    const availableInputMapRef = useRef(availableInputMap);
    availableInputMapRef.current = availableInputMap;
    const availableNotesMapRef = useRef(availableNotesMap);
    availableNotesMapRef.current = availableNotesMap;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const activePortionJobIdRef = useRef(activePortionJobId);
    activePortionJobIdRef.current = activePortionJobId;

    // Keep stable refs for props used in async callbacks
    const jobRef = useRef(job);
    jobRef.current = job;
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getActiveJobId = useCallback((): number => {
        const currentJob = jobRef.current;
        const currentActivePortionJobId = activePortionJobIdRef.current;
        return currentActivePortionJobId ?? currentJob?.id ?? 0;
    }, []);

    const getActiveGroupId = useCallback((): number => {
        const currentJob = jobRef.current;
        const currentActivePortionJobId = activePortionJobIdRef.current;
        if (currentActivePortionJobId && currentJob?.portionJobs) {
            const portion = currentJob.portionJobs.find((p: PortionJobInfo) => p.jobId === currentActivePortionJobId);
            if (portion?.accessorialChargeGroupId) return portion.accessorialChargeGroupId;
        }
        return currentJob?.accessorialChargeGroupId ?? 0;
    }, []);

    const recalculate = useCallback((charge: JobAccessorialChargeDto, row: AppliedRowState): number => {
        const inputValue = row.inputValue !== '' ? parseFloat(row.inputValue) : 0;
        const itemCount = row.itemCount !== '' ? parseInt(row.itemCount, 10) : 1;
        return calculateAmount(charge, inputValue, itemCount);
    }, []);

    const getPercentageCalculationNote = useCallback((charge: AccessorialChargeDto): string | null => {
        if (charge.chargeType !== 'percentage') return null;
        const currentAvailable = availableChargesRef.current;
        if (!currentAvailable.length) return null;
        const orders = currentAvailable.map(c => c.calculationOrder ?? 0);
        const minOrder = Math.min(...orders);
        const maxOrder = Math.max(...orders);
        const currentOrder = charge.calculationOrder ?? 0;
        if (currentOrder === maxOrder && currentOrder !== minOrder) return 'Applied after all other charges';
        if (currentOrder === minOrder && currentOrder !== maxOrder) return 'Applied before all other charges';
        if (currentOrder !== minOrder && currentOrder !== maxOrder) return 'Applied after charges with lower calculation order';
        return null;
    }, []);

    // Strips initial pct charge amounts from ucjbAmount so the base reflects freight + non-pct only.
    // Uses liveJobAmount (fetched from DB at open) rather than the stale AngularJS prop.
    const getInitialAdjustedJobAmount = useCallback((): number => {
        const initial = initialAppliedChargesRef.current ?? [];
        const initialPctTotal = initial
            .filter(c => c.chargeType === 'percentage')
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
        return (liveJobAmountRef.current ?? 0) - initialPctTotal;
    }, []);

    const computePercentageBase = useCallback((
        pctCharge: JobAccessorialChargeDto,
        currentAppliedCharges: JobAccessorialChargeDto[]
    ): number => {
        const initial = initialAppliedChargesRef.current ?? [];
        const initialNonPctTotal = initial
            .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
        const currentNonPctTotal = currentAppliedCharges
            .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
            .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

        // Use the snapshot inputValue (not the current DB value) as the anchor.
        // Auto-saves update the DB mid-session, so using the current value breaks add/delete symmetry.
        // New charges (not in snapshot) fall back to initialAdjustedJobAmount.
        const initialPctCharge = initial.find(c => c.jobAccessorialChargeId === pctCharge.jobAccessorialChargeId);
        const anchor = initialPctCharge?.inputValue != null
            ? initialPctCharge.inputValue
            : getInitialAdjustedJobAmount();

        return anchor + currentNonPctTotal - initialNonPctTotal;
    }, [getInitialAdjustedJobAmount]);

    // ── Data loading ──────────────────────────────────────────────────────────

    const loadAppliedCharges = useCallback(async (): Promise<JobAccessorialChargeDto[] | null> => {
        const activeJobId = getActiveJobId();
        if (!activeJobId) return null;

        setIsLoadingApplied(true);
        try {
            const charges = await accessorialChargesApi.getAppliedCharges(activeJobId);
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
            if (initialAppliedChargesRef.current === null) {
                initialAppliedChargesRef.current = charges;
            }
            setAppliedCharges(charges);
            setAppliedRowState(rowState);
            setIsLoadingApplied(false);
            return charges;
        } catch (error: unknown) {
            showToastRef.current(`Error loading applied charges: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setIsLoadingApplied(false);
            return null;
        }
    }, [getActiveJobId]);

    const loadAvailableCharges = useCallback(async (): Promise<AccessorialChargeDto[] | null> => {
        const currentJob = jobRef.current;
        const activeJobId = getActiveJobId();
        const activeGroupId = getActiveGroupId();
        if (!activeJobId || !activeGroupId) return null;

        setIsLoadingAvailable(true);
        try {
            const charges = await accessorialChargesApi.getAvailableCharges(
                activeGroupId,
                activeJobId
            );
            const autoInputMap: Record<number, string> = {};
            for (const c of charges) {
                if (c.minimumQuantity != null) {
                    autoInputMap[c.accessorialChargeId] = String(c.minimumQuantity);
                }
                if (c.unitTypeName === 'Pounds' || c.unitTypeName === 'Kilograms') {
                    if (currentJob?.weight != null) autoInputMap[c.accessorialChargeId] = String(currentJob.weight);
                } else if (c.unitTypeName === 'Quantity') {
                    if (currentJob?.quantity != null) autoInputMap[c.accessorialChargeId] = String(currentJob.quantity);
                }
            }
            setAvailableCharges(charges);
            setAvailableInputMap(prev => ({ ...autoInputMap, ...prev }));
            setIsLoadingAvailable(false);
            return charges;
        } catch (error: unknown) {
            showToastRef.current(`Error loading available charges: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setIsLoadingAvailable(false);
            return null;
        }
    }, [getActiveJobId, getActiveGroupId]);

    const computePercentageInputs = useCallback((
        currentAvailableCharges: AccessorialChargeDto[],
        currentAppliedCharges: JobAccessorialChargeDto[]
    ): void => {
        const initial = initialAppliedChargesRef.current ?? [];

        const inputMap: Record<number, string> = {};
        for (const charge of currentAvailableCharges) {
            if (charge.chargeType !== 'percentage') continue;

            const initialNonPctTotal = initial
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < charge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);
            const currentNonPctTotal = currentAppliedCharges
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < charge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

            inputMap[charge.accessorialChargeId] = String(getInitialAdjustedJobAmount() + currentNonPctTotal - initialNonPctTotal);
        }

        if (Object.keys(inputMap).length === 0) return;
        setAvailableInputMap(prev => ({ ...prev, ...inputMap }));
    }, [getInitialAdjustedJobAmount]);

    const loadAll = useCallback(async (): Promise<JobAccessorialChargeDto[]> => {
        const activeJobId = getActiveJobId();
        const [available, applied, liveAmount] = await Promise.all([
            loadAvailableCharges(),
            loadAppliedCharges(),
            activeJobId ? accessorialChargesApi.getJobAmount(activeJobId).catch(() => null) : Promise.resolve(null),
        ]);
        // Only set once per session (same principle as initialAppliedCharges).
        // Mid-session adds/delete update ucjbAmount via triggers, but the delta-based
        // calculation in initialAdjustedJobAmount relies on the value being stable.
        if (liveJobAmountRef.current === null && liveAmount !== null) liveJobAmountRef.current = liveAmount;
        computePercentageInputs(available ?? [], applied ?? []);
        return applied ?? [];
    }, [getActiveJobId, loadAvailableCharges, loadAppliedCharges, computePercentageInputs]);

    const autoSavePercentageCharges = useCallback(async (currentAppliedCharges: JobAccessorialChargeDto[]): Promise<void> => {
        const percentageCharges = currentAppliedCharges.filter(
            c => c.chargeType === 'percentage' && c.overrideAmount == null
        );
        if (percentageCharges.length === 0) return;

        let didSave = false;
        for (const charge of percentageCharges) {
            const newBase = computePercentageBase(charge, currentAppliedCharges);
            if (Math.abs(newBase - (charge.inputValue ?? 0)) < 0.01) continue;

            try {
                await accessorialChargesApi.updateCharge(charge.jobAccessorialChargeId, {
                    inputValue: newBase,
                    itemCount: charge.itemCount,
                    notes: charge.notes || undefined,
                    overrideAmount: undefined,
                });
                didSave = true;
            } catch (error: unknown) {
                showToastRef.current(`Error updating percentage charge "${charge.name}": ${error instanceof Error ? error.message : String(error)}`, 'error');
            }
        }

        if (didSave) {
            await loadAppliedCharges();
        }
    }, [computePercentageBase, loadAppliedCharges]);

    // ── Reset helper ──────────────────────────────────────────────────────────

    const resetAndLoad = useCallback((portionJobId: number | null) => {
        initialAppliedChargesRef.current = null;
        liveJobAmountRef.current = null;
        setAvailableCharges([]);
        setAppliedCharges([]);
        setAppliedRowState({});
        setSelectedIds(new Set());
        setAvailableInputMap({});
        setAvailableNotesMap({});
        setMissingInputIds(new Set());
        setIsLoadingAvailable(false);
        setIsLoadingApplied(false);
        setIsAddingCharges(false);
        setActivePortionJobId(portionJobId);
    }, []);

    // We need a ref to loadAll so the effect can call it after state resets
    const loadAllRef = useRef(loadAll);
    loadAllRef.current = loadAll;

    // Track whether we need to trigger a load after resetting
    const pendingLoadRef = useRef(false);

    // ── Effects ───────────────────────────────────────────────────────────────

    // Dialog open effect
    const prevOpenRef = useRef(open);
    useEffect(() => {
        const justOpened = open && !prevOpenRef.current;
        prevOpenRef.current = open;

        if (justOpened || (open && prevOpenRef.current)) {
            if (justOpened) {
                const firstPortionJobId = job?.portionJobs?.[0]?.jobId ?? null;
                resetAndLoad(firstPortionJobId);
                pendingLoadRef.current = true;
            }
        }
    }, [open, job, resetAndLoad]);

    // ComponentDidMount equivalent: if open on first render
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            if (open) {
                const firstPortionJobId = job?.portionJobs?.[0]?.jobId ?? null;
                resetAndLoad(firstPortionJobId);
                pendingLoadRef.current = true;
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Execute pending load after state resets settle
    useEffect(() => {
        if (pendingLoadRef.current) {
            pendingLoadRef.current = false;
            void loadAllRef.current();
        }
    }, [activePortionJobId]);

    // Recompute percentage inputs when applied row state changes and has dirty rows
    const recomputePercentageInputsFromState = useCallback((): void => {
        const currentAvailable = availableChargesRef.current;
        const currentApplied = appliedChargesRef.current;
        const currentRowState = appliedRowStateRef.current;
        const initial = initialAppliedChargesRef.current ?? [];

        const inputMap: Record<number, string> = {};
        for (const pctCharge of currentAvailable) {
            if (pctCharge.chargeType !== 'percentage') continue;

            const initialNonPctTotal = initial
                .filter(c => c.chargeType !== 'percentage' && c.calculationOrder < pctCharge.calculationOrder)
                .reduce((sum, c) => sum + (c.overrideAmount ?? c.calculatedAmount ?? 0), 0);

            let currentNonPctTotal = 0;
            let dirtyAdjustment = 0;
            for (const applied of currentApplied) {
                if (applied.chargeType === 'percentage') continue;
                if (applied.calculationOrder >= pctCharge.calculationOrder) continue;

                currentNonPctTotal += applied.overrideAmount ?? applied.calculatedAmount ?? 0;

                const row = currentRowState[applied.jobAccessorialChargeId];
                if (!row?.isDirty) continue;

                const savedAmount = applied.overrideAmount ?? applied.calculatedAmount ?? 0;
                const dirtyAmount = row.overrideAmount !== '' && !isNaN(parseFloat(row.overrideAmount))
                    ? parseFloat(row.overrideAmount)
                    : recalculate(applied, row);
                dirtyAdjustment += dirtyAmount - savedAmount;
            }

            inputMap[pctCharge.accessorialChargeId] = String(getInitialAdjustedJobAmount() + currentNonPctTotal - initialNonPctTotal + dirtyAdjustment);
        }

        if (Object.keys(inputMap).length === 0) return;
        setAvailableInputMap(prev => ({ ...prev, ...inputMap }));
    }, [recalculate, getInitialAdjustedJobAmount]);

    // Watch appliedRowState for dirty rows and recompute percentage inputs
    useEffect(() => {
        const hasDirtyRows = Object.values(appliedRowState).some(r => r.isDirty);
        if (hasDirtyRows) {
            recomputePercentageInputsFromState();
        }
    }, [appliedRowState, recomputePercentageInputsFromState]);

    // ── Event handlers ────────────────────────────────────────────────────────

    const handlePortionTabClick = useCallback((jobId: number): void => {
        if (jobId === activePortionJobIdRef.current) return;
        initialAppliedChargesRef.current = null;
        liveJobAmountRef.current = null;
        setAvailableCharges([]);
        setAppliedCharges([]);
        setAppliedRowState({});
        setSelectedIds(new Set());
        setAvailableInputMap({});
        setAvailableNotesMap({});
        setMissingInputIds(new Set());
        setIsLoadingAvailable(false);
        setIsLoadingApplied(false);
        setIsAddingCharges(false);
        setActivePortionJobId(jobId);
        pendingLoadRef.current = true;
    }, []);

    const handleRefresh = useCallback((): void => {
        resetAndLoad(activePortionJobIdRef.current);
        pendingLoadRef.current = true;
    }, [resetAndLoad]);

    // Ask Auto-Mate for a re-rate anomaly + suggested charges, then pre-select the
    // suggested charges in the Add table so the operator reviews and confirms via
    // the existing "Add Selected Charges" flow (nothing is applied automatically).
    const handleSuggestCharges = useCallback(async (): Promise<void> => {
        const activeJobId = getActiveJobId();
        const activeGroupId = getActiveGroupId();
        if (!activeJobId || !activeGroupId) return;

        const result = await runSuggest((signal) => analyzePricing(activeJobId, activeGroupId, {signal}));
        if (!result) return;
        setPricingResult(result);

        const available = availableChargesRef.current;
        const applyIds = new Set<number>();
        const inputs: Record<number, string> = {};
        for (const s of result.suggestions) {
            const charge = available.find(c => c.accessorialChargeId === s.accessorialChargeId && !c.alreadyApplied);
            if (!charge) continue;
            applyIds.add(s.accessorialChargeId);
            if (s.suggestedInputValue != null) inputs[s.accessorialChargeId] = String(s.suggestedInputValue);
        }
        if (applyIds.size > 0) {
            setSelectedIds(prev => new Set([...prev, ...applyIds]));
            setAvailableInputMap(prev => ({...prev, ...inputs}));
        }
    }, [getActiveJobId, getActiveGroupId, runSuggest]);

    // ── Applied row handlers ──────────────────────────────────────────────────

    const setRowField = useCallback((id: number, field: keyof AppliedRowState, value: AppliedRowState[keyof AppliedRowState]): void => {
        setAppliedRowState(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value,
                isDirty: true,
            },
        }));
    }, []);

    const handleSaveRow = useCallback(async (charge: JobAccessorialChargeDto): Promise<void> => {
        const row = appliedRowStateRef.current[charge.jobAccessorialChargeId];
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

        setAppliedRowState(prev => ({
            ...prev,
            [charge.jobAccessorialChargeId]: { ...prev[charge.jobAccessorialChargeId], isSaving: true },
        }));

        try {
            const updated = await accessorialChargesApi.updateCharge(charge.jobAccessorialChargeId, request);
            setAppliedCharges(prev =>
                prev.map(c =>
                    c.jobAccessorialChargeId === charge.jobAccessorialChargeId ? updated : c
                )
            );
            setAppliedRowState(prev => ({
                ...prev,
                [charge.jobAccessorialChargeId]: {
                    inputValue: updated.inputValue != null ? String(updated.inputValue) : '',
                    itemCount: String(updated.itemCount ?? 1),
                    notes: updated.notes ?? '',
                    overrideAmount: updated.overrideAmount != null ? String(updated.overrideAmount) : '',
                    isDirty: false,
                    isSaving: false,
                    isDeleting: false,
                },
            }));
            showToastRef.current(`Charge "${charge.name}" updated.`, 'success');
            const applied = await loadAllRef.current();
            if (charge.chargeType !== 'percentage') await autoSavePercentageCharges(applied);
        } catch (error: unknown) {
            showToastRef.current(`Error saving charge: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setAppliedRowState(prev => ({
                ...prev,
                [charge.jobAccessorialChargeId]: { ...prev[charge.jobAccessorialChargeId], isSaving: false },
            }));
        }
    }, [autoSavePercentageCharges]);

    const handleDeleteRow = useCallback(async (charge: JobAccessorialChargeDto): Promise<void> => {
        setAppliedRowState(prev => ({
            ...prev,
            [charge.jobAccessorialChargeId]: { ...prev[charge.jobAccessorialChargeId], isDeleting: true },
        }));

        try {
            await accessorialChargesApi.deleteCharge(charge.jobAccessorialChargeId);
            setAppliedCharges(prev =>
                prev.filter(c => c.jobAccessorialChargeId !== charge.jobAccessorialChargeId)
            );
            setAppliedRowState(prev => {
                const updated = { ...prev };
                delete updated[charge.jobAccessorialChargeId];
                return updated;
            });
            showToastRef.current(`Charge "${charge.name}" removed.`, 'success');
            const applied = await loadAllRef.current();
            await autoSavePercentageCharges(applied);
        } catch (error: unknown) {
            showToastRef.current(`Error deleting charge: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setAppliedRowState(prev => ({
                ...prev,
                [charge.jobAccessorialChargeId]: { ...prev[charge.jobAccessorialChargeId], isDeleting: false },
            }));
        }
    }, [autoSavePercentageCharges]);

    // ── Add charges handlers ──────────────────────────────────────────────────

    const handleToggleAvailable = useCallback((chargeId: number): void => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(chargeId)) next.delete(chargeId);
            else next.add(chargeId);
            return next;
        });
    }, []);

    const handleAvailableNoteChange = useCallback((chargeId: number, value: string): void => {
        setAvailableNotesMap(prev => ({ ...prev, [chargeId]: value }));
    }, []);

    const handleAppliedInputBlur = useCallback((jobAccessorialChargeId: number, minimumQuantity: number | undefined): void => {
        if (!minimumQuantity) return;
        const row = appliedRowStateRef.current[jobAccessorialChargeId];
        if (!row) return;
        const val = parseFloat(row.inputValue ?? '');
        if (!isNaN(val) && val < minimumQuantity) {
            setRowField(jobAccessorialChargeId, 'inputValue', String(minimumQuantity));
        }
    }, [setRowField]);

    const handleAvailableInputBlur = useCallback((chargeId: number): void => {
        const currentAvailable = availableChargesRef.current;
        const currentInputMap = availableInputMapRef.current;
        const charge = currentAvailable.find(c => c.accessorialChargeId === chargeId);
        if (!charge?.minimumQuantity) return;
        const val = parseFloat(currentInputMap[chargeId] ?? '');
        if (!isNaN(val) && val < charge.minimumQuantity) {
            setAvailableInputMap(prev => ({ ...prev, [chargeId]: String(charge.minimumQuantity) }));
        }
    }, []);

    const handleAvailableInputChange = useCallback((chargeId: number, value: string): void => {
        setMissingInputIds(prev => {
            const next = new Set(prev);
            next.delete(chargeId);
            return next;
        });
        setAvailableInputMap(prev => ({ ...prev, [chargeId]: value }));
    }, []);

    const handleAddSelected = useCallback(async (): Promise<void> => {
        const currentAvailable = availableChargesRef.current;
        const currentSelectedIds = selectedIdsRef.current;
        const currentInputMap = availableInputMapRef.current;
        const currentNotesMap = availableNotesMapRef.current;
        const activeJobId = getActiveJobId();
        if (!activeJobId || currentSelectedIds.size === 0) return;

        const selectedCharges = currentAvailable.filter(c => currentSelectedIds.has(c.accessorialChargeId));

        const missing = selectedCharges.filter(c => {
            if (c.chargeType === 'flat' || isAutoPopulated(c)) return false;
            const raw = currentInputMap[c.accessorialChargeId];
            return raw === undefined || raw === '' || isNaN(parseFloat(raw));
        });
        if (missing.length > 0) {
            setMissingInputIds(new Set(missing.map(c => c.accessorialChargeId)));
            return;
        }

        const toAdd: JobAccessorialChargeCreateRequest[] = selectedCharges
            .sort((a, b) => a.calculationOrder - b.calculationOrder)
            .map(c => {
                const raw = currentInputMap[c.accessorialChargeId];
                const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : NaN;
                return {
                    accessorialChargeId: c.accessorialChargeId,
                    inputValue: !isNaN(parsed) ? parsed : undefined,
                    itemCount: 1,
                    notes: currentNotesMap[c.accessorialChargeId] || undefined,
                };
            });

        setIsAddingCharges(true);
        try {
            await accessorialChargesApi.addCharges(activeJobId, toAdd);
            setSelectedIds(new Set());
            setAvailableInputMap({});
            setAvailableNotesMap({});
            setIsAddingCharges(false);
            showToastRef.current(`${toAdd.length} charge(s) added.`, 'success');
            const applied = await loadAllRef.current();
            await autoSavePercentageCharges(applied);
        } catch (error: unknown) {
            showToastRef.current(`Error adding charges: ${error instanceof Error ? error.message : String(error)}`, 'error');
            setIsAddingCharges(false);
        }
    }, [getActiveJobId, autoSavePercentageCharges]);

    // ── Computed values ───────────────────────────────────────────────────────

    const selectedTotal = useMemo((): number => {
        return availableCharges
            .filter(c => selectedIds.has(c.accessorialChargeId))
            .reduce((sum, c) => {
                if (c.chargeType === 'flat') return sum + (c.baseRate ?? 0);
                return sum;
            }, 0);
    }, [availableCharges, selectedIds]);

    const portionJobs = job?.portionJobs ?? [];
    const isLoading = isLoadingAvailable || isLoadingApplied;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: { overflow: 'hidden', minWidth: 700 },
                },
            }}
        >
            {/* Header */}
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <ReceiptIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{
                        fontWeight: 600
                    }}>
                        Accessorial Charges
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Manage additional charges for this job
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleRefresh}
                    disabled={isLoading || isAddingCharges}
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                    })}
                    title="Refresh"
                >
                    <RefreshIcon />
                </IconButton>
                <IconButton
                    onClick={onClose}
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                    })}
                    title="Close"
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Portion job tabs */}
            {portionJobs.length > 0 && (
                <Box sx={{ display: 'flex', borderBottom: '2px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    {portionJobs.map((portion: PortionJobInfo) => (
                        <Button
                            key={portion.jobId}
                            onClick={() => handlePortionTabClick(portion.jobId)}
                            variant={activePortionJobId === portion.jobId ? 'contained' : 'outlined'}
                            disabled={isLoadingAvailable || isLoadingApplied}
                            sx={{
                                borderRadius: 0,
                                flex: 1,
                                fontWeight: 600,
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderRight: 'none',
                                borderBottom: 'none',
                            }}
                        >
                            {portion.label}
                        </Button>
                    ))}
                </Box>
            )}
            <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Auto-Mate pricing assist — hidden unless AI is enabled */}
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: pricingResult ? 1 : 0 }}>
                                <AiDraftButton onClick={handleSuggestCharges} isDrafting={isSuggesting} label="Suggest charges" />
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    Auto-Mate reviews this job's notes &amp; flags and checks the price.
                                </Typography>
                            </Box>
                            {pricingResult?.anomaly?.isOutlier && (
                                <Alert severity="warning" sx={{ mb: 1 }}>
                                    Charged {formatCurrency(pricingResult.anomaly.storedCharge)} but a re-rate gives{' '}
                                    {formatCurrency(pricingResult.anomaly.recomputedRate)} ({pricingResult.anomaly.deltaPercent > 0 ? '+' : ''}
                                    {pricingResult.anomaly.deltaPercent}%) — review before invoicing.
                                </Alert>
                            )}
                            {pricingResult && pricingResult.suggestions.length > 0 && (
                                <Alert severity="info">
                                    Suggested {pricingResult.suggestions.length} charge(s), pre-selected below for review:{' '}
                                    {pricingResult.suggestions.map(s => s.name).join(', ')}
                                </Alert>
                            )}
                            {pricingResult && pricingResult.suggestions.length === 0 && !pricingResult.anomaly?.isOutlier && (
                                <Alert severity="success">No additional charges or pricing issues detected.</Alert>
                            )}
                        </Box>

                        {/* Section 1 — Applied Charges */}
                        <Box>
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1
                                }}>
                                Applied Charges
                            </Typography>
                            <TableContainer component={Paper} elevation={1}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Service</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Stage</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Input / Units</Typography></TableCell>
                                            <TableCell align="right"><Typography sx={{
                                                fontWeight: 600
                                            }}>Amount</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Notes</Typography></TableCell>
                                            <TableCell align="center"><Typography sx={{
                                                fontWeight: 600
                                            }}>Actions</Typography></TableCell>
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
                                                            sx={{
                                                                color: "text.secondary",
                                                                fontStyle: "italic"
                                                            }}>
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
                                                            <Typography variant="caption" sx={{
                                                                color: "text.secondary"
                                                            }}>
                                                                {formatChargeType(charge.chargeType)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            {charge.addedAtStage ? (
                                                                <Chip
                                                                    label={charge.addedAtStage.replace('_', ' ').toUpperCase()}
                                                                    size="small"
                                                                    color={stageColor(charge.addedAtStage)}
                                                                    sx={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em' }}
                                                                />
                                                            ) : '\u2014'}
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
                                                                                setRowField(
                                                                                    charge.jobAccessorialChargeId,
                                                                                    'inputValue',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            onBlur={() => handleAppliedInputBlur(charge.jobAccessorialChargeId, charge.minimumQuantity)}
                                                                            sx={{ width: 90 }}
                                                                            disabled={row.isSaving || row.isDeleting || isAutoPopulated(charge)}
                                                                            slotProps={charge.minimumQuantity != null ? {htmlInput: {min: charge.minimumQuantity}} : undefined}
                                                                        />
                                                                        {charge.unitTypeName && (
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                {isAutoPopulated(charge) && (
                                                                                    <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                                                )}
                                                                                <Typography variant="body2" sx={{
                                                                                    color: "text.secondary"
                                                                                }}>
                                                                                    {charge.unitTypeName}
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                        {(charge.chargeType === 'hourly' || charge.chargeType === 'per_unit') && charge.ratePerUnit != null && (
                                                                            <Typography variant="body2" sx={{
                                                                                color: "text.secondary"
                                                                            }}>
                                                                                {'\u00D7'} {formatCurrency(charge.ratePerUnit)}
                                                                            </Typography>
                                                                        )}
                                                                        {charge.chargeType === 'percentage' && charge.percentageRate != null && (
                                                                            <Typography variant="body2" sx={{
                                                                                color: "text.secondary"
                                                                            }}>
                                                                                {'\u00D7'} {charge.percentageRate}%
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                    {renderLimits(charge)}
                                                                </Box>
                                                            ) : (
                                                                <Typography variant="body2" sx={{
                                                                    color: "text.secondary"
                                                                }}>
                                                                    Flat fee
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                                {formatCurrency(
                                                                    row.overrideAmount !== ''
                                                                        ? parseFloat(row.overrideAmount)
                                                                        : row.isDirty
                                                                        ? recalculate(charge, row)
                                                                        : (charge.overrideAmount ?? charge.calculatedAmount ?? undefined)
                                                                )}
                                                            </Typography>
                                                            <TextField
                                                                size="small"
                                                                label="Override"
                                                                type="number"
                                                                value={row.overrideAmount}
                                                                onChange={e => setRowField(charge.jobAccessorialChargeId, 'overrideAmount', e.target.value)}
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
                                                                    setRowField(
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
                                                                        onClick={() => handleSaveRow(charge)}
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
                                                                    onClick={() => handleDeleteRow(charge)}
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
                                                    <Typography variant="body2" sx={{
                                                        color: "text.secondary"
                                                    }}>Total</Typography>
                                                    <Typography variant="body2" sx={{
                                                        fontWeight: 700
                                                    }}>
                                                        {formatCurrency(
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
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1
                                }}>
                                Add Charges
                            </Typography>
                            <TableContainer component={Paper} elevation={1}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                                            <TableCell padding="checkbox" />
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Service</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Description</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Calculation</Typography></TableCell>
                                            <TableCell align="right"><Typography sx={{
                                                fontWeight: 600
                                            }}>Amount</Typography></TableCell>
                                            <TableCell><Typography sx={{
                                                fontWeight: 600
                                            }}>Notes</Typography></TableCell>
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
                                                            sx={{
                                                                color: "text.secondary",
                                                                fontStyle: "italic"
                                                            }}>
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
                                                        onClick={() => handleToggleAvailable(charge.accessorialChargeId)}
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
                                                                    handleToggleAvailable(charge.accessorialChargeId)
                                                                }
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{
                                                                fontWeight: isSelected ? 600 : 400
                                                            }}>
                                                                {charge.name}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{
                                                                color: "text.secondary"
                                                            }}>
                                                                {charge.description}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell onClick={e => e.stopPropagation()}>
                                                            {charge.chargeType === 'flat' ? (
                                                                <Typography variant="body2" sx={{
                                                                    color: "text.secondary"
                                                                }}>
                                                                    Flat fee
                                                                </Typography>
                                                            ) : (
                                                                <Box>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <TextField
                                                                            size="small"
                                                                            type="number"
                                                                            value={availableInputMap[charge.accessorialChargeId] ?? ''}
                                                                            onChange={e => handleAvailableInputChange(charge.accessorialChargeId, e.target.value)}
                                                                            onBlur={() => handleAvailableInputBlur(charge.accessorialChargeId)}
                                                                            sx={{ width: 90 }}
                                                                            disabled={!isSelected || isAddingCharges || isAutoPopulated(charge)}
                                                                            slotProps={charge.minimumQuantity != null ? {htmlInput: {min: charge.minimumQuantity}} : undefined}
                                                                            error={isSelected && missingInputIds.has(charge.accessorialChargeId)}
                                                                            helperText={isSelected && missingInputIds.has(charge.accessorialChargeId) ? 'Required' : undefined}
                                                                        />
                                                                        {charge.unitTypeName && (
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                {isAutoPopulated(charge) && (
                                                                                    <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                                                )}
                                                                                <Typography variant="body2" sx={{
                                                                                    color: "text.secondary"
                                                                                }}>
                                                                                    {charge.unitTypeName}
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                        {(charge.chargeType === 'hourly' || charge.chargeType === 'per_unit') && charge.ratePerUnit != null && (
                                                                            <Typography variant="body2" sx={{
                                                                                color: "text.secondary"
                                                                            }}>
                                                                                {'\u00D7'} {formatCurrency(charge.ratePerUnit)}
                                                                            </Typography>
                                                                        )}
                                                                        {charge.chargeType === 'percentage' && charge.percentageRate != null && (
                                                                            <Typography variant="body2" sx={{
                                                                                color: "text.secondary"
                                                                            }}>
                                                                                {'\u00D7'} {charge.percentageRate}%
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                    {renderLimits(charge)}
                                                                    {(() => {
                                                                        const note = getPercentageCalculationNote(charge);
                                                                        return note ? (
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{
                                                                                    color: "text.secondary",
                                                                                    display: "block",
                                                                                    mt: 0.5,
                                                                                    fontStyle: 'italic'
                                                                                }}>
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
                                                                if (charge.chargeType === 'flat') return formatCurrency(charge.baseRate);
                                                                if (isNaN(inputVal)) return '\u2014';
                                                                return formatCurrency(
                                                                    calculateAmount(charge, inputVal)
                                                                );
                                                            })()}
                                                        </TableCell>
                                                        <TableCell onClick={e => e.stopPropagation()}>
                                                            <TextField
                                                                size="small"
                                                                placeholder="Notes"
                                                                value={availableNotesMap[charge.accessorialChargeId] ?? ''}
                                                                onChange={e =>
                                                                    handleAvailableNoteChange(
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
                        bgcolor: 'background.paper',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    <Button onClick={onClose} variant="outlined">
                        Close
                    </Button>
                    {selectedIds.size > 0 && (
                        <Button
                            onClick={handleAddSelected}
                            variant="contained"
                            color="primary"
                            disabled={isAddingCharges}
                            startIcon={isAddingCharges ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {isAddingCharges
                                ? 'Adding...'
                                : `Add Selected Charges${selectedTotal > 0 ? ` (${formatCurrency(selectedTotal)})` : ''}`}
                        </Button>
                    )}
                </DialogActions>
            )}
        </Dialog>
    );
};

export default AccessorialChargesDialog;
