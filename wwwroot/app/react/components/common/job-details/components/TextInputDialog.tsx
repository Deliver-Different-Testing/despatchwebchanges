/**
 * TextInputDialog - Small MUI dialog for editing text fields
 *
 * Replaces $mdDialog.prompt() for editing text fields like
 * RefA, RefB, POD name, weight, tracking mobile/email, etc.
 */

import React, {useState, useEffect} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

export interface TextInputDialogProps {
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    okLabel?: string;
    cancelLabel?: string;
    required?: boolean;
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
    onSubmit,
    onCancel,
}: TextInputDialogProps) {
    const [value, setValue] = useState(initialValue);
    const isEmpty = required && !value.trim();

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

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>{title}</DialogTitle>
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
