/**
 * EditDateTimeDialog Component
 *
 * React replacement for the AngularJS edit-date-time-dialog.
 * Allows editing date and/or time values with timezone information.
 *
 * **Wall-clock, by construction.** Mantine's pickers are string-valued —
 * `DateInput` speaks `YYYY-MM-DD` and `TimePicker` speaks `HH:mm` — so nothing
 * here ever builds a `Date`, and there is no instant to convert. The dialog's own
 * state stays a `Dayjs` because that is what callers submit and receive, and the
 * pickers only ever set its calendar fields (`.year()/.month()/.date()`,
 * `.hour()/.minute()`), never re-anchor it to another zone. `selectedTimeZone` is
 * carried through to the result as a *label* for the value, exactly as before.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { DateInput, TimePicker } from '@mantine/dates';
import { CalendarDays, Globe, Lock } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { EditDateTimeDialogProps, EditDateTimeDialogResult } from './types';
import { getIanaTimezone, getTimezoneName } from '../../../utils/dateUtils';
import { Icon } from '../../common/icon/Icon';
import {
    DialogFooter, DialogHeader, DialogShell, dialogContentBg, sectionPaperProps,
} from '../shared/mantine';

dayjs.extend(utc);
dayjs.extend(timezone);

/** The wire/display format the pickers and the callers agree on. */
const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm';

/**
 * Format timezone for display (e.g., "America/New_York" -> "Eastern Daylight Time")
 */
function formatTimezoneDisplay(tz: string | { text?: string } | undefined | null): string {
    // Handle timezone objects (e.g. {text: "Pacific/Auckland"}) that may be passed via `as any`
    const tzStr = typeof tz === 'string' ? tz : tz?.text ?? '';
    if (!tzStr) return '';
    try {
        return getTimezoneName(tzStr);
    } catch {
        return tzStr.replace(/_/g, ' ');
    }
}

export const EditDateTimeDialog: React.FC<EditDateTimeDialogProps> = ({
    open,
    title,
    fieldName,
    dateTime: initialDateTime,
    defaultTimeZone,
    showDate = true,
    showTime = true,
    isUSCustomer = false,
    readOnly = false,
    allowClear = false,
    onClose,
    onSubmit,
    showToast,
}) => {
    // State
    const [dateTime, setDateTime] = useState<Dayjs>(dayjs());
    const [isLoading, setIsLoading] = useState(false);
    // Handle timezone objects that may arrive via `as any` from callers
    const resolvedTz = typeof defaultTimeZone === 'string'
        ? defaultTimeZone
        : (defaultTimeZone as unknown as { text?: string })?.text ?? undefined;
    const [selectedTimeZone] = useState(resolvedTz || getIanaTimezone());

    // Initialize dateTime when dialog opens or initialDateTime changes
    useEffect(() => {
        if (open) {
            if (initialDateTime && initialDateTime.isValid()) {
                setDateTime(initialDateTime);
            } else {
                // No incoming value: seed with the wall clock *in the job's zone*, so a
                // US job opens on its own local time rather than the browser's. This is
                // not a conversion of stored data — there is no stored value yet — and
                // the seeded fields are then edited as plain wall-clock numbers.
                setDateTime(dayjs().tz(selectedTimeZone));
            }
        }
    }, [open, initialDateTime]);

    /**
     * Date change. The picker hands over a `YYYY-MM-DD` string (or null while the
     * user is mid-type); only the calendar fields move, so the time of day and the
     * zone the value was written in are untouched.
     */
    const handleDateChange = useCallback((value: string | null) => {
        // `YYYY-MM-DD` is the ISO calendar-date form, which dayjs parses natively and
        // unambiguously — no `customParseFormat` plugin needed, and no zone applied.
        const parsed = value ? dayjs(value) : null;
        if (parsed?.isValid()) {
            setDateTime(prev => prev.year(parsed.year()).month(parsed.month()).date(parsed.date()));
        } else {
            // A cleared field marks the value invalid so Save refuses it, rather than
            // silently keeping the old date.
            setDateTime(dayjs(NaN));
        }
    }, []);

    /**
     * Time change — hours and minutes only. Split rather than parsed: `dayjs('16:30')`
     * is Invalid Date natively, and the format argument is ignored unless the
     * `customParseFormat` plugin is loaded, so a parse here would silently drop every
     * edit.
     */
    const handleTimeChange = useCallback((value: string) => {
        const [hours, minutes] = (value ?? '').split(':').map(Number);
        if (Number.isFinite(hours) && Number.isFinite(minutes)) {
            setDateTime(prev => prev.hour(hours).minute(minutes).second(0));
        }
    }, []);

    // Process the datetime based on mode before submitting
    const processDateTime = useCallback((dt: Dayjs): Dayjs => {
        if (showDate && showTime) {
            // Both date and time - use as is
            return dt;
        } else if (showDate && !showTime) {
            // Date only - set to midnight (00:00:00)
            return dt.startOf('day');
        } else if (showTime && !showDate) {
            // Time only - use minimum date (1900-01-01) with the selected time
            return dayjs('1900-01-01')
                .hour(dt.hour())
                .minute(dt.minute())
                .second(0)
                .millisecond(0);
        }
        return dt;
    }, [showDate, showTime]);

    // Handle form submission
    const handleSubmit = useCallback(async () => {
        if (!dateTime || !dateTime.isValid()) {
            showToast('Please provide valid date/time information', 'warning');
            return;
        }

        try {
            setIsLoading(true);

            const processedDateTime = processDateTime(dateTime);

            const result: EditDateTimeDialogResult = {
                fieldName,
                value: processedDateTime,
                timezone: selectedTimeZone,
            };

            // Await onSubmit in case it returns a promise
            await onSubmit(result);
        } catch (error: unknown) {
            console.error('Error submitting date/time:', error);
            showToast(error instanceof Error ? error.message : 'Failed to save date/time', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [dateTime, fieldName, selectedTimeZone, processDateTime, onSubmit, showToast]);

    // Clear the value: resolve with `cleared: true` so the caller removes the
    // stored value rather than persisting a date. `value` is still supplied to
    // satisfy the result shape but is ignored by clear-aware callers.
    const handleClear = useCallback(async () => {
        try {
            setIsLoading(true);
            await onSubmit({
                fieldName,
                value: dateTime,
                timezone: selectedTimeZone,
                cleared: true,
            });
        } catch (error: unknown) {
            console.error('Error clearing date/time:', error);
            showToast(error instanceof Error ? error.message : 'Failed to clear date/time', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [dateTime, fieldName, selectedTimeZone, onSubmit, showToast]);

    const disabled = isLoading || readOnly;
    const dateValue = dateTime.isValid() ? dateTime.format(DATE_FORMAT) : null;
    const timeValue = dateTime.isValid() ? dateTime.format(TIME_FORMAT) : '';

    const dateField = (
        <DateInput
            label="Date"
            value={dateValue}
            onChange={handleDateChange}
            valueFormat={DATE_FORMAT}
            disabled={disabled}
            style={{flex: 1}}
        />
    );

    /**
     * `TimePicker`, not `TimeInput`: a native `<input type="time">` renders AM/PM
     * under a US browser locale even when the bound value is `HH:mm`, and this app
     * shows 24-hour times everywhere. `format="24h"` makes that independent of the
     * browser.
     */
    const timeField = (
        <TimePicker
            label="Time (24-hour)"
            format="24h"
            value={timeValue}
            onChange={handleTimeChange}
            hoursInputLabel="Hours"
            minutesInputLabel="Minutes"
            withDropdown
            disabled={disabled}
            style={{flex: 1}}
        />
    );

    return (
        <DialogShell opened={open} onClose={onClose} label={title} trapFocus={false}>
            <DialogHeader
                icon={<Icon lucide={readOnly ? Lock : CalendarDays}/>}
                title={title}
                subtitle={readOnly ? 'View only — this job is locked' : 'Update the date and time'}
                onClose={onClose}
                closeDisabled={isLoading}
            />
            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="lg">
                    <Group gap="md" align="flex-start" grow>
                        {showDate && dateField}
                        {showTime && timeField}
                    </Group>

                    {/* Timezone Information - Only shown for US customers */}
                    {isUSCustomer && (
                        <Paper {...sectionPaperProps}>
                            <Group gap="sm" wrap="nowrap">
                                <Icon
                                    lucide={Globe}
                                    size={24}
                                    color="var(--mantine-primary-color-filled)"
                                    aria-hidden
                                />
                                <Box>
                                    <Text size="sm" c="dimmed" fw={500}>Job timezone</Text>
                                    <Text>{formatTimezoneDisplay(selectedTimeZone)}</Text>
                                </Box>
                            </Group>
                        </Paper>
                    )}
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onClose}
                cancelLabel={readOnly ? 'Close' : 'Cancel'}
                onConfirm={handleSubmit}
                confirmLabel={isLoading ? 'Saving...' : 'Save'}
                hideConfirm={readOnly}
                submitting={isLoading}
                secondaryAction={!readOnly && allowClear ? (
                    <Button variant="outline" color="red" onClick={handleClear} disabled={isLoading} miw={100}>
                        Clear
                    </Button>
                ) : undefined}
            />
        </DialogShell>
    );
};

export default EditDateTimeDialog;
