/**
 * RestoreConfirmationDialog
 *
 * Confirms a restore that would cost the job something it can't get back. Restoring reopens the
 * job as a new job on the dispatch board and always clears its POD name (the board view excludes
 * any job that still carries one); the captured photos and signatures are only archived when the
 * operator opts in. Shared by the job-list context menu, the bulk job-list action, the job-search
 * page and the AngularJS job-search FAB.
 */
import React from 'react';
import {Alert, Box, Button, Checkbox, Paper, Stack, Text} from '@mantine/core';
import {ArrowLeftRight, History} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg, sectionPaperProps} from '../shared/mantine';

export interface RestorePodImpactSummary {
    /** How many of the jobs being restored carry a POD name. */
    jobsWithPodName: number;
    /** The POD name itself, when exactly one job is being restored. */
    podName?: string | null;
    /** Total captured photos/signatures across the jobs, or null when the count couldn't be established. */
    imageCount: number | null;
}

export interface RestoreConfirmationDialogProps {
    open: boolean;
    /** How many of the jobs being restored are completed. Drives the reopen warning. Defaults to 1. */
    count?: number;
    /**
     * What the restore would destroy. Omitted when the caller couldn't check, in which case the
     * dialog keeps the generic image opt-in and says nothing about the POD name.
     */
    podImpact?: RestorePodImpactSummary;
    /**
     * Confirms the restore. `removeCapturedImages` reflects the opt-in checkbox — when true, the
     * job's captured photos/signatures are archived (soft-deleted) as part of the restore.
     */
    onConfirm: (removeCapturedImages: boolean) => void | Promise<void>;
    /**
     * Opens Swap POD instead of restoring — the way to move a POD onto another job rather than
     * lose it. Omitted for bulk restores, where there is no single job to swap.
     */
    onSwapPod?: () => void | Promise<void>;
    onClose: () => void;
    /** Shows a spinner on the confirm button and locks the dialog while true. */
    submitting?: boolean;
}

export const RestoreConfirmationDialog: React.FC<RestoreConfirmationDialogProps> = ({
    open,
    count = 1,
    podImpact,
    onConfirm,
    onSwapPod,
    onClose,
    submitting = false,
}) => {
    const jobsWithPodName = podImpact?.jobsWithPodName ?? 0;
    const imageCount = podImpact ? podImpact.imageCount : null;
    const plural = count > 1 || jobsWithPodName > 1;
    const showImageOptIn = imageCount !== 0;

    const [removeCapturedImages, setRemoveCapturedImages] = React.useState(false);

    // Reset the opt-in each time the dialog reopens so it never carries over from a prior restore.
    React.useEffect(() => {
        if (open) {
            setRemoveCapturedImages(false);
        }
    }, [open]);

    const title = count > 0
        ? (plural ? 'Restore completed jobs' : 'Restore completed job')
        : (plural ? 'Restore jobs' : 'Restore job');

    // Restoring always nulls the POD name and completion time; the captured imagery only goes if
    // the operator opts in below. Swap POD is the way to keep a POD by moving it to another job.
    const podWarning = plural
        ? `This clears the proof of delivery — delivery time and POD name — on ${jobsWithPodName} of the selected jobs.`
        : `This clears the POD — delivery time and name${podImpact?.podName ? ` “${podImpact.podName}”` : ''}. To move a POD to another job, use Swap POD instead.`;

    const imageOptInLabel = imageCount === null
        ? (plural ? 'Also remove the images captured on these jobs' : 'Also remove the images captured on this job')
        : `Also remove the ${imageCount} ${imageCount === 1 ? 'image' : 'images'} captured on ${plural ? 'these jobs' : 'this job'}`;

    return (
        <DialogShell opened={open} onClose={onClose} label={title}>
            <DialogHeader
                variant="warning"
                icon={<Icon lucide={History}/>}
                title={title}
                subtitle={plural ? 'Reopens the jobs on the dispatch board' : 'Reopens the job on the dispatch board'}
                onClose={onClose}
                closeDisabled={submitting}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="md">
                    {count > 0 && (
                        <Alert color="orange" variant="light">
                            {plural
                                ? `${count} of the selected jobs are completed. Restoring them reopens them as new jobs on the dispatch board.`
                                : 'This job is completed. Restoring it reopens it as a new job on the dispatch board.'}
                        </Alert>
                    )}
                    {jobsWithPodName > 0 && (
                        <Alert color="red" variant="light">
                            {podWarning}
                        </Alert>
                    )}
                    {showImageOptIn && (
                        <Paper {...sectionPaperProps}>
                            <Checkbox
                                color="orange"
                                checked={removeCapturedImages}
                                onChange={(e) => setRemoveCapturedImages(e.currentTarget.checked)}
                                disabled={submitting}
                                label={
                                    <Text size="sm" fw={500}>
                                        {imageOptInLabel}
                                    </Text>
                                }
                            />
                            <Text size="xs" c="dimmed" mt={4} ml={32}>
                                {removeCapturedImages
                                    ? 'Delivery and pickup photos and signatures will be archived and hidden from the job (recoverable).'
                                    : 'Captured photos and signatures will be kept on the job.'}
                            </Text>
                        </Paper>
                    )}
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onClose}
                secondaryAction={onSwapPod && (
                    <Button
                        variant="default"
                        disabled={submitting}
                        leftSection={<Icon lucide={ArrowLeftRight} size={16}/>}
                        onClick={() => void onSwapPod()}
                    >
                        Swap POD
                    </Button>
                )}
                onConfirm={() => onConfirm(showImageOptIn && removeCapturedImages)}
                confirmColor="orange"
                confirmIcon={<Icon lucide={History} size={16}/>}
                confirmLabel={submitting ? 'Restoring…' : 'Restore'}
                submitting={submitting}
            />
        </DialogShell>
    );
};

export default RestoreConfirmationDialog;
