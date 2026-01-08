/**
 * Auto Complete Dialog React Module
 *
 * Entry point for the React-based Auto Complete Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {AutoCompleteDialog, Suggestion} from './AutoCompleteDialog';
import {getTheme} from '../../../react/theme/muiTheme';

// Result interface for the dialog
export interface AutoCompleteResult {
    item: Suggestion;
    shouldRerate: boolean;
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

    const handleSubmit = (item: Suggestion, shouldRerate: boolean) => {
        dialogState.open = false;
        dialogState.resolve?.({item, shouldRerate});
        dialogState.resolve = undefined;
        renderDialog();
    };

    const handleSearch = async (searchTerm: string): Promise<Suggestion[]> => {
        if (!dialogState.searchFn) return [];
        return dialogState.searchFn(searchTerm);
    };

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <AutoCompleteDialog
                open={dialogState.open}
                title={dialogState.title}
                placeholder={dialogState.placeholder}
                itemIcon={dialogState.itemIcon}
                existingItem={dialogState.existingItem}
                showRerateOption={dialogState.showRerateOption}
                minInputLength={dialogState.minInputLength}
                onClose={handleClose}
                onSubmit={handleSubmit}
                onSearch={handleSearch}
            />
        </ThemeProvider>
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
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
(window as any).ReactAutoCompleteDialog = {
    open: openAutoCompleteDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const autoCompleteDialogReactModule = (window as any).angular.module(
    'uDispatch.autoCompleteDialogReact',
    []
);

console.log('[AutoCompleteDialogReact] Module registered');

export default autoCompleteDialogReactModule;
