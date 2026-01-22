/**
 * Save Layout Dialog Component
 *
 * A simple dialog for entering a name when saving a new layout.
 */

import React, {useState, useEffect} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
} from '@mui/material';

export interface SaveLayoutDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    existingNames: string[];
}

export const SaveLayoutDialog: React.FC<SaveLayoutDialogProps> = ({
    open,
    onClose,
    onSave,
    existingNames,
}) => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setName('');
            setError('');
        }
    }, [open]);

    const handleNameChange = (value: string) => {
        setName(value);
        setError('');
    };

    const handleSave = () => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            setError('Please enter a layout name');
            return;
        }

        if (trimmedName.toLowerCase() === 'default') {
            setError('Cannot use "Default" as a layout name');
            return;
        }

        if (existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
            setError('A layout with this name already exists');
            return;
        }

        onSave(trimmedName);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) {
            handleSave();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Save Layout</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Enter a name for your custom layout. You can switch between saved layouts at any time.
                </Typography>
                <TextField
                    autoFocus
                    fullWidth
                    label="Layout Name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    error={!!error}
                    helperText={error}
                    placeholder="e.g., My Custom Layout"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveLayoutDialog;
