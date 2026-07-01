/**
 * EditSavedFlightDialog
 *
 * Sets the flight number saved against a recurring flight booking. The operator
 * searches the booking's route (one fetch on open) and picks a flight, or types
 * a custom flight number — which shows a "can't guarantee auto-assign" warning.
 * The saved number is matched and auto-assigned on each push-to-live.
 *
 * Follows the canonical job-detail edit-dialog design language.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';

import { EditSavedFlightDialogProps, FlightOption } from './types';
import { nationwideApi, FlightViewModel } from '../../../services/nationwideApi';

function normalizeFlightNumber(value: string): string {
    return (value ?? '').replace(/[\s-]/g, '').trim().toUpperCase();
}

/** Build the complete flight number ("NZ123") from a search result. */
function completeFlightNumber(flight: FlightViewModel): string {
    const seg = flight.flightSegments?.[0];
    if (seg?.carrierFsCode && seg?.flightNumber) {
        return normalizeFlightNumber(`${seg.carrierFsCode}${seg.flightNumber}`);
    }
    return normalizeFlightNumber(flight.flightNumber ?? '');
}

function toOption(flight: FlightViewModel): FlightOption {
    const value = completeFlightNumber(flight);
    const time = flight.departureTime?.isValid?.() ? flight.departureTime.format('HH:mm') : '';
    const route = [flight.departureAirport, flight.arrivalAirport].filter(Boolean).join('→');
    const label = [value, [route, time].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    return { value, label };
}

export const EditSavedFlightDialog: React.FC<EditSavedFlightDialogProps> = ({
    open,
    bookingId,
    fromAirportId,
    toAirportId,
    currentValue,
    departureDate,
    onClose,
    onSubmit,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [savedValue, setSavedValue] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [options, setOptions] = useState<FlightOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    const searchDate = useMemo(
        () => (departureDate?.isValid?.() ? departureDate : dayjs().add(1, 'day')),
        [departureDate]
    );

    // Load the route's flights once when the dialog opens. The list is small,
    // so the Autocomplete filters it locally as the user types; freeSolo lets
    // them enter a custom number not in the list.
    useEffect(() => {
        if (!open) return;

        const initial = currentValue ?? '';
        setInputValue(initial);
        setSavedValue(normalizeFlightNumber(initial));
        setIsCustom(false);
        setOptions([]);
        setMessage(undefined);

        let cancelled = false;
        setLoading(true);
        nationwideApi
            .getRecurringFlightOptions({
                bookingId,
                departureDate: searchDate.format('YYYY-MM-DD'),
                departureAirportId: fromAirportId,
                arrivalAirportId: toAirportId,
            })
            .then((result) => {
                if (cancelled) return;
                const opts = result.flights.map(toOption);
                setOptions(opts);
                setMessage(result.message);
                // Flag a pre-existing saved value as custom if the route search
                // doesn't surface it (schedule change / manual entry).
                const normalizedInitial = normalizeFlightNumber(initial);
                if (normalizedInitial && !opts.some((o) => o.value === normalizedInitial)) {
                    setIsCustom(true);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setOptions([]);
                setMessage('Flight search is unavailable — you can still enter a flight number manually.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, bookingId, fromAirportId, toAirportId, currentValue, searchDate]);

    const applyTypedValue = useCallback(
        (text: string) => {
            const normalized = normalizeFlightNumber(text);
            const matched = options.find((o) => o.value === normalized || o.label === text);
            setSavedValue(matched ? matched.value : normalized);
            setIsCustom(!matched && normalized.length > 0);
        },
        [options]
    );

    const handleSubmit = useCallback(async () => {
        try {
            setIsSaving(true);
            await onSubmit(savedValue);
        } finally {
            setIsSaving(false);
        }
    }, [onSubmit, savedValue]);

    const hasAirports = fromAirportId != null && toAirportId != null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: { borderRadius: 2, overflow: 'hidden', minWidth: 480, maxWidth: 600 },
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
                    }}
                >
                    <FlightTakeoffIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Saved Flight
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Auto-assigned each time this booking is pushed live
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isSaving}
                    aria-label="Close dialog"
                    sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: 'white',
                            borderRadius: 3,
                            p: 2.5,
                            border: '1px solid',
                            borderColor: 'grey.200',
                        }}
                    >
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                            Flight number
                        </Typography>
                        <Autocomplete
                            freeSolo
                            autoHighlight
                            disabled={isSaving}
                            options={options}
                            loading={loading}
                            inputValue={inputValue}
                            getOptionLabel={(option) =>
                                typeof option === 'string' ? option : option.label
                            }
                            isOptionEqualToValue={(option, value) =>
                                typeof value !== 'string' && option.value === value.value
                            }
                            onInputChange={(_event, newInput, reason) => {
                                setInputValue(newInput);
                                if (reason === 'input' || reason === 'clear') {
                                    applyTypedValue(newInput);
                                }
                            }}
                            onChange={(_event, newValue) => {
                                if (newValue == null) {
                                    setInputValue('');
                                    setSavedValue('');
                                    setIsCustom(false);
                                } else if (typeof newValue === 'string') {
                                    setInputValue(newValue);
                                    applyTypedValue(newValue);
                                } else {
                                    setInputValue(newValue.label);
                                    setSavedValue(newValue.value);
                                    setIsCustom(false);
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    fullWidth
                                    placeholder={hasAirports ? 'Search flights or type a number…' : 'Enter a flight number…'}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                                    slotProps={{
                                        ...params.slotProps,
                                        input: {
                                            ...params.slotProps.input,
                                            endAdornment: (
                                                <>
                                                    {loading ? <CircularProgress color="inherit" size={16} /> : null}
                                                    {params.slotProps.input.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
                        />
                    </Paper>

                    {message && !loading && options.length === 0 && (
                        <Alert severity="info">{message}</Alert>
                    )}

                    {isCustom && savedValue.length > 0 && (
                        <Alert severity="warning">
                            <strong>{savedValue}</strong> is a custom flight number that wasn&apos;t found on this
                            route. Double-check it&apos;s correct — we can&apos;t guarantee it&apos;ll auto-assign
                            when this booking is pushed live.
                        </Alert>
                    )}
                </Box>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button onClick={onClose} variant="outlined" disabled={isSaving} sx={{ minWidth: 100 }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    color="primary"
                    disabled={isSaving}
                    startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                    sx={{ minWidth: 100 }}
                >
                    {isSaving ? 'Saving…' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditSavedFlightDialog;
