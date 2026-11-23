/** Decimal hours as "12.50"; blank when hours are not provided (the tenant hides them from dispatchers). */
export function formatHoursDecimal(hours: number | null | undefined): string {
    return hours == null ? '' : hours.toFixed(2);
}
