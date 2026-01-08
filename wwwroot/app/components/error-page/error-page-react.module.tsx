/**
 * Error Page React Module
 *
 * Entry point for the React-based Error Page component.
 * Provides functions to mount/unmount the error page in an AngularJS context.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {ErrorPage, ErrorPageProps, ErrorType} from './ErrorPage';
import {getTheme} from '../../react/theme/muiTheme';

let errorPageRoot: Root | null = null;
let errorPageContainer: HTMLElement | null = null;

export interface MountErrorPageConfig {
    errorType?: ErrorType;
    customTitle?: string;
    customMessage?: string;
    onGoHome?: () => void;
    onGoBack?: () => void;
}

/**
 * Mounts the error page component into a container element
 */
export function mountErrorPage(
    containerId: string,
    config: MountErrorPageConfig = {}
): void {
    console.log('[ErrorPageReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (errorPageRoot && errorPageContainer && errorPageContainer.id !== containerId) {
        console.log('[ErrorPageReact] Unmounting previous error page from:', errorPageContainer.id);
        errorPageRoot.unmount();
        errorPageRoot = null;
        errorPageContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId);
    if (!container) {
        console.error('[ErrorPageReact] Container not found:', containerId);
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        console.log('[ErrorPageReact] Created fallback container');
    }

    errorPageContainer = container;

    // Create new root if needed
    if (!errorPageRoot) {
        console.log('[ErrorPageReact] Creating new React root');
        errorPageRoot = createRoot(container);
    }

    const currentTheme = getTheme();

    errorPageRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <ErrorPage
                errorType={config.errorType}
                customTitle={config.customTitle}
                customMessage={config.customMessage}
                onGoHome={config.onGoHome}
                onGoBack={config.onGoBack}
            />
        </ThemeProvider>
    );

    console.log('[ErrorPageReact] Error page rendered');
}

/**
 * Unmounts the error page
 */
export function unmountErrorPage(): void {
    if (errorPageRoot) {
        errorPageRoot.unmount();
        errorPageRoot = null;
    }

    if (errorPageContainer && errorPageContainer.parentNode) {
        errorPageContainer.parentNode.removeChild(errorPageContainer);
        errorPageContainer = null;
    }
}

// Expose globally for AngularJS access
(window as any).ReactErrorPage = {
    mount: mountErrorPage,
    unmount: unmountErrorPage,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const errorPageReactModule = (window as any).angular.module(
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
