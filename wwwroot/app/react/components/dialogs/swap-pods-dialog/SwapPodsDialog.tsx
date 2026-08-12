/**
 * React Swap PODs Dialog
 *
 * Allows operators to move a POD signature from one job to another,
 * correcting cases where a driver signed off the wrong job.
 *
 * Two-phase flow:
 *   Phase 1 — Input:   Enter second job number and validate
 *   Phase 2 — Confirm: Review both job numbers and confirm the swap
 */

import React, {useState} from 'react';
import {Alert, Box, Group, Paper, Stack, Text, TextInput} from '@mantine/core';
import {ArrowLeftRight, CircleCheck, Info} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import type {ShowToastFn} from '../../../services/toastService';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';

/** The two job numbers being swapped, shown side by side in the confirm step. */
const JobChip: React.FC<{label: string; value: string}> = ({label, value}) => (
    <Box
        p="sm"
        ta="center"
        style={{
            flex: 1,
            borderRadius: 'var(--mantine-radius-sm)',
            backgroundColor: 'var(--mantine-color-brand-0)',
            border: '1px solid var(--mantine-color-brand-3)',
        }}
    >
        <Text fz="xs" c="dimmed">{label}</Text>
        <Text fz="lg" fw={700} c="brand.7">{value}</Text>
    </Box>
);

export interface SwapPodsDialogProps {
    open: boolean;
    jobNo: string;
    onClose: () => void;
    onValidate: (jobNo: string) => Promise<boolean>;
    onSwap: (job1: string, job2: string) => Promise<void>;
    showToast: ShowToastFn;
}

type Phase = 'input' | 'confirm';

export function SwapPodsDialog({
    open,
    jobNo,
    onClose,
    onValidate,
    onSwap,
    showToast,
}: SwapPodsDialogProps): React.ReactElement | null {
    const [secondJobNo, setSecondJobNo] = useState('');
    const [phase, setPhase] = useState<Phase>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when the dialog opens
    React.useEffect(() => {
        if (open) {
            setSecondJobNo('');
            setPhase('input');
            setLoading(false);
            setError(null);
        }
    }, [open]);

    const handleValidate = async (): Promise<void> => {
        const trimmed = secondJobNo.trim();
        if (!trimmed) {
            setError('Please enter a job number.');
            return;
        }

        if (trimmed === jobNo) {
            setError('The second job cannot be the same as the current job.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const isValid = await onValidate(trimmed);
            if (isValid) {
                setPhase('confirm');
            } else {
                setError(`Job ${trimmed} is not eligible for a POD swap.`);
            }
        } catch {
            setError('Failed to validate job. Please check the job number and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSwap = async (): Promise<void> => {
        setLoading(true);
        try {
            await onSwap(jobNo, secondJobNo.trim());
            showToast('PODs swapped successfully.', 'success');
            onClose();
        } catch {
            showToast('An error occurred while swapping PODs. Please try again.', 'error');
            setLoading(false);
        }
    };

    const handleBackToInput = (): void => {
        setPhase('input');
        setError(null);
    };

    const handleKeyDown: (e: React.KeyboardEvent) => Promise<void> = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && phase === 'input' && !loading) {
            await handleValidate();
        }
    };

    return (
        <DialogShell opened={open} onClose={loading ? () => {} : onClose} size={520}>
            <DialogHeader
                icon={<Icon lucide={ArrowLeftRight}/>}
                title="Swap PODs"
                subtitle="Move a POD signature between two jobs"
                onClose={onClose}
                closeDisabled={loading}
            />
            {/* Content */}
            <Stack p="lg" gap="md" bg={dialogContentBg}>
                {/* Info banner */}
                <Alert color="cyan" variant="light" icon={<Icon lucide={Info}/>}>
                    This will move the POD signature from <strong>{jobNo}</strong> to the job you specify, and vice versa.
                </Alert>

                {phase === 'input' ? (
                    /* Phase 1 — Input */
                    <Stack gap="md">
                        {/* Current job (read-only) */}
                        <TextInput label="Current job" value={jobNo} disabled/>
                        {/* Second job input */}
                        <TextInput
                            label="Second job number"
                            placeholder="Enter job number"
                            value={secondJobNo}
                            onChange={(e) => {
                                setSecondJobNo(e.currentTarget.value);
                                if (error) setError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            error={error ?? undefined}
                            data-autofocus
                        />
                    </Stack>
                ) : (
                    /* Phase 2 — Confirm */
                    <Paper {...sectionPaperProps}>
                        <Group gap="xs" mb="md">
                            <Icon lucide={CircleCheck} size={20} color="var(--mantine-color-green-6)"/>
                            <Text fz="sm" fw={600}>Ready to swap</Text>
                        </Group>
                        <Group gap="md" align="center" wrap="nowrap">
                            <JobChip label="Job 1" value={jobNo}/>
                            <Icon lucide={ArrowLeftRight} size={28} color="var(--mantine-color-dimmed)"/>
                            <JobChip label="Job 2" value={secondJobNo.trim()}/>
                        </Group>
                    </Paper>
                )}
            </Stack>
            {/* Actions */}
            {phase === 'input' ? (
                <DialogFooter
                    onCancel={onClose}
                    onConfirm={handleValidate}
                    confirmLabel={loading ? 'Validating...' : 'Validate'}
                    confirmIcon={<Icon lucide={ArrowLeftRight}/>}
                    confirmDisabled={loading || !secondJobNo.trim()}
                    submitting={loading}
                />
            ) : (
                <DialogFooter
                    onCancel={handleBackToInput}
                    cancelLabel="Back"
                    onConfirm={handleConfirmSwap}
                    confirmLabel={loading ? 'Swapping...' : 'Confirm Swap'}
                    confirmIcon={<Icon lucide={ArrowLeftRight}/>}
                    submitting={loading}
                />
            )}
        </DialogShell>
    );
}

export default SwapPodsDialog;
