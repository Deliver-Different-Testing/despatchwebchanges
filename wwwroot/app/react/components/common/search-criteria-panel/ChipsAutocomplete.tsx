/**
 * ChipsAutocomplete Component
 *
 * Reusable multi-select chip input with async autocomplete search.
 * Used for Clients, Couriers, and Speeds filters in the search criteria panel.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {Autocomplete, Chip, TextField, CircularProgress} from '@mui/material';
import {ISuggestion} from '../../../../interfaces/job.interface';

export interface ChipsAutocompleteProps {
    label: string;
    placeholder: string;
    value: ISuggestion[];
    minInputLength: number;
    onSearch: (searchText: string) => Promise<ISuggestion[]>;
    onChange: (items: ISuggestion[]) => void;
}

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

    // Debounced search
    useEffect(() => {
        if (!inputValue || inputValue.length < minInputLength) {
            setOptions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const results = await onSearch(inputValue);
                // Filter out already-selected items
                const selectedIds = new Set(value.map(v => v.id));
                setOptions(results.filter(r => !selectedIds.has(r.id)));
            } catch (error) {
                console.error('ChipsAutocomplete search failed:', error);
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue, minInputLength, onSearch, value]);

    const handleChange = useCallback((_event: React.SyntheticEvent, newValue: ISuggestion[]) => {
        onChange(newValue);
    }, [onChange]);

    return (
        <Autocomplete
            multiple
            size="small"
            options={options}
            loading={loading}
            value={value}
            inputValue={inputValue}
            getOptionLabel={(option) => option.text}
            isOptionEqualToValue={(option, val) => option.id === val.id}
            onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
            onChange={handleChange}
            noOptionsText={
                inputValue.length >= minInputLength
                    ? `No ${label.toLowerCase()} found`
                    : `Type at least ${minInputLength} character${minInputLength > 1 ? 's' : ''} to search`
            }
            renderTags={(tagValue, getTagProps) =>
                tagValue.map((option, index) => {
                    const {key, ...chipProps} = getTagProps({index});
                    return (
                        <Chip
                            key={key}
                            label={option.text}
                            size="small"
                            {...chipProps}
                            sx={{
                                height: 22,
                                fontSize: '0.75rem',
                                bgcolor: 'rgba(0, 0, 0, 0.08)',
                            }}
                        />
                    );
                })
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={value.length === 0 ? placeholder : ''}
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={18} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
            sx={{
                '& .MuiOutlinedInput-root': {
                    minHeight: 34,
                    padding: '2px 10px',
                    bgcolor: 'background.paper',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.12)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.3)',
                    },
                },
            }}
        />
    );
};

export default ChipsAutocomplete;
