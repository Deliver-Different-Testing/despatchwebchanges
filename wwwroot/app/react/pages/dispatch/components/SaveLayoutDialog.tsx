/**
 * SaveLayoutDialog - Self-contained dialog for saving dashboard layouts.
 *
 * Owns its own open/name state so DispatchPage doesn't re-render on keystroke.
 */

import React, {forwardRef, useCallback, useImperativeHandle, useState} from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

export interface SaveLayoutDialogHandle {
    open: () => void;
}

interface SaveLayoutDialogProps {
    onSave: (name: string) => void;
}

export const SaveLayoutDialog = forwardRef<SaveLayoutDialogHandle, SaveLayoutDialogProps>(
    function SaveLayoutDialog({onSave}, ref) {
        const [isOpen, setIsOpen] = useState(false);
        const [name, setName] = useState('');

        useImperativeHandle(ref, () => ({
            open: () => {
                setName('');
                setIsOpen(true);
            },
        }));

        const handleSave = useCallback(() => {
            if (name.trim()) {
                onSave(name.trim());
                setIsOpen(false);
            }
        }, [name, onSave]);

        return (
            <Dialog
                open={isOpen}
                onClose={() => setIsOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Save Layout</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Layout name"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                        }}
                        sx={{mt: 1}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!name.trim()}
                        onClick={handleSave}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
