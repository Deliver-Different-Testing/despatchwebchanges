import React, {useEffect, useState} from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import {getExactCourierByCode} from '../../../services/courierApi';
import {filterCouriersForNumericSearch} from '../../job-search/lib/searchCriteria';
import type {ShowToastFn} from '../../../services/toastTypes';
import type {CourierSuggestion} from '../../../interfaces';

export interface CourierSearchFieldProps {
    onSelect: (courier: CourierSuggestion) => void;
    placeholder?: string;
    /** Used to warn when a typed code matches no courier (V1 parity). */
    showToast?: ShowToastFn;
}

/**
 * Async courier search for the Current Work panel. Wraps the shared
 * `useCourierSearch` hook (which hits `courier/AllActiveSearch`, matching both
 * name and courier code) so picking a courier focuses their work — covering V1
 * `searchCourier` / `onCourierSearchSelect` and the exact-code lookup.
 *
 * `AllActiveSearch` matches codes as substrings and orders them as text, so
 * typing "78" can list "178" first. Narrowing to the exact code (the same rule
 * the job-search filters use) plus `autoHighlight` restores V1's "type the code,
 * press Enter" flow. When the search has no results at all — a code the substring
 * search missed, or Enter beaten to the punch by the debounce — Enter falls back
 * to the exact-code endpoint V1 used.
 */
export const CourierSearchField: React.FC<CourierSearchFieldProps> = ({
    onSelect,
    placeholder = 'Search courier by name or code…',
    showToast,
}) => {
    const [input, setInput] = useState('');
    const [debounced, setDebounced] = useState('');
    const [lookingUp, setLookingUp] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(input.trim()), 250);
        return () => clearTimeout(t);
    }, [input]);

    const {data: results = [], isFetching} = useCourierSearch(debounced, {minLength: 1});
    // Filter on the live input, not the debounced term, so the exact match is
    // offered as soon as the code is fully typed.
    const options = filterCouriersForNumericSearch(results, input);

    const select = (courier: CourierSuggestion) => {
        onSelect(courier);
        setInput('');
        setDebounced('');
    };

    // Enter is MUI's whenever the dropdown has something to offer — it selects the
    // highlighted option from the Autocomplete root, which sits outside this field, so
    // only take over when the search came back empty.
    const handleKeyDown = async (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' || options.length > 0 || lookingUp) return;
        const code = input.trim();
        if (!code) return;
        event.preventDefault();

        setLookingUp(true);
        try {
            const match = await getExactCourierByCode(code);
            if (match) select(match);
            else showToast?.(`No courier found with code: ${code}`, 'warning');
        } catch {
            // Distinct from "not found" — the code may well exist.
            showToast?.(`Could not look up courier code: ${code}`, 'error');
        } finally {
            setLookingUp(false);
        }
    };

    return (
        <Autocomplete<CourierSuggestion, false, false, false>
            size="small"
            options={options}
            loading={isFetching || lookingUp}
            autoHighlight
            // A search box, not a value picker: the picked courier shows up as the job
            // list below, and the field clears ready for the next code (V1 parity).
            value={null}
            inputValue={input}
            // Server-side search — don't re-filter locally.
            filterOptions={(x) => x}
            getOptionLabel={(o) => o.text}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onInputChange={(_, value) => setInput(value)}
            onChange={(_, value) => {
                if (value) select(value);
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    aria-label="Search courier"
                    onKeyDown={handleKeyDown}
                />
            )}
        />
    );
};
