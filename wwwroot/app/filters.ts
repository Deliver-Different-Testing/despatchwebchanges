import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {findIana} from "windows-iana";

// Register the required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Formats a date/time value with a dayjs format string
 */
export function momentFormatFilter(dateString: string | Date | Dayjs, format: string): string {
    if (!dateString) return '';
    return dayjs(dateString).format(format);
}

/**
 * Formats byte values into human-readable format
 */
export function bytesFilter(bytes: number, precision?: number): string {
    if (isNaN(parseFloat(String(bytes))) || !isFinite(bytes)) return "-";
    if (typeof precision === "undefined") precision = 1;
    const units = ["bytes", "kB", "MB", "GB", "TB", "PB"];
    const number = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) + " " + units[number];
}

/**
 * Replaces all occurrences of a string with another
 */
export function replaceFilter(input: string, search: string, replacement: string): string {
    if (!input) return input;
    return input.replace(new RegExp(search, "g"), replacement);
}

/**
 * Gets timezone abbreviation from IANA timezone
 */
export function timezoneShortFilter(timezone: string): string {
    if (!timezone) return '';

    try {
        const now = dayjs();

        const ianaTimezones = findIana(timezone);
        const ianaTimezone = ianaTimezones && ianaTimezones.length > 0
            ? ianaTimezones[0]
            : timezone; // If not found, use original (might already be IANA)

        // Manual handling for New Zealand timezones
        // Dispatchers requested no timezone to be shown for NZ
        if (ianaTimezone === 'Pacific/Auckland' ||
            timezone.toLowerCase().includes('new zealand') ||
            timezone.toLowerCase().includes('nz')) {
            return '';
        }
        
        const timeInZone = now.tz(ianaTimezone);

        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'short'
        });

        const formatted = formatter.format(timeInZone.toDate());
        const abbreviation = formatted.split(' ').pop();

        return abbreviation ? `(${abbreviation})` : `(${timezone})`;
    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return `(${timezone})`;
    }
}

