import moment from 'moment-timezone';
import { findIana } from 'windows-iana';

class TimezoneConverter implements angular.IServiceProvider {
    private readonly ianaTimezone: string;

    constructor() {
        const tenantTimezone = TimeZone;
        this.ianaTimezone = this.convertToIana(tenantTimezone);

        if (!moment.tz.zone(this.ianaTimezone)) {
            throw new Error(`Invalid timezone: ${tenantTimezone} (converted to ${this.ianaTimezone})`);
        }
    }

    $get() {
        return this;
    }

    private convertToIana(timezone: string): string {
        try {
            const ianaTimezones = findIana(timezone);

            if (ianaTimezones && ianaTimezones.length > 0) {
                return ianaTimezones[0];
            }

            return timezone;
        } catch (error) {
            return timezone;
        }
    }

    format(date: Date | string | number): string {
        return moment(date).tz(this.ianaTimezone).format();
    }

    convertTimeZone(dateTime: Date | string, fromTimeZone: string, toTimeZone?: string): string {
        if (toTimeZone === undefined) {
            toTimeZone = this.ianaTimezone;
        }

        // If dateTime is a Date object, convert it to ISO string
        const dateInput = dateTime instanceof Date ? dateTime.toISOString() : dateTime;

        return moment.tz(dateInput, fromTimeZone).tz(toTimeZone).format();
    }

    getCurrentTimeInSelectedTimeZone(timeZone?: string): string {
        if(timeZone === undefined) {
            timeZone = this.ianaTimezone;
        }

        return moment().tz(timeZone).format('HH:mm');
    }
}

export default TimezoneConverter;
