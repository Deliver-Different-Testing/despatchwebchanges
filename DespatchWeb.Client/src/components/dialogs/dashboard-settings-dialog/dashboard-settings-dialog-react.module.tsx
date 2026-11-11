/**
 * Dashboard Settings Dialog React Module
 *
 * Entry point for the React-based Dashboard Settings Dialog.
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
import {getMinsSelectionOptions} from '../../../utils/MinsSelectionOptions';
import {createDialogHost} from '../../../utils/reactDialogHost';
import type {CourierDisplayMode} from '../../../types';

interface DashboardSettingsPayload {
    config: DashboardSettingsConfig;
    selectedRefreshInterval: RefreshOption;
    selectedDriverLocationRefreshInterval: RefreshOption;
    selectedTaskRefreshInterval: RefreshOption;
    refreshOptions: RefreshOption[];
    selectedCourierDisplayMode?: CourierDisplayMode;
}

const DISABLED_REFRESH: RefreshOption = {id: 0, text: 'Disabled'};

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
            selectedCourierDisplayMode={payload.selectedCourierDisplayMode}
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
    selectedCourierDisplayMode?: CourierDisplayMode,
): Promise<DashboardSettingsResult | null> {
    return settingsHost.open({
        config,
        selectedRefreshInterval: selectedRefreshInterval ?? DISABLED_REFRESH,
        selectedDriverLocationRefreshInterval: selectedDriverLocationRefreshInterval ?? DISABLED_REFRESH,
        selectedTaskRefreshInterval: selectedTaskRefreshInterval ?? DISABLED_REFRESH,
        refreshOptions: [DISABLED_REFRESH, ...getMinsSelectionOptions()],
        selectedCourierDisplayMode,
    });
}

export const reactDashboardSettingsDialog = {
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

export const reactCustomizePanelsDialog = {
    open: openCustomizePanelsDialog,
};
