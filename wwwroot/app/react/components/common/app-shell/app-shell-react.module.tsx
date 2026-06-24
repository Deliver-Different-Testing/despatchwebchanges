/**
 * App Shell React Module
 *
 * Entry point for the React-based App Toolbar and Side Nav components.
 * Provides functions to mount/unmount the app shell in an AngularJS context.
 */
import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {AppShell} from './AppShell';
import {getTheme} from '../../../theme/muiTheme';
import type {BreadcrumbItem} from '../app-toolbar/AppToolbar';
import {
    MessagesButton,
    RefreshButton,
    SettingsButton,
    ViewsMenu,
    LayoutsMenu,
    DateFilterMenu,
    ActionsMenu,
    View,
    Layout,
    DateFilterData,
} from '../app-toolbar/ToolbarActions';
import {ToolbarActionsBar, ToolbarActionItem} from '../app-toolbar/ToolbarActionsBar';
import SmsIcon from '@mui/icons-material/Sms';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import angular from 'angular';
import {openHubUrl} from '../../../services/navigationService';
import {ReactQueryProvider} from '../../../query';
import {PartnerApprovalsBadge} from '../../../pages/partner-approvals/PartnerApprovalsBadge';

// Toolbar Actions Configuration
export interface ToolbarActionsConfig {
    // Messages
    messages?: {
        unreadCount: number;
        onClick: (event: React.MouseEvent) => void;
    };
    // Refresh
    refresh?: {
        onClick: () => void;
        loading?: boolean;
    };
    // Settings
    settings?: {
        onClick: (event: React.MouseEvent) => void;
    };
    // Views Menu
    views?: {
        items: View[] | null;
        loading?: boolean;
        onToggleView: (view: View) => void;
        onClearAll: () => void;
    };
    // Layouts Menu
    layouts?: {
        items: Layout[];
        currentLayoutName?: string;
        onSaveLayout: () => void;
        onLoadLayout: (index: number) => void;
        onDeleteLayout: (index: number) => void;
        onCustomizePanels?: () => void;
    };
    // Date Filter - React component
    dateFilter?: {
        data: DateFilterData | null;
        appPage?: string;
        timeZone?: string;
        onRefreshData: (dateFilterData: DateFilterData) => void;
        onShowToast?: (message: string, type: 'success' | 'warning' | 'error') => void;
    };
    // Actions Menu (Add New Job, Inter-Courier Charge)
    actionsMenu?: {
        onCreateNewJob: (event: React.MouseEvent) => void;
        onInterCourierCharge: (event: React.MouseEvent) => void;
    };
    // Partner approvals badge — global feed of pending inter-tenant change
    // requests this user must review. Always shown when present; the badge
    // hides its count when the inbox is empty.
    partnerApprovals?: {
        enabled: boolean;
        onOpenJob?: (jobId: number, jobNo: string) => void;
    };
    // Custom children (for any other content)
    customContent?: React.ReactNode;
}

// State management
interface AppShellState {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    firstName: string;
    fullName: string;
    isUsCustomer: boolean;
    currentState: string;
    logoUrl?: string;
    companyName?: string;
    onLogoClick?: () => void;
    onNavigate: (state: string) => void;
}

let shellRoot: Root | null = null;
let shellContainer: HTMLDivElement | null = null;
let shellState: AppShellState | null = null;
let toolbarActions: ToolbarActionsConfig | null = null;

/**
 * Builds toolbar children from actions config
 */
function buildToolbarChildren(): React.ReactNode {
    if (!toolbarActions) return null;

    // Ordered left→right. Items with an `overflow` descriptor collapse into the
    // "More" menu on narrow viewports; dropdown-menu actions stay inline.
    const items: ToolbarActionItem[] = [];

    // Actions menu (Add New Job, Inter-Courier Charge)
    if (toolbarActions.actionsMenu) {
        items.push({
            key: 'actionsMenu',
            node: (
                <ActionsMenu
                    onCreateNewJob={toolbarActions.actionsMenu.onCreateNewJob}
                    onInterCourierCharge={toolbarActions.actionsMenu.onInterCourierCharge}
                />
            ),
        });
    }

    // Messages button
    if (toolbarActions.messages) {
        const {unreadCount, onClick} = toolbarActions.messages;
        items.push({
            key: 'messages',
            node: <MessagesButton unreadCount={unreadCount} onClick={onClick}/>,
            overflow: {
                label: unreadCount > 0 ? `Messages (${unreadCount > 99 ? '99+' : unreadCount})` : 'Messages',
                icon: <SmsIcon fontSize="small"/>,
                onSelect: (event) => onClick(event),
            },
        });
    }

    // Partner approvals badge — drawer-based inbox of pending change
    // requests this user must approve. Wraps in ReactQueryProvider so it
    // owns its own cache without depending on the host page also having
    // a provider mounted (the App Shell renders before any page state).
    if (toolbarActions.partnerApprovals?.enabled) {
        const onOpenJob = toolbarActions.partnerApprovals.onOpenJob;
        items.push({
            key: 'partnerApprovals',
            node: (
                <ReactQueryProvider>
                    <PartnerApprovalsBadge
                        toolbarVariant
                        onOpenJob={onOpenJob}
                    />
                </ReactQueryProvider>
            ),
        });
    }

    // Date filter menu
    if (toolbarActions.dateFilter) {
        items.push({
            key: 'dateFilter',
            node: (
                <DateFilterMenu
                    dateFilterData={toolbarActions.dateFilter.data}
                    appPage={toolbarActions.dateFilter.appPage}
                    timeZone={toolbarActions.dateFilter.timeZone}
                    onRefreshData={toolbarActions.dateFilter.onRefreshData}
                    onShowToast={toolbarActions.dateFilter.onShowToast}
                />
            ),
        });
    }

    // Views menu
    if (toolbarActions.views) {
        items.push({
            key: 'views',
            node: (
                <ViewsMenu
                    views={toolbarActions.views.items}
                    loading={toolbarActions.views.loading}
                    onToggleView={toolbarActions.views.onToggleView}
                    onClearAll={toolbarActions.views.onClearAll}
                />
            ),
        });
    }

    // Layouts menu
    if (toolbarActions.layouts) {
        items.push({
            key: 'layouts',
            node: (
                <LayoutsMenu
                    layouts={toolbarActions.layouts.items}
                    currentLayoutName={toolbarActions.layouts.currentLayoutName}
                    onSaveLayout={toolbarActions.layouts.onSaveLayout}
                    onLoadLayout={toolbarActions.layouts.onLoadLayout}
                    onDeleteLayout={toolbarActions.layouts.onDeleteLayout}
                    onCustomizePanels={toolbarActions.layouts.onCustomizePanels}
                />
            ),
        });
    }

    // Refresh button
    if (toolbarActions.refresh) {
        const {onClick, loading} = toolbarActions.refresh;
        items.push({
            key: 'refresh',
            node: <RefreshButton onClick={onClick} loading={loading}/>,
            overflow: {
                label: loading ? 'Refreshing…' : 'Refresh',
                icon: <RefreshIcon fontSize="small"/>,
                onSelect: () => onClick(),
            },
        });
    }

    // Settings button
    if (toolbarActions.settings) {
        const {onClick} = toolbarActions.settings;
        items.push({
            key: 'settings',
            node: <SettingsButton onClick={onClick}/>,
            overflow: {
                label: 'Settings',
                icon: <SettingsIcon fontSize="small"/>,
                onSelect: (event) => onClick(event),
            },
        });
    }

    // Custom content
    if (toolbarActions.customContent) {
        items.push({
            key: 'custom',
            node: <>{toolbarActions.customContent}</>,
        });
    }

    return items.length > 0 ? <ToolbarActionsBar actions={items}/> : null;
}

/**
 * Renders the app shell with current state
 */
function renderShell(): void {
    if (!shellRoot || !shellState) return;

    const currentTheme = getTheme();
    const children = buildToolbarChildren();

    shellRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <AppShell
                title={shellState.title}
                breadcrumbs={shellState.breadcrumbs}
                firstName={shellState.firstName}
                fullName={shellState.fullName}
                isUsCustomer={shellState.isUsCustomer}
                currentState={shellState.currentState}
                logoUrl={shellState.logoUrl}
                companyName={shellState.companyName}
                onLogoClick={shellState.onLogoClick}
                onNavigate={shellState.onNavigate}
            >
                {children}
            </AppShell>
        </ThemeProvider>
    );
}

/**
 * Mounts the app shell component into a container element
 */
export function mountAppShell(
    containerId: string,
    config: {
        title?: string;
        breadcrumbs?: BreadcrumbItem[];
        firstName: string;
        fullName: string;
        isUsCustomer: boolean;
        currentState: string;
        logoUrl?: string;
        companyName?: string;
        onLogoClick?: () => void;
        onNavigate: (state: string) => void;
    }
): void {
    console.log('[AppShellReact] Mounting to container:', containerId);

    // If there's an existing root for a different container, unmount it first
    if (shellRoot && shellContainer && shellContainer.id !== containerId) {
        console.log('[AppShellReact] Unmounting previous shell from:', shellContainer.id);
        shellRoot.unmount();
        shellRoot = null;
        shellContainer = null;
    }

    // Find the container
    let container = document.getElementById(containerId) as HTMLDivElement;
    if (!container) {
        console.error('[AppShellReact] Container not found:', containerId);
        // Create container as fallback
        container = document.createElement('div');
        container.id = containerId;
        document.body.insertBefore(container, document.body.firstChild);
        console.log('[AppShellReact] Created fallback container');
    }

    shellContainer = container;
    shellState = config;
    toolbarActions = null; // Reset toolbar actions

    // Create new root if needed
    if (!shellRoot) {
        console.log('[AppShellReact] Creating new React root');
        shellRoot = createRoot(container);
    }

    renderShell();
    console.log('[AppShellReact] Shell rendered');
}

/**
 * Updates the app shell state
 */
export function updateAppShell(updates: Partial<AppShellState>): void {
    if (!shellState) return;

    shellState = {...shellState, ...updates};
    renderShell();
}

/**
 * Updates just the current state (for navigation)
 */
export function updateCurrentState(state: string): void {
    if (!shellState) return;

    shellState.currentState = state;
    renderShell();
}

/**
 * Updates just the title
 */
export function updateTitle(title: string): void {
    if (!shellState) return;

    shellState.title = title;
    renderShell();
}

/**
 * Updates the breadcrumb trail. Pass an empty array to clear it and fall back
 * to the legacy single-title rendering path.
 */
export function updateBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
    if (!shellState) return;

    shellState.breadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : undefined;
    renderShell();
}

/**
 * Sets toolbar actions configuration
 */
export function setToolbarActions(actions: ToolbarActionsConfig | null): void {
    toolbarActions = actions;
    renderShell();
}

/**
 * Updates specific toolbar action
 */
export function updateToolbarAction<K extends Exclude<keyof ToolbarActionsConfig, 'customContent'>>(
    actionKey: K,
    updates: Partial<NonNullable<ToolbarActionsConfig[K]>>
): void {
    if (!toolbarActions) {
        toolbarActions = {};
    }

    const existing = toolbarActions[actionKey];
    if (existing) {
        (toolbarActions[actionKey] as object) = {
            ...existing,
            ...updates,
        };
    } else {
        (toolbarActions[actionKey] as object) = updates;
    }

    renderShell();
}

/**
 * Unmounts the app shell
 */
export function unmountAppShell(): void {
    if (shellRoot) {
        shellRoot.unmount();
        shellRoot = null;
    }

    if (shellContainer && shellContainer.parentNode) {
        shellContainer.parentNode.removeChild(shellContainer);
        shellContainer = null;
    }

    shellState = null;
    toolbarActions = null;
}

// Expose globally for AngularJS access
window.ReactAppShell = {
    mount: mountAppShell,
    update: updateAppShell,
    updateState: updateCurrentState,
    updateTitle: updateTitle,
    updateBreadcrumbs: updateBreadcrumbs,
    setToolbarActions: setToolbarActions,
    updateToolbarAction: updateToolbarAction,
    unmount: unmountAppShell,
};

// Register as AngularJS module (for ocLazyLoad compatibility)
const appShellReactModule = window.angular!.module(
    'uDispatch.appShellReact',
    []
);

// Provide a service that wraps the React component
appShellReactModule.service('reactAppShellService', [
    '$state',
    '$rootScope',
    'APP_CONFIG',
    (
        $state: angular.ui.IStateService,
        $rootScope: angular.IRootScopeService,
        appConfig: any
    ) => {
        let stateChangeListener: (() => void) | null = null;

        return {
            /**
             * Mount the React App Shell
             */
            mount: (containerId: string, title: string) => {
                const firstName = window.FirstName || 'User';
                const fullName = window.FullName || 'User';

                mountAppShell(containerId, {
                    title,
                    firstName,
                    fullName,
                    isUsCustomer: appConfig.US_Customer,
                    currentState: $state.current.name || '',
                    onLogoClick: () => openHubUrl(),
                    onNavigate: (state: string) => {
                        $state.go(state).catch((error: any) => {
                            if (error?.type === 2 /* RejectType.SUPERSEDED */) return;
                            console.error(`[AppShellReact] Navigation to '${state}' failed:`, error);
                        });
                    },
                });

                // Listen for state changes to update navigation highlighting
                stateChangeListener = $rootScope.$on('$stateChangeSuccess', (
                    _event: any,
                    toState: angular.ui.IState
                ) => {
                    updateCurrentState(toState.name || '');
                }) as unknown as () => void;
            },

            /**
             * Set toolbar actions from AngularJS controller
             */
            setToolbarActions: (actions: ToolbarActionsConfig) => {
                setToolbarActions(actions);
            },

            /**
             * Update a specific toolbar action
             */
            updateToolbarAction: updateToolbarAction,

            /**
             * Update messages badge count
             */
            updateMessageCount: (count: number) => {
                if (toolbarActions?.messages) {
                    updateToolbarAction('messages', {unreadCount: count});
                }
            },

            /**
             * Update views list
             */
            updateViews: (views: View[]) => {
                if (toolbarActions?.views) {
                    updateToolbarAction('views', {items: views});
                }
            },

            /**
             * Update layouts list
             */
            updateLayouts: (layouts: Layout[], currentName?: string) => {
                if (toolbarActions?.layouts) {
                    updateToolbarAction('layouts', {
                        items: layouts,
                        currentLayoutName: currentName,
                    });
                }
            },

            updateState: updateCurrentState,
            updateTitle: updateTitle,
            updateBreadcrumbs: updateBreadcrumbs,

            /**
             * Unmount and clean-up
             */
            unmount: () => {
                if (stateChangeListener) {
                    stateChangeListener();
                    stateChangeListener = null;
                }
                unmountAppShell();
            },
        };
    }
]);

console.log('[AppShellReact] Module registered');

export default appShellReactModule;
