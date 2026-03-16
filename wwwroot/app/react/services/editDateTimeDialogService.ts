/**
 * Edit Date Time Dialog Service
 *
 * React service for showing date/time edit dialogs.
 * Provides a clean API for React components to show date/time dialogs.
 */

import { Dayjs } from 'dayjs';
import type { ShowToastFn } from './toastService';

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
    defaultTimeZone?: string;
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
 * Window interface for the React dialog
 */
interface ReactEditDateTimeDialogWindow {
    showEditTimeDialog: (options: InternalDialogOptions) => Promise<EditDateTimeDialogResult | null>;
    showEditDateDialog: (options: InternalDialogOptions) => Promise<EditDateTimeDialogResult | null>;
    showEditDateAndTimeDialog: (options: InternalDialogOptions) => Promise<EditDateTimeDialogResult | null>;
    setToastService: (service: { showToast: ShowToastFn }) => void;
}

/**
 * Get the React dialog manager from window
 */
function getDialogManager(): ReactEditDateTimeDialogWindow {
    const manager = window.ReactEditDateTimeDialog as ReactEditDateTimeDialogWindow | undefined;
    if (!manager) {
        throw new Error('EditDateTimeDialog React module not loaded. Ensure the module is loaded before calling dialog functions.');
    }
    return manager;
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
 *     title: 'Edit Ready Time',
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
    const manager = getDialogManager();
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
 *     title: 'Edit Delivery Date',
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
    const manager = getDialogManager();
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
 *     title: 'Edit Delivery By',
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
    const manager = getDialogManager();
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
export function setToastService(
    showToast: ShowToastFn
): void {
    const manager = getDialogManager();
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
