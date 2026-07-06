/**
 * EditSavedFlightDialog
 *
 * Sets the flight number saved against a recurring flight booking. The operator
 * searches the booking's route (one fetch on open) and picks a flight, or types
 * a custom flight number — which shows a "can't guarantee auto-assign" warning.
 * The saved number is matched and auto-assigned on each push-to-live.
 *
 * When `showAirportPickers` is set (recurring bookings created without a route),
 * the dialog also renders From/To airport autocompletes sourced from the airport
 * table; the flight search runs off that selection and the chosen airports are
 * returned to `onSubmit` so they can be persisted with the flight number.
 *
 * Follows the canonical job-detail edit-dialog design language.
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';

import { EditSavedFlightDialogProps, FlightOption, AirportOption } from './types';
import { nationwideApi, FlightViewModel } from '../../../services/nationwideApi';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from '../shared/styles';

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
    showAirportPickers = false,
    onClose,
    onSubmit,
}) => {
    // Explicit ids so the dialog gets an accessible name/description — the
    // custom Box header means MUI can't auto-wire aria-labelledby from a
    // <DialogTitle>. (WAI-ARIA / MD3 dialog guidance.)
    const titleId = useId();
    const descriptionId = useId();

    const [inputValue, setInputValue] = useState('');
    const [savedValue, setSavedValue] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [options, setOptions] = useState<FlightOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    // Airport-picker state (only used when showAirportPickers is set).
    const [airportOptions, setAirportOptions] = useState<AirportOption[]>([]);
    const [airportsLoading, setAirportsLoading] = useState(false);
    const [selectedFrom, setSelectedFrom] = useState<AirportOption | null>(null);
    const [selectedTo, setSelectedTo] = useState<AirportOption | null>(null);

    const searchDate = useMemo(
        () => (departureDate?.isValid?.() ? departureDate : dayjs().add(1, 'day')),
        [departureDate]
    );

    // Airports driving the flight search: the operator's picker selection when
    // pickers are shown, otherwise the airports passed in for a flight booking.
    const effectiveFromId = showAirportPickers ? selectedFrom?.id : fromAirportId;
    const effectiveToId = showAirportPickers ? selectedTo?.id : toAirportId;
    const hasAirports = effectiveFromId != null && effectiveToId != null;

    // Reset per-open, and (picker mode) load the airport list and seed any
    // airports already on the booking.
    useEffect(() => {
        if (!open) return;

        const initial = currentValue ?? '';
        setInputValue(initial);
        setSavedValue(normalizeFlightNumber(initial));
        setIsCustom(false);
        setOptions([]);
        setMessage(undefined);
        setSelectedFrom(null);
        setSelectedTo(null);

        if (!showAirportPickers) return;

        let cancelled = false;
        setAirportsLoading(true);
        nationwideApi
            .getAllActiveAirportSuggestions()
            .then((suggestions) => {
                if (cancelled) return;
                const opts = suggestions.map((s) => ({ id: s.id, label: s.text }));
                setAirportOptions(opts);
                if (fromAirportId != null) {
                    setSelectedFrom(opts.find((o) => o.id === fromAirportId) ?? null);
                }
                if (toAirportId != null) {
                    setSelectedTo(opts.find((o) => o.id === toAirportId) ?? null);
                }
            })
            .catch(() => {
                if (!cancelled) setAirportOptions([]);
            })
            .finally(() => {
                if (!cancelled) setAirportsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, showAirportPickers, currentValue, fromAirportId, toAirportId]);

    // Search the route's flights whenever both airports are known. In picker
    // mode this re-runs as the operator changes the From/To selection.
    useEffect(() => {
        if (!open) return;

        if (effectiveFromId == null || effectiveToId == null) {
            setOptions([]);
            if (showAirportPickers) {
                setMessage('Select departure and arrival airports to search flights.');
            }
            return;
        }

        let cancelled = false;
        setLoading(true);
        nationwideApi
            .getRecurringFlightOptions({
                bookingId,
                departureDate: searchDate.format('YYYY-MM-DD'),
                departureAirportId: effectiveFromId,
                arrivalAirportId: effectiveToId,
            })
            .then((result) => {
                if (cancelled) return;
                const opts = result.flights.map(toOption);
                setOptions(opts);
                setMessage(result.message);
                // Flag a pre-existing saved value as custom if the route search
                // doesn't surface it (schedule change / manual entry).
                const normalizedInitial = normalizeFlightNumber(currentValue ?? '');
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
    }, [open, bookingId, effectiveFromId, effectiveToId, searchDate, showAirportPickers, currentValue]);

    const applyTypedValue = useCallback(
        (text: string) => {
            const normalized = normalizeFlightNumber(text);
            const matched = options.find((o) => o.value === normalized || o.label === text);
            setSavedValue(matched ? matched.value : normalized);
            setIsCustom(!matched && normalized.length > 0);
        },
        [options]
    );

    // In picker mode the route airports must be chosen and a flight number
    // entered before we can save — the auto-assign needs all three.
    const missingRoute = showAirportPickers && (selectedFrom == null || selectedTo == null);
    const missingFlight = showAirportPickers && savedValue.length === 0;
    const submitDisabled = isSaving || missingRoute || missingFlight;

    // Explain why Save is unavailable — a disabled button gives no feedback on
    // its own. Matches the disabled-Save tooltip used by the dimensions dialog.
    const saveHint = missingRoute
        ? 'Select departure and arrival airports first'
        : missingFlight
            ? 'Enter a flight number to save'
            : '';

    const handleSubmit = useCallback(async () => {
        try {
            setIsSaving(true);
            if (showAirportPickers) {
                if (selectedFrom == null || selectedTo == null) return;
                await onSubmit(savedValue, {
                    fromAirportId: selectedFrom.id,
                    toAirportId: selectedTo.id,
                });
            } else {
                await onSubmit(savedValue);
            }
        } finally {
            setIsSaving(false);
        }
    }, [onSubmit, savedValue, showAirportPickers, selectedFrom, selectedTo]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: { overflow: 'hidden', minWidth: 480, maxWidth: 600 },
                },
            }}
        >
            {/* Header */}
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <FlightTakeoffIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography id={titleId} variant="h6" sx={{ fontWeight: 600 }}>
                        {showAirportPickers ? 'Add Flight' : 'Saved Flight'}
                    </Typography>
                    <Typography id={descriptionId} variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                        Auto-assigned each time this booking is pushed live
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isSaving}
                    aria-label="Close dialog"
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                    })}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {showAirportPickers && (
                        <Paper
                            elevation={0}
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 3,
                                p: 2.5,
                                border: '1px solid',
                                borderColor: 'grey.200',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                                    From airport
                                </Typography>
                                <Autocomplete
                                    disabled={isSaving}
                                    options={airportOptions}
                                    loading={airportsLoading}
                                    value={selectedFrom}
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    onChange={(_event, newValue) => setSelectedFrom(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            autoFocus
                                            size="small"
                                            fullWidth
                                            placeholder="Select departure airport…"
                                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                                            slotProps={{
                                                ...params.slotProps,
                                                htmlInput: {
                                                    ...params.slotProps?.htmlInput,
                                                    'aria-label': 'From airport',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                                    To airport
                                </Typography>
                                <Autocomplete
                                    disabled={isSaving}
                                    options={airportOptions}
                                    loading={airportsLoading}
                                    value={selectedTo}
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    onChange={(_event, newValue) => setSelectedTo(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            size="small"
                                            fullWidth
                                            placeholder="Select arrival airport…"
                                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                                            slotProps={{
                                                ...params.slotProps,
                                                htmlInput: {
                                                    ...params.slotProps?.htmlInput,
                                                    'aria-label': 'To airport',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </Box>
                        </Paper>
                    )}

                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: 'background.paper',
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
                                    autoFocus={!showAirportPickers}
                                    size="small"
                                    fullWidth
                                    placeholder={hasAirports ? 'Search flights or type a number…' : 'Enter a flight number…'}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                                    slotProps={{
                                        ...params.slotProps,
                                        htmlInput: {
                                            ...params.slotProps?.htmlInput,
                                            'aria-label': 'Flight number',
                                        },
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
                    bgcolor: 'background.paper',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button onClick={onClose} variant="outlined" disabled={isSaving} sx={{ minWidth: 100 }}>
                    Cancel
                </Button>
                <Tooltip title={saveHint}>
                    {/* span so the tooltip still fires while the button is disabled */}
                    <span>
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            color="primary"
                            disabled={submitDisabled}
                            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                            sx={{ minWidth: 100 }}
                        >
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </span>
                </Tooltip>
            </DialogActions>
        </Dialog>
    );
};

export default EditSavedFlightDialog;
