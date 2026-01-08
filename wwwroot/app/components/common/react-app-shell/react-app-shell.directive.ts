/**
 * React App Shell Directive
 *
 * An AngularJS directive that wraps the React App Shell component.
 * This makes it easy to use the React toolbar and sidenav across all pages.
 */

interface ReactAppShellScope extends angular.IScope {
    title: string;
    messagesCount?: number;
    onMessagesClick?: (event: { $event: MouseEvent }) => void;
    views?: any[];
    viewsLoading?: boolean;
    onToggleView?: (args: { view: any }) => void;
    onClearAllViews?: () => void;
    layouts?: any[];
    currentLayoutName?: string;
    onSaveLayout?: () => void;
    onLoadLayout?: (args: { index: number }) => void;
    onDeleteLayout?: (args: { index: number }) => void;
    onSettingsClick?: (event: { $event: MouseEvent }) => void;
    onRefreshClick?: () => void;
    refreshLoading?: boolean;
    // Date filter
    dateFilterData?: any;
    appPage?: string;
    onDateFilterRefresh?: (args: { dateFilterData: any }) => void;
}

function reactAppShellDirective(
    $ocLazyLoad: oc.ILazyLoad,
    $state: angular.ui.IStateService,
    navigationService: any,
    APP_CONFIG: any,
    $rootScope: angular.IRootScopeService,
    toastrService: any
): angular.IDirective<ReactAppShellScope> {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            messagesCount: '<?',
            onMessagesClick: '&?',
            views: '<?',
            viewsLoading: '<?',
            onToggleView: '&?',
            onClearAllViews: '&?',
            layouts: '<?',
            currentLayoutName: '<?',
            onSaveLayout: '&?',
            onLoadLayout: '&?',
            onDeleteLayout: '&?',
            onSettingsClick: '&?',
            onRefreshClick: '&?',
            refreshLoading: '<?',
            // Date filter
            dateFilterData: '<?',
            appPage: '@?',
            onDateFilterRefresh: '&?',
        },
        template: '<div class="react-app-shell-container"></div>',
        link: function(
            scope: ReactAppShellScope,
            element: angular.IAugmentedJQuery,
            _attrs: angular.IAttributes
        ) {
            let mounted = false;
            let stateChangeListener: (() => void) | null = null;

            // Create a unique container ID
            const containerId = 'react-app-shell-' + Math.random().toString(36).substring(2, 9);
            const containerEl = element.find('.react-app-shell-container')[0];
            containerEl.id = containerId;

            // Update toolbar actions when scope changes
            const updateToolbarActions = () => {
                if (!mounted) return;

                const ReactAppShell = (window as any).ReactAppShell;
                if (!ReactAppShell) return;

                const actions: any = {};

                // Messages
                if (scope.onMessagesClick) {
                    actions.messages = {
                        unreadCount: scope.messagesCount || 0,
                        onClick: (event: MouseEvent) => {
                            scope.$apply(() => {
                                scope.onMessagesClick!({ $event: event });
                            });
                        },
                    };
                }

                // Date filter - React component
                // Only show if callback is provided AND dateFilterData is not explicitly null
                if (scope.onDateFilterRefresh && scope.dateFilterData !== null) {
                    actions.dateFilter = {
                        data: scope.dateFilterData ? {
                            startDate: scope.dateFilterData.startDate,
                            endDate: scope.dateFilterData.endDate,
                            useTime: scope.dateFilterData.useTime,
                        } : null,
                        appPage: scope.appPage || 'default',
                        timeZone: (window as any).TimeZone || 'New Zealand Standard Time',
                        onRefreshData: (dateFilterData: any) => {
                            scope.$apply(() => {
                                scope.onDateFilterRefresh!({ dateFilterData });
                            });
                        },
                        onShowToast: (message: string, type: string) => {
                            if (toastrService) {
                                if (type === 'success') {
                                    toastrService.showSuccessToast(message);
                                } else if (type === 'warning') {
                                    toastrService.showWarningToast(message);
                                } else if (type === 'error') {
                                    toastrService.showErrorToast(message);
                                }
                            }
                        },
                    };
                }

                // Views - clone array to ensure React detects changes
                if (scope.onToggleView && scope.onClearAllViews) {
                    actions.views = {
                        items: scope.views ? scope.views.map(v => ({...v})) : null,
                        loading: scope.viewsLoading || false,
                        onToggleView: (view: any) => {
                            scope.$apply(() => {
                                // Find the original view in scope and toggle its selected property
                                // This mimics the AngularJS template behavior: view.selected = !view.selected
                                const originalView = scope.views?.find(v => v.id === view.id);
                                if (originalView) {
                                    originalView.selected = !originalView.selected;
                                    scope.onToggleView!({ view: originalView });
                                }
                            });
                        },
                        onClearAll: () => {
                            scope.$apply(() => {
                                scope.onClearAllViews!();
                            });
                        },
                    };
                }

                // Layouts - clone array to ensure React detects changes
                if (scope.onSaveLayout && scope.onLoadLayout && scope.onDeleteLayout) {
                    actions.layouts = {
                        items: scope.layouts ? scope.layouts.map(l => ({...l})) : [],
                        currentLayoutName: scope.currentLayoutName,
                        onSaveLayout: () => {
                            scope.$apply(() => {
                                scope.onSaveLayout!();
                            });
                        },
                        onLoadLayout: (index: number) => {
                            scope.$apply(() => {
                                scope.onLoadLayout!({ index });
                            });
                        },
                        onDeleteLayout: (index: number) => {
                            scope.$apply(() => {
                                scope.onDeleteLayout!({ index });
                            });
                        },
                    };
                }

                // Refresh
                if (scope.onRefreshClick) {
                    actions.refresh = {
                        onClick: () => {
                            scope.$apply(() => {
                                scope.onRefreshClick!();
                            });
                        },
                        loading: scope.refreshLoading || false,
                    };
                }

                // Settings
                if (scope.onSettingsClick) {
                    actions.settings = {
                        onClick: (event: MouseEvent) => {
                            scope.$apply(() => {
                                scope.onSettingsClick!({ $event: event });
                            });
                        },
                    };
                }

                ReactAppShell.setToolbarActions(actions);
            };

            // Load and mount the React App Shell
            const mountShell = async () => {
                try {
                    console.log('[ReactAppShellDirective] Loading React App Shell module...');

                    // Fetch manifest for asset path resolution
                    const manifestResponse = await fetch('dist/manifest.json');
                    const manifest = await manifestResponse.json();
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

                    // Load vendor-react first (if not already loaded)
                    if (!(window as any).React) {
                        console.log('[ReactAppShellDirective] Loading vendor-react...');
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }

                    // Load the React App Shell module
                    await $ocLazyLoad.load({
                        name: 'uDispatch.appShellReact',
                        files: [getAssetPath('appShellReact.js')]
                    });

                    console.log('[ReactAppShellDirective] Module loaded, checking for ReactAppShell...');

                    const ReactAppShell = (window as any).ReactAppShell;
                    if (!ReactAppShell) {
                        console.error('[ReactAppShellDirective] ReactAppShell not found on window after loading');
                        return;
                    }

                    console.log('[ReactAppShellDirective] Mounting to container:', containerId);

                    const firstName = (window as any).FirstName || 'User';
                    const fullName = (window as any).FullName || 'User';

                    // Mount the shell
                    ReactAppShell.mount(containerId, {
                        title: scope.title || 'Dashboard',
                        firstName,
                        fullName,
                        isUsCustomer: APP_CONFIG.US_Customer,
                        currentState: $state.current.name || '',
                        onLogoClick: () => navigationService.openHubUrl(),
                        onNavigate: (state: string) => $state.go(state),
                    });

                    mounted = true;
                    console.log('[ReactAppShellDirective] Mounted successfully');

                    // Set up toolbar actions
                    updateToolbarActions();

                    // Listen for state changes
                    stateChangeListener = $rootScope.$on('$stateChangeSuccess', (
                        _event: any,
                        toState: angular.ui.IState
                    ) => {
                        if (mounted) {
                            ReactAppShell.updateState(toState.name || '');
                        }
                    }) as unknown as () => void;

                } catch (error) {
                    console.error('[ReactAppShellDirective] Error mounting React App Shell:', error);
                }
            };

            // Watch for changes to scope properties
            scope.$watchGroup([
                'title',
                'messagesCount',
                'viewsLoading',
                'currentLayoutName',
                'refreshLoading',
            ], () => {
                if (mounted) {
                    const ReactAppShell = (window as any).ReactAppShell;
                    if (ReactAppShell && scope.title) {
                        ReactAppShell.updateTitle(scope.title);
                    }
                    updateToolbarActions();
                }
            });

            // Deep watch views, layouts, and dateFilterData
            scope.$watch('views', () => {
                updateToolbarActions();
            }, true);

            scope.$watch('layouts', () => {
                updateToolbarActions();
            }, true);

            scope.$watch('dateFilterData', () => {
                updateToolbarActions();
            }, true);

            // Mount on init
            mountShell();

            // Cleanup on destroy
            scope.$on('$destroy', () => {
                console.log('[ReactAppShellDirective] Destroying...');
                if (stateChangeListener) {
                    stateChangeListener();
                }

                if (mounted) {
                    const ReactAppShell = (window as any).ReactAppShell;
                    if (ReactAppShell) {
                        ReactAppShell.unmount();
                    }
                }
            });
        }
    };
}

reactAppShellDirective.$inject = ['$ocLazyLoad', '$state', 'navigationService', 'APP_CONFIG', '$rootScope', 'toastrService'];

export default reactAppShellDirective;
