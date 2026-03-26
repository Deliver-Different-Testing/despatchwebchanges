/**
 * React Void Job Confirmation Dialog
 *
 * A modern replacement for the AngularJS void-job-confirmation-dialog using MUI components.
 * Allows users to void a single job or multiple related jobs with a required reason.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
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

    const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
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

    const toggleJobSelection = (jobId: number): void => {
        setRelatedJobs(prev => prev.map(j =>
            j.id === jobId ? {...j, selected: !j.selected} : j
        ));
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
                await onVoidBulkJob(
                    job.id,
                    voidSingleJobOnly,
                    voidReasonText,
                    jobIds
                );
            } else {
                await onVoidJob(
                    job.id,
                    voidSingleJobOnly,
                    voidReasonText,
                    jobIds
                );
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
    <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{
            paper: {
                elevation: 24,
                sx: {
                    borderRadius: 2,
                    overflow: 'hidden',
                    minWidth: 480,
                    maxWidth: 600,
                },
            },
        }}
    >
        {/* Header */}
        <Box
            sx={(theme) => ({
                background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
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
                <DeleteIcon sx={{fontSize: 24}} />
            </Box>
            <Box sx={{flex: 1}}>
                <Typography variant="h6" fontWeight={600}>
                    Void {job.jobNo}
                </Typography>
                <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                    Permanently cancel this job
                </Typography>
            </Box>
            <IconButton
                onClick={onClose}
                disabled={isSubmitting}
                sx={{
                    color: 'white',
                    '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                }}
            >
                <CloseIcon />
            </IconButton>
        </Box>

        {/* Content */}
        <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
            {/* Warning Box */}
            <Paper
                elevation={0}
                sx={(theme) => ({
                    p: 2,
                    mb: 3,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                    borderLeft: `4px solid ${theme.palette.warning.main}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                })}
            >
                <WarningIcon sx={(theme) => ({color: theme.palette.warning.dark, fontSize: 20})} />
                <Typography variant="body2" color="text.primary">
                    You are about to void job <strong>#{job.jobNo}</strong>.
                </Typography>
            </Paper>

            {/* Linked bulk job info */}
            {!job.isBulkJob && (
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 2,
                        mb: 3,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.info.main, 0.08),
                        borderLeft: `4px solid ${theme.palette.info.main}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                    })}
                >
                    <InfoIcon sx={(theme) => ({color: theme.palette.info.dark, fontSize: 20})} />
                    <Typography variant="body2" color="text.primary">
                        Any linked bulk jobs will also be voided.
                    </Typography>
                </Paper>
            )}

            {/* Reason Input */}
            <Box sx={{mb: 3}}>
                <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Reason for voiding (required)"
                    placeholder="Please provide a reason for voiding this job"
                    value={voidReasonText}
                    onChange={handleReasonChange}
                    disabled={isSubmitting}
                    slotProps={{htmlInput: {maxLength: 500}}}
                    helperText={`${voidReasonText.length}/500 characters`}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: 'white',
                        },
                    }}
                />
            </Box>

            {/* Void Scope Toggle */}
            <Paper
                elevation={0}
                sx={(theme) => ({
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: 'white',
                })}
            >
                <FormControlLabel
                    control={
                        <Switch
                            checked={voidSingleJobOnly}
                            onChange={(e) => handleToggleMultiVoid(e.target.checked)}
                            disabled={isSubmitting}
                            color="primary"
                        />
                    }
                    label={
                        <Typography variant="body2" fontWeight={500}>
                            {voidSingleJobOnly ? 'Void this job only' : 'Void multiple related jobs'}
                        </Typography>
                    }
                />
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5, ml: 6}}>
                    {voidSingleJobOnly
                        ? 'Only this specific job will be voided'
                        : 'Select which related jobs to void'
                    }
                </Typography>
            </Paper>

            {/* Related Jobs Multi-Select */}
            {!voidSingleJobOnly && (
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        mt: 2,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'white',
                        overflow: 'hidden',
                    })}
                >
                    {/* Header */}
                    <Box
                        sx={(theme) => ({
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            bgcolor: theme.palette.grey[50],
                        })}
                    >
                        <Typography variant="subtitle2" fontWeight={500}>
                            Related Jobs
                        </Typography>
                        <Box sx={{display: 'flex', gap: 1}}>
                            <Button
                                size="small"
                                onClick={selectAllJobs}
                                disabled={isLoadingRelatedJobs || isSubmitting}
                                sx={{textTransform: 'none', minWidth: 'auto', px: 1}}
                            >
                                Select All
                            </Button>
                            <Button
                                size="small"
                                onClick={deselectAllJobs}
                                disabled={isLoadingRelatedJobs || isSubmitting}
                                sx={{textTransform: 'none', minWidth: 'auto', px: 1}}
                            >
                                Deselect All
                            </Button>
                        </Box>
                    </Box>

                    {/* Loading State */}
                    {isLoadingRelatedJobs && (
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 3}}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                                Loading related jobs...
                            </Typography>
                        </Box>
                    )}

                    {/* Jobs List */}
                    {!isLoadingRelatedJobs && (
                        <>
                            {relatedJobs.length === 0 ? (
                                <Box sx={{py: 3, textAlign: 'center'}}>
                                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                        No related jobs found.
                                    </Typography>
                                </Box>
                            ) : (
                                <List sx={{maxHeight: 200, overflow: 'auto', py: 0}}>
                                    {relatedJobs.map((relatedJob) => (
                                        <ListItem
                                            key={relatedJob.id}
                                            disablePadding
                                            sx={(theme) => ({
                                                borderBottom: `1px solid ${theme.palette.divider}`,
                                                '&:last-child': {borderBottom: 'none'},
                                                ...(relatedJob.selected && {
                                                    bgcolor: alpha(theme.palette.grey[600], 0.06),
                                                    borderLeft: `3px solid ${theme.palette.grey[600]}`,
                                                }),
                                            })}
                                        >
                                            <ListItemButton
                                                onClick={() => toggleJobSelection(relatedJob.id)}
                                                disabled={isSubmitting}
                                                dense
                                            >
                                                <ListItemIcon sx={{minWidth: 36}}>
                                                    <Checkbox
                                                        edge="start"
                                                        checked={relatedJob.selected}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        size="small"
                                                    />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={relatedJob.text}
                                                    slotProps={{primary: {variant: 'body2'}}}
                                                />
                                                {relatedJob.id === job.id && (
                                                    <Chip
                                                        label="current"
                                                        size="small"
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '0.7rem',
                                                            bgcolor: 'grey.200',
                                                        }}
                                                    />
                                                )}
                                                {relatedJob.isBulkJob && (
                                                    <Chip
                                                        label="Bulk"
                                                        size="small"
                                                        color="info"
                                                        sx={{ height: 20, fontSize: '0.7rem', ml: 0.5 }}
                                                    />
                                                )}
                                                {relatedJob.isArchived && (
                                                    <Chip
                                                        label="Archived"
                                                        size="small"
                                                        color="warning"
                                                        sx={{ height: 20, fontSize: '0.7rem', ml: 0.5 }}
                                                    />
                                                )}
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            )}

                            {/* Summary */}
                            {relatedJobs.length > 0 && (
                                <Box
                                    sx={(theme) => ({
                                        px: 2,
                                        py: 1,
                                        borderTop: `1px solid ${theme.palette.divider}`,
                                        bgcolor: theme.palette.grey[50],
                                        textAlign: 'right',
                                    })}
                                >
                                    <Typography variant="caption" color="text.secondary">
                                        {selectedCount} of {relatedJobs.length} jobs selected
                                    </Typography>
                                </Box>
                            )}
                        </>
                    )}
                </Paper>
            )}
        </DialogContent>

        {/* Actions */}
        <DialogActions
            sx={(theme) => ({
                px: 3,
                py: 2,
                bgcolor: 'white',
                borderTop: `1px solid ${theme.palette.divider}`,
                gap: 1,
            })}
        >
            <Button
                onClick={onClose}
                variant="outlined"
                disabled={isSubmitting}
                sx={{minWidth: 100}}
            >
                Cancel
            </Button>
            <Button
                onClick={handleConfirm}
                variant="contained"
                color="error"
                disabled={isConfirmDisabled}
                startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                sx={{minWidth: 120}}
            >
                {isSubmitting ? 'Voiding...' : confirmButtonText}
            </Button>
        </DialogActions>
    </Dialog>
    );
};

export default VoidJobConfirmationDialog;
