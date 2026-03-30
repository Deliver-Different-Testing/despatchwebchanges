/**
 * Edit Date Time Dialog Types
 */

import { Dayjs } from 'dayjs';
import type { ShowToastFn } from '../../../services/toastService';

/**
 * Job property field names for identifying which field is being edited
 */
export type JobPropertyField = string;

/**
 * Dialog mode configuration
 */
export type DateTimeMode = 'date' | 'time' | 'datetime';

/**
 * Result returned when the dialog is submitted
 */
export interface EditDateTimeDialogResult {
    fieldName: JobPropertyField;
    value: Dayjs;
    timezone: string;
}

/**
 * Props for the EditDateTimeDialog component
 */
export interface EditDateTimeDialogProps {
    open: boolean;
    title: string;
    fieldName: JobPropertyField;
    dateTime?: Dayjs;
    defaultTimeZone?: string;
    showDate?: boolean;
    showTime?: boolean;
    isUSCustomer?: boolean;
    onClose: () => void;
    onSubmit: (result: EditDateTimeDialogResult) => void | Promise<void>;
    showToast: ShowToastFn;
}

/**
 * Options passed when opening the dialog from AngularJS
 */
export interface EditDateTimeDialogOptions {
    title: string;
    fieldName: JobPropertyField;
    dateTime?: Dayjs;
    defaultTimeZone?: string;
    showDate?: boolean;
    showTime?: boolean;
    isUSCustomer?: boolean;
}
