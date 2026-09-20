import React from 'react';
import {SettingsPage} from './SettingsPage';
import {MountSettingsConfig} from '../../interfaces';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {createPageHost} from '../../utils/reactPageHost';

const host = createPageHost<MountSettingsConfig>({
    logName: 'SettingsReact',
    render: () => islandTree(
        <ErrorBoundary>
            <SettingsPage/>
        </ErrorBoundary>
    ),
});

export function mountSettingsPage(containerId: string, config: MountSettingsConfig): void {
    host.mount(containerId, config);
}

export function unmountSettingsPage(): void {
    host.unmount();
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactSettings = {
    mount: mountSettingsPage,
    unmount: unmountSettingsPage,
};

const settingsReactModule = window.angular!.module('uDispatch.settingsReact', []);

console.log('[SettingsReact] Module registered');

export default settingsReactModule;
