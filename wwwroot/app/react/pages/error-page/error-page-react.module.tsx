/**
 * Error Page React Module
 *
 * Entry point for the React-based Error Page component.
 * Provides functions to mount/unmount the error page in an AngularJS context.
 */

import React from 'react';
import {ErrorPage, ErrorType} from './ErrorPage';
import angular from 'angular';
import {islandTree} from '../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../components/common/mui-interop/MuiThemeIsland';
import {createPageHost} from '../../utils/reactPageHost';

export interface MountErrorPageConfig {
    errorType?: ErrorType;
    customTitle?: string;
    customMessage?: string;
    onGoHome?: () => void;
    onGoBack?: () => void;
}

const host = createPageHost<MountErrorPageConfig>({
    logName: 'ErrorPageReact',
    removeContainerOnUnmount: true,
    render: (config) => islandTree(
        <MuiThemeIsland>
            <ErrorPage
                errorType={config.errorType}
                customTitle={config.customTitle}
                customMessage={config.customMessage}
                onGoHome={config.onGoHome}
                onGoBack={config.onGoBack}
            />
        </MuiThemeIsland>
    ),
});

/**
 * Mounts the error page component into a container element
 */
export function mountErrorPage(containerId: string, config: MountErrorPageConfig = {}): void {
    host.mount(containerId, config);
}

/**
 * Unmounts the error page
 */
export function unmountErrorPage(): void {
    host.unmount();
}

// Expose globally for AngularJS access (typed via global.d.ts)
window.ReactErrorPage = {
    mount: mountErrorPage,
    unmount: unmountErrorPage,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const errorPageReactModule = window.angular!.module(
    'uDispatch.errorPageReact',
    []
);

// Provide a service that wraps the React component
errorPageReactModule.service('reactErrorPageService', [
    '$state',
    function($state: angular.ui.IStateService) {
        return {
            /**
             * Mount the React Error Page
             */
            mount: function(
                containerId: string,
                errorType?: ErrorType,
                customTitle?: string,
                customMessage?: string
            ) {
                mountErrorPage(containerId, {
                    errorType,
                    customTitle,
                    customMessage,
                    onGoHome: () => $state.go('home'),
                    onGoBack: () => window.history.back(),
                });
            },

            /**
             * Unmount and cleanup
             */
            unmount: unmountErrorPage,
        };
    }
]);

console.log('[ErrorPageReact] Module registered');

export default errorPageReactModule;
