/**
 * Select Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

/**
 * An item in the select dropdown (mirrors ISuggestion)
 */
export interface SelectDialogItem {
    id: number;
    text: string;
}

/**
 * Result returned when the dialog is submitted
 */
export interface SelectDialogResult {
    fieldName: string;
    value: number;
    checkboxValue?: boolean;
}

/**
 * Props for the SelectDialog component
 */
export interface SelectDialogProps {
    open: boolean;
    title: string;
    fieldName: string;
    items: SelectDialogItem[];
    initialValue?: string | number | null;
    warningMessage?: string;
    showCheckbox?: boolean;
    checkboxLabel?: string;
    onClose: () => void;
    onSubmit: (result: SelectDialogResult) => void | Promise<void>;
    showToast: ShowToastFn;
}

/**
 * Options passed when opening the dialog from AngularJS
 */
export interface SelectDialogOptions {
    title: string;
    fieldName: string;
    items: SelectDialogItem[];
    initialValue?: string | number | null;
    showCheckbox?: boolean;
    checkboxLabel?: string;
}
