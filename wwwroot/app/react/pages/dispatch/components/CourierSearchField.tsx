import React, {useEffect, useState} from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import type {CourierSuggestion} from '../../../interfaces';

export interface CourierSearchFieldProps {
    onSelect: (courier: CourierSuggestion) => void;
    placeholder?: string;
}

/**
 * Async courier search for the Current Work panel. Wraps the shared
 * `useCourierSearch` hook (which hits `courier/AllActiveSearch`, matching both
 * name and courier code) so picking a courier focuses their work — covering V1
 * `searchCourier` / `onCourierSearchSelect` and the exact-code lookup.
 */
export const CourierSearchField: React.FC<CourierSearchFieldProps> = ({
    onSelect,
    placeholder = 'Search courier by name or code…',
}) => {
    const [input, setInput] = useState('');
    const [debounced, setDebounced] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebounced(input.trim()), 250);
        return () => clearTimeout(t);
    }, [input]);

    const {data: options = [], isFetching} = useCourierSearch(debounced);

    return (
        <Autocomplete<CourierSuggestion, false, false, false>
            size="small"
            options={options}
            loading={isFetching}
            // Server-side search — don't re-filter locally.
            filterOptions={(x) => x}
            getOptionLabel={(o) => o.text}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onInputChange={(_, value) => setInput(value)}
            onChange={(_, value) => {
                if (value) onSelect(value);
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    aria-label="Search courier"
                />
            )}
        />
    );
};
