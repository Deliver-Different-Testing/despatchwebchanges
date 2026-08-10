/**
 * Inter-Courier Charge Dialog (React)
 *
 * Replaces the AngularJS inter-courier-charge-dialog.
 * Allows dispatchers to create paired inter-courier charge jobs.
 */

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {Box, Combobox, Group, Loader, Paper, Stack, Text, TextInput, useCombobox} from '@mantine/core';
import {Banknote, Check, SearchX} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';
import {searchActiveCouriers} from '../../../services/courierApi';
import {searchActiveClients} from '../../../services/jobApi';
import {createInterCourierCharge} from '../../../services/dispatchExecutorApi';
import type {Suggestion} from '../../../interfaces/job';
import type {ShowToastFn} from '../../../services/toastService';

const MIN_SEARCH_LENGTH = 2;
const ZONES_MULTIPLIER = 7;
const DEBOUNCE_MS = 300;

export interface InterCourierChargeDialogProps {
    open: boolean;
    onClose: () => void;
    showToast: ShowToastFn;
}

interface AutocompleteFieldState {
    options: Suggestion[];
    loading: boolean;
    inputValue: string;
    selected: Suggestion | null;
}

const initialFieldState: AutocompleteFieldState = {
    options: [],
    loading: false,
    inputValue: '',
    selected: null,
};

function useDebouncedSearch(
    inputValue: string,
    searchFn: (term: string, options?: {signal?: AbortSignal}) => Promise<Suggestion[]>,
    setField: React.Dispatch<React.SetStateAction<AutocompleteFieldState>>,
    abortRef: React.RefObject<AbortController | null>,
) {
    useEffect(() => {
        if (!inputValue || inputValue.length < MIN_SEARCH_LENGTH) {
            setField(prev => ({...prev, options: [], loading: false}));
            return;
        }

        const timer = setTimeout(async () => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setField(prev => ({...prev, loading: true}));
            try {
                const results = await searchFn(inputValue, {signal: controller.signal});
                if (!controller.signal.aborted) {
                    setField(prev => ({...prev, options: results, loading: false}));
                }
            } catch (error: any) {
                if (error?.name !== 'AbortError' && !controller.signal.aborted) {
                    setField(prev => ({...prev, options: [], loading: false}));
                }
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [inputValue, searchFn, setField, abortRef]);
}

/**
 * Async-search field over `Suggestion` objects.
 *
 * Mantine's `Autocomplete` is a free-text string input with no object value, so
 * the object-valued MUI `Autocomplete` this replaces is rebuilt on the
 * `Combobox` primitive: the input holds the display text while the caller keeps
 * the selected object.
 */
const SearchField: React.FC<{
    label: string;
    placeholder: string;
    field: AutocompleteFieldState;
    setField: React.Dispatch<React.SetStateAction<AutocompleteFieldState>>;
    error?: string;
    autoFocus?: boolean;
}> = ({label, placeholder, field, setField, error, autoFocus}) => {
    const combobox = useCombobox({onDropdownClose: () => combobox.resetSelectedOption()});

    return (
        <Combobox
            store={combobox}
            onOptionSubmit={(value) => {
                const selected = field.options.find(o => String(o.id) === value) ?? null;
                setField(prev => ({...prev, selected, inputValue: selected?.text ?? ''}));
                combobox.closeDropdown();
            }}
        >
            <Combobox.Target>
                <TextInput
                    label={label}
                    placeholder={placeholder}
                    withAsterisk
                    data-autofocus={autoFocus || undefined}
                    value={field.inputValue}
                    error={error}
                    rightSection={field.loading ? <Loader size={18}/> : null}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    onClick={() => combobox.openDropdown()}
                    onChange={(event) => {
                        // Typing invalidates the previous pick — the caller must
                        // re-select before the form counts as complete.
                        setField(prev => ({...prev, inputValue: event.currentTarget.value, selected: null}));
                        combobox.openDropdown();
                    }}
                />
            </Combobox.Target>
            <Combobox.Dropdown>
                <Combobox.Options>
                    {field.options.length > 0 ? (
                        field.options.map(option => (
                            <Combobox.Option value={String(option.id)} key={option.id}>
                                {option.text}
                            </Combobox.Option>
                        ))
                    ) : (
                        <Combobox.Empty>
                            {field.inputValue.length >= MIN_SEARCH_LENGTH ? (
                                <Group gap="xs" justify="center">
                                    <Icon lucide={SearchX} size={18}/>
                                    <Text fz="sm" c="dimmed">No matches for &ldquo;{field.inputValue}&rdquo;</Text>
                                </Group>
                            ) : (
                                <Text fz="sm" c="dimmed">Type at least {MIN_SEARCH_LENGTH} characters to search</Text>
                            )}
                        </Combobox.Empty>
                    )}
                </Combobox.Options>
            </Combobox.Dropdown>
        </Combobox>
    );
};

export const InterCourierChargeDialog: React.FC<InterCourierChargeDialogProps> = ({
    open,
    onClose,
    showToast,
}) => {
    const [fromCourier, setFromCourier] = useState<AutocompleteFieldState>(initialFieldState);
    const [toCourier, setToCourier] = useState<AutocompleteFieldState>(initialFieldState);
    const [client, setClient] = useState<AutocompleteFieldState>(initialFieldState);
    const [reference, setReference] = useState('');
    const [zones, setZones] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Abort controllers for in-flight searches
    const fromCourierAbort = useRef<AbortController | null>(null);
    const toCourierAbort = useRef<AbortController | null>(null);
    const clientAbort = useRef<AbortController | null>(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setFromCourier(initialFieldState);
            setToCourier(initialFieldState);
            setClient(initialFieldState);
            setReference('');
            setZones('');
            setAmount('');
            setIsSubmitting(false);
            setSubmitted(false);
        }
    }, [open]);

    useDebouncedSearch(fromCourier.inputValue, searchActiveCouriers, setFromCourier, fromCourierAbort);
    useDebouncedSearch(toCourier.inputValue, searchActiveCouriers, setToCourier, toCourierAbort);
    useDebouncedSearch(client.inputValue, searchActiveClients, setClient, clientAbort);

    const handleZonesChange = useCallback((value: string) => {
        setZones(value);
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            setAmount(String(parsed * ZONES_MULTIPLIER));
        } else {
            setAmount('0');
        }
    }, []);

    const isFormValid = fromCourier.selected && toCourier.selected && client.selected
        && reference.trim() !== '' && zones !== '' && amount !== ''
        && !isNaN(parseFloat(zones)) && !isNaN(parseFloat(amount))
        && parseFloat(zones) >= 0 && parseFloat(amount) >= 0;

    const handleSubmit = useCallback(async () => {
        setSubmitted(true);

        if (!isFormValid) {
            showToast('Please complete all the required fields', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            await createInterCourierCharge({
                fromCourierId: fromCourier.selected!.id,
                toCourierId: toCourier.selected!.id,
                clientId: client.selected!.id,
                reference: reference.trim(),
                amount: parseFloat(amount),
            });

            showToast('Inter-Courier Charge saved successfully', 'success');
            onClose();
        } catch (error) {
            showToast('An error occurred while saving the charge', 'error');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [isFormValid, fromCourier.selected, toCourier.selected, client.selected, reference, amount, showToast, onClose]);

    const handleClose = useCallback(() => {
        if (!isSubmitting) onClose();
    }, [isSubmitting, onClose]);

    const searchFieldError = (selected: unknown) => (submitted && !selected ? 'This field is required.' : undefined);

    return (
        <DialogShell opened={open} onClose={handleClose}>
            <DialogHeader
                icon={<Icon lucide={Banknote} />}
                title="Inter-Courier Charge"
                subtitle="Create a charge transfer between couriers"
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Paper {...sectionPaperProps} p="lg">
                    <Stack gap="lg">
                        <SearchField
                            label="From Courier"
                            placeholder="Search Courier..."
                            field={fromCourier}
                            setField={setFromCourier}
                            error={searchFieldError(fromCourier.selected)}
                            autoFocus
                        />
                        <SearchField
                            label="To Courier"
                            placeholder="Search Courier..."
                            field={toCourier}
                            setField={setToCourier}
                            error={searchFieldError(toCourier.selected)}
                        />
                        <SearchField
                            label="Client"
                            placeholder="Search Client..."
                            field={client}
                            setField={setClient}
                            error={searchFieldError(client.selected)}
                        />

                        <TextInput
                            label="Reference"
                            placeholder="Enter reference"
                            withAsterisk
                            value={reference}
                            onChange={(e) => setReference(e.currentTarget.value)}
                            error={submitted && reference.trim() === '' ? 'This field is required.' : undefined}
                        />

                        <Group gap="md" align="flex-start" grow>
                            <TextInput
                                label="Zones"
                                type="number"
                                withAsterisk
                                min={0}
                                value={zones}
                                onChange={(e) => handleZonesChange(e.currentTarget.value)}
                                error={
                                    submitted && zones === '' ? 'This field is required.'
                                        : submitted && parseFloat(zones) < 0 ? 'Value must be zero or greater.'
                                            : undefined
                                }
                            />
                            <TextInput
                                label="Amount"
                                type="number"
                                withAsterisk
                                min={0}
                                step={0.01}
                                value={amount}
                                onChange={(e) => setAmount(e.currentTarget.value)}
                                error={
                                    submitted && amount === '' ? 'This field is required.'
                                        : submitted && parseFloat(amount) < 0 ? 'Value must be zero or greater.'
                                            : undefined
                                }
                            />
                        </Group>
                    </Stack>
                </Paper>
            </Box>
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel="Add Charge"
                confirmIcon={<Icon lucide={Check} />}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default InterCourierChargeDialog;
