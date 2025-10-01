import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function formatDateForApi(date: Date | dayjs.Dayjs | string): string {
    // Always use ISO 8601 format for backend communication
    // This removes timezone to get around timezone conversion issues.
    // Make sure to store the correct timezone in the db
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDateForApiWithTzs(date: Date | dayjs.Dayjs | string, timeZone?: string): string {
    if(!timeZone) timeZone = dayjs.tz.guess();
    // Provide the timeZone to ensure the correct conversion
    // Use this going forward to keep track of timezones properly
    // Defaults to the user's timezone if not provided'
    
    console.log('[formatDateForApiWithTzs] Starting conversion', {
        inputDate: date,
        timeZone: timeZone,
    });

    const result = dayjs.tz(date, timeZone).format();

    console.log('[formatDateForApiWithTzs] Conversion complete', {
        input: date,
        timeZone: timeZone,
        output: result,
        outputTimezone: dayjs.tz(date, timeZone).format('Z'), // logs the offset like +05:30
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