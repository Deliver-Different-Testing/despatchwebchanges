/**
 * SelectDialog Component
 *
 * React replacement for the AngularJS select-dialog.
 * Presents a dropdown selection with optional warning message and checkbox.
 */

import React, { useState, useEffect, useCallback } from 'react';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ChecklistIcon from '@mui/icons-material/Checklist';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';

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
                text: selectedItem.text,
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
        <DialogShell open={open} onClose={onClose} disableEnforceFocus>
            <DialogHeader
                icon={<ChecklistIcon/>}
                title={`Edit ${title}`}
                subtitle="Select an option from the list"
                onClose={onClose}
                closeDisabled={isLoading}
            />
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
                            sx={{ bgcolor: 'background.paper' }}
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
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSubmit}
                confirmLabel={isLoading ? 'Saving...' : 'Save'}
                confirmDisabled={!selectedItem}
                submitting={isLoading}
            />
        </DialogShell>
    );
};

export default SelectDialog;
