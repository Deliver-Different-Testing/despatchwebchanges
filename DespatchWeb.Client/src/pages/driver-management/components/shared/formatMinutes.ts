/** "7h 30m"; rounds to whole minutes first so 59.6 becomes "1h 0m", never "0h 60m". */
export function formatMinutes(totalMinutes: number): string {
    const rounded = Math.max(0, Math.round(totalMinutes));
    if (rounded === 0) return '0m';
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}
