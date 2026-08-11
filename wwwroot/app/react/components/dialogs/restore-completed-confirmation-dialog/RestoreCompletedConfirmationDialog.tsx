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
import {Alert, Box, Checkbox, Paper, Stack, Text} from '@mantine/core';
import {History} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg, sectionPaperProps} from '../shared/mantine';

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
        <DialogShell
            opened={open}
            onClose={onClose}
            label={plural ? 'Restore completed jobs' : 'Restore completed job'}
        >
            <DialogHeader
                variant="warning"
                icon={<Icon lucide={History}/>}
                title={plural ? 'Restore completed jobs' : 'Restore completed job'}
                subtitle="Reopens the job on the dispatch board"
                onClose={onClose}
                closeDisabled={submitting}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="md">
                    <Alert color="orange" variant="light">
                        {plural
                            ? `${count} of the selected jobs are completed. Restoring them reopens them as new jobs on the dispatch board.`
                            : 'This job is completed. Restoring it reopens it as a new job on the dispatch board.'}
                    </Alert>
                    <Paper {...sectionPaperProps}>
                        <Checkbox
                            color="orange"
                            checked={removeCapturedImages}
                            onChange={(e) => setRemoveCapturedImages(e.currentTarget.checked)}
                            disabled={submitting}
                            label={
                                <Text size="sm" fw={500}>
                                    {plural
                                        ? 'Also remove the images captured on these jobs'
                                        : 'Also remove the images captured on this job'}
                                </Text>
                            }
                        />
                        <Text size="xs" c="dimmed" mt={4} ml={32}>
                            {removeCapturedImages
                                ? 'Delivery and pickup photos and signatures will be archived and hidden from the job (recoverable).'
                                : 'Captured photos and signatures will be kept on the job.'}
                        </Text>
                    </Paper>
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onClose}
                onConfirm={() => onConfirm(removeCapturedImages)}
                confirmColor="orange"
                confirmIcon={<Icon lucide={History} size={16}/>}
                confirmLabel={submitting ? 'Restoring…' : 'Restore'}
                submitting={submitting}
            />
        </DialogShell>
    );
};

export default RestoreCompletedConfirmationDialog;
