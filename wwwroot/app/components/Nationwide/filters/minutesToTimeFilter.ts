/**
 * Converts minutes to time
 */
export function minutesToTimeFilter(minutes: number): string {
    if (!minutes || isNaN(minutes)) return '';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return hours + 'h ' + (mins < 10 ? '0' + mins : mins) + 'm';
}
