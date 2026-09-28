/**
 * SelectDialog Component
 *
 * React replacement for the AngularJS select-dialog.
 * Presents a dropdown selection with optional warning message and checkbox.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CloseIcon from '@mui/icons-material/Close';

import { SelectDialogProps, SelectDialogResult, SelectDialogItem } from './types';

export const SelectDialog: React.FC<SelectDialogProps> = ({
    open,
    title,
    fieldName,
    items,
    initialValue,
    warningMessage,
    showCheckbox = false,
    checkboxLabel = '',
    onClose,
    onSubmit,
    showToast,
}) => {
    const [selectedItem, setSelectedItem] = useState<SelectDialogItem | null>(null);
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setCheckboxValue(false);
            setIsLoading(false);

            if (initialValue != null && items.length > 0) {
                const found = items.find(
                    item => item.text === initialValue || item.id === initialValue
                ) ?? null;
                setSelectedItem(found);
            } else {
                setSelectedItem(null);
            }
        }
    }, [open, initialValue, items]);

    const handleSelectChange = useCallback((event: { target: { value: unknown } }) => {
        const id = event.target.value as number;
        const item = items.find(i => i.id === id) ?? null;
        setSelectedItem(item);
    }, [items]);

    const handleSubmit = useCallback(async () => {
        if (!selectedItem) {
            showToast('Please select an option', 'warning');
            return;
        }

        try {
            setIsLoading(true);

            const result: SelectDialogResult = {
                fieldName,
                value: selectedItem.id,
                checkboxValue: showCheckbox ? checkboxValue : undefined,
            };

            await onSubmit(result);
        } catch (error: unknown) {
            console.error('Error submitting selection:', error);
            showToast(error instanceof Error ? error.message : 'Failed to save selection', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedItem, fieldName, showCheckbox, checkboxValue, onSubmit, showToast]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            disableEnforceFocus
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: 480,
                        maxWidth: 600,
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
                    <ChecklistIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                        Edit {title}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Select an option from the list
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isLoading}
                    sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Select Dropdown */}
                    <FormControl fullWidth>
                        <InputLabel id="select-dialog-label">{title}</InputLabel>
                        <Select
                            labelId="select-dialog-label"
                            value={selectedItem?.id ?? ''}
                            onChange={handleSelectChange}
                            label={title}
                            disabled={isLoading}
                            sx={{ bgcolor: 'white' }}
                        >
                            {items.map(item => (
                                <MenuItem key={item.id} value={item.id}>
                                    {item.text}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Warning Message */}
                    {warningMessage && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            {warningMessage}
                        </Alert>
                    )}

                    {/* Checkbox */}
                    {showCheckbox && (
                        <>
                            <Divider />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={checkboxValue}
                                        onChange={(e) => setCheckboxValue(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                }
                                label={checkboxLabel}
                            />
                        </>
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
                <Button
                    onClick={onClose}
                    variant="outlined"
                    disabled={isLoading}
                    sx={{ minWidth: 100 }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    color="primary"
                    disabled={isLoading || !selectedItem}
                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ minWidth: 100 }}
                >
                    {isLoading ? 'Saving...' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SelectDialog;
