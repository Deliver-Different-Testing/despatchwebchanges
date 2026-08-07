/**
 * DispatchDialog
 *
 * Universal dispatch dialog covering all four destinations
 * (Courier / Agent / NP / DFRNT Partner) and both single + bulk + recurring
 * dispatch modes.
 *
 * The DFRNT Partner radio folds in the rate determination flow that used to
 * live in the standalone SendToPartnerDialog (now removed). When the active
 * radio is DFRNT Partner the dialog renders a partner picker plus the
 * PartnerRatePanel; for other radios it renders a destination Autocomplete.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import type {SxProps, Theme} from '@mui/material';
import {DialogShell, DialogHeader, DialogFooter, AgentEmailFields, type AgentEmailState} from '../shared';

import {autocompleteSearch} from '../../../services/jobDetailApi';
import {apiClient} from '../../../services/apiClient';
import type {ISuggestion} from '../../../../interfaces/job.interface';
import type {EventGroupItem} from '../../../services/jobListApi';

import {PartnerRatePanel} from './PartnerRatePanel';
import type {DispatchDialogProps, DispatchMode, DispatchType} from './types';

const SECTION_LABEL_SX = {
    color: 'text.secondary',
    fontWeight: 500,
    mb: 1,
} satisfies SxProps<Theme>;

const SECTION_PAPER_SX = {
    bgcolor: 'background.paper',
    borderRadius: 3,
    p: 2.5,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

const TEXT_FIELD_SX = {
    '& .MuiOutlinedInput-root': {bgcolor: 'background.paper'},
} satisfies SxProps<Theme>;

// Per-type search backends. Mirrors the legacy useJobActions.handleCourierClick
// type-options exactly so behaviour is identical to the old recurring-job picker.
const SEARCH_FN: Record<'Courier' | 'Agent' | 'NP', (s: string) => Promise<ISuggestion[]>> = {
    Courier: (s) => autocompleteSearch(s, '/courier/AllActiveSearch'),
    Agent: (s) =>
        apiClient.get<ISuggestion[]>('/NationwideJob/GetAllAgentsSearch', {
            searchTerm: s,
            isNetworkPartner: false,
        }),
    NP: (s) =>
        apiClient.get<ISuggestion[]>('/NationwideJob/GetAllAgentsSearch', {
            searchTerm: s,
            isNetworkPartner: true,
        }),
};

const PLACEHOLDERS: Record<'Courier' | 'Agent' | 'NP', string> = {
    Courier: 'Search courier...',
    Agent: 'Search agent...',
    NP: 'Search Network Partner...',
};

function computeDfrntDisabled(mode: DispatchMode): {disabled: boolean; tooltip: string} {
    if (mode.kind === 'bulk') {
        return {
            disabled: true,
            tooltip: 'DFRNT Partner is not available for bulk dispatch — dispatch jobs individually.',
        };
    }
    if (mode.kind === 'recurring') {
        return {disabled: true, tooltip: 'DFRNT Partner is not yet available for recurring jobs.'};
    }
    const {flags} = mode;
    if (flags.isArchived) {
        return {disabled: true, tooltip: 'DFRNT Partner is not yet available for archived jobs.'};
    }
    if (flags.isBulkJob) {
        return {disabled: true, tooltip: 'DFRNT Partner is not yet available for bulk jobs.'};
    }
    if (flags.preBook) {
        return {disabled: true, tooltip: 'DFRNT Partner is not yet available for recurring jobs.'};
    }
    return {disabled: false, tooltip: ''};
}

function subtitleForMode(mode: DispatchMode): string {
    if (mode.kind === 'bulk') {
        const n = mode.jobs.length;
        return `${n} job${n === 1 ? '' : 's'} selected`;
    }
    return `Job ${mode.jobNo}`;
}

export const DispatchDialog: React.FC<DispatchDialogProps> = ({
    open,
    mode,
    initialType = 'Courier',
    existingDestination,
    onClose,
    onDispatchCourier,
    onUnassignCourier,
    onSendToPartner,
    fetchRate,
    getPartnerOptions,
}) => {
    const dfrntState = useMemo(() => computeDfrntDisabled(mode), [mode]);

    const [selectedType, setSelectedType] = useState<DispatchType>(initialType);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Courier / Agent / NP destination state
    const [destination, setDestination] = useState<ISuggestion | null>(existingDestination ?? null);
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<ISuggestion[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Editable agent-email template (Agent option, single job). Fed by AgentEmailFields.
    const [agentEmail, setAgentEmail] = useState<AgentEmailState>({willEmail: false, subject: '', body: ''});

    // DFRNT Partner state
    const [partnerOptions, setPartnerOptions] = useState<EventGroupItem[]>([]);
    const [partnerOptionsLoading, setPartnerOptionsLoading] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
    const [partnerLaneUnserviceable, setPartnerLaneUnserviceable] = useState(false);
    const [agreedRate, setAgreedRate] = useState(0);
    const [agreedRateValid, setAgreedRateValid] = useState(false);

    // Reset when (re)opening — guarantees a fresh state if the dialog is reused.
    useEffect(() => {
        if (!open) return;
        // If the caller asked for DFRNT Partner but it's disabled, fall back to Courier.
        const startType = initialType === 'DfrntPartner' && dfrntState.disabled
            ? 'Courier'
            : initialType;
        setSelectedType(startType);
        setSubmitting(false);
        setSubmitError('');
        setDestination(existingDestination ?? null);
        setInputValue(existingDestination?.text ?? '');
        setOptions([]);
        setAgentEmail({willEmail: false, subject: '', body: ''});
        setSelectedPartnerId('');
        setAgreedRate(0);
        setAgreedRateValid(false);
    }, [open, initialType, dfrntState.disabled, existingDestination]);

    // Lazy-load the partner list the first time DFRNT Partner is selected.
    useEffect(() => {
        if (!open) return;
        if (selectedType !== 'DfrntPartner') return;
        if (partnerOptions.length > 0 || partnerOptionsLoading) return;
        setPartnerOptionsLoading(true);
        getPartnerOptions()
            .then((opts) => setPartnerOptions(opts))
            .catch(() => setPartnerOptions([]))
            .finally(() => setPartnerOptionsLoading(false));
    }, [open, selectedType, partnerOptions.length, partnerOptionsLoading, getPartnerOptions]);

    // Debounced destination search — only fires for Courier / Agent / NP.
    useEffect(() => {
        if (selectedType === 'DfrntPartner') return;
        const term = inputValue;
        if (!term || term.length < 1) {
            setOptions([]);
            return;
        }
        const handle = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const results = await SEARCH_FN[selectedType](term);
                setOptions(results);
            } catch {
                setOptions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [inputValue, selectedType]);

    const handleTypeChange = useCallback((newType: DispatchType) => {
        setSelectedType(newType);
        // Clear destination so the operator can't accidentally submit a courier
        // id against the agent column or vice versa.
        setDestination(null);
        setInputValue('');
        setOptions([]);
        setAgentEmail({willEmail: false, subject: '', body: ''});
        setSubmitError('');
    }, []);

    const handlePartnerRateChange = useCallback((rate: number, valid: boolean) => {
        setAgreedRate(rate);
        setAgreedRateValid(valid);
    }, []);

    const canConfirm = useMemo(() => {
        if (submitting) return false;
        if (selectedType === 'DfrntPartner') {
            return selectedPartnerId !== '' && agreedRateValid;
        }
        return destination !== null;
    }, [submitting, selectedType, selectedPartnerId, agreedRateValid, destination]);

    const handleConfirm = useCallback(async () => {
        setSubmitError('');
        setSubmitting(true);
        try {
            if (selectedType === 'DfrntPartner') {
                const partner = partnerOptions.find((p) => p.id === selectedPartnerId);
                if (!partner) {
                    setSubmitError('Select a partner before confirming.');
                    return;
                }
                await onSendToPartner({id: partner.id, text: partner.text}, agreedRate);
            } else {
                if (!destination) return;
                // Only the Agent path (with an email actually going out) carries the edited
                // template; Courier/NP keep the bare two-arg call.
                if (selectedType === 'Agent' && agentEmail.willEmail) {
                    await onDispatchCourier(selectedType, destination, agentEmail.subject, agentEmail.body);
                } else {
                    await onDispatchCourier(selectedType, destination);
                }
            }
        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : 'Dispatch failed.';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    }, [selectedType, partnerOptions, selectedPartnerId, agreedRate, destination, agentEmail, onSendToPartner, onDispatchCourier]);

    const handleUnassign = useCallback(async () => {
        if (!onUnassignCourier) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            await onUnassignCourier();
        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : 'Unassign failed.';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    }, [onUnassignCourier]);

    // Only offer "Unassign courier" for a recurring job that currently has a
    // courier assigned, and only while the Courier radio is active.
    const showUnassign =
        mode.kind === 'recurring' &&
        selectedType === 'Courier' &&
        Boolean(existingDestination) &&
        Boolean(onUnassignCourier);

    const showPartnerRatePanel = selectedType === 'DfrntPartner' && selectedPartnerId !== '';

    // Per-type confirm label + icon. Courier keeps the original "Dispatch" verb;
    // the other three are framed as "Send to ..." so it's obvious which lane the
    // job is heading down (and gives DFRNT Partner its own visual identity).
    const CONFIRM_LABELS: Record<DispatchType, {idle: string; busy: string}> = {
        Courier: {idle: 'Dispatch', busy: 'Dispatching...'},
        DfrntPartner: {idle: 'Send to Partner', busy: 'Sending...'},
        Agent: {idle: 'Send to Agent', busy: 'Sending...'},
        NP: {idle: 'Send to NP', busy: 'Sending...'},
    };
    const CONFIRM_ICONS: Record<DispatchType, React.ReactElement> = {
        Courier: <LocalShippingIcon/>,
        DfrntPartner: <HandshakeIcon/>,
        Agent: <SupportAgentIcon/>,
        NP: <AccountTreeIcon/>,
    };
    // The operator has been shown the warning and the alternatives; reframing the button makes it
    // explicit that confirming now overrides a known objection rather than proceeding normally.
    const confirmLabel = submitting
        ? CONFIRM_LABELS[selectedType].busy
        : (selectedType === 'DfrntPartner' && partnerLaneUnserviceable)
            ? 'Send anyway'
            : CONFIRM_LABELS[selectedType].idle;
    const confirmIcon = CONFIRM_ICONS[selectedType];

    // Wrap the disabled DFRNT Partner radio in a Tooltip — Tooltip needs a
    // non-disabled child to receive pointer events, hence the <span>.
    const dfrntRadio = (
        <FormControlLabel
            value="DfrntPartner"
            control={<Radio size="small" disabled={dfrntState.disabled}/>}
            label="DFRNT Partner"
            disabled={dfrntState.disabled}
        />
    );

    return (
        <DialogShell open={open} onClose={submitting ? undefined : onClose}>
            <DialogHeader
                icon={<LocalShippingIcon/>}
                title="Dispatch"
                subtitle={subtitleForMode(mode)}
                onClose={onClose}
                closeDisabled={submitting}
            />
            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {/* Type radio row */}
                    <Box>
                        <Typography variant="body2" sx={SECTION_LABEL_SX}>Type</Typography>
                        <Paper elevation={0} sx={SECTION_PAPER_SX}>
                            <RadioGroup
                                row
                                value={selectedType}
                                onChange={(e) => handleTypeChange(e.target.value as DispatchType)}
                            >
                                <FormControlLabel value="Courier" control={<Radio size="small"/>} label="Courier"/>
                                {dfrntState.disabled ? (
                                    <Tooltip title={dfrntState.tooltip} placement="top" enterDelay={0} enterTouchDelay={0}>
                                        <span>{dfrntRadio}</span>
                                    </Tooltip>
                                ) : (
                                    dfrntRadio
                                )}
                                <FormControlLabel value="Agent" control={<Radio size="small"/>} label="Agent"/>
                                <FormControlLabel value="NP" control={<Radio size="small"/>} label="NP"/>
                            </RadioGroup>
                        </Paper>
                    </Box>

                    {/* Destination panel */}
                    {selectedType !== 'DfrntPartner' && (
                        <Box>
                            <Typography variant="body2" sx={SECTION_LABEL_SX}>Destination</Typography>
                            <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                <Autocomplete
                                    fullWidth
                                    autoHighlight
                                    options={options}
                                    loading={searchLoading}
                                    value={destination}
                                    inputValue={inputValue}
                                    getOptionLabel={(option) => option.text}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    onInputChange={(_, v) => setInputValue(v)}
                                    onChange={(_, v) => setDestination(v)}
                                    disabled={submitting}
                                    noOptionsText={
                                        inputValue.length >= 1
                                            ? `No ${selectedType.toLowerCase()} matching "${inputValue}" were found.`
                                            : 'Type to search'
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            autoFocus
                                            placeholder={PLACEHOLDERS[selectedType]}
                                            size="small"
                                            sx={TEXT_FIELD_SX}
                                            slotProps={{
                                                ...params.slotProps,
                                                input: {
                                                    ...params.slotProps.input,
                                                    endAdornment: (
                                                        <>
                                                            {searchLoading ? <CircularProgress color="inherit" size={18}/> : null}
                                                            {params.slotProps.input.endAdornment}
                                                        </>
                                                    ),
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </Paper>
                        </Box>
                    )}

                    {/* Inbound-agent email pre-flight + editable template — only for a chosen
                        Agent on a single job. Keyed by agent+job so it reseeds when either changes. */}
                    {selectedType === 'Agent' && destination && mode.kind === 'single' && (
                        <AgentEmailFields
                            key={`${destination.id}-${mode.jobId}`}
                            agentId={destination.id}
                            jobId={mode.jobId}
                            onChange={setAgentEmail}
                        />
                    )}

                    {/* DFRNT Partner panel */}
                    {selectedType === 'DfrntPartner' && (
                        <Box>
                            <Typography variant="body2" sx={SECTION_LABEL_SX}>Partner</Typography>
                            <Paper elevation={0} sx={SECTION_PAPER_SX}>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Partner"
                                    value={selectedPartnerId === '' ? '' : String(selectedPartnerId)}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setSelectedPartnerId(v === '' ? '' : Number(v));
                                    }}
                                    disabled={submitting || partnerOptionsLoading}
                                    sx={TEXT_FIELD_SX}
                                    slotProps={{
                                        input: {
                                            endAdornment: partnerOptionsLoading
                                                ? <CircularProgress size={18}/>
                                                : undefined,
                                        },
                                    }}
                                >
                                    {partnerOptions.length === 0 && !partnerOptionsLoading && (
                                        <MenuItem value="" disabled>No active partners</MenuItem>
                                    )}
                                    {partnerOptions.map((opt) => (
                                        <MenuItem key={opt.id} value={String(opt.id)}>{opt.text}</MenuItem>
                                    ))}
                                </TextField>
                            </Paper>
                        </Box>
                    )}

                    {/* Partner rate panel — only after a partner is chosen */}
                    {showPartnerRatePanel && (
                        <PartnerRatePanel
                            partnerId={Number(selectedPartnerId)}
                            jobId={mode.kind === 'bulk' ? 0 : mode.jobId}
                            fetchRate={fetchRate}
                            onRateChange={handlePartnerRateChange}
                            onServiceabilityChange={setPartnerLaneUnserviceable}
                            disabled={submitting}
                        />
                    )}

                    {showUnassign && (
                        <Alert severity="info">
                            Unassigning removes the courier from this recurring job and from any
                            upcoming jobs already created that aren&apos;t completed yet. Completed jobs
                            keep their assigned courier.
                        </Alert>
                    )}

                    {submitError && <Alert severity="error">{submitError}</Alert>}
                </Box>
            </DialogContent>
            {/* Footer */}
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleConfirm}
                confirmLabel={confirmLabel}
                confirmIcon={confirmIcon}
                confirmDisabled={!canConfirm}
                submitting={submitting}
                secondaryAction={showUnassign ? (
                    <Button
                        onClick={handleUnassign}
                        variant="text"
                        color="error"
                        disabled={submitting}
                        startIcon={<PersonRemoveIcon/>}
                        sx={{minHeight: 44}}
                    >
                        Unassign courier
                    </Button>
                ) : undefined}
            />
        </DialogShell>
    );
};

export default DispatchDialog;
