import dayjs from "dayjs";

export function formatFullDate(date: Date | string, isUsCustomer: boolean = true): string {
    console.log('formatFullDate input:', date);
    const result = isUsCustomer
        ? dayjs(date).format('YYYY-DD-MM HH:mm:ss')
        : dayjs(date).format('YYYY-MM-DD HH:mm:ss');
    console.log('formatFullDate output:', result);
    return result;
}

export function formatShortDateTime(date: Date | string, isUsCustomer: boolean = true): string {
    console.log('formatShortDate input:', date);
    const result = isUsCustomer
        ? dayjs(date).format("MM/DD HH:mm")
        : dayjs(date).format("DD/MM HH:mm");
    console.log('formatShortDate output:', result);
    return result;
}

export function formatShortDateWithYear(date: Date | string, isUsCustomer: boolean = true): string {
    console.log('formatDateOnly input:', date);
    const result = isUsCustomer
        ? dayjs(date).format("MM/DD/YYYY")
        : dayjs(date).format("DD/MM/YYYY");
    console.log('formatDateOnly output:', result);
    return result;
}


export function formatMins(date: Date | string): string {
    console.log('formatMins input:', date);
    const result = dayjs(date).format('HH:mm');
    console.log('formatMins output:', result);
    return result;
}