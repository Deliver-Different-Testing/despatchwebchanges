/**
 * Dashboard Settings Dialog React Module
 *
 * Entry point for the React-based Dashboard Settings Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {
    DashboardSettingsDialog,
    DashboardSettingsConfig,
    DashboardSettingsResult,
    DashboardBox,
    RefreshOption,
} from './DashboardSettingsDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import angular from 'angular';

// State management for the dialog
interface DialogState {
    open: boolean;
    config: DashboardSettingsConfig;
    boxes: Record<string, DashboardBox>;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    resolve?: (value: DashboardSettingsResult | null) => void;
}

let dialogRoot: Root | null = null;
let dialogContainer: HTMLDivElement | null = null;
let dialogState: DialogState = {
    open: false,
    config: {title: 'Dashboard Settings'},
    boxes: {},
    refreshOptions: [],
};

/**
 * Generate refresh interval options
 * Mirrors the AngularJS getMinsSelectionOptions function
 */
function getMinsSelectionOptions(
    startSeconds: number = 30,
    intervalSeconds: number = 30,
    maxMinutes: number = 15
): RefreshOption[] {
    const options: RefreshOption[] = [];
    const maxSeconds = maxMinutes * 60;

    for (let seconds = startSeconds; seconds <= maxSeconds; seconds += intervalSeconds) {
        options.push({
            id: seconds,
            text: formatDuration(seconds),
        });
    }

    return options;
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
        return `${seconds} seconds`;
    } else if (remainingSeconds === 0) {
        return minutes === 1 ? `${minutes} min` : `${minutes} mins`;
    } else {
        const minText = minutes === 1 ? 'min' : 'mins';
        return `${minutes} ${minText} ${remainingSeconds} seconds`;
    }
}

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

    const handleSave = (result: DashboardSettingsResult) => {
        dialogState.open = false;
        dialogState.resolve?.(result);
        dialogState.resolve = undefined;
        renderDialog();
    };

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    dialogRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <DashboardSettingsDialog
                    open={dialogState.open}
                    config={dialogState.config}
                    boxes={dialogState.boxes}
                    selectedRefreshInterval={dialogState.selectedRefreshInterval}
                    selectedDriverLocationRefreshInterval={dialogState.selectedDriverLocationRefreshInterval}
                    refreshOptions={dialogState.refreshOptions}
                    onClose={handleClose}
                    onSave={handleSave}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );
}

/**
 * Initialize the dialog root (called once)
 */
function initializeDialogRoot(): void {
    if (dialogRoot) return;

    dialogContainer = document.createElement('div');
    dialogContainer.id = 'react-dashboard-settings-dialog-root';
    document.body.appendChild(dialogContainer);
    dialogRoot = createRoot(dialogContainer);
}

/**
 * Opens the dashboard settings dialog
 *
 * @param config - Dialog configuration (title, which sections to show)
 * @param boxes - Dashboard boxes with their visibility settings
 * @param selectedRefreshInterval - Currently selected job list refresh interval
 * @param selectedDriverLocationRefreshInterval - Currently selected driver location refresh interval
 * @returns Promise that resolves with the settings result, or null if cancelled
 */
export function openDashboardSettingsDialog(
    config: DashboardSettingsConfig,
    boxes: Record<string, DashboardBox>,
    selectedRefreshInterval?: RefreshOption,
    selectedDriverLocationRefreshInterval?: RefreshOption
): Promise<DashboardSettingsResult | null> {
    initializeDialogRoot();

    // Generate refresh options (disabled + time intervals)
    const refreshOptions: RefreshOption[] = [
        {id: 0, text: 'Disabled'},
        ...getMinsSelectionOptions(),
    ];

    return new Promise((resolve) => {
        dialogState = {
            open: true,
            config,
            boxes: {...boxes}, // Clone the boxes
            selectedRefreshInterval: selectedRefreshInterval ?? {id: 0, text: 'Disabled'},
            selectedDriverLocationRefreshInterval: selectedDriverLocationRefreshInterval ?? {id: 0, text: 'Disabled'},
            refreshOptions,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
(window as any).ReactDashboardSettingsDialog = {
    open: openDashboardSettingsDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const dashboardSettingsDialogReactModule = (window as any).angular.module(
    'uDispatch.dashboardSettingsDialogReact',
    []
);

console.log('[DashboardSettingsDialogReact] Module registered');

export default dashboardSettingsDialogReactModule;
