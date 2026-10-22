/**
 * Edit Date Time Dialog Service
 *
 * React service for showing date/time edit dialogs.
 * Provides a clean API for React components to show date/time dialogs.
 */

import { Dayjs } from 'dayjs';
import type { ShowToastFn } from './toastService';
import { loadDialog } from '../components/dialogs/dialogRegistry';

/**
 * Result returned when the dialog is submitted
 */
export interface EditDateTimeDialogResult {
    fieldName: string;
    value: Dayjs;
    timezone: string;
}

/**
 * Options for showing a date/time dialog
 */
export interface EditDateTimeDialogOptions {
    /** Dialog title */
    title: string;
    /** Field name identifier for the result */
    fieldName: string;
    /** Initial date/time value */
    dateTime?: Dayjs;
    /** Default timezone for the job */
    defaultTimeZone?: string | {text?: string};
    /** Whether this is a US customer (shows timezone info) */
    isUSCustomer?: boolean;
}

/**
 * Internal options passed to the dialog manager
 */
interface InternalDialogOptions extends EditDateTimeDialogOptions {
    showDate: boolean;
    showTime: boolean;
}

/**
 * Show a time-only edit dialog
 *
 * @param options - Dialog options
 * @returns Promise that resolves with the result or null if cancelled
 *
 * @example
 * ```typescript
 * const result = await showEditTimeDialog({
 *     title: 'Edit ready time',
 *     fieldName: 'readyTime',
 *     dateTime: dayjs(),
 * });
 * if (result) {
 *     console.log('Selected time:', result.value.format('HH:mm'));
 * }
 * ```
 */
export async function showEditTimeDialog(
    options: EditDateTimeDialogOptions
): Promise<EditDateTimeDialogResult | null> {
    const manager = await loadDialog('EditDateTime');
    return manager.showEditTimeDialog({
        ...options,
        showDate: false,
        showTime: true,
    });
}

/**
 * Show a date-only edit dialog
 *
 * @param options - Dialog options
 * @returns Promise that resolves with the result or null if cancelled
 *
 * @example
 * ```typescript
 * const result = await showEditDateDialog({
 *     title: 'Edit delivery date',
 *     fieldName: 'deliveryDate',
 *     dateTime: dayjs(),
 * });
 * if (result) {
 *     console.log('Selected date:', result.value.format('YYYY-MM-DD'));
 * }
 * ```
 */
export async function showEditDateDialog(
    options: EditDateTimeDialogOptions
): Promise<EditDateTimeDialogResult | null> {
    const manager = await loadDialog('EditDateTime');
    return manager.showEditDateDialog({
        ...options,
        showDate: true,
        showTime: false,
    });
}

/**
 * Show a date and time edit dialog
 *
 * @param options - Dialog options
 * @returns Promise that resolves with the result or null if cancelled
 *
 * @example
 * ```typescript
 * const result = await showEditDateAndTimeDialog({
 *     title: 'Edit delivery by',
 *     fieldName: 'deliverBy',
 *     dateTime: dayjs(),
 *     defaultTimeZone: 'America/New_York',
 *     isUSCustomer: true,
 * });
 * if (result) {
 *     console.log('Selected:', result.value.format('YYYY-MM-DD HH:mm'));
 *     console.log('Timezone:', result.timezone);
 * }
 * ```
 */
export async function showEditDateAndTimeDialog(
    options: EditDateTimeDialogOptions
): Promise<EditDateTimeDialogResult | null> {
    const manager = await loadDialog('EditDateTime');
    return manager.showEditDateAndTimeDialog({
        ...options,
        showDate: true,
        showTime: true,
    });
}

/**
 * Set the toast service for showing notifications
 *
 * @param showToast - Function to show toast notifications
 *
 * @example
 * ```typescript
 * setToastService((message, type) => {
 *     toastr[type](message);
 * });
 * ```
 */
export async function setToastService(
    showToast: ShowToastFn
): Promise<void> {
    const manager = await loadDialog('EditDateTime');
    manager.setToastService({ showToast });
}

/**
 * Edit Date Time Dialog Service
 *
 * Provides methods for showing date/time edit dialogs.
 */
export const editDateTimeDialogService = {
    showEditTimeDialog,
    showEditDateDialog,
    showEditDateAndTimeDialog,
    setToastService,
};

export default editDateTimeDialogService;
