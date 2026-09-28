/**
 * CreateAheadBackfillDialog
 *
 * Opens after the operator raises RecurringInitialDays on a recurring
 * template. Lists the interim service dates that would have been created
 * had the higher offset been in force yesterday, and lets the operator
 * pick which ones to backfill now.
 *
 * Design rules (Steve README + Dane 2026-07-16 sign-off):
 *  - Never delete future jobs when the value is reduced (nothing to do).
 *  - Idempotent: the create endpoint's per-date dup guard means double-click
 *    yields jobsCreated=0 on the second call.
 *  - Calendar dates on the wire (YYYY-MM-DD), no UTC round-trip. Backend
 *    binds to DateOnly so east-of-UTC tenants don't drift onto the previous
 *    day.
 *  - Reuses the InsertToLiveDialog pattern for toast + error surfacing.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Box, Checkbox, Divider, Group, Loader, Stack, Text} from '@mantine/core';
import {CalendarPlus, Info, TriangleAlert} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg} from '../../../dialogs/shared/mantine';
import {recurringJobsApi} from '../../../../services/recurringJobsApi';
import type {
    CreateAheadBackfillCandidate,
    PreviewCreateAheadBackfillResult,
} from '../../../../interfaces';
import type {ShowToastFn} from '../../../../services/toastService';

export interface CreateAheadBackfillDialogProps {
    open: boolean;
    /** ucbkID of the parent recurring booking template being backfilled. */
    jobId: number;
    /** Previous RecurringInitialDays value (0 if never set). */
    oldValue: number;
    /** New RecurringInitialDays value the operator saved. Must be > oldValue
     *  or the dialog would have nothing to show — the parent component is
     *  responsible for skipping the open() call in that case. */
    newValue: number;
    onClose: () => void;
    onSuccess: () => void;
    showToast: ShowToastFn;
}

export const CreateAheadBackfillDialog: React.FC<CreateAheadBackfillDialogProps> = ({
    open,
    jobId,
    oldValue,
    newValue,
    onClose,
    onSuccess,
    showToast,
}) => {
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [preview, setPreview] = useState<PreviewCreateAheadBackfillResult | null>(null);
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Fetch the preview whenever the dialog is opened for a specific
    // template + value change. Cleaned up on close so a re-open always
    // hits the endpoint fresh (in case the cron ran in between and the
    // "already existing" set changed).
    useEffect(() => {
        if (!open || jobId <= 0 || newValue <= oldValue) {
            return;
        }

        let cancelled = false;
        setIsLoadingPreview(true);
        setPreviewError(null);

        recurringJobsApi
            .previewCreateAheadBackfill({jobId, oldValue, newValue})
            .then((result) => {
                if (cancelled) return;
                setPreview(result);
                // Pre-check all candidates by default — matches the README's
                // "offer to create tomorrow and day after tomorrow immediately"
                // language. Operator can deselect any they don't want.
                setSelectedDates(new Set(result.candidates.map((c) => c.serviceDate)));
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const message =
                    (error as {response?: {data?: string}})?.response?.data
                    || (error instanceof Error ? error.message : 'Failed to load backfill preview.');
                setPreviewError(message);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingPreview(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, jobId, oldValue, newValue]);

    const handleClose = useCallback(() => {
        if (isSubmitting) return;
        setPreview(null);
        setSelectedDates(new Set());
        setPreviewError(null);
        onClose();
    }, [isSubmitting, onClose]);

    const toggleDate = useCallback((serviceDate: string) => {
        setSelectedDates((prev) => {
            const next = new Set(prev);
            if (next.has(serviceDate)) {
                next.delete(serviceDate);
            } else {
                next.add(serviceDate);
            }
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        setSelectedDates((prev) => {
            if (!preview) return prev;
            if (prev.size === preview.candidates.length) {
                return new Set();
            }
            return new Set(preview.candidates.map((c) => c.serviceDate));
        });
    }, [preview]);

    const handleCreate = useCallback(async () => {
        if (!preview || selectedDates.size === 0) {
            return;
        }
        setIsSubmitting(true);
        try {
            const dates = preview.candidates
                .map((c) => c.serviceDate)
                .filter((d) => selectedDates.has(d));

            const result = await recurringJobsApi.createCreateAheadBackfill({
                jobId,
                dates,
            });

            const parts: string[] = [];
            parts.push(`Created ${result.jobsCreated} job(s) across ${result.createdDates.length} service date(s).`);
            if (result.duplicatesSkipped > 0) {
                parts.push(`Skipped ${result.duplicatesSkipped} duplicate(s).`);
            }
            if (result.errors.length > 0) {
                parts.push(`${result.errors.length} date(s) failed — see log.`);
            }
            showToast(parts.join(' '), result.errors.length > 0 ? 'warning' : 'success');
            onSuccess();
            handleClose();
        } catch (error) {
            const message =
                (error as {response?: {data?: string}})?.response?.data
                || (error instanceof Error ? error.message : 'Backfill push failed.');
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }, [preview, selectedDates, jobId, showToast, onSuccess, handleClose]);

    const summaryText = useMemo(() => {
        return `Raising create-ahead days from ${oldValue} to ${newValue} would have covered these interim service dates.`;
    }, [oldValue, newValue]);

    const nothingToBackfill = !!preview && preview.candidates.length === 0;

    return (
        <DialogShell opened={open} onClose={handleClose} label="Create missing interim bookings?">
            <DialogHeader
                icon={<Icon lucide={CalendarPlus}/>}
                title="Create missing interim bookings?"
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />
            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="md">
                    <Text size="sm" c="dimmed">{summaryText}</Text>

                    {isLoadingPreview && (
                        <Group gap="xs">
                            <Loader size={16} role="progressbar" aria-label="Loading preview"/>
                            <Text size="sm">Loading preview...</Text>
                        </Group>
                    )}

                    {previewError && (
                        <Alert color="red" variant="light" icon={<Icon lucide={TriangleAlert} size={18}/>}>
                            {previewError}
                        </Alert>
                    )}

                    {preview && !isLoadingPreview && (
                        <>
                            {nothingToBackfill ? (
                                <Alert color="reflex" variant="light" icon={<Icon lucide={Info} size={18}/>}>
                                    No interim dates need backfilling. Every service date in the new
                                    window is either already live or does not match the recurrence
                                    pattern / holiday rules.
                                </Alert>
                            ) : (
                                <>
                                    <Checkbox
                                        label={`Select all (${preview.candidates.length})`}
                                        checked={selectedDates.size === preview.candidates.length}
                                        indeterminate={
                                            selectedDates.size > 0
                                            && selectedDates.size < preview.candidates.length
                                        }
                                        onChange={toggleAll}
                                        disabled={isSubmitting}
                                    />
                                    <Stack gap="xs">
                                        {preview.candidates.map((c: CreateAheadBackfillCandidate) => (
                                            <Checkbox
                                                key={c.serviceDate}
                                                label={`${c.displayLabel} (${c.serviceDate})`}
                                                checked={selectedDates.has(c.serviceDate)}
                                                onChange={() => toggleDate(c.serviceDate)}
                                                disabled={isSubmitting}
                                            />
                                        ))}
                                    </Stack>
                                    <Text size="xs" c="dimmed">
                                        A fresh job number is minted per push (same logic as the nightly
                                        cron), so re-pushes are always safe against duplicates.
                                    </Text>
                                </>
                            )}

                            {preview.alreadyExistingDates.length > 0 && (
                                <>
                                    <Divider/>
                                    <Text size="xs" c="dimmed">
                                        Already live (no action needed): {preview.alreadyExistingDates.join(', ')}
                                    </Text>
                                </>
                            )}

                            {preview.skippedDates.length > 0 && (
                                <>
                                    <Divider/>
                                    <Text size="xs" c="dimmed">
                                        Skipped by pattern / holiday rules:
                                    </Text>
                                    <Stack gap={2} pl="xs">
                                        {preview.skippedDates.map((s) => (
                                            <Text key={s.serviceDate} size="xs" c="dimmed">
                                                {s.serviceDate} — {s.reason}
                                            </Text>
                                        ))}
                                    </Stack>
                                </>
                            )}
                        </>
                    )}
                </Stack>
            </Box>
            <DialogFooter
                onCancel={handleClose}
                cancelLabel={nothingToBackfill ? 'Close' : 'Skip backfill'}
                onConfirm={handleCreate}
                confirmLabel={isSubmitting ? 'Creating...' : `Create ${selectedDates.size} booking(s)`}
                confirmDisabled={
                    isSubmitting
                    || isLoadingPreview
                    || !preview
                    || selectedDates.size === 0
                }
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default CreateAheadBackfillDialog;
