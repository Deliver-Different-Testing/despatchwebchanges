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
    return (window as any).TimeZone || 'UTC';
}

/**
 * Check if the current tenant is a US customer
 */
export function isUsCustomer(): boolean {
    return (window as any).serverConfig?.isUSCustomer ?? true;
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

    const dateTime = dayjs(dateTimeString);
    if (!dateTime.isValid()) return 'Invalid date';

    const ianaTimeZone = getIanaTimezone();
    const now = dayjs().tz(ianaTimeZone);
    const isToday = dateTime.isSame(now, 'day');
    const isTomorrow = dateTime.isSame(now.add(1, 'day'), 'day');

    if (isToday) {
        return formatTime(dateTime);
    } else if (isTomorrow) {
        return `Tomorrow ${formatTime(dateTime)}`;
    } else {
        return formatLongDateTime(dateTime);
    }
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
        const now = dayjs();
        const ianaTimezone = getIanaTimezone(timezone);

        // Manual handling for New Zealand timezones
        if (
            ianaTimezone === 'Pacific/Auckland' ||
            timezone.toLowerCase().includes('new zealand') ||
            timezone.toLowerCase().includes('nz')
        ) {
            const timeInZone = now.tz('Pacific/Auckland');
            const month = timeInZone.month();
            const date = timeInZone.date();
            const day = timeInZone.day();

            let isDST = false;
            if (month > 8 || month < 3) {
                isDST = true;
            } else if (month === 8) {
                const lastSunday = 30 - ((30 - date + day) % 7);
                isDST = date >= lastSunday;
            } else if (month === 3) {
                const firstSunday = 7 - ((date - 1 + (7 - day)) % 7);
                isDST = date < firstSunday;
            }

            return isDST ? 'New Zealand Daylight Time' : 'New Zealand Standard Time';
        }

        const timeInZone = now.tz(ianaTimezone);
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'long',
        });

        const formatted = formatter.format(timeInZone.toDate());
        const parts = formatted.split(' ');

        // Find where the timezone name starts (after time portion)
        let timezoneStartIndex = -1;
        for (let i = 0; i < parts.length; i++) {
            if (
                parts[i].toLowerCase().includes('am') ||
                parts[i].toLowerCase().includes('pm') ||
                /^\d{1,2}:\d{2}/.test(parts[i])
            ) {
                timezoneStartIndex = i + 1;
                break;
            }
        }

        if (timezoneStartIndex > 0 && timezoneStartIndex < parts.length) {
            return parts.slice(timezoneStartIndex).join(' ');
        }

        // Fallback: look for common timezone keywords
        const timezoneParts: string[] = [];
        let foundTimezoneName = false;

        for (const part of parts) {
            const lower = part.toLowerCase();

            // Skip date/time parts
            if (
                /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part) ||
                /^\d{1,2}:\d{2}/.test(part) ||
                lower === 'at' ||
                lower.includes('am') ||
                lower.includes('pm')
            ) {
                continue;
            }

            // Common timezone keywords
            if (
                lower.includes('standard') ||
                lower.includes('daylight') ||
                lower.includes('summer') ||
                lower.includes('time') ||
                lower.includes('mountain') ||
                lower.includes('pacific') ||
                lower.includes('eastern') ||
                lower.includes('central') ||
                lower.includes('atlantic') ||
                lower.includes('alaska') ||
                lower.includes('hawaii')
            ) {
                foundTimezoneName = true;
            }

            if (foundTimezoneName) {
                timezoneParts.push(part);
            }
        }

        if (timezoneParts.length > 0) {
            return timezoneParts.join(' ');
        }

        return timezone;
    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return timezone;
    }
}

// Re-export dayjs for convenience
export {dayjs};
