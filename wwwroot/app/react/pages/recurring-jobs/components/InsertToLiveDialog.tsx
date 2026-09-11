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
 *
 * **The insert date is a calendar date end to end.** Mantine's `DateInput` is
 * string-valued (`YYYY-MM-DD`) — the exact form the API binds to a `DateOnly` —
 * so the value can no longer be turned into an instant by accident, which is the
 * bug the comment on the API call below warns about.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Box, Paper, Radio, Stack, Text} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {Rocket} from 'lucide-react';
import dayjs, {Dayjs} from 'dayjs';
import {insertScopeColors} from '../../../theme/designTokens';
import {recurringJobsApi} from '../../../services/recurringJobsApi';
import {
    InsertRecurringToLiveResult,
    InsertToLiveScope,
    PrebookListModel,
} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    sectionLabelProps,
    sectionPaperProps,
} from '../../../components/dialogs/shared/mantine';
import {Icon} from '../../../components/common/icon/Icon';

/** Both the picker's exchange format and what the API binds as a `DateOnly`. */
const ISO_DATE = 'YYYY-MM-DD';

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
                insertDate: insertDate.format(ISO_DATE),
                scope,
            });

            const dateLabel = insertDate.format(ISO_DATE);
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
        <DialogShell opened={open} onClose={handleClose} label="Insert to live">
            <DialogHeader
                icon={<Icon lucide={Rocket}/>}
                title="Insert to live"
                subtitle={<>{job.jobNo} &middot; {job.customJobName || job.client}</>}
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />

            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="lg">
                    <Paper {...sectionPaperProps}>
                        <Text {...sectionLabelProps}>Booking</Text>
                        <Text>{job.jobNo} — {job.customJobName || job.client}</Text>
                        {job.routeName && (
                            <Text size="sm" c="dimmed" mt={2}>Route: {job.routeName}</Text>
                        )}
                    </Paper>

                    <DateInput
                        label="Insert date"
                        required
                        value={insertDate?.format(ISO_DATE) ?? null}
                        onChange={(value) => setInsertDate(value ? dayjs(value) : null)}
                        valueFormat={ISO_DATE}
                        placeholder={ISO_DATE}
                        disabled={isSubmitting}
                    />

                    <Paper {...sectionPaperProps}>
                        <Radio.Group
                            label="Scope"
                            value={String(scope)}
                            onChange={(value) => setScope(Number(value) as InsertToLiveScope)}
                        >
                            {/* Colour here is blast radius, not decoration: blue pushes
                                one booking, orange pushes everything on the route. The
                                wording carries the same split for anyone who can't see it. */}
                            <Stack gap="xs" mt="xs">
                                <Radio
                                    value={String(InsertToLiveScope.Group)}
                                    label="Selected booking (parent + any children)"
                                    description="Just this one — the booking you picked, plus its children."
                                    color={insertScopeColors.group}
                                    data-insert-scope="group"
                                    disabled={isSubmitting}
                                />
                                <Radio
                                    value={String(InsertToLiveScope.Route)}
                                    label="All Manual bookings on the same route for that date"
                                    description="Wider reach — every Manual booking sharing that route and date."
                                    color={insertScopeColors.route}
                                    data-insert-scope="route"
                                    disabled={isSubmitting || !job.routeId}
                                />
                            </Stack>
                        </Radio.Group>
                    </Paper>

                    <Alert color="blue">
                        A fresh job number is minted per push (same logic as the nightly cron),
                        so repeat pushes are always safe. Source bookings stay on Manual mode —
                        use Activate from the row actions to opt into the nightly cron.
                    </Alert>
                </Stack>
            </Box>

            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleInsert}
                confirmLabel={isSubmitting ? 'Inserting...' : 'Insert to live'}
                confirmIcon={<Icon lucide={Rocket} size={16}/>}
                confirmDisabled={isSubmitting || !insertDate}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default InsertToLiveDialog;
