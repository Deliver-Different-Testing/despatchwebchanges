/**
 * App Shell React Module
 *
 * Entry point for the React-based App Toolbar and Side Nav components.
 * Provides functions to mount/unmount the app shell in an AngularJS context.
 */
import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {AppShell} from './AppShell';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../mui-interop/MuiThemeIsland';
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
import {MessageSquare, RefreshCw, Settings as SettingsGlyph} from 'lucide-react';
import {Icon} from '../icon/Icon';
import angular from 'angular';
import {openHubUrl} from '../../../services/navigationService';
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
        onRenameLayout?: (index: number) => void;
        onImportLayouts?: () => void;
        onCustomizePanels?: () => void;
        onResetLayout?: () => void;
        columnEditMode?: boolean;
        onToggleColumnEditMode?: () => void;
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
    beta?: boolean;
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
                icon: <Icon lucide={MessageSquare} size={16}/>,
                onSelect: (event) => onClick(event),
            },
        });
    }

    // Partner approvals badge — drawer-based inbox of pending change
    // requests this user must approve. The query cache comes from the
    // shell's own provider stack.
    if (toolbarActions.partnerApprovals?.enabled) {
        const onOpenJob = toolbarActions.partnerApprovals.onOpenJob;
        items.push({
            key: 'partnerApprovals',
            node: (
                <PartnerApprovalsBadge
                    toolbarVariant
                    onOpenJob={onOpenJob}
                />
            ),
        });
    }

    // Date filter menu
    if (toolbarActions.dateFilter) {
        items.push({
            key: 'dateFilter',
            node: (
                // Still MUI — migration Phase 5.
                <MuiThemeIsland>
                    <DateFilterMenu
                        dateFilterData={toolbarActions.dateFilter.data}
                        appPage={toolbarActions.dateFilter.appPage}
                        timeZone={toolbarActions.dateFilter.timeZone}
                        onRefreshData={toolbarActions.dateFilter.onRefreshData}
                        onShowToast={toolbarActions.dateFilter.onShowToast}
                    />
                </MuiThemeIsland>
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
                    onRenameLayout={toolbarActions.layouts.onRenameLayout}
                    onImportLayouts={toolbarActions.layouts.onImportLayouts}
                    onCustomizePanels={toolbarActions.layouts.onCustomizePanels}
                    onResetLayout={toolbarActions.layouts.onResetLayout}
                    columnEditMode={toolbarActions.layouts.columnEditMode}
                    onToggleColumnEditMode={toolbarActions.layouts.onToggleColumnEditMode}
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
                icon: <Icon lucide={RefreshCw} size={16}/>,
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
                icon: <Icon lucide={SettingsGlyph} size={16}/>,
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

    const children = buildToolbarChildren();

    shellRoot.render(islandTree(
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
            beta={shellState.beta}
        >
            {children}
        </AppShell>
    ));
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
        beta?: boolean;
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

console.log('[AppShellReact] Module registered');

export default appShellReactModule;
