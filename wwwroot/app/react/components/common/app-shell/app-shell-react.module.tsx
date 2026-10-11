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
import type {BreadcrumbItem} from '../app-toolbar/AppToolbar';
import {buildToolbarChildren, type ToolbarActionsConfig} from './ToolbarActionsView';

export type {ToolbarActionsConfig};

// State management
interface AppShellState {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    firstName: string;
    fullName: string;
    isUsCustomer: boolean;
    isNetworkPartner?: boolean;
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
 * Renders the app shell with current state
 */
function renderShell(): void {
    if (!shellRoot || !shellState) return;

    const children = buildToolbarChildren(toolbarActions);

    shellRoot.render(islandTree(
        <AppShell
            title={shellState.title}
            breadcrumbs={shellState.breadcrumbs}
            firstName={shellState.firstName}
            fullName={shellState.fullName}
            isUsCustomer={shellState.isUsCustomer}
            isNetworkPartner={shellState.isNetworkPartner}
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
        isNetworkPartner?: boolean;
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
