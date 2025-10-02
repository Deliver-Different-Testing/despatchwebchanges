import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {findIana} from "windows-iana";

dayjs.extend(utc);
dayjs.extend(timezone);

export function formatDateForApi(date: Date | dayjs.Dayjs | string): string {
    // Always use ISO 8601 format for backend communication
    // This removes timezone to get around timezone conversion issues.
    // Make sure to store the correct timezone in the db
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDateForApiWithTzs(date: Date | dayjs.Dayjs | string, timeZone?: string): string {
    if(!timeZone) timeZone = TimeZone;

    // Convert Windows timezone to IANA format if needed
    let ianaTimeZone = timeZone;
    try {
        // Check if it's a Windows timezone by trying to convert it
        const ianaZones = findIana(timeZone);
        if (ianaZones && ianaZones.length > 0) {
            // Use the first IANA zone returned
            ianaTimeZone = ianaZones[0];
            console.log('[formatDateForApiWithTzs] Converted Windows timezone', {
                original: timeZone,
                iana: ianaTimeZone
            });
        }
    } catch (error) {
        // If conversion fails, assume it's already in IANA format
        console.log('[formatDateForApiWithTzs] Using timezone as-is', {
            timeZone: timeZone,
            error: error
        });
    }

    console.log('[formatDateForApiWithTzs] Starting conversion', {
        inputDate: date,
        timeZone: ianaTimeZone,
    });

    let dayjsDate;

    if (date instanceof Date) {
        // Extract the date/time components from the Date object
        // Format them as a string without timezone info
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-based
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');

        // Create a date string without a timezone
        const dateString = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

        // Parse this string as being in the target timezone
        dayjsDate = dayjs.tz(dateString, 'YYYY-MM-DD HH:mm:ss', ianaTimeZone);
    } else if (typeof date === 'string') {
        // If the string already has timezone info, strip it first
        // Otherwise parse as-is in the target timezone
        const dateWithoutTz = date.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
        dayjsDate = dayjs.tz(dateWithoutTz, ianaTimeZone);
    } else {
        // It's already a dayjs object - format without timezone then reparse
        const dateString = date.format('YYYY-MM-DD HH:mm:ss');
        dayjsDate = dayjs.tz(dateString, 'YYYY-MM-DD HH:mm:ss', ianaTimeZone);
    }

    const result = dayjsDate.format();

    console.log('[formatDateForApiWithTzs] Conversion complete', {
        input: date,
        timeZone: ianaTimeZone,
        output: result,
        outputTimezone: dayjsDate.format('Z'),
    });

    return result;
}

export function displayLongDate(date: Date | string, isUsCustomer: boolean = true): string {
    return isUsCustomer
        ? dayjs(date).format('MM/DD/YYYY h:mm A')  // 09/22/2025 9:24 AM
        : dayjs(date).format('DD/MM/YYYY HH:mm');   // 22/09/2025 09:24
}

export function formatShortDateTime(date: Date | string, isUsCustomer: boolean = true): string {
    return isUsCustomer
        ? dayjs(date).format("MM/DD HH:mm")
        : dayjs(date).format("DD/MM HH:mm");
}

export function formatMins(date: Date | string): string {
    return dayjs(date).format('HH:mm');
}