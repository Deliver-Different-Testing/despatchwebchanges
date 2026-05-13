/**
 * Job Change Request Dialog
 *
 * Lets a dispatcher submit a change request against an inter-tenant partner job.
 * Auto-apply fields (Notes / ProgressNote / PodNote) apply immediately on the local job;
 * manual fields open a task on the counterparty's dashboard and await approval.
 */

import React, {useState, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import {jobChangeRequestApi, type JobChangeRequestResult} from '../../../services/jobChangeRequestApi';

/** Closed set mirroring DespatchWeb.Enums.JobChangeField. Keep in sync if backend changes. */
const FIELD_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
    {value: 'Notes', label: 'Notes (auto-apply)', hint: 'Replaces job notes immediately'},
    {value: 'ProgressNote', label: 'Progress Note (auto-apply)', hint: 'Appended to job notes immediately'},
    {value: 'PodNote', label: 'POD Note (auto-apply)', hint: 'Appended to job notes immediately'},
    {value: 'Quantity', label: 'Quantity', hint: 'Requires counterparty approval; re-rates on approval'},
    {value: 'Speed', label: 'Service Speed', hint: 'Requires counterparty approval; re-rates on approval'},
    {value: 'PartnerAgreedRate', label: 'Agreed Rate', hint: 'Requires counterparty approval; locked after settlement'},
];

export interface JobChangeRequestDialogProps {
    open: boolean;
    jobId: number;
    jobNo: string;
    onClose: () => void;
    onSubmitted?: (result: JobChangeRequestResult) => void;
}

export const JobChangeRequestDialog: React.FC<JobChangeRequestDialogProps> = ({
                                                                                  open,
                                                                                  jobId,
                                                                                  jobNo,
                                                                                  onClose,
                                                                                  onSubmitted,
                                                                              }) => {
    const [fieldName, setFieldName] = useState('Notes');
    const [requestedValue, setRequestedValue] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const reset = useCallback(() => {
        setFieldName('Notes');
        setRequestedValue('');
        setReason('');
        setError('');
        setSuccess('');
        setSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
        if (submitting) return;
        reset();
        onClose();
    }, [submitting, reset, onClose]);

    const handleSubmit = useCallback(async () => {
        if (!fieldName) {
            setError('Choose a field to change');
            return;
        }
        if (!requestedValue.trim()) {
            setError('Enter the requested value');
            return;
        }
        setError('');
        setSuccess('');
        setSubmitting(true);
        try {
            const result = await jobChangeRequestApi.create({
                jobId,
                fieldName,
                requestedValue: requestedValue.trim(),
                reason: reason.trim() || undefined,
            });
            if (!result.success) {
                setError(result.message ?? 'Submission failed');
            } else {
                const status = result.request?.status === 'Applied'
                    ? 'Change applied'
                    : 'Change request sent to partner';
                setSuccess(status);
                onSubmitted?.(result);
            }
        } catch (e) {
            const msg = (e as { message?: string })?.message ?? 'Submission failed';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }, [fieldName, requestedValue, reason, jobId, onSubmitted]);

    const selected = FIELD_OPTIONS.find(f => f.value === fieldName);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2}}>
                <Box>
                    <Typography variant="h6">Request Job Change</Typography>
                    <Typography variant="body2" color="text.secondary">Job {jobNo}</Typography>
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={submitting}>
                    <CloseIcon/>
                </IconButton>
            </Box>

            <DialogContent>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    <TextField
                        select
                        label="Field"
                        value={fieldName}
                        onChange={e => setFieldName(e.target.value)}
                        size="small"
                        fullWidth
                        disabled={submitting}
                        helperText={selected?.hint}
                    >
                        {FIELD_OPTIONS.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Requested value"
                        value={requestedValue}
                        onChange={e => setRequestedValue(e.target.value)}
                        size="small"
                        fullWidth
                        disabled={submitting}
                    />

                    <TextField
                        label="Reason (optional)"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={5}
                        disabled={submitting}
                    />

                    {error && <Alert severity="error">{error}</Alert>}
                    {success && <Alert severity="success">{success}</Alert>}
                </Box>
            </DialogContent>

            <DialogActions sx={{px: 3, pb: 2}}>
                <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16}/> : <SendIcon/>}
                >
                    {submitting ? 'Sending…' : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
