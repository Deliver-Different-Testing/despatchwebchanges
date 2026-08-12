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
import {Alert, Box, Button, Paper, Select, Stack, Text} from '@mantine/core';
import {useDebouncedValue} from '@mantine/hooks';
import {SegmentedToggle} from '../../common/segmented-toggle';
import {Handshake, Headset, Network, UserMinus} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {
    AgentEmailFields,
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    sectionLabelProps,
    sectionPaperProps,
    type AgentEmailState,
} from '../shared/mantine';

import {autocompleteSearch} from '../../../services/jobDetailApi';
import {apiClient} from '../../../services/apiClient';
import type {ISuggestion} from '../../../../interfaces/job.interface';
import type {EventGroupItem} from '../../../services/jobListApi';

import {PartnerRatePanel} from './PartnerRatePanel';
import type {DispatchDialogProps, DispatchMode, DispatchType} from './types';

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

    const [debouncedTerm] = useDebouncedValue(inputValue, 300);

    // Debounced destination search — only fires for Courier / Agent / NP.
    // Clearing the box empties the list immediately; only the fetch is debounced.
    useEffect(() => {
        if (selectedType === 'DfrntPartner') return;
        if (!inputValue || inputValue.length < 1) {
            setOptions([]);
            return;
        }
        if (!debouncedTerm || debouncedTerm.length < 1) return;
        let cancelled = false;
        void (async () => {
            setSearchLoading(true);
            try {
                const results = await SEARCH_FN[selectedType](debouncedTerm);
                if (!cancelled) setOptions(results);
            } catch {
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) setSearchLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [inputValue, debouncedTerm, selectedType]);

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
        Courier: <Icon tabler={IconTruck} size={16}/>,
        DfrntPartner: <Icon lucide={Handshake} size={16}/>,
        Agent: <Icon lucide={Headset} size={16}/>,
        NP: <Icon lucide={Network} size={16}/>,
    };
    // The operator has been shown the warning and the alternatives; reframing the button makes it
    // explicit that confirming now overrides a known objection rather than proceeding normally.
    const confirmLabel = submitting
        ? CONFIRM_LABELS[selectedType].busy
        : (selectedType === 'DfrntPartner' && partnerLaneUnserviceable)
            ? 'Send anyway'
            : CONFIRM_LABELS[selectedType].idle;
    const confirmIcon = CONFIRM_ICONS[selectedType];

    return (
        <DialogShell
            opened={open}
            onClose={submitting ? () => {} : onClose}
            label="Dispatch"
        >
            <DialogHeader
                icon={<Icon tabler={IconTruck}/>}
                title="Dispatch"
                subtitle={subtitleForMode(mode)}
                onClose={onClose}
                closeDisabled={submitting}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="lg">
                    {/* Type radio row */}
                    <Box>
                        <Text {...sectionLabelProps}>Type</Text>
                        <Paper {...sectionPaperProps}>
                            <SegmentedToggle<DispatchType>
                                aria-label="Dispatch type"
                                variant="inline"
                                value={selectedType}
                                onChange={handleTypeChange}
                                data={[
                                    {value: 'Courier', label: 'Courier'},
                                    {
                                        value: 'DfrntPartner',
                                        label: 'DFRNT Partner',
                                        disabled: dfrntState.disabled,
                                        tooltip: dfrntState.disabled ? dfrntState.tooltip : undefined,
                                    },
                                    {value: 'Agent', label: 'Agent'},
                                    {value: 'NP', label: 'NP'},
                                ]}
                            />
                        </Paper>
                    </Box>

                    {/* Destination panel */}
                    {selectedType !== 'DfrntPartner' && (
                        <Box>
                            <Text {...sectionLabelProps}>Destination</Text>
                            <Paper {...sectionPaperProps}>
                                <SearchSelect<ISuggestion>
                                    aria-label="Destination"
                                    placeholder={PLACEHOLDERS[selectedType]}
                                    autoFocus
                                    autoHighlight
                                    value={destination}
                                    onChange={setDestination}
                                    options={options}
                                    onSearchChange={setInputValue}
                                    loading={searchLoading}
                                    disabled={submitting}
                                    getOptionKey={(option) => option.id}
                                    getOptionLabel={(option) => option.text}
                                    minSearchLength={1}
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
                            <Text {...sectionLabelProps}>Partner</Text>
                            <Paper {...sectionPaperProps}>
                                <Select
                                    label="Partner"
                                    value={selectedPartnerId === '' ? null : String(selectedPartnerId)}
                                    onChange={(value) => setSelectedPartnerId(value === null ? '' : Number(value))}
                                    disabled={submitting || partnerOptionsLoading}
                                    comboboxProps={{keepMounted: false}}
                                    nothingFoundMessage="No active partners"
                                    data={partnerOptions.map((opt) => ({value: String(opt.id), label: opt.text}))}
                                />
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
                        <Alert color="reflex" variant="light">
                            Unassigning removes the courier from this recurring job and from any
                            upcoming jobs already created that aren&apos;t completed yet. Completed jobs
                            keep their assigned courier.
                        </Alert>
                    )}

                    {submitError && <Alert color="red" variant="light">{submitError}</Alert>}
                </Stack>
            </Box>
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
                        variant="subtle"
                        color="red"
                        disabled={submitting}
                        leftSection={<Icon lucide={UserMinus} size={16}/>}
                    >
                        Unassign courier
                    </Button>
                ) : undefined}
            />
        </DialogShell>
    );
};

export default DispatchDialog;
