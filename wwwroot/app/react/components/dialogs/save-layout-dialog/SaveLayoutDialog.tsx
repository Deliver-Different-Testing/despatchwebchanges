/**
 * SaveLayoutDialog Component
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import SaveIcon from '@mui/icons-material/Save';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx, sectionLabelSx, dialogFieldSx} from '../shared';

export interface SaveLayoutDialogProps {
    open: boolean;
    /** Existing layout names — used to reject duplicates (case-insensitive). */
    existingNames: string[];
    onClose: () => void;
    /** Called with the trimmed, validated layout name. */
    onConfirm: (name: string) => void;
    /** Pre-fill the name field (e.g. when renaming an existing layout). */
    initialName?: string;
    /** Header title. Defaults to "Save Layout". */
    title?: string;
    /** Header subtitle. */
    subtitle?: string;
    /** Primary action label. Defaults to "Add Layout". */
    confirmLabel?: string;
}

export const SaveLayoutDialog: React.FC<SaveLayoutDialogProps> = ({
    open,
    existingNames,
    onClose,
    onConfirm,
    initialName = '',
    title = 'Save Layout',
    subtitle = 'Name the current arrangement to save it',
    confirmLabel = 'Add Layout',
}) => {
    const [name, setName] = useState(initialName);

    // Reset the field to the initial value each time the dialog opens.
    useEffect(() => {
        if (open) setName(initialName);
    }, [open, initialName]);

    const trimmed = name.trim();
    const normalizedExisting = useMemo(
        () => new Set(existingNames.map(n => n.trim().toLowerCase())),
        [existingNames],
    );
    const isDuplicate = trimmed.length > 0 && normalizedExisting.has(trimmed.toLowerCase());
    const isValid = trimmed.length > 0 && !isDuplicate;

    const helperText = isDuplicate
        ? 'A layout with this name already exists.'
        : ' ';

    const handleConfirm = useCallback(() => {
        if (!isValid) return;
        onConfirm(trimmed);
    }, [isValid, trimmed, onConfirm]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    }, [handleConfirm]);

    return (
        <DialogShell open={open} onClose={onClose}>
            <DialogHeader
                icon={<DashboardCustomizeIcon/>}
                title={title}
                subtitle={subtitle}
                onClose={onClose}
            />

            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Box>
                        <Typography variant="body2" sx={sectionLabelSx}>
                            Layout name
                        </Typography>
                        <Paper elevation={0} sx={sectionPaperSx}>
                            <TextField
                                size="small"
                                fullWidth
                                autoFocus
                                label="Layout name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                error={isDuplicate}
                                helperText={helperText}
                                slotProps={{htmlInput: {maxLength: 50}}}
                                sx={dialogFieldSx}
                            />
                        </Paper>
                    </Box>
                </Box>
            </DialogContent>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleConfirm}
                confirmLabel={confirmLabel}
                confirmIcon={<SaveIcon/>}
                confirmDisabled={!isValid}
            />
        </DialogShell>
    );
};

export default SaveLayoutDialog;
