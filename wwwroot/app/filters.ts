import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {findIana} from "windows-iana";

// Register the required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Formats byte values into human-readable format
 */
export function bytesFilter(bytes: number, precision?: number): string {
    if (isNaN(parseFloat(bytes as any)) || !isFinite(bytes)) return "-";
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
 * Formats a date using day.js
 */
export function momentFormatFilter(dateString: string | Date | Dayjs, format: string): string {
    if (!dateString) return '';
    return dayjs(dateString).format(format);
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
        if (ianaTimezone === 'Pacific/Auckland' ||
            timezone.toLowerCase().includes('new zealand') ||
            timezone.toLowerCase().includes('nz')) {

            const timeInZone = now.tz('Pacific/Auckland');

            // Check if it's daylight saving time in NZ
            const month = timeInZone.month(); // 0-based (0 = January)
            const date = timeInZone.date();
            const day = timeInZone.day(); // 0 = Sunday

            let isDST = false;

            if (month > 8 || month < 3) { // Oct-Mar (months 9-2)
                isDST = true;
            } else if (month === 8) { // September
                // Find last Sunday of September
                const lastSunday = 30 - ((30 - date + day) % 7);
                isDST = date >= lastSunday;
            } else if (month === 3) { // April
                // Find first Sunday of April
                const firstSunday = 7 - ((date - 1 + (7 - day)) % 7);
                isDST = date < firstSunday;
            }

            return isDST ? 'NZDT' : 'NZST';
        }

        const timeInZone = now.tz(ianaTimezone);

        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'short'
        });

        const formatted = formatter.format(timeInZone.toDate());
        const abbreviation = formatted.split(' ').pop();

        return abbreviation || timezone;
    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return timezone;
    }
}

export function timezoneLongFilter(timezone: string): string {
    if (!timezone) return '';

    try {
        const now = dayjs();

        const ianaTimezones = findIana(timezone);
        const ianaTimezone = ianaTimezones && ianaTimezones.length > 0
            ? ianaTimezones[0]
            : timezone; // If not found, use original (might already be IANA)

        // Manual handling for New Zealand timezones
        if (ianaTimezone === 'Pacific/Auckland' ||
            timezone.toLowerCase().includes('new zealand') ||
            timezone.toLowerCase().includes('nz')) {

            const timeInZone = now.tz('Pacific/Auckland');

            // Check if it's daylight saving time in NZ
            const month = timeInZone.month(); // 0-based (0 = January)
            const date = timeInZone.date();
            const day = timeInZone.day(); // 0 = Sunday

            let isDST = false;

            if (month > 8 || month < 3) { // Oct-Mar (months 9-2)
                isDST = true;
            } else if (month === 8) { // September
                // Find last Sunday of September
                const lastSunday = 30 - ((30 - date + day) % 7);
                isDST = date >= lastSunday;
            } else if (month === 3) { // April
                // Find first Sunday of April
                const firstSunday = 7 - ((date - 1 + (7 - day)) % 7);
                isDST = date < firstSunday;
            }

            return isDST ? 'New Zealand Daylight Time' : 'New Zealand Standard Time';
        }

        const timeInZone = now.tz(ianaTimezone);

        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'long'
        });

        const formatted = formatter.format(timeInZone.toDate());
        const parts = formatted.split(' ');

        let timezoneStartIndex = -1;
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].toLowerCase().includes('am') ||
                parts[i].toLowerCase().includes('pm') ||
                /^\d{1,2}:\d{2}/.test(parts[i])) {
                timezoneStartIndex = i + 1;
                break;
            }
        }

        if (timezoneStartIndex > 0 && timezoneStartIndex < parts.length) {
            return parts.slice(timezoneStartIndex).join(' ');
        }

        const timezoneParts = [];
        let foundTimezoneName = false;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].toLowerCase();

            // Skip obvious date/time parts
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(parts[i]) || // date
                /^\d{1,2}:\d{2}/.test(parts[i]) || // time
                part === 'at' ||
                part.includes('am') ||
                part.includes('pm')) {
                continue;
            }

            // Common timezone keywords
            if (part.includes('standard') ||
                part.includes('daylight') ||
                part.includes('summer') ||
                part.includes('time') ||
                part.includes('mountain') ||
                part.includes('pacific') ||
                part.includes('eastern') ||
                part.includes('central') ||
                part.includes('atlantic') ||
                part.includes('alaska') ||
                part.includes('hawaii')) {
                foundTimezoneName = true;
            }

            if (foundTimezoneName) {
                timezoneParts.push(parts[i]);
            }
        }

        if (timezoneParts.length > 0) {
            return timezoneParts.join(' ');
        }

        // Last resort: take all parts that aren't obviously date/time
        const filteredParts = parts.filter(part => {
            const lower = part.toLowerCase();
            return !(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part) ||
                /^\d{1,2}:\d{2}/.test(part) ||
                lower === 'at' ||
                lower.includes('am') ||
                lower.includes('pm'));
        });

        return filteredParts.join(' ') || timezone;

    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return timezone;
    }
}