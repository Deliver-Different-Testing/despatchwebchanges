/**
 * Dashboard Settings Dialog React Module
 *
 * Entry point for the React-based Dashboard Settings Dialog.
 * Exposes a global function to open the dialog from AngularJS.
 */

import React from 'react';
import {
    DashboardSettingsDialog,
    DashboardSettingsConfig,
    DashboardSettingsResult,
    DashboardBox,
    RefreshOption,
} from './DashboardSettingsDialog';
import {CustomizePanelsDialog} from '../customize-panels-dialog/CustomizePanelsDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {createDialogHost} from '../../../utils/reactDialogHost';

interface DashboardSettingsPayload {
    config: DashboardSettingsConfig;
    selectedRefreshInterval: RefreshOption;
    selectedDriverLocationRefreshInterval: RefreshOption;
    selectedTaskRefreshInterval: RefreshOption;
    refreshOptions: RefreshOption[];
    nationwideBetaEnabled?: boolean;
}

const DISABLED_REFRESH: RefreshOption = {id: 0, text: 'Disabled'};

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

const settingsHost = createDialogHost<DashboardSettingsPayload, DashboardSettingsResult | null>({
    containerId: 'react-dashboard-settings-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <DashboardSettingsDialog
            open={open}
            config={payload.config}
            selectedRefreshInterval={payload.selectedRefreshInterval}
            selectedDriverLocationRefreshInterval={payload.selectedDriverLocationRefreshInterval}
            selectedTaskRefreshInterval={payload.selectedTaskRefreshInterval}
            refreshOptions={payload.refreshOptions}
            nationwideBetaEnabled={payload.nationwideBetaEnabled}
            onClose={() => close(null)}
            onSave={(result: DashboardSettingsResult) => close(result)}
        />
    ),
});

export function openDashboardSettingsDialog(
    config: DashboardSettingsConfig,
    selectedRefreshInterval?: RefreshOption,
    selectedDriverLocationRefreshInterval?: RefreshOption,
    selectedTaskRefreshInterval?: RefreshOption,
    nationwideBetaEnabled?: boolean,
): Promise<DashboardSettingsResult | null> {
    return settingsHost.open({
        config,
        selectedRefreshInterval: selectedRefreshInterval ?? DISABLED_REFRESH,
        selectedDriverLocationRefreshInterval: selectedDriverLocationRefreshInterval ?? DISABLED_REFRESH,
        selectedTaskRefreshInterval: selectedTaskRefreshInterval ?? DISABLED_REFRESH,
        refreshOptions: [DISABLED_REFRESH, ...getMinsSelectionOptions()],
        nationwideBetaEnabled,
    });
}

// Expose globally for AngularJS access
window.ReactDashboardSettingsDialog = {
    open: openDashboardSettingsDialog,
};

const panelsHost = createDialogHost<
    {title?: string; boxes: Record<string, DashboardBox>; layoutEditable: boolean},
    Record<string, DashboardBox> | null
>({
    containerId: 'react-customize-panels-dialog-root',
    render: ({open, payload, close}) => islandTree(
        <CustomizePanelsDialog
            open={open}
            title={payload.title}
            boxes={payload.boxes}
            layoutEditable={payload.layoutEditable}
            onClose={() => close(null)}
            onSave={close}
        />
    ),
});

export function openCustomizePanelsDialog(
    boxes: Record<string, DashboardBox>,
    title?: string,
    layoutEditable = true,
): Promise<Record<string, DashboardBox> | null> {
    return panelsHost.open({title, boxes: {...boxes}, layoutEditable});
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
