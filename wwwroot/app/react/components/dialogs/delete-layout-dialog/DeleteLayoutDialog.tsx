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
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';

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
        <DialogShell open={open} onClose={onClose}>
            <DialogHeader
                variant="error"
                icon={<DeleteIcon/>}
                title="Delete Layout"
                subtitle={layoutName}
                onClose={onClose}
            />

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

            <DialogFooter
                onCancel={onClose}
                onConfirm={onConfirm}
                confirmLabel="Delete"
                confirmColor="error"
                confirmIcon={<DeleteIcon/>}
            />
        </DialogShell>
    );
};

export default DeleteLayoutDialog;
