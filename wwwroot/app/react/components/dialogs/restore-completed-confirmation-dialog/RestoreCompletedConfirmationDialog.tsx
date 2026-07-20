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
import Checkbox from '@mui/material/Checkbox';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';

export interface RestoreCompletedConfirmationDialogProps {
    open: boolean;
    /** How many completed jobs are being restored. Drives the copy. Defaults to 1. */
    count?: number;
    /**
     * Confirms the restore. `removeCapturedImages` reflects the opt-in checkbox — when true, the
     * job's captured photos/signatures are archived (soft-deleted) as part of the restore.
     */
    onConfirm: (removeCapturedImages: boolean) => void | Promise<void>;
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
    const [removeCapturedImages, setRemoveCapturedImages] = React.useState(false);

    // Reset the opt-in each time the dialog reopens so it never carries over from a prior restore.
    React.useEffect(() => {
        if (open) {
            setRemoveCapturedImages(false);
        }
    }, [open]);

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
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Alert severity="warning">
                        {plural
                            ? `${count} of the selected jobs are completed. Restoring them reopens them as new jobs on the dispatch board.`
                            : 'This job is completed. Restoring it reopens it as a new job on the dispatch board.'}
                    </Alert>
                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper',
                        })}
                    >
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={removeCapturedImages}
                                    onChange={(e) => setRemoveCapturedImages(e.target.checked)}
                                    disabled={submitting}
                                    color="warning"
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{fontWeight: 500}}>
                                    {plural
                                        ? 'Also remove the images captured on these jobs'
                                        : 'Also remove the images captured on this job'}
                                </Typography>
                            }
                        />
                        <Typography
                            variant="caption"
                            sx={{color: 'text.secondary', display: 'block', mt: 0.5, ml: 4}}
                        >
                            {removeCapturedImages
                                ? 'Delivery and pickup photos and signatures will be archived and hidden from the job (recoverable).'
                                : 'Captured photos and signatures will be kept on the job.'}
                        </Typography>
                    </Paper>
                </Box>
            </DialogContent>
            <DialogFooter
                onCancel={onClose}
                onConfirm={() => onConfirm(removeCapturedImages)}
                confirmColor="warning"
                confirmIcon={<SettingsBackupRestoreIcon/>}
                confirmLabel={submitting ? 'Restoring…' : 'Restore'}
                submitting={submitting}
            />
        </DialogShell>
    );
};

export default RestoreCompletedConfirmationDialog;
