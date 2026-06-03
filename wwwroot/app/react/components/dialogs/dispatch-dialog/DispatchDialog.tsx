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
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
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
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SendIcon from '@mui/icons-material/Send';
import type {SxProps, Theme} from '@mui/material';

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
    bgcolor: 'white',
    borderRadius: 3,
    p: 2.5,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

const TEXT_FIELD_SX = {
    '& .MuiOutlinedInput-root': {bgcolor: 'white'},
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

    // DFRNT Partner state
    const [partnerOptions, setPartnerOptions] = useState<EventGroupItem[]>([]);
    const [partnerOptionsLoading, setPartnerOptionsLoading] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
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
                await onDispatchCourier(selectedType, destination);
            }
        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : 'Dispatch failed.';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    }, [selectedType, partnerOptions, selectedPartnerId, agreedRate, destination, onSendToPartner, onDispatchCourier]);

    const showPartnerRatePanel = selectedType === 'DfrntPartner' && selectedPartnerId !== '';
    const isDfrnt = selectedType === 'DfrntPartner';
    const confirmLabel = isDfrnt
        ? (submitting ? 'Sending...' : 'Send to Partner')
        : (submitting ? 'Dispatching...' : 'Dispatch');
    const confirmIcon = isDfrnt ? <SendIcon/> : <LocalShippingIcon/>;

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
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: 480,
                        maxWidth: 600,
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
                        flexShrink: 0,
                    }}
                >
                    <LocalShippingIcon sx={{fontSize: 24}}/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{
                        fontWeight: 600
                    }}>Dispatch</Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {subtitleForMode(mode)}
                    </Typography>
                </Box>
                <IconButton
                    aria-label="Close dialog"
                    onClick={onClose}
                    disabled={submitting}
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon/>
                </IconButton>
            </Box>
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
                                <FormControlLabel value="Agent" control={<Radio size="small"/>} label="Agent"/>
                                <FormControlLabel value="NP" control={<Radio size="small"/>} label="NP"/>
                                {dfrntState.disabled ? (
                                    <Tooltip title={dfrntState.tooltip} placement="top">
                                        <span>{dfrntRadio}</span>
                                    </Tooltip>
                                ) : (
                                    dfrntRadio
                                )}
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
                            disabled={submitting}
                        />
                    )}

                    {submitError && <Alert severity="error">{submitError}</Alert>}
                </Box>
            </DialogContent>
            {/* Footer */}
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
                    disabled={submitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    disabled={!canConfirm}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit"/> : confirmIcon}
                    sx={{minWidth: 100}}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DispatchDialog;
