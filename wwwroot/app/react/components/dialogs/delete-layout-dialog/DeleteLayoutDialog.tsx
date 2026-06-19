/**
 * DeleteLayoutDialog Component
 *
 * MUI replacement for the native `window.confirm('Delete layout ...?')` used by
 * the Job Search (v2) toolbar's per-layout delete action. Purely confirms the
 * intent — removal/persistence is handled by the caller. Follows the canonical
 * destructive-dialog design language (error palette; see VoidJobConfirmationDialog).
 */

import React from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';

export interface DeleteLayoutDialogProps {
    open: boolean;
    /** Name of the layout being deleted — shown in the header and body. */
    layoutName: string;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteLayoutDialog: React.FC<DeleteLayoutDialogProps> = ({
    open,
    layoutName,
    onClose,
    onConfirm,
}) => {
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
                    background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
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
                    <DeleteIcon sx={{fontSize: 24}}/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        Delete Layout
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {layoutName}
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
                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.warning.main, 0.08),
                            borderLeft: `4px solid ${theme.palette.warning.main}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                        })}
                    >
                        <WarningIcon sx={(theme) => ({color: theme.palette.warning.dark, fontSize: 20})}/>
                        <Typography variant="body2" sx={{color: 'text.primary'}}>
                            You are about to delete the layout <strong>{layoutName}</strong>. This cannot be undone, and you&apos;ll be switched back to the Default layout.
                        </Typography>
                    </Paper>
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
                    onClick={onConfirm}
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon/>}
                    sx={{minWidth: 100}}
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteLayoutDialog;
