import dayjs from "dayjs";

export function formatFullDate(date: Date | string, isUsCustomer: boolean = true): string {
    return isUsCustomer
        ? dayjs(date).format('YYYY-DD-MM HH:mm:ss')
        : dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatShortDateTime(date: Date | string, isUsCustomer: boolean = true): string {
    return isUsCustomer
        ? dayjs(date).format("MM/DD HH:mm")
        : dayjs(date).format("DD/MM HH:mm");
}

export function formatMins(date: Date | string): string {
    return dayjs(date).format('HH:mm');
}