/**
 * Reusable confirmation dialog for dispatch operations.
 * Used for offline courier confirmation, chilled job warnings, etc.
 */

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {alpha} from '@mui/material/styles';

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    severity?: 'warning' | 'error' | 'info';
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    severity = 'warning',
}: ConfirmDialogProps) {
    const colorMap = {
        warning: 'warning' as const,
        error: 'error' as const,
        info: 'primary' as const,
    };
    const color = colorMap[severity];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {borderRadius: 2, overflow: 'hidden'},
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
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
                    <WarningAmberIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        {title}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 2,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette[color].main, 0.08),
                        borderLeft: `4px solid ${theme.palette[color].main}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                    })}
                >
                    <WarningAmberIcon sx={(theme) => ({color: theme.palette[color].dark, fontSize: 20})} />
                    <Typography variant="body2" color="text.primary">
                        {message}
                    </Typography>
                </Paper>
            </DialogContent>

            <DialogActions sx={(theme) => ({px: 3, py: 2, bgcolor: 'white', borderTop: `1px solid ${theme.palette.divider}`, gap: 1})}>
                <Button onClick={onClose} variant="outlined">
                    {cancelLabel}
                </Button>
                <Button onClick={onConfirm} variant="contained" color={color}>
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
