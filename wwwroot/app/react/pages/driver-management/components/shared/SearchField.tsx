import React, {useCallback, useEffect, useRef, useState} from 'react';
import {IconButton, InputAdornment, TextField} from '@mui/material';
import {Clear as ClearIcon, Search as SearchIcon} from '@mui/icons-material';

interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const DEBOUNCE_DELAY = 300;

export const SearchField: React.FC<SearchFieldProps> = ({value, onChange, placeholder = 'Search...'}) => {
    const [localValue, setLocalValue] = useState(value);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const val = event.target.value;
            setLocalValue(val);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                onChange(val);
            }, DEBOUNCE_DELAY);
        },
        [onChange]
    );

    const handleClear = useCallback(() => {
        setLocalValue('');
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        onChange('');
    }, [onChange]);

    return (
        <TextField
            size="small"
            placeholder={placeholder}
            value={localValue}
            onChange={handleChange}
            sx={{
                minWidth: 200,
                '& .MuiOutlinedInput-root': {bgcolor: 'white'},
            }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon sx={{color: 'text.secondary', fontSize: 20}} />
                    </InputAdornment>
                ),
                endAdornment: localValue ? (
                    <InputAdornment position="end">
                        <IconButton size="small" onClick={handleClear} edge="end">
                            <ClearIcon sx={{fontSize: 18}} />
                        </IconButton>
                    </InputAdornment>
                ) : null,
            }}
        />
    );
};
