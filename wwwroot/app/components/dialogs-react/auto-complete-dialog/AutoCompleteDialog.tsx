/**
 * React Auto Complete Dialog
 *
 * A modern replacement for the AngularJS auto-complete-dialog using MUI components.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    Autocomplete,
    Checkbox,
    FormControlLabel,
    CircularProgress,
    Paper,
    alpha,
} from '@mui/material';
import {
    Close as CloseIcon,
    ManageSearch as ManageSearchIcon,
    SearchOff as SearchOffIcon,
    Check as CheckIcon,
} from '@mui/icons-material';

// Types
export interface Suggestion {
    id: number;
    text: string;
    selected?: boolean;
}

export interface AutoCompleteDialogProps {
    open: boolean;
    title: string;
    placeholder: string;
    itemIcon?: string;
    existingItem?: Suggestion;
    showRerateOption?: boolean;
    minInputLength?: number;
    onClose: () => void;
    onSubmit: (item: Suggestion, shouldRerate: boolean) => void;
    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
}

export const AutoCompleteDialog: React.FC<AutoCompleteDialogProps> = ({
    open,
    title,
    placeholder,
    existingItem,
    showRerateOption = false,
    minInputLength = 1,
    onClose,
    onSubmit,
    onSearch,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [selectedItem, setSelectedItem] = useState<Suggestion | null>(existingItem ?? null);
    const [options, setOptions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [shouldRerate, setShouldRerate] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedItem(existingItem ?? null);
            setInputValue(existingItem?.text ?? '');
            setOptions([]);
            setShouldRerate(false);
        }
    }, [open, existingItem]);

    // Debounced search
    const handleSearch = useCallback(async (searchTerm: string) => {
        if (searchTerm.length < minInputLength) {
            setOptions([]);
            return;
        }

        setLoading(true);
        try {
            const results = await onSearch(searchTerm);
            setOptions(results);
        } catch (error) {
            console.error('Search failed:', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [onSearch, minInputLength]);

    // Debounce the search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputValue && inputValue.length >= minInputLength) {
                handleSearch(inputValue);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue, handleSearch, minInputLength]);

    const handleSubmit = () => {
        if (selectedItem) {
            onSubmit(selectedItem, shouldRerate);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                elevation: 24,
                sx: {
                    borderRadius: 3,
                    overflow: 'hidden',
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
                    <Typography variant="h5" fontWeight={600}>
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
            <DialogContent sx={{p: 3, bgcolor: '#fafafa'}}>
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 3,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'white',
                    })}
                >
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
                                    <Typography color="text.secondary">
                                        No {title.toLowerCase()} matching "{inputValue}" were found.
                                    </Typography>
                                </Box>
                            ) : (
                                <Typography color="text.secondary">
                                    Type at least {minInputLength} character{minInputLength > 1 ? 's' : ''} to search
                                </Typography>
                            )
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                placeholder={placeholder}
                                variant="outlined"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
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
