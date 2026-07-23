/**
 * TextInputDialog - Small MUI dialog for editing text fields
 *
 * Replaces $mdDialog.prompt() for editing text fields like
 * RefA, RefB, POD name, weight, tracking mobile/email, etc.
 */

import React, {useState, useEffect} from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../../../dialogs/shared/styles';

export interface TextInputDialogProps {
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    okLabel?: string;
    cancelLabel?: string;
    required?: boolean;
    /** When true a "Clear" action is shown that submits an empty value to remove the field. */
    allowClear?: boolean;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}

export function TextInputDialog({
    open,
    title,
    label,
    initialValue,
    okLabel = 'Save',
    cancelLabel = 'Cancel',
    required = true,
    allowClear = false,
    onSubmit,
    onCancel,
}: TextInputDialogProps) {
    const [value, setValue] = useState(initialValue);
    const isEmpty = required && !value.trim();
    // Only offer Clear when there is a value to remove.
    const canClear = allowClear && !!value.trim();

    useEffect(() => {
        if (open) {
            setValue(initialValue);
        }
    }, [open, initialValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEmpty) return;
        onSubmit(value);
    };

    // Clear submits an empty value, bypassing the required check, so the
    // field is removed rather than updated.
    const handleClear = () => {
        onSubmit('');
    };

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <Box
                sx={(theme) => headerChromeSx(theme)}
            >
                <Box sx={(theme) => headerChipSx(theme)}>
                    <EditIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>{title}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>Update the field value</Typography>
                </Box>
                <IconButton onClick={onCancel} sx={(theme) => ({
                    color: headerOnColor(theme),
                    '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                })}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label={label}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        margin="dense"
                        error={isEmpty}
                        helperText={isEmpty ? 'This field is required' : ' '}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    {canClear && (
                        <Button
                            onClick={handleClear}
                            variant="outlined"
                            color="error"
                        >
                            Clear
                        </Button>
                    )}
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isEmpty}
                    >
                        {okLabel}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
