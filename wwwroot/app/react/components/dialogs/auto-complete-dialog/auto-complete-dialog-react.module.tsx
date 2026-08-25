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
import {AutoCompleteDialog, AssignTypeOption, Suggestion} from './AutoCompleteDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

// Result interface for the dialog
export interface AutoCompleteResult {
    item: Suggestion;
    shouldRerate: boolean;
    /** Populated only when the dialog was opened via openWithTypes. */
    selectedType?: string;
}

interface AutoCompletePayload {
    title: string;
    placeholder: string;
    itemIcon: string;
    existingItem?: Suggestion;
    showRerateOption: boolean;
    minInputLength: number;
    searchFn: (searchTerm: string) => Promise<Suggestion[]>;
    typeOptions?: AssignTypeOption[];
    initialTypeValue?: string;
}

const host = createDialogHost<AutoCompletePayload, AutoCompleteResult | null>({
    containerId: 'react-auto-complete-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <AutoCompleteDialog
            open={open}
            title={payload.title}
            placeholder={payload.placeholder}
            itemIcon={payload.itemIcon}
            existingItem={payload.existingItem}
            showRerateOption={payload.showRerateOption}
            minInputLength={payload.minInputLength}
            typeOptions={payload.typeOptions}
            initialTypeValue={payload.initialTypeValue}
            onClose={() => close(null)}
            onSubmit={(item, shouldRerate, selectedType) => close({item, shouldRerate, selectedType})}
            onSearch={(searchTerm) => payload.searchFn(searchTerm)}
        />
    ),
});

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
    return host.open({
        title,
        placeholder,
        itemIcon,
        existingItem,
        showRerateOption,
        minInputLength,
        searchFn,
        typeOptions: undefined,
        initialTypeValue: undefined,
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
    if (!typeOptions || typeOptions.length === 0) {
        throw new Error('openAutoCompleteDialogWithTypes requires at least one typeOption.');
    }

    return host.open({
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
