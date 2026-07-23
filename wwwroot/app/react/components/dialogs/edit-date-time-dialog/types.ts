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
    /** True when the user chose to clear the value rather than pick a new one. */
    cleared?: boolean;
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
    /** When true the dialog opens in view-only mode: fields disabled, no Save. */
    readOnly?: boolean;
    /** When true a "Clear" action is shown that submits with `cleared: true` to remove the value. */
    allowClear?: boolean;
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
    readOnly?: boolean;
    allowClear?: boolean;
}
