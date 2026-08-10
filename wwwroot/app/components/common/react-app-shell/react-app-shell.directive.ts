import angular from 'angular';
import {openHubUrl, openJobInSearch} from '../../../react/services/navigationService';
import type MessagingDialogService from '../../dialogs/messaging-dialog/messaging-dialog.service';
import {ReactAppShellScope} from "./react-app-shell.scope";

/**
 * React App Shell Directive
 *
 * An AngularJS directive that wraps the React App Shell component.
 * This makes it easy to use the React toolbar and sidenav across all pages.
 */

interface BreadcrumbItem {
    label: string;
    href?: string;
}

function buildBreadcrumbs(section: string | undefined, title: string | undefined): BreadcrumbItem[] {
    const crumbs: BreadcrumbItem[] = [];
    if (section) {
        crumbs.push({label: section});
    }
    if (title) {
        crumbs.push({label: title});
    }
    return crumbs;
}

function reactAppShellDirective(
    $ocLazyLoad: oc.ILazyLoad,
    $state: angular.ui.IStateService,
    APP_CONFIG: any,
    $rootScope: angular.IRootScopeService,
    toastrService: any,
    $interval: angular.IIntervalService,
    messagingDialogService: MessagingDialogService
): angular.IDirective<ReactAppShellScope> {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            section: '@?',
            beta: '<?',
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
            onRenameLayout: '&?',
            onImportLayouts: '&?',
            onCustomizePanels: '&?',
            onResetLayout: '&?',
            columnEditMode: '<?',
            onToggleColumnEditMode: '&?',
            onSettingsClick: '&?',
            onRefreshClick: '&?',
            refreshLoading: '<?',
            // Date filter
            dateFilterData: '<?',
            appPage: '@?',
            onDateFilterRefresh: '&?',
            // Actions menu
            onCreateNewJob: '&?',
            onInterCourierCharge: '&?',
        },
        template: '<div class="react-app-shell-container"></div>',
        link: function(
            scope: ReactAppShellScope,
            element: angular.IAugmentedJQuery,
            _attrs: angular.IAttributes
        ) {
            let mounted = false;
            let stateChangeListener: (() => void) | null = null;

            // Whether this page wires its own messages handler. When it does we
            // defer entirely to the page (its click handler + `messages-count`);
            // otherwise the directive self-wires the shared messaging dialog and
            // polls the unread count so the button is present on every page.
            const pageOwnsMessages = !!scope.onMessagesClick;
            let selfUnreadCount = 0;
            let unreadPoll: angular.IPromise<void> | null = null;

            // Refresh the directive-owned unread badge (self-wired pages only).
            const refreshSelfUnreadCount = async () => {
                if (pageOwnsMessages) return;
                try {
                    selfUnreadCount = await messagingDialogService.getUnreadMessageCount();
                    updateToolbarActions();
                } catch (error) {
                    console.error('[ReactAppShellDirective] Failed to fetch unread message count:', error);
                }
            };

            // Open the shared messaging dialog, then refresh the badge on close.
            const openSelfMessaging = async (event: MouseEvent) => {
                try {
                    await messagingDialogService.openMessagingDialog(event);
                } catch (error) {
                    console.error('[ReactAppShellDirective] Failed to open messaging dialog:', error);
                } finally {
                    void refreshSelfUnreadCount();
                }
            };

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

                // Messages — always available on every page. If the host page
                // wires `on-messages-click`, defer to it (and its `messages-count`);
                // otherwise the directive self-wires the shared messaging dialog
                // and its own polled unread count.
                if (pageOwnsMessages) {
                    actions.messages = {
                        unreadCount: scope.messagesCount || 0,
                        onClick: (event: MouseEvent) => {
                            scope.$apply(() => {
                                scope.onMessagesClick!({ $event: event });
                            });
                        },
                    };
                } else {
                    actions.messages = {
                        unreadCount: selfUnreadCount,
                        onClick: (event: MouseEvent) => {
                            void openSelfMessaging(event);
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
                        // Rename a custom layout. Only wired when the host page
                        // provides `on-rename-layout`.
                        ...(scope.onRenameLayout ? {
                            onRenameLayout: (index: number) => {
                                scope.$apply(() => {
                                    scope.onRenameLayout!({ index });
                                });
                            },
                        } : {}),
                        // "Import V1 layouts" — copy the user's legacy layouts into
                        // this page's V2 store. Only wired when the host page
                        // provides `on-import-layouts`.
                        ...(scope.onImportLayouts ? {
                            onImportLayouts: () => {
                                scope.$apply(() => {
                                    scope.onImportLayouts!();
                                });
                            },
                        } : {}),
                        // Cross-link the organiser: "Customize panels…" opens the
                        // dedicated panel-visibility dialog. Only wired when the host
                        // page provides `on-customize-panels`.
                        ...(scope.onCustomizePanels ? {
                            onCustomizePanels: () => {
                                scope.$apply(() => {
                                    scope.onCustomizePanels!();
                                });
                            },
                        } : {}),
                        // "Edit columns" mode toggle. Only wired when the host
                        // page provides `on-toggle-column-edit-mode`.
                        ...(scope.onToggleColumnEditMode ? {
                            columnEditMode: !!scope.columnEditMode,
                            onToggleColumnEditMode: () => {
                                scope.$apply(() => {
                                    scope.onToggleColumnEditMode!();
                                });
                            },
                        } : {}),
                        // "Reset layout" restores the shipped arrangement. Only
                        // wired when the host page provides `on-reset-layout`.
                        ...(scope.onResetLayout ? {
                            onResetLayout: () => {
                                scope.$apply(() => {
                                    scope.onResetLayout!();
                                });
                            },
                        } : {}),
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

                // Actions menu (Add New Job, Inter-Courier Charge)
                if (scope.onCreateNewJob && scope.onInterCourierCharge) {
                    actions.actionsMenu = {
                        onCreateNewJob: (event: MouseEvent) => {
                            scope.$apply(() => {
                                scope.onCreateNewJob!({ $event: event });
                            });
                        },
                        onInterCourierCharge: (event: MouseEvent) => {
                            scope.$apply(() => {
                                scope.onInterCourierCharge!({ $event: event });
                            });
                        },
                    };
                }

                // Partner approvals badge — always available, surfaces pending
                // inter-tenant change requests this tenant must review. Clicking
                // a job row in the drawer opens that job in a new tab via the
                // existing deep-link helper.
                actions.partnerApprovals = {
                    enabled: true,
                    onOpenJob: (jobId: number) => openJobInSearch(jobId),
                };

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

                    // Load the React App Shell module, plus its stylesheet when the
                    // bundle emits one (CSS modules in the shell's components).
                    const shellFiles = [getAssetPath('appShellReact.js')];
                    if (manifest['appShellReact.css']) {
                        shellFiles.push(getAssetPath('appShellReact.css'));
                    }
                    await $ocLazyLoad.load({
                        name: 'uDispatch.appShellReact',
                        files: shellFiles
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
                        breadcrumbs: buildBreadcrumbs(scope.section, scope.title),
                        beta: !!scope.beta,
                        firstName,
                        fullName,
                        isUsCustomer: APP_CONFIG.US_Customer,
                        currentState: $state.current.name || '',
                        onLogoClick: () => openHubUrl(),
                        onNavigate: (state: string) => {
                            $state.go(state).catch((error: any) => {
                                // Ignore superseded transitions (user clicked another link)
                                if (error?.type === 2 /* RejectType.SUPERSEDED */) return;
                                console.error(`[ReactAppShellDirective] Navigation to '${state}' failed:`, error);
                            });
                        },
                    });

                    mounted = true;
                    console.log('[ReactAppShellDirective] Mounted successfully');

                    // Set up toolbar actions
                    updateToolbarActions();

                    // For self-wired pages, seed the unread badge and poll it so
                    // the messages button stays current on every page.
                    if (!pageOwnsMessages) {
                        void refreshSelfUnreadCount();
                        unreadPoll = $interval(() => {
                            void refreshSelfUnreadCount();
                        }, 60000);
                    }

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
                'section',
                'messagesCount',
                'viewsLoading',
                'currentLayoutName',
                'refreshLoading',
                'editMode',
            ], () => {
                if (mounted) {
                    const ReactAppShell = (window as any).ReactAppShell;
                    if (ReactAppShell) {
                        ReactAppShell.updateBreadcrumbs(
                            buildBreadcrumbs(scope.section, scope.title)
                        );
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
           void mountShell();

            // Clean-up on destroy
            scope.$on('$destroy', () => {
                console.log('[ReactAppShellDirective] Destroying...');
                if (stateChangeListener) {
                    stateChangeListener();
                }

                if (unreadPoll) {
                    $interval.cancel(unreadPoll);
                    unreadPoll = null;
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

reactAppShellDirective.$inject = ['$ocLazyLoad', '$state', 'APP_CONFIG', '$rootScope', 'toastrService', '$interval', 'messagingDialogService'];

export default reactAppShellDirective;
