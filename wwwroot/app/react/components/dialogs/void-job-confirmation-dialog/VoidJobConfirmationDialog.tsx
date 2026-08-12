/**
 * React Void Job Confirmation Dialog (DFRNT / Mantine)
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {Alert, Badge, Box, Button, Checkbox, Group, Loader, Paper, Stack, Switch, Text, Textarea} from '@mantine/core';
import {Info, Trash2, TriangleAlert} from 'lucide-react';
import {Icon, UI_ICON_SIZE} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';
import {RelatedJob, VoidJobDialogJob, VoidJobResult} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';

// Re-export types for backward compatibility
export type {RelatedJob, VoidJobDialogJob, VoidJobResult};

export interface VoidJobConfirmationDialogProps {
    open: boolean;
    job: VoidJobDialogJob | null;
    onClose: () => void;
    onConfirm: (result: VoidJobResult) => void;
    onLoadRelatedJobs: (jobId: number, isArchived: boolean, isBulkJob: boolean) => Promise<RelatedJob[]>;
    onVoidJob: (jobId: number, voidSingleJobOnly: boolean, voidReason: string, selectedJobIds?: number[]) => Promise<void>;
    onVoidBulkJob: (bulkJobId: number, voidSingleJobOnly: boolean, voidReason: string, selectedJobIds?: number[]) => Promise<void>;
    showToast: ShowToastFn;
}

export const VoidJobConfirmationDialog: React.FC<VoidJobConfirmationDialogProps> = ({
    open,
    job,
    onClose,
    onConfirm,
    onLoadRelatedJobs,
    onVoidJob,
    onVoidBulkJob,
    showToast,
}) => {
    const [voidReasonText, setVoidReasonText] = useState('');
    const [voidSingleJobOnly, setVoidSingleJobOnly] = useState(true);
    const [relatedJobs, setRelatedJobs] = useState<RelatedJob[]>([]);
    const [isLoadingRelatedJobs, setIsLoadingRelatedJobs] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setVoidReasonText('');
            setVoidSingleJobOnly(true);
            setRelatedJobs([]);
            setIsLoadingRelatedJobs(false);
            setIsSubmitting(false);
        }
    }, [open]);

    const selectedCount = useMemo(() => relatedJobs.filter(j => j.selected).length, [relatedJobs]);
    const selectedJobIds = useMemo(() => relatedJobs.filter(j => j.selected).map(j => j.id), [relatedJobs]);

    const isConfirmDisabled = useMemo(() => (
        !voidReasonText ||
        voidReasonText.trim().length === 0 ||
        (!voidSingleJobOnly && selectedCount === 0) ||
        isSubmitting
    ), [voidReasonText, voidSingleJobOnly, selectedCount, isSubmitting]);

    const confirmButtonText = useMemo(() => {
        if (voidSingleJobOnly) return 'Void Job';
        return `Void ${selectedCount} Job${selectedCount !== 1 ? 's' : ''}`;
    }, [voidSingleJobOnly, selectedCount]);

    const handleReasonChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
        setVoidReasonText(event.target.value);
    };

    const handleToggleMultiVoid = useCallback(async (checked: boolean): Promise<void> => {
        setVoidSingleJobOnly(checked);

        if (!checked && relatedJobs.length === 0 && job) {
            setIsLoadingRelatedJobs(true);
            try {
                const jobs = await onLoadRelatedJobs(job.id, job.isArchived ?? false, job.isBulkJob);
                setRelatedJobs(jobs);
            } catch (error) {
                console.error('Error loading related jobs:', error);
                showToast('Failed to load related jobs.', 'error');
                setRelatedJobs([]);
            } finally {
                setIsLoadingRelatedJobs(false);
            }
        }
    }, [relatedJobs.length, job, onLoadRelatedJobs, showToast]);

    // Checkbox.Group reports the whole selection as string values, so every
    // selection change — including Select/Deselect All — is the same setter.
    const setSelectedJobIds = (ids: string[]): void => {
        setRelatedJobs(prev => prev.map(j => ({...j, selected: ids.includes(String(j.id))})));
    };

    const selectAllJobs = (): void => {
        setRelatedJobs(prev => prev.map(j => ({...j, selected: true})));
    };

    const deselectAllJobs = (): void => {
        setRelatedJobs(prev => prev.map(j => ({...j, selected: false})));
    };

    const handleConfirm = async (): Promise<void> => {
        if (!job) return;

        if (!voidReasonText || voidReasonText.trim() === '') {
            showToast('Please enter a reason for voiding this job.', 'warning');
            return;
        }

        const jobIds = voidSingleJobOnly ? undefined : selectedJobIds;

        if (!voidSingleJobOnly && (!jobIds || jobIds.length === 0)) {
            showToast('Please select at least one job to void.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            if (job.isBulkJob) {
                await onVoidBulkJob(job.id, voidSingleJobOnly, voidReasonText, jobIds);
            } else {
                await onVoidJob(job.id, voidSingleJobOnly, voidReasonText, jobIds);
            }

            const voidedCount = voidSingleJobOnly ? 1 : jobIds?.length ?? 1;
            const message = voidedCount === 1
                ? `${job.jobNo} has been voided successfully.`
                : `${voidedCount} jobs have been voided successfully.`;

            showToast(message, 'success');
            onConfirm({success: true, voidedCount});
        } catch {
            showToast('An error occurred while voiding the job. Please try again later.', 'error');
            setIsSubmitting(false);
        }
    };

    if (!job) return null;

    return (
        <DialogShell opened={open} onClose={onClose}>
            <DialogHeader
                variant="error"
                icon={<Icon lucide={Trash2}/>}
                title={`Void ${job.jobNo}`}
                subtitle="Permanently cancel this job"
                onClose={onClose}
                closeDisabled={isSubmitting}
            />

            <Stack p="lg" gap="md" bg={dialogContentBg}>
                {/* Warning */}
                <Alert variant="light" color="orange" icon={<Icon lucide={TriangleAlert}/>}>
                    You are about to void job <strong>#{job.jobNo}</strong>.
                </Alert>

                {/* Linked bulk job info */}
                {!job.isBulkJob && (
                    <Alert variant="light" color="cyan" icon={<Icon lucide={Info}/>}>
                        Any linked bulk jobs will also be voided.
                    </Alert>
                )}

                {/* Reason */}
                <Textarea
                    label="Reason for voiding (required)"
                    placeholder="Please provide a reason for voiding this job"
                    value={voidReasonText}
                    onChange={handleReasonChange}
                    disabled={isSubmitting}
                    maxLength={500}
                    autosize
                    minRows={3}
                    maxRows={6}
                    description={`${voidReasonText.length}/500 characters`}
                    inputWrapperOrder={['label', 'input', 'description', 'error']}
                />

                {/* Void scope toggle */}
                <Paper {...sectionPaperProps}>
                    <Switch
                        checked={voidSingleJobOnly}
                        onChange={(e) => handleToggleMultiVoid(e.currentTarget.checked)}
                        disabled={isSubmitting}
                        label={voidSingleJobOnly ? 'Void this job only' : 'Void multiple related jobs'}
                        description={voidSingleJobOnly
                            ? 'Only this specific job will be voided'
                            : 'Select which related jobs to void'}
                    />
                </Paper>

                {/* Related jobs multi-select */}
                {!voidSingleJobOnly && (
                    <Paper withBorder radius="md" style={{overflow: 'hidden'}}>
                        {/* Header */}
                        <Group
                            justify="space-between"
                            px="md"
                            py="sm"
                            style={{borderBottom: '1px solid var(--mantine-color-gray-3)', backgroundColor: 'var(--mantine-color-gray-1)'}}
                        >
                            <Text fw={500} fz="sm">Related Jobs</Text>
                            <Group gap="xs">
                                <Button variant="subtle" size="compact-sm" onClick={selectAllJobs} disabled={isLoadingRelatedJobs || isSubmitting}>
                                    Select All
                                </Button>
                                <Button variant="subtle" size="compact-sm" onClick={deselectAllJobs} disabled={isLoadingRelatedJobs || isSubmitting}>
                                    Deselect All
                                </Button>
                            </Group>
                        </Group>

                        {/* Loading */}
                        {isLoadingRelatedJobs && (
                            <Group justify="center" gap="sm" py="lg">
                                <Loader size={UI_ICON_SIZE}/>
                                <Text fz="sm" c="dimmed">Loading related jobs...</Text>
                            </Group>
                        )}

                        {/* Jobs list */}
                        {!isLoadingRelatedJobs && (
                            <>
                                {relatedJobs.length === 0 ? (
                                    <Box py="lg" ta="center">
                                        <Text fz="sm" c="dimmed" fs="italic">No related jobs found.</Text>
                                    </Box>
                                ) : (
                                    <Checkbox.Group value={selectedJobIds.map(String)} onChange={setSelectedJobIds}>
                                        <Box mah={200} style={{overflowY: 'auto'}}>
                                            {relatedJobs.map((relatedJob) => (
                                                <Checkbox
                                                    key={relatedJob.id}
                                                    value={String(relatedJob.id)}
                                                    disabled={isSubmitting}
                                                    size="sm"
                                                    px={12}
                                                    py={8}
                                                    styles={{labelWrapper: {flex: 1}}}
                                                    style={{
                                                        borderBottom: '1px solid var(--mantine-color-gray-3)',
                                                        borderLeft: relatedJob.selected ? '3px solid var(--mantine-color-gray-6)' : '3px solid transparent',
                                                        backgroundColor: relatedJob.selected ? 'var(--mantine-color-gray-1)' : undefined,
                                                    }}
                                                    label={
                                                        <Group gap="xs" wrap="nowrap">
                                                            <Text fz="sm" style={{flex: 1}}>{relatedJob.text}</Text>
                                                            {relatedJob.id === job.id && (
                                                                <Badge size="sm" variant="light" color="gray">current</Badge>
                                                            )}
                                                            {relatedJob.isBulkJob && (
                                                                <Badge size="sm" variant="light" color="cyan">Bulk</Badge>
                                                            )}
                                                            {relatedJob.isArchived && (
                                                                <Badge size="sm" variant="light" color="orange">Archived</Badge>
                                                            )}
                                                        </Group>
                                                    }
                                                />
                                            ))}
                                        </Box>
                                    </Checkbox.Group>
                                )}

                                {/* Summary */}
                                {relatedJobs.length > 0 && (
                                    <Box
                                        px="md"
                                        py="xs"
                                        ta="right"
                                        style={{borderTop: '1px solid var(--mantine-color-gray-3)', backgroundColor: 'var(--mantine-color-gray-1)'}}
                                    >
                                        <Text fz="xs" c="dimmed">{selectedCount} of {relatedJobs.length} jobs selected</Text>
                                    </Box>
                                )}
                            </>
                        )}
                    </Paper>
                )}
            </Stack>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleConfirm}
                confirmColor="red"
                confirmIcon={<Icon lucide={Trash2}/>}
                confirmLabel={isSubmitting ? 'Voiding...' : confirmButtonText}
                confirmDisabled={isConfirmDisabled}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default VoidJobConfirmationDialog;
