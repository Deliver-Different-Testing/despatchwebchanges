import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {findIana} from "windows-iana";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Short timezone label such as "(PST)"; empty for NZ, where dispatchers asked for none. */
export function timezoneShort(timezone: string): string {
    if (!timezone) return '';

    try {
        const now = dayjs();

        const ianaTimezones = findIana(timezone);
        const ianaTimezone = ianaTimezones && ianaTimezones.length > 0
            ? ianaTimezones[0]
            : timezone;

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
