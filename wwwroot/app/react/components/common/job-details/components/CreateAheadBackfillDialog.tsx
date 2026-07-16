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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
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

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create missing interim bookings?</DialogTitle>
            <DialogContent>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, pt: 1}}>
                    <Typography variant="body2" color="text.secondary">
                        {summaryText}
                    </Typography>

                    {isLoadingPreview && (
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                            <CircularProgress size={16}/>
                            <Typography variant="body2">Loading preview...</Typography>
                        </Box>
                    )}

                    {previewError && (
                        <Alert severity="error">{previewError}</Alert>
                    )}

                    {preview && !isLoadingPreview && (
                        <>
                            {preview.candidates.length === 0 ? (
                                <Alert severity="info">
                                    No interim dates need backfilling. Every service date in the new
                                    window is either already live or does not match the recurrence
                                    pattern / holiday rules.
                                </Alert>
                            ) : (
                                <>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedDates.size === preview.candidates.length}
                                                indeterminate={
                                                    selectedDates.size > 0
                                                    && selectedDates.size < preview.candidates.length
                                                }
                                                onChange={toggleAll}
                                                disabled={isSubmitting}
                                            />
                                        }
                                        label={`Select all (${preview.candidates.length})`}
                                    />
                                    <List dense disablePadding>
                                        {preview.candidates.map((c: CreateAheadBackfillCandidate) => (
                                            <ListItem key={c.serviceDate} disableGutters>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={selectedDates.has(c.serviceDate)}
                                                            onChange={() => toggleDate(c.serviceDate)}
                                                            disabled={isSubmitting}
                                                        />
                                                    }
                                                    label={`${c.displayLabel} (${c.serviceDate})`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                    <FormHelperText>
                                        A fresh job number is minted per push (same logic as the nightly
                                        cron), so re-pushes are always safe against duplicates.
                                    </FormHelperText>
                                </>
                            )}

                            {preview.alreadyExistingDates.length > 0 && (
                                <>
                                    <Divider/>
                                    <Typography variant="caption" color="text.secondary">
                                        Already live (no action needed): {preview.alreadyExistingDates.join(', ')}
                                    </Typography>
                                </>
                            )}

                            {preview.skippedDates.length > 0 && (
                                <>
                                    <Divider/>
                                    <Typography variant="caption" color="text.secondary">
                                        Skipped by pattern / holiday rules:
                                    </Typography>
                                    <List dense disablePadding>
                                        {preview.skippedDates.map((s) => (
                                            <ListItem key={s.serviceDate} disableGutters sx={{pl: 1}}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {s.serviceDate} — {s.reason}
                                                </Typography>
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isSubmitting}>
                    {preview && preview.candidates.length === 0 ? 'Close' : 'Skip backfill'}
                </Button>
                <Button
                    onClick={handleCreate}
                    color="primary"
                    variant="contained"
                    disabled={
                        isSubmitting
                        || isLoadingPreview
                        || !preview
                        || selectedDates.size === 0
                    }
                    startIcon={isSubmitting ? <CircularProgress size={16} color="inherit"/> : undefined}
                >
                    {isSubmitting
                        ? 'Creating...'
                        : `Create ${selectedDates.size} booking(s)`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateAheadBackfillDialog;
