import dayjs from "dayjs";

export function formatDateForApi(date: Date | string): string {
    // Always use ISO 8601 format for backend communication
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
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