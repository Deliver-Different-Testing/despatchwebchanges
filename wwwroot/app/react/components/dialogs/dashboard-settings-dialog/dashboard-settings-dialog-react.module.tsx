/**
 * Dashboard Settings Dialog React Module
 *
 * Entry point for the React-based Dashboard Settings Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
    DashboardSettingsDialog,
    DashboardSettingsConfig,
    DashboardSettingsResult,
    DashboardBox,
    RefreshOption,
} from './DashboardSettingsDialog';
import {CustomizePanelsDialog} from '../customize-panels-dialog/CustomizePanelsDialog';
import {getTheme} from '../../../theme/muiTheme';
import {ReactQueryProvider} from '../../../query';
import {isAiAutoOpenEnabled, setAiAutoOpenEnabled} from '../../../../functions/aiSettings';

// State management for the dialogue
interface DialogState {
    open: boolean;
    config: DashboardSettingsConfig;
    boxes: Record<string, DashboardBox>;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    aiEnabled?: boolean;
    aiAutoOpen?: boolean;
    jobSearchBetaEnabled?: boolean;
    dispatchBetaEnabled?: boolean;
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
        // The "Open automatically" preference is owned by this bridge: seeded
        // from localStorage and persisted here so the AngularJS callers don't
        // need to know about it.
        if (result.aiAutoOpen !== undefined) {
            setAiAutoOpenEnabled(result.aiAutoOpen);
        }
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
                <CssBaseline/>
                <DashboardSettingsDialog
                    open={dialogState.open}
                    config={dialogState.config}
                    boxes={dialogState.boxes}
                    selectedRefreshInterval={dialogState.selectedRefreshInterval}
                    selectedDriverLocationRefreshInterval={dialogState.selectedDriverLocationRefreshInterval}
                    selectedTaskRefreshInterval={dialogState.selectedTaskRefreshInterval}
                    refreshOptions={dialogState.refreshOptions}
                    aiEnabled={dialogState.aiEnabled}
                    aiAutoOpen={dialogState.aiAutoOpen}
                    jobSearchBetaEnabled={dialogState.jobSearchBetaEnabled}
                    dispatchBetaEnabled={dialogState.dispatchBetaEnabled}
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

export function openDashboardSettingsDialog(
    config: DashboardSettingsConfig,
    boxes: Record<string, DashboardBox>,
    selectedRefreshInterval?: RefreshOption,
    selectedDriverLocationRefreshInterval?: RefreshOption,
    selectedTaskRefreshInterval?: RefreshOption,
    aiEnabled?: boolean,
    jobSearchBetaEnabled?: boolean,
    dispatchBetaEnabled?: boolean,
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
            selectedTaskRefreshInterval: selectedTaskRefreshInterval ?? {id: 0, text: 'Disabled'},
            refreshOptions,
            aiEnabled,
            aiAutoOpen: isAiAutoOpenEnabled(),
            jobSearchBetaEnabled,
            dispatchBetaEnabled,
            resolve,
        };
        renderDialog();
    });
}

// Expose globally for AngularJS access
window.ReactDashboardSettingsDialog = {
    open: openDashboardSettingsDialog,
};

interface CustomizePanelsState {
    open: boolean;
    title?: string;
    boxes: Record<string, DashboardBox>;
    layoutEditable?: boolean;
    resolve?: (value: Record<string, DashboardBox> | null) => void;
}

let panelsRoot: Root | null = null;
let panelsContainer: HTMLDivElement | null = null;
let panelsState: CustomizePanelsState = {open: false, boxes: {}};

function renderPanelsDialog(): void {
    if (!panelsRoot) return;

    const handleClose = () => {
        panelsState.open = false;
        panelsState.resolve?.(null);
        panelsState.resolve = undefined;
        renderPanelsDialog();
    };

    const handleSave = (boxes: Record<string, DashboardBox>) => {
        panelsState.open = false;
        panelsState.resolve?.(boxes);
        panelsState.resolve = undefined;
        renderPanelsDialog();
    };

    const currentTheme = getTheme();

    panelsRoot.render(
        <ReactQueryProvider>
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <CustomizePanelsDialog
                    open={panelsState.open}
                    title={panelsState.title}
                    boxes={panelsState.boxes}
                    layoutEditable={panelsState.layoutEditable ?? true}
                    onClose={handleClose}
                    onSave={handleSave}
                />
            </ThemeProvider>
        </ReactQueryProvider>
    );
}

function initializePanelsRoot(): void {
    if (panelsRoot) return;
    panelsContainer = document.createElement('div');
    panelsContainer.id = 'react-customize-panels-dialog-root';
    document.body.appendChild(panelsContainer);
    panelsRoot = createRoot(panelsContainer);
}

export function openCustomizePanelsDialog(
    boxes: Record<string, DashboardBox>,
    title?: string,
    layoutEditable = true,
): Promise<Record<string, DashboardBox> | null> {
    initializePanelsRoot();
    return new Promise((resolve) => {
        panelsState = {open: true, title, boxes: {...boxes}, layoutEditable, resolve};
        renderPanelsDialog();
    });
}

window.ReactCustomizePanelsDialog = {
    open: openCustomizePanelsDialog,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const dashboardSettingsDialogReactModule = window.angular!.module(
    'uDispatch.dashboardSettingsDialogReact',
    []
);

console.log('[DashboardSettingsDialogReact] Module registered');

export default dashboardSettingsDialogReactModule;
