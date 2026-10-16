/**
 * Afterhours schedule interfaces for React components
 */

export interface AfterHoursCourierSchedule {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    days: string[];
    startTime?: string; // HH:mm format
    endTime?: string; // HH:mm format
    timezone?: string;
    duration: string;
}

export interface TimeZoneOption {
    id: number;
    text: string;
    timeZoneIana: string;
}

export interface CourierSuggestion {
    id: number;
    text: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
