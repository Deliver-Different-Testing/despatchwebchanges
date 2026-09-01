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

import {Alert, Autocomplete, Box, Loader, Paper, Select, Stack, Text, Tooltip} from '@mantine/core';
import {PlaneTakeoff} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EditSavedFlightDialogProps, FlightOption, AirportOption } from './types';
import {nationwideApi} from '../../../services/nationwideApi';
import type {FlightViewModel} from '../../../interfaces/nationwideJobs';

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

    /*
     * MUI split this across onInputChange and onChange; Mantine's Autocomplete has
     * one callback carrying the string. That is enough because applyTypedValue
     * already matches on the label as well as the value, so picking a suggestion
     * and typing its label land in the same place — and anything unmatched is
     * marked custom, which is what the warning below reads.
     */
    const handleFlightInputChange = useCallback(
        (value: string) => {
            setInputValue(value);
            applyTypedValue(value);
        },
        [applyTypedValue]
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
        /*
         * The header was hand-built from the legacy sx tokens, with its own titleId
         * and describedby wiring because a custom Box header gave MUI nothing to
         * name the dialog from. DialogShell takes `label` for that, so both ids go.
         */
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.sm}
            label={showAirportPickers ? 'Add flight' : 'Saved flight'}
        >
            <DialogHeader
                icon={<Icon lucide={PlaneTakeoff}/>}
                title={showAirportPickers ? 'Add flight' : 'Saved flight'}
                subtitle="Auto-assigned each time this booking is pushed live"
                onClose={onClose}
                closeDisabled={isSaving}
            />

            {/* Content */}
            <Box bg={dialogContentBg}>
                <Stack p={24} gap={24}>
                    {showAirportPickers && (
                        <Paper {...sectionPaperProps}>
                            <Stack gap={16}>
                                {/*
                                  * A Select, not an Autocomplete: the airport list is
                                  * loaded once into state rather than searched, so
                                  * there is nothing to type-ahead against. Mantine's
                                  * Select speaks strings, so the id round-trips.
                                  */}
                                <Box>
                                    <Text {...sectionLabelProps}>From airport</Text>
                                    <Select
                                        data-autofocus
                                        searchable
                                        disabled={isSaving || airportsLoading}
                                        placeholder="Select departure airport…"
                                        aria-label="From airport"
                                        comboboxProps={{keepMounted: false}}
                                        value={selectedFrom ? String(selectedFrom.id) : null}
                                        onChange={(value) =>
                                            setSelectedFrom(airportOptions.find(a => String(a.id) === value) ?? null)}
                                        data={airportOptions.map(a => ({value: String(a.id), label: a.label}))}
                                    />
                                </Box>
                                <Box>
                                    <Text {...sectionLabelProps}>To airport</Text>
                                    <Select
                                        searchable
                                        disabled={isSaving || airportsLoading}
                                        placeholder="Select arrival airport…"
                                        aria-label="To airport"
                                        comboboxProps={{keepMounted: false}}
                                        value={selectedTo ? String(selectedTo.id) : null}
                                        onChange={(value) =>
                                            setSelectedTo(airportOptions.find(a => String(a.id) === value) ?? null)}
                                        data={airportOptions.map(a => ({value: String(a.id), label: a.label}))}
                                    />
                                </Box>
                            </Stack>
                        </Paper>
                    )}

                    <Paper {...sectionPaperProps}>
                        <Text {...sectionLabelProps}>Flight number</Text>
                        {/*
                          * Free text with suggestions, which is what Mantine's
                          * Autocomplete is — the operator may type a number the
                          * route search did not return. Picking a suggestion stores
                          * the flight number behind the label; typing anything else
                          * is treated as custom and warned about below.
                          */}
                        <Autocomplete
                            disabled={isSaving}
                            placeholder={hasAirports ? 'Search flights or type a number…' : 'Enter a flight number…'}
                            aria-label="Flight number"
                            value={inputValue}
                            onChange={handleFlightInputChange}
                            data={options.map(o => o.label)}
                            rightSection={loading ? <Loader size={16} aria-label="Searching flights"/> : undefined}
                        />
                    </Paper>

                    {message && !loading && options.length === 0 && (
                        <Alert color="blue" variant="light">{message}</Alert>
                    )}

                    {isCustom && savedValue.length > 0 && (
                        <Alert color="yellow" variant="light">
                            <strong>{savedValue}</strong> is a custom flight number that wasn&apos;t found on this
                            route. Double-check it&apos;s correct — we can&apos;t guarantee it&apos;ll auto-assign
                            when this booking is pushed live.
                        </Alert>
                    )}
                </Stack>
            </Box>

            {/*
              * The span that let the tooltip fire over a disabled button is still
              * needed — a disabled control emits no pointer events in Mantine either.
              */}
            <Tooltip label={saveHint}>
                <span>
                    <DialogFooter
                        onCancel={onClose}
                        onConfirm={handleSubmit}
                        confirmLabel="Save"
                        confirmDisabled={submitDisabled}
                        submitting={isSaving}
                    />
                </span>
            </Tooltip>
        </DialogShell>
    );
};

export default EditSavedFlightDialog;
