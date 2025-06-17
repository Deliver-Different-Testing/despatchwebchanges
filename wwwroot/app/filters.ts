import {findIana} from "windows-iana";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Register the required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Returns a unique list of items based on a key property
 */
export function uniqueFilter(collection: any[], keyName: string): any[] {
    const output: any[] = [];
    const keys: any[] = [];

    collection.forEach(item => {
        const key = item[keyName];
        if (keys.indexOf(key) === -1) {
            keys.push(key);
            output.push(item);
        }
    });

    return output;
}

/**
 * Ensures a URL has http:// or https:// prefix
 */
export function urlFixFilter($url: string): string {
    const regExp = /(http(s?))\:\/\//gi;
    if (!regExp.test($url)) {
        $url = `https://${$url}`;
    }
    return $url;
}

/**
 * Gets an item by attribute
 */
export function getByAttrFilter(input: any[] | Record<string, any>, val: string, attr?: string): any {
    if (!attr) {
        const obj = input as Record<string, any>;
        for (let k in obj) {
            if (k === val) {
                return obj[k];
            }
        }
    } else {
        const arr = input as any[];
        let i = 0;
        const len = arr.length;
        for (; i < len; i++) {
            if (+arr[i][attr] === +val) {
                return arr[i];
            }
        }
    }
    return null;
}

/**
 * Maps input values using a provided mapping object
 */
export function switchFilter(input: any, map: Record<string, any>): any {
    return map[input] || "";
}

/**
 * Moves selected item to the top of the list
 */
export function selectedToTopFilter(contacts: any[], selected: any): any[] {
    const newList: any[] = [];
    contacts.forEach(u => {
        if (u.id === selected) {
            newList.unshift(u);
        } else {
            newList.push(u);
        }
    });
    return newList;
}

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
 * Returns an icon based on job status
 */
export function jobStatusIconFilter(status: string): string {
    switch (status.toUpperCase()) {
        case "NEW":
            return "fiber_new";
        case "PICKEDUP":
            return "local_shipping";
        case "ACCEPTED":
            return "check_circle";
        case "DISPATCHED":
            return "send";
        default:
            return "info";
    }
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
export function momentFormatFilter(dateString: string | Date, format: string): string {
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

        // Use Day.js to format in the target timezone
        const timeInZone = now.tz(ianaTimezone);

        // Still need Intl.DateTimeFormat for timezone abbreviation extraction
        // Day.js doesn't have built-in timezone abbreviation support
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimezone,
            timeZoneName: 'short'
        });

        // Format the Day.js date as a native Date for Intl formatter
        const formatted = formatter.format(timeInZone.toDate());
        const abbreviation = formatted.split(' ').pop();

        return abbreviation || timezone;
    } catch (error) {
        console.error('Error formatting timezone:', error, 'for timezone:', timezone);
        return timezone;
    }
}

/**
 * Converts minutes to time
 */
export function minutesToTimeFilter(minutes: number): string {
    if (!minutes || isNaN(minutes)) return '';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return hours + 'h ' + (mins < 10 ? '0' + mins : mins) + 'm';
}
