/**
 * TextInputDialog - Small MUI dialog for editing text fields
 *
 * Replaces $mdDialog.prompt() for editing text fields like
 * RefA, RefB, POD name, weight, tracking mobile/email, etc.
 */

import React, {useState, useEffect, useRef} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

export interface TextInputDialogProps {
    open: boolean;
    title: string;
    placeholder: string;
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
    placeholder,
    initialValue,
    okLabel = 'Save',
    cancelLabel = 'Cancel',
    required = true,
    onSubmit,
    onCancel,
}: TextInputDialogProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setValue(initialValue);
        }
    }, [open, initialValue]);

    // Auto-focus input when dialog opens
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const handleSubmit = () => {
        if (required && !value.trim()) return;
        onSubmit(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="xs"
            fullWidth
            slotProps={{
                paper: {sx: {borderRadius: 2}},
            }}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <TextField
                    inputRef={inputRef}
                    fullWidth
                    variant="outlined"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    size="small"
                    sx={{mt: 1}}
                    error={required && !value.trim()}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} color="inherit">
                    {cancelLabel}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={required && !value.trim()}
                >
                    {okLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
