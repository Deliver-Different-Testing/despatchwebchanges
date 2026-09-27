/**
 * Date Utilities for React Components
 *
 * Provides date formatting and timezone conversion utilities.
 * Migrated from AngularJS formatDates.ts and filters.ts
 */

import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {findIana} from 'windows-iana';

// Extend dayjs with timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Get the current tenant timezone from the window global
 */
export function getTenantTimezone(): string {
    return window.TimeZone || 'UTC';
}

/**
 * Check if the current tenant is a US customer
 */
export function isUsCustomer(): boolean {
    return window.serverConfig?.isUSCustomer ?? true;
}

/**
 * Convert Windows timezone to IANA format
 * @param timezone - Windows or IANA timezone string
 * @returns IANA timezone string
 */
export function getIanaTimezone(timezone?: string): string {
    if (!timezone) timezone = getTenantTimezone();

    // Try to find IANA equivalent using windows-iana
    try {
        const ianaTimezones = findIana(timezone);
        if (ianaTimezones && ianaTimezones.length > 0) {
            return ianaTimezones[0];
        }
    } catch {
        // If conversion fails, assume it's already in IANA format
    }

    return timezone;
}

/**
 * Format a date for API submission with timezone
 * @param date - Date to format
 * @param timeZone - Optional timezone (defaults to tenant timezone)
 * @returns ISO formatted date string with timezone
 */
export function formatDateForApi(date: Date | Dayjs | string, timeZone?: string): string {
    const ianaTimeZone = getIanaTimezone(timeZone);

    let dayjsDate: Dayjs;

    if (date instanceof Date) {
        // Extract date/time components and create string without timezone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');

        const dateString = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        dayjsDate = dayjs.tz(dateString, 'YYYY-MM-DD HH:mm:ss', ianaTimeZone);
    } else if (typeof date === 'string') {
        // Strip existing timezone info and reparse in target timezone
        const dateWithoutTz = date.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
        dayjsDate = dayjs.tz(dateWithoutTz, ianaTimeZone);
    } else {
        // It's a dayjs object - format without timezone then reparse
        const dateString = date.format('YYYY-MM-DD HH:mm:ss');
        dayjsDate = dayjs.tz(dateString, 'YYYY-MM-DD HH:mm:ss', ianaTimeZone);
    }

    return dayjsDate.format();
}

/**
 * Parse a date string from API response
 * @param dateString - ISO date string from API
 * @returns Dayjs object with correct timezone offset
 */
export function parseDateFromApi(dateString: string): Dayjs {
    if (!dateString) {
        return dayjs(null);
    }

    // Extract timezone offset (e.g., "-08:00", "+05:30", or "Z")
    const offsetMatch = dateString.match(/([+-]\d{2}:\d{2}|Z)$/);

    if (!offsetMatch) {
        return dayjs(dateString);
    }

    const originalOffset = offsetMatch[1] === 'Z' ? '+00:00' : offsetMatch[1];

    // Strip the timezone offset from the date string to prevent automatic conversion
    const dateWithoutOffset = dateString.replace(/([+-]\d{2}:\d{2}|Z)$/, '');

    // Parse as UTC (no conversion), then apply the original offset while keeping the time
    return dayjs.utc(dateWithoutOffset).utcOffset(originalOffset, true);
}

/**
 * Format date with time (locale-aware)
 * @param date - Date to format
 * @param isUs - Whether to use US format (defaults to tenant setting)
 * @returns Formatted date string (e.g., "Jan/15/2025 9:24 AM" or "15/Jan/2025 09:24")
 */
export function formatLongDateTime(date: Date | Dayjs | string, isUs?: boolean): string {
    const useUs = isUs ?? isUsCustomer();
    const d = dayjs.isDayjs(date) ? date : dayjs(date);
    return useUs
        ? d.format('MMM/DD/YYYY h:mm A')
        : d.format('DD/MMM/YYYY HH:mm');
}

/**
 * Format date without time (locale-aware)
 * @param date - Date to format
 * @param isUs - Whether to use US format (defaults to tenant setting)
 * @returns Formatted date string (e.g., "Jan/15/2025" or "15/Jan/2025")
 */
export function formatLongDate(date: Date | Dayjs | string, isUs?: boolean): string {
    const useUs = isUs ?? isUsCustomer();
    const d = dayjs.isDayjs(date) ? date : dayjs(date);
    return useUs
        ? d.format('MMM/DD/YYYY')
        : d.format('DD/MMM/YYYY');
}

/**
 * Format short date with time
 * @param date - Date to format
 * @param isUs - Whether to use US format (defaults to tenant setting)
 * @returns Formatted date string (e.g., "Jan/15 14:30" or "15/Jan 14:30")
 */
export function formatShortDateTime(date: Date | Dayjs | string, isUs?: boolean): string {
    const useUs = isUs ?? isUsCustomer();
    const d = dayjs.isDayjs(date) ? date : dayjs(date);
    return useUs
        ? d.format('MMM/DD HH:mm')
        : d.format('DD/MMM HH:mm');
}

/**
 * Format short date without time
 * @param date - Date to format
 * @param isUs - Whether to use US format (defaults to tenant setting)
 * @returns Formatted date string (e.g., "Jan/15" or "15/Jan")
 */
export function formatShortDate(date: Date | Dayjs | string, isUs?: boolean): string {
    const useUs = isUs ?? isUsCustomer();
    const d = dayjs.isDayjs(date) ? date : dayjs(date);
    return useUs
        ? d.format('MMM/DD')
        : d.format('DD/MMM');
}

/**
 * Numeric date-input format (locale-aware): US MM/DD/YYYY vs NZ DD/MM/YYYY.
 * @param isUs - Whether to use US format (defaults to tenant setting)
 * @returns Format string suitable for a numeric date field / dayjs .format()
 */
export function getInputDateFormat(isUs?: boolean): string {
    return (isUs ?? isUsCustomer()) ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
}

/**
 * Parse a numeric date string in the tenant's input format.
 * Avoids the customParseFormat plugin by reordering the day/month components
 * according to the locale before constructing the dayjs object.
 * @param input - Date string like "03/04/2025"
 * @param isUs - Whether the input is US-ordered (defaults to tenant setting)
 * @returns Parsed Dayjs, or null if the string is not a valid date
 */
export function parseInputDate(input: string, isUs?: boolean): Dayjs | null {
    const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const useUs = isUs ?? isUsCustomer();
    const [, first, second, yyyy] = match;
    const dd = useUs ? second : first;
    const mm = useUs ? first : second;
    const d = dayjs(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return d.isValid() ? d : null;
}

/**
 * Format time only (HH:mm)
 * @param date - Date to format
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(date: Date | Dayjs | string): string {
    const d = dayjs.isDayjs(date) ? date : dayjs(date);
    return d.format('HH:mm');
}

/**
 * Format a date string intelligently based on how recent it is
 * @param dateTimeString - Date string to format
 * @returns "HH:mm" for today, "Tomorrow HH:mm" for tomorrow, or full date otherwise
 */
export function formatRelativeDateTime(dateTimeString: string): string {
    if (!dateTimeString) return 'No date';

    const parsed = parseDateFromApi(dateTimeString);
    if (!parsed.isValid()) return 'Invalid date';

    // The API already returns this timestamp in the tenant's local wall-clock with its
    // offset (DeliveryJourneyService converts UTC rows via ConvertUtcToTenantTimeZone and
    // stamps local rows via SetDateTimeWithTimeZone). parseDateFromApi preserves that
    // wall-clock + offset, so display it as-is — matching formatLongDateTime/formatTime.
    // Do NOT re-project with .tz(window.TimeZone): that double-converts and flips the day
    // when the offsets disagree (showed a 16:24 booking as "Tomorrow 04:24").
    const now = dayjs().utcOffset(parsed.utcOffset());
    const isToday = parsed.isSame(now, 'day');
    const isTomorrow = parsed.isSame(now.add(1, 'day'), 'day');

    // Locale-aware time so US tenants see 12-hour AM/PM (matching formatLongDateTime),
    // not the 24-hour form used for NZ tenants.
    const timeStr = isUsCustomer() ? parsed.format('h:mm A') : parsed.format('HH:mm');

    if (isToday) {
        return timeStr;
    } else if (isTomorrow) {
        return `Tomorrow ${timeStr}`;
    } else {
        return formatLongDateTime(parsed);
    }
}

/**
 * Format the elapsed time since a past date as a short relative string
 * (e.g. "just now", "45s ago", "3m ago", "5h ago", "2d ago").
 * @param date - A past Date to measure from now
 * @returns Short relative-time string
 */
export function formatRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    // Round rather than truncate: a due date that is "2 calendar days ago" can be as
    // little as 47 real hours back across a DST transition, and floor(47/24) wrongly
    // reads "1d ago".
    return `${Math.round(hours / 24)}d ago`;
}

/**
 * Get timezone abbreviation (e.g., "(PST)", "(EST)")
 * Returns empty string for New Zealand timezones per business requirement
 * @param timezone - Windows or IANA timezone string
 * @returns Timezone abbreviation in parentheses, or empty string
 */
export function getTimezoneAbbreviation(timezone: string): string {
    if (!timezone) return '';

    try {
        const ianaTimezone = getIanaTimezone(timezone);

        // New Zealand timezones should not show abbreviation (per business requirement)
        if (
            ianaTimezone === 'Pacific/Auckland' ||
            timezone.toLowerCase().includes('new zealand') ||
            timezone.toLowerCase().includes('nz')
        ) {
            return '';
        }

        const now = dayjs();
        const timeInZone = now.tz(ianaTimezone);

        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'short',
        });

        const formatted = formatter.format(timeInZone.toDate());
        const abbreviation = formatted.split(' ').pop();

        return abbreviation ? `(${abbreviation})` : `(${timezone})`;
    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return `(${timezone})`;
    }
}

/**
 * Get full timezone name (e.g., "Pacific Standard Time")
 * @param timezone - Windows or IANA timezone string
 * @returns Full timezone name
 */
export function getTimezoneName(timezone: string): string {
    if (!timezone) return '';

    try {
        const ianaTimezone = getIanaTimezone(timezone);

        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'long',
        });

        const parts = formatter.formatToParts(new Date());
        const tzPart = parts.find(p => p.type === 'timeZoneName');

        return tzPart?.value || timezone;
    } catch {
        return timezone;
    }
}

// Backward-compatible aliases for formatDates.ts consolidation
export { formatDateForApi as formatDateForApiWithTzs };
export { formatTime as formatMins };
export { formatRelativeDateTime as formatInfoLogDateTimeString };
export { parseDateFromApi as formatDateFromApi };

// Re-export dayjs for convenience
export {dayjs};
