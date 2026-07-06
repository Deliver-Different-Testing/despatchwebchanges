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
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {Dayjs} from 'dayjs';
import type {SxProps, Theme} from '@mui/material';
import {recurringJobsApi} from '../../../services/recurringJobsApi';
import {
    InsertRecurringToLiveResult,
    InsertToLiveScope,
    PrebookListModel,
} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';
import {
    headerChipSx,
    headerChromeSx,
    headerOnColor,
    headerOverlayColor
} from '../../../components/dialogs/shared/styles';

const sectionPaperSx = {
    bgcolor: 'white',
    borderRadius: 3,
    p: 2.5,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

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
            let message =
                `Inserted ${result.jobsInserted} job(s) from ${result.bookingsMaterialised} parent booking(s) for ${dateLabel}.`;
            if (result.flightsAutoAssigned > 0) {
                message += ` ${result.flightsAutoAssigned} flight(s) auto-assigned.`;
            }
            if (result.flightsUnmatched > 0) {
                message += ` ${result.flightsUnmatched} saved flight(s) couldn't be matched — assign manually.`;
            }
            showToast(message, result.flightsUnmatched > 0 ? 'warning' : 'success');
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
        <Dialog
            open={open}
            onClose={handleClose}
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
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <RocketLaunchIcon/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        Insert to live
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {job.jobNo} &middot; {job.customJobName || job.client}
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleClose}
                    disabled={isSubmitting}
                    aria-label="Close dialog"
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                    })}
                >
                    <CloseIcon/>
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {/* Booking */}
                    <Paper elevation={0} sx={sectionPaperSx}>
                        <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500}}>
                            Booking
                        </Typography>
                        <Typography variant="body1">
                            {job.jobNo} — {job.customJobName || job.client}
                        </Typography>
                        {job.routeName && (
                            <Typography variant="body2" sx={{color: 'text.secondary', mt: 0.25}}>
                                Route: {job.routeName}
                            </Typography>
                        )}
                    </Paper>

                    {/* Insert date */}
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500, mb: 1}}>
                            Insert date
                        </Typography>
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
                                        sx: {'& .MuiOutlinedInput-root': {bgcolor: 'white'}},
                                    },
                                }}
                            />
                        </LocalizationProvider>
                    </Box>

                    {/* Scope */}
                    <Paper elevation={0} sx={sectionPaperSx}>
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
                        </FormControl>
                    </Paper>

                    {/* Guidance */}
                    <Alert severity="info">
                        A fresh job number is minted per push (same logic as the nightly cron),
                        so repeat pushes are always safe. Source bookings stay on Manual mode —
                        use Activate from the row actions to opt into the nightly cron.
                    </Alert>
                </Box>
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
                    onClick={handleClose}
                    variant="outlined"
                    disabled={isSubmitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleInsert}
                    color="primary"
                    variant="contained"
                    disabled={isSubmitting || !insertDate}
                    startIcon={isSubmitting
                        ? <CircularProgress size={16} color="inherit"/>
                        : <RocketLaunchIcon/>}
                    sx={{minWidth: 100}}
                >
                    {isSubmitting ? 'Inserting...' : 'Insert to live'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default InsertToLiveDialog;
