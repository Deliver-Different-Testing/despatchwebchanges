/**
 * Auto Complete Dialog React Module
 *
 * Entry point for the React-based Auto Complete Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 *
 * Also exposes `openWithTypes` for the 3-way Assign Route picker
 * (Steve 2026-05-26, HANDOVER-KEVIN-2026-05-26.md) — same modal,
 * adds a Type radio row above the dropdown, returns the selected
 * radio value alongside the picked item so the caller routes the
 * write to the right column.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {AutoCompleteDialog, AssignTypeOption, Suggestion} from './AutoCompleteDialog';
import {DfrntMantineProvider} from '../../../theme/DfrntMantineProvider';

// Result interface for the dialog
export interface AutoCompleteResult {
    item: Suggestion;
    shouldRerate: boolean;
    /** Populated only when the dialog was opened via openWithTypes. */
    selectedType?: string;
}

// State management for the dialog
interface DialogState {
    open: boolean;
    title: string;
    placeholder: string;
    itemIcon: string;
    existingItem?: Suggestion;
    showRerateOption: boolean;
    minInputLength: number;
    searchFn: ((searchTerm: string) => Promise<Suggestion[]>) | null;
    typeOptions?: AssignTypeOption[];
    initialTypeValue?: string;
    resolve?: (value: AutoCompleteResult | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    title: '',
    placeholder: '',
    itemIcon: 'topic',
    showRerateOption: false,
    minInputLength: 2,
    searchFn: null,
};

/**
 * Renders the dialog with current state
 */
function renderDialog(): void {
    if (!dialogRoot) return;

    const handleClose = () => {
        dialogState.open = false;
        dialogState.resolve?.(null);
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSubmit = (item: Suggestion, shouldRerate: boolean, selectedType?: string) => {
        dialogState.open = false;
        dialogState.resolve?.({item, shouldRerate, selectedType});
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSearch = async (searchTerm: string): Promise<Suggestion[]> => {
        if (!dialogState.searchFn) return [];
        return dialogState.searchFn(searchTerm);
    };

    // Get theme dynamically based on customer region
    dialogRoot.render(
        <DfrntMantineProvider>
                <AutoCompleteDialog
                    open={dialogState.open}
                    title={dialogState.title}
                    placeholder={dialogState.placeholder}
                    itemIcon={dialogState.itemIcon}
                    existingItem={dialogState.existingItem}
                    showRerateOption={dialogState.showRerateOption}
                    minInputLength={dialogState.minInputLength}
                    typeOptions={dialogState.typeOptions}
                    initialTypeValue={dialogState.initialTypeValue}
                    onClose={handleClose}
                    onSubmit={handleSubmit}
                    onSearch={handleSearch}
                />
            </DfrntMantineProvider>
    );
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-auto-complete-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the auto complete dialog
 *
 * @param title - Dialog title
 * @param placeholder - Placeholder text for the search input
 * @param searchFn - Function to perform the search
 * @param existingItem - Pre-selected item (optional)
 * @param showRerateOption - Whether to show the re-rate checkbox
 * @param itemIcon - Icon name for list items
 * @param minInputLength - Minimum characters before search triggers
 * @returns Promise that resolves with the selected item and rerate flag, or null if cancelled
 */
export function openAutoCompleteDialog(
    title: string,
    placeholder: string,
    searchFn: (searchTerm: string) => Promise<Suggestion[]>,
    existingItem?: Suggestion,
    showRerateOption: boolean = false,
    itemIcon: string = 'topic',
    minInputLength: number = 2
): Promise<AutoCompleteResult | null> {
    initializeDialogRoot();

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            title,
            placeholder,
            itemIcon,
            existingItem,
            showRerateOption,
            minInputLength,
            searchFn,
            typeOptions: undefined,
            initialTypeValue: undefined,
            resolve,
        };
        renderDialog();
    });
}

/**
 * Opens the auto complete dialog with a Type radio row (Courier / Agent / NP).
 *
 * Same modal as openAutoCompleteDialog but adds a radio above the dropdown.
 * The radio determines which search backend the dropdown queries; the resolved
 * result carries `selectedType` so the caller routes the write to the right
 * target column (Steve 2026-05-26, HANDOVER-KEVIN-2026-05-26.md).
 *
 * The dialog-level `searchFn` here is the FALLBACK — under normal radio
 * operation each AssignTypeOption supplies its own `onSearch`.
 */
export function openAutoCompleteDialogWithTypes(
    title: string,
    typeOptions: AssignTypeOption[],
    options?: {
        existingItem?: Suggestion;
        initialTypeValue?: string;
        showRerateOption?: boolean;
        minInputLength?: number;
        itemIcon?: string;
    }
): Promise<AutoCompleteResult | null> {
    initializeDialogRoot();

    if (!typeOptions || typeOptions.length === 0) {
        throw new Error('openAutoCompleteDialogWithTypes requires at least one typeOption.');
    }

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            title,
            // Placeholder is per-type — the dialog reads it from the active
            // AssignTypeOption. Pass empty string as the dialog-level default.
            placeholder: '',
            itemIcon: options?.itemIcon ?? 'topic',
            existingItem: options?.existingItem,
            showRerateOption: options?.showRerateOption ?? false,
            minInputLength: options?.minInputLength ?? 2,
            // Fallback when no AssignTypeOption matches — returns empty list.
            searchFn: async () => [],
            typeOptions,
            initialTypeValue: options?.initialTypeValue ?? typeOptions[0].value,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactAutoCompleteDialog = {
    open: openAutoCompleteDialog,
    openWithTypes: openAutoCompleteDialogWithTypes,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const autoCompleteDialogReactModule = window.angular!.module(
    'uDispatch.autoCompleteDialogReact',
    []
);

console.log('[AutoCompleteDialogReact] Module registered');

export default autoCompleteDialogReactModule;
