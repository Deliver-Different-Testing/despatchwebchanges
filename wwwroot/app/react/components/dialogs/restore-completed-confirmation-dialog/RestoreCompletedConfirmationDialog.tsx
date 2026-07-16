/**
 * RestoreCompletedConfirmationDialog
 *
 * Confirms restoring one or more *completed* jobs. Restoring a completed job
 * reopens it as a new job on the dispatch board (its proof of delivery is
 * kept), so this is a cautionary (amber) confirmation rather than a plain one.
 * Shared by the single-job context menu and the bulk job-list action; `count`
 * drives the singular/plural copy.
 */
import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import DialogContent from '@mui/material/DialogContent';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';

export interface RestoreCompletedConfirmationDialogProps {
    open: boolean;
    /** How many completed jobs are being restored. Drives the copy. Defaults to 1. */
    count?: number;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
    /** Shows a spinner on the confirm button and locks the dialog while true. */
    submitting?: boolean;
}

export const RestoreCompletedConfirmationDialog: React.FC<RestoreCompletedConfirmationDialogProps> = ({
    open,
    count = 1,
    onConfirm,
    onClose,
    submitting = false,
}) => {
    const plural = count > 1;

    return (
        <DialogShell open={open} onClose={onClose}>
            <DialogHeader
                variant="warning"
                icon={<SettingsBackupRestoreIcon/>}
                title={plural ? 'Restore completed jobs' : 'Restore completed job'}
                subtitle="Reopens the job on the dispatch board"
                onClose={onClose}
                closeDisabled={submitting}
            />
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3}}>
                    <Alert severity="warning">
                        {plural
                            ? `${count} of the selected jobs are completed. Restoring them reopens them as new jobs on the dispatch board. Their proof of delivery is kept.`
                            : 'This job is completed. Restoring it reopens it as a new job on the dispatch board. Its proof of delivery is kept.'}
                    </Alert>
                </Box>
            </DialogContent>
            <DialogFooter
                onCancel={onClose}
                onConfirm={onConfirm}
                confirmColor="warning"
                confirmIcon={<SettingsBackupRestoreIcon/>}
                confirmLabel={submitting ? 'Restoring…' : 'Restore'}
                submitting={submitting}
            />
        </DialogShell>
    );
};

export default RestoreCompletedConfirmationDialog;
