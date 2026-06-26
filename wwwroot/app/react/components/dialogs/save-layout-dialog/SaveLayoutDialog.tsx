/**
 * SaveLayoutDialog Component
 *
 * MUI replacement for the native `window.prompt('Layout name?')` used by the
 * Job Search (v2) toolbar's "Add Layout" action. Purely captures a name —
 * persistence is handled by the caller. Follows the canonical dialog design
 * language (see EditDateTimeDialog).
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';

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
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
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
                    <DashboardCustomizeIcon sx={{fontSize: 24}}/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        {title}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {subtitle}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    aria-label="Close dialog"
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon/>
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500, mb: 1}}>
                            Layout name
                        </Typography>
                        <Paper
                            elevation={0}
                            sx={{
                                bgcolor: 'white',
                                borderRadius: 3,
                                p: 2.5,
                                border: '1px solid',
                                borderColor: 'grey.200',
                            }}
                        >
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
                                sx={{'& .MuiOutlinedInput-root': {bgcolor: 'white'}}}
                            />
                        </Paper>
                    </Box>
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
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    disabled={!isValid}
                    startIcon={<SaveIcon/>}
                    sx={{minWidth: 100}}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveLayoutDialog;
