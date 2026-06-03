/**
 * React Auto Complete Dialog
 *
 * A modern replacement for the AngularJS auto-complete-dialog using MUI components.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import CloseIcon from '@mui/icons-material/Close';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CheckIcon from '@mui/icons-material/Check';

// Types
export interface Suggestion {
    id: number;
    text: string;
    selected?: boolean;
}

/**
 * 3-way Assign picker — per-type config for the radio row + filtered dropdown.
 * When AutoCompleteDialog receives a non-empty `typeOptions` prop, it renders
 * a radio row above the Autocomplete and routes the search callback through
 * the active option. Submit emits the chosen option's `value` alongside the
 * picked item so the caller knows which target column to write.
 * Steve 2026-05-26, HANDOVER-KEVIN-2026-05-26.md.
 */
export interface AssignTypeOption {
    /** Discriminator returned via onSubmit so the caller routes to the right field. */
    value: string;
    /** Radio label rendered to the operator. */
    label: string;
    /** Placeholder shown inside the search box when this option is active. */
    placeholder: string;
    /** Per-type search backend. Replaces the dialog-level onSearch when active. */
    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
}

export interface AutoCompleteDialogProps {
    open: boolean;
    title: string;
    placeholder: string;
    itemIcon?: string;
    existingItem?: Suggestion;
    showRerateOption?: boolean;
    minInputLength?: number;
    /** When non-empty, renders the Type radio row above the dropdown. */
    typeOptions?: AssignTypeOption[];
    /** Initial radio selection (defaults to the first typeOption when omitted). */
    initialTypeValue?: string;
    onClose: () => void;
    onSubmit: (item: Suggestion, shouldRerate: boolean, selectedType?: string) => void;
    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
}

export const AutoCompleteDialog: React.FC<AutoCompleteDialogProps> = ({
    open,
    title,
    placeholder,
    existingItem,
    showRerateOption = false,
    minInputLength = 1,
    typeOptions,
    initialTypeValue,
    onClose,
    onSubmit,
    onSearch,
}) => {
    const hasTypeOptions = !!(typeOptions && typeOptions.length > 0);
    const defaultTypeValue = initialTypeValue ?? typeOptions?.[0]?.value ?? '';

    const [inputValue, setInputValue] = useState('');
    const [selectedItem, setSelectedItem] = useState<Suggestion | null>(existingItem ?? null);
    const [options, setOptions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [shouldRerate, setShouldRerate] = useState(false);
    const [selectedType, setSelectedType] = useState<string>(defaultTypeValue);

    // Resolve the active search function — when typeOptions is supplied the
    // radio determines which backend the dropdown queries. The dialog-level
    // onSearch is the fallback for non-typed callers (e.g. Client picker).
    const activeSearchFn = hasTypeOptions
        ? (typeOptions!.find((t) => t.value === selectedType)?.onSearch ?? onSearch)
        : onSearch;

    const activePlaceholder = hasTypeOptions
        ? (typeOptions!.find((t) => t.value === selectedType)?.placeholder ?? placeholder)
        : placeholder;

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedItem(existingItem ?? null);
            setInputValue(existingItem?.text ?? '');
            setOptions([]);
            setShouldRerate(false);
            setSelectedType(defaultTypeValue);
        }
    }, [open, existingItem, defaultTypeValue]);

    // Radio change — clear the prior selection so an operator can't accidentally
    // submit a courier id against the agent column or vice versa. The Autocomplete's
    // value/inputValue refresh too. Re-run the active search if the box still has
    // text in it so the new list populates without an extra keystroke.
    const handleTypeChange = useCallback((newType: string) => {
        setSelectedType(newType);
        setSelectedItem(null);
        setInputValue('');
        setOptions([]);
    }, []);

    // Debounced search
    const handleSearch = useCallback(async (searchTerm: string) => {
        if (searchTerm.length < minInputLength) {
            setOptions([]);
            return;
        }

        setLoading(true);
        try {
            const results = await activeSearchFn(searchTerm);
            setOptions(results);
        } catch (error) {
            console.error('Search failed:', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [activeSearchFn, minInputLength]);

    // Debounce the search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (inputValue && inputValue.length >= minInputLength) {
               await handleSearch(inputValue);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue, handleSearch, minInputLength]);

    const handleSubmit = () => {
        if (selectedItem) {
            onSubmit(selectedItem, shouldRerate, hasTypeOptions ? selectedType : undefined);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ManageSearchIcon sx={{fontSize: 28}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>
                        {title}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Search and select an option
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 3,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'white',
                    })}
                >
                    {/* Type radio — only renders when typeOptions is supplied.
                        Steve 2026-05-26: "Add a radio button row above the
                        existing dropdown" for the 3-way Assign picker. */}
                    {hasTypeOptions && (
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 600,
                                    color: 'text.secondary'
                                }}>
                                Type:
                            </Typography>
                            <RadioGroup
                                row
                                value={selectedType}
                                onChange={(e) => handleTypeChange(e.target.value)}
                            >
                                {typeOptions!.map((opt) => (
                                    <FormControlLabel
                                        key={opt.value}
                                        value={opt.value}
                                        control={<Radio size="small" />}
                                        label={opt.label}
                                    />
                                ))}
                            </RadioGroup>
                        </Box>
                    )}

                    <Autocomplete
                        fullWidth
                        autoHighlight
                        autoSelect
                        options={options}
                        loading={loading}
                        value={selectedItem}
                        inputValue={inputValue}
                        getOptionLabel={(option) => option.text}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        onInputChange={(_, newInputValue) => {
                            setInputValue(newInputValue);
                        }}
                        onChange={(_, newValue) => {
                            setSelectedItem(newValue);
                        }}
                        noOptionsText={
                            inputValue.length >= minInputLength ? (
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, py: 1}}>
                                    <SearchOffIcon color="action" />
                                    <Typography sx={{
                                        color: "text.secondary"
                                    }}>
                                        No {title.toLowerCase()} matching "{inputValue}" were found.
                                    </Typography>
                                </Box>
                            ) : (
                                <Typography sx={{
                                    color: "text.secondary"
                                }}>
                                    Type at least {minInputLength} character{minInputLength > 1 ? 's' : ''} to search
                                </Typography>
                            )
                        }
                        renderInput={({slotProps: autoSlotProps, ...params}) => (
                            <TextField
                                {...params}
                                autoFocus
                                placeholder={activePlaceholder}
                                variant="outlined"
                                slotProps={{
                                    ...autoSlotProps,
                                    input: {
                                        ...autoSlotProps.input,
                                        endAdornment: (
                                            <>
                                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
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
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <ManageSearchIcon
                                    sx={(theme) => ({
                                        color: alpha(theme.palette.primary.main, 0.7),
                                        fontSize: 20,
                                    })}
                                />
                                <Typography>{option.text}</Typography>
                            </Box>
                        )}
                    />

                    {/* Re-rate checkbox */}
                    {showRerateOption && (
                        <Box sx={{mt: 2}}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={shouldRerate}
                                        onChange={(e) => setShouldRerate(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Re-Rate Job"
                            />
                        </Box>
                    )}
                </Paper>
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
                <Button onClick={onClose} variant="outlined" sx={{minWidth: 100}}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!selectedItem}
                    startIcon={<CheckIcon />}
                    sx={{minWidth: 100}}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AutoCompleteDialog;
