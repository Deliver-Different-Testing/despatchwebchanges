/**
 * ChipsAutocomplete Component
 *
 * Reusable multi-select chip input with async autocomplete search.
 * Used for Clients, Couriers, and Speeds filters in the search criteria panel.
 *
 * Built on Mantine's `MultiSelect` rather than `TagsInput`: the options come from
 * a server search and carry an `id`, so this is a pick-from-results control, not
 * free-form tagging. `MultiSelect` speaks strings, so ids are stringified on the
 * way in and resolved back to `ISuggestion` on the way out.
 */

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {Loader, MultiSelect} from '@mantine/core';
import {useDebouncedValue} from '@mantine/hooks';
import {ISuggestion} from '../../../../interfaces/job.interface';

export interface ChipsAutocompleteProps {
    label: string;
    placeholder: string;
    value: ISuggestion[];
    minInputLength: number;
    onSearch: (searchText: string) => Promise<ISuggestion[]>;
    onChange: (items: ISuggestion[]) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export const ChipsAutocomplete: React.FC<ChipsAutocompleteProps> = ({
    label,
    placeholder,
    value,
    minInputLength,
    onSearch,
    onChange,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<ISuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedInput] = useDebouncedValue(inputValue, SEARCH_DEBOUNCE_MS);

    // Every suggestion this component has seen, so a selected item keeps its
    // label after the search that produced it is cleared.
    const knownRef = useRef(new Map<string, ISuggestion>());
    for (const item of [...value, ...options]) {
        knownRef.current.set(String(item.id), item);
    }

    useEffect(() => {
        if (!debouncedInput || debouncedInput.length < minInputLength) {
            setOptions([]);
            return undefined;
        }

        // The debounce hook has no teardown of its own, so this guards against a
        // slow request resolving after a newer one (or after unmount).
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const results = await onSearch(debouncedInput);
                if (cancelled) return;
                // Filter out already-selected items
                const selectedIds = new Set(value.map(v => v.id));
                setOptions(results.filter(r => !selectedIds.has(r.id)));
            } catch (error) {
                if (cancelled) return;
                console.error('ChipsAutocomplete search failed:', error);
                setOptions([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [debouncedInput, minInputLength, onSearch, value]);

    const selectedValues = useMemo(() => value.map(v => String(v.id)), [value]);

    const data = useMemo(() => {
        const seen = new Set<string>();
        return [...value, ...options]
            .filter(item => {
                const key = String(item.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map(item => ({value: String(item.id), label: item.text}));
    }, [value, options]);

    const handleChange = useCallback((ids: string[]) => {
        onChange(ids.map(id => knownRef.current.get(id)).filter((s): s is ISuggestion => s != null));
    }, [onChange]);

    const nothingFound = inputValue.length >= minInputLength
        ? `No ${label.toLowerCase()} found`
        : `Type at least ${minInputLength} character${minInputLength > 1 ? 's' : ''} to search`;

    return (
        <MultiSelect
            size="xs"
            searchable
            // Already-selected items are not offered again, matching the previous
            // Autocomplete's behaviour.
            hidePickedOptions
            data={data}
            value={selectedValues}
            onChange={handleChange}
            searchValue={inputValue}
            onSearchChange={setInputValue}
            placeholder={value.length === 0 ? placeholder : ''}
            nothingFoundMessage={nothingFound}
            // Mantine's Loader carries no implicit role; this one is a genuine
            // indeterminate busy indicator for the in-flight search.
            rightSection={
                loading ? <Loader size={18} role="progressbar" aria-label={`Searching ${label.toLowerCase()}`} /> : undefined
            }
            // The results are already filtered server-side (and de-selected above),
            // so the built-in substring filter would only hide valid matches.
            filter={({options: opts}) => opts}
        />
    );
};

export default ChipsAutocomplete;
