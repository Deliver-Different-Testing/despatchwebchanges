/**
 * React Error Page Directive
 *
 * An AngularJS directive that wraps the React Error Page component.
 */

import {ErrorType} from '../../react/pages/error-page/ErrorPage';

interface ReactErrorPageScope extends angular.IScope {
    errorType?: string;
    customTitle?: string;
    customMessage?: string;
}

function reactErrorPageDirective(
    $ocLazyLoad: oc.ILazyLoad,
    $state: angular.ui.IStateService
): angular.IDirective<ReactErrorPageScope> {
    return {
        restrict: 'E',
        scope: {
            errorType: '@?',
            customTitle: '@?',
            customMessage: '@?',
        },
        template: '<div class="react-error-page-container"></div>',
        link: function(
            scope: ReactErrorPageScope,
            element: angular.IAugmentedJQuery
        ) {
            let mounted = false;

            // Create a unique container ID
            const containerId = 'react-error-page-' + Math.random().toString(36).substring(2, 9);
            const containerEl = element.find('.react-error-page-container')[0];
            containerEl.id = containerId;

            // Load and mount the React Error Page
            const mountErrorPage = async () => {
                try {
                    console.log('[ReactErrorPageDirective] Loading React Error Page module...');

                    // Fetch manifest for asset path resolution
                    const manifestResponse = await fetch('dist/manifest.json');
                    const manifest = await manifestResponse.json();
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

                    // Load vendor-react first (if not already loaded)
                    if (!(window as any).React) {
                        console.log('[ReactErrorPageDirective] Loading vendor-react...');
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }

                    // Load the React Error Page module
                    await $ocLazyLoad.load({
                        name: 'uDispatch.errorPageReact',
                        files: [getAssetPath('errorPageReact.js')]
                    });

                    console.log('[ReactErrorPageDirective] Module loaded, checking for ReactErrorPage...');

                    const ReactErrorPage = (window as any).ReactErrorPage;
                    if (!ReactErrorPage) {
                        console.error('[ReactErrorPageDirective] ReactErrorPage not found on window after loading');
                        return;
                    }

                    console.log('[ReactErrorPageDirective] Mounting to container:', containerId);

                    // Mount the error page
                    ReactErrorPage.mount(containerId, {
                        errorType: scope.errorType as ErrorType,
                        customTitle: scope.customTitle,
                        customMessage: scope.customMessage,
                        onGoHome: () => $state.go('home'),
                        onGoBack: () => window.history.back(),
                    });

                    mounted = true;
                    console.log('[ReactErrorPageDirective] Mounted successfully');

                } catch (error) {
                    console.error('[ReactErrorPageDirective] Error mounting React Error Page:', error);
                }
            };

            // Mount on init
            mountErrorPage();

            // Cleanup on destroy
            scope.$on('$destroy', () => {
                console.log('[ReactErrorPageDirective] Destroying...');

                if (mounted) {
                    const ReactErrorPage = (window as any).ReactErrorPage;
                    if (ReactErrorPage) {
                        ReactErrorPage.unmount();
                    }
                }
            });
        }
    };
}

reactErrorPageDirective.$inject = ['$ocLazyLoad', '$state'];

export default reactErrorPageDirective;
