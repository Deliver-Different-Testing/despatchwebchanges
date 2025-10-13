export enum DaysOfWeek {
    None = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 4,
    Thursday = 8,
    Friday = 16,
    Saturday = 32,
    Sunday = 64,
    Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday,
    Weekend = Saturday | Sunday,
    All = Weekdays | Weekend
}

// Helper functions that work with the enum
export const DaysOfWeekHelpers = {
    allDays: [
        DaysOfWeek.Monday,
        DaysOfWeek.Tuesday,
        DaysOfWeek.Wednesday,
        DaysOfWeek.Thursday,
        DaysOfWeek.Friday,
        DaysOfWeek.Saturday,
        DaysOfWeek.Sunday,
    ] as const,

    // Use a Record type for proper type safety
    dayLabels: {
        [DaysOfWeek.Monday]: 'Monday',
        [DaysOfWeek.Tuesday]: 'Tuesday',
        [DaysOfWeek.Wednesday]: 'Wednesday',
        [DaysOfWeek.Thursday]: 'Thursday',
        [DaysOfWeek.Friday]: 'Friday',
        [DaysOfWeek.Saturday]: 'Saturday',
        [DaysOfWeek.Sunday]: 'Sunday',
    } as Record<DaysOfWeek, string>,

    bitwiseToArray(bitmap: DaysOfWeek | number): DaysOfWeek[] {
        return this.allDays.filter(day => (bitmap & day) === day);
    },

    arrayToBitwise(days: DaysOfWeek[]): DaysOfWeek {
        return days.reduce((acc, day) => acc | day, DaysOfWeek.None);
    },

    hasDay(bitmap: DaysOfWeek | number, day: DaysOfWeek): boolean {
        return (bitmap & day) === day;
    },

    toDisplayString(bitmap: DaysOfWeek | number): string {
        const days = this.bitwiseToArray(bitmap);
        if (days.length === 0) return 'None';
        if (days.length === 7) return 'Every day';
        return days.map(d => this.dayLabels[d]).join(', ');
    }
};