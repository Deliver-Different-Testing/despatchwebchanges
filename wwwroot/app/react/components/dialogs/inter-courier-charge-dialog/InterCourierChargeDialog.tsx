/**
 * Inter-Courier Charge Dialog (React)
 *
 * Replaces the AngularJS inter-courier-charge-dialog.
 * Allows dispatchers to create paired inter-courier charge jobs.
 */

import React, {useState, useCallback, useEffect, useRef} from 'react';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import PaymentsIcon from '@mui/icons-material/Payments';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CheckIcon from '@mui/icons-material/Check';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';
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

    const renderAutocomplete = (
        label: string,
        placeholder: string,
        field: AutocompleteFieldState,
        setField: React.Dispatch<React.SetStateAction<AutocompleteFieldState>>,
        autoFocus?: boolean,
    ) => {
        const hasError = submitted && !field.selected;

        return (
            <Autocomplete
                fullWidth
                size="small"
                autoHighlight
                options={field.options}
                loading={field.loading}
                value={field.selected}
                inputValue={field.inputValue}
                getOptionLabel={(option) => option.text}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onInputChange={(_, newValue) => {
                    setField(prev => ({...prev, inputValue: newValue}));
                }}
                onChange={(_, newValue) => {
                    setField(prev => ({...prev, selected: newValue}));
                }}
                noOptionsText={
                    field.inputValue.length >= MIN_SEARCH_LENGTH ? (
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, py: 1}}>
                            <SearchOffIcon color="action" />
                            <Typography sx={{
                                color: "text.secondary"
                            }}>
                                No matches for &ldquo;{field.inputValue}&rdquo;
                            </Typography>
                        </Box>
                    ) : (
                        <Typography sx={{
                            color: "text.secondary"
                        }}>
                            Type at least {MIN_SEARCH_LENGTH} characters to search
                        </Typography>
                    )
                }
                renderInput={({slotProps: autoSlotProps, ...params}) => (
                    <TextField
                        {...params}
                        autoFocus={autoFocus}
                        label={label}
                        placeholder={placeholder}
                        variant="outlined"
                        size="small"
                        required
                        error={hasError}
                        helperText={hasError ? 'This field is required.' : undefined}
                        slotProps={{
                            ...autoSlotProps,
                            input: {
                                ...autoSlotProps.input,
                                endAdornment: (
                                    <>
                                        {field.loading ? <CircularProgress color="inherit" size={20} /> : null}
                                        {autoSlotProps.input.endAdornment}
                                    </>
                                ),
                            },
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <Box
                        component="li"
                        {...props}
                        key={option.id}
                        sx={{display: 'flex', alignItems: 'center', gap: 1}}
                    >
                        <Typography>{option.text}</Typography>
                    </Box>
                )}
            />
        );
    };

    return (
        <DialogShell open={open} onClose={handleClose}>
            <DialogHeader
                icon={<PaymentsIcon />}
                title="Inter-Courier Charge"
                subtitle="Create a charge transfer between couriers"
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />
            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 3,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5,
                    })}
                >
                    {renderAutocomplete('From Courier', 'Search Courier...', fromCourier, setFromCourier, true)}
                    {renderAutocomplete('To Courier', 'Search Courier...', toCourier, setToCourier)}
                    {renderAutocomplete('Client', 'Search Client...', client, setClient)}

                    <TextField
                        label="Reference"
                        placeholder="Enter reference"
                        variant="outlined"
                        size="small"
                        fullWidth
                        required
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        error={submitted && reference.trim() === ''}
                        helperText={submitted && reference.trim() === '' ? 'This field is required.' : undefined}
                    />

                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField
                            label="Zones"
                            variant="outlined"
                            size="small"
                            type="number"
                            required
                            value={zones}
                            onChange={(e) => handleZonesChange(e.target.value)}
                            error={submitted && (zones === '' || isNaN(parseFloat(zones)) || parseFloat(zones) < 0)}
                            helperText={
                                submitted && zones === '' ? 'This field is required.'
                                    : submitted && parseFloat(zones) < 0 ? 'Value must be zero or greater.'
                                        : undefined
                            }
                            slotProps={{htmlInput: {min: 0}}}
                            sx={{flex: '0 0 40%'}}
                        />
                        <TextField
                            label="Amount"
                            variant="outlined"
                            size="small"
                            type="number"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            error={submitted && (amount === '' || isNaN(parseFloat(amount)) || parseFloat(amount) < 0)}
                            helperText={
                                submitted && amount === '' ? 'This field is required.'
                                    : submitted && parseFloat(amount) < 0 ? 'Value must be zero or greater.'
                                        : undefined
                            }
                            slotProps={{htmlInput: {min: 0, step: 0.01}}}
                            sx={{flex: 1}}
                        />
                    </Box>
                </Paper>
            </DialogContent>
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSubmit}
                confirmLabel="Add Charge"
                confirmIcon={<CheckIcon />}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default InterCourierChargeDialog;
