/**
 * Insert-to-Live Dialog
 *
 * Manual-mode operator action — picks a service date + scope, then asks
 * the backend to materialise the selected parent recurring booking (and
 * its children, automatically) into live tucJob for that date.
 *
 * Each push rotates the family's ucbkJobNumber via the same
 * UTL_stpJob_Insert_JobNumber path uspPrebookSet uses for the nightly
 * cron, so there is no possibility of a ucjbNumber UNIQUE collision and
 * no conflict warning UI is needed. Source bookings stay on
 * RecurringMode = Manual after the push.
 */

import React, {useCallback, useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {Dayjs} from 'dayjs';
import {recurringJobsApi} from '../../../services/recurringJobsApi';
import {
    InsertRecurringToLiveResult,
    InsertToLiveScope,
    PrebookListModel,
} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';

export interface InsertToLiveDialogProps {
    open: boolean;
    job: PrebookListModel | null;
    onClose: () => void;
    onSuccess: (result: InsertRecurringToLiveResult) => void;
    showToast: ShowToastFn;
}

export const InsertToLiveDialog: React.FC<InsertToLiveDialogProps> = ({
    open,
    job,
    onClose,
    onSuccess,
    showToast,
}) => {
    const defaultDate = useMemo(() => dayjs().startOf('day'), []);
    const [insertDate, setInsertDate] = useState<Dayjs | null>(defaultDate);
    // Group is the default and the only single-booking scope — it pushes
    // the booking's full parent/child family. Standalone bookings (no
    // children) still resolve to a family of one via Group, so a Single
    // option was unnecessary noise (user 2026-06-10).
    const [scope, setScope] = useState<InsertToLiveScope>(InsertToLiveScope.Group);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = useCallback(() => {
        if (isSubmitting) {
            return;
        }
        setInsertDate(defaultDate);
        setScope(InsertToLiveScope.Group);
        onClose();
    }, [defaultDate, isSubmitting, onClose]);

    const handleScopeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setScope(Number(event.target.value) as InsertToLiveScope);
    }, []);

    const handleInsert = useCallback(async () => {
        if (!job || !insertDate) {
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await recurringJobsApi.insertToLive({
                jobId: job.id,
                // Calendar date only — avoid .toISOString() because that
                // rolls the local-picked date into UTC, and for any
                // tenant east of UTC (e.g. NZ +12 in June) the resulting
                // instant lands on the *previous* calendar day. The
                // backend now binds this to a DateOnly and stamps it
                // straight into tucJobBooking.ucbkDate with no TZ math.
                insertDate: insertDate.format('YYYY-MM-DD'),
                scope,
            });

            const dateLabel = insertDate.format('YYYY-MM-DD');
            showToast(
                `Inserted ${result.jobsInserted} job(s) from ${result.bookingsMaterialised} parent booking(s) for ${dateLabel}.`,
                'success'
            );
            onSuccess(result);
        } catch (error) {
            // Backend returns 400 with the validation message for
            // scope/mode failures so the operator sees what to fix.
            const message =
                (error as { response?: { data?: string } })?.response?.data
                || (error instanceof Error ? error.message : 'Insert-to-live failed.');
            console.error('Insert-to-live failed:', error);
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }, [insertDate, job, onSuccess, scope, showToast]);

    if (!job) {
        return null;
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Insert to live</DialogTitle>
            <DialogContent>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, pt: 1}}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Booking
                        </Typography>
                        <Typography variant="body1">
                            {job.jobNo} — {job.customJobName || job.client}
                        </Typography>
                        {job.routeName && (
                            <Typography variant="body2" color="text.secondary">
                                Route: {job.routeName}
                            </Typography>
                        )}
                    </Box>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="Insert date"
                            value={insertDate}
                            onChange={(value) => setInsertDate(value)}
                            disabled={isSubmitting}
                            format="YYYY-MM-DD"
                            slotProps={{
                                textField: {
                                    required: true,
                                    size: 'small',
                                    fullWidth: true,
                                },
                            }}
                        />
                    </LocalizationProvider>

                    <FormControl disabled={isSubmitting}>
                        <FormLabel>Scope</FormLabel>
                        <RadioGroup value={scope} onChange={handleScopeChange}>
                            <FormControlLabel
                                value={InsertToLiveScope.Group}
                                control={<Radio/>}
                                label="Selected booking (parent + any children)"
                            />
                            <FormControlLabel
                                value={InsertToLiveScope.Route}
                                control={<Radio/>}
                                label="All Manual bookings on the same route for that date"
                                disabled={!job.routeId}
                            />
                        </RadioGroup>
                        <FormHelperText>
                            A fresh job number is minted per push (same logic as the nightly cron),
                            so repeat pushes are always safe. Source bookings stay on Manual mode —
                            use Activate from the row actions to opt into the nightly cron.
                        </FormHelperText>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button
                    onClick={handleInsert}
                    color="primary"
                    variant="contained"
                    disabled={isSubmitting || !insertDate}
                    startIcon={isSubmitting ? <CircularProgress size={16} color="inherit"/> : undefined}
                >
                    {isSubmitting ? 'Inserting...' : 'Insert to live'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default InsertToLiveDialog;
