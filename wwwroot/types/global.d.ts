/**
 * Global Window type augmentations
 *
 * Centralizes type declarations for all window globals used across the app.
 * Eliminates the need for (window as any) casts throughout the codebase.
 */

import type * as React from 'react';
import type * as ReactDOM from 'react-dom';
import type * as ReactDOMClient from 'react-dom/client';
import type {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type angular from 'angular';
import type {MountRecurringJobsConfig} from '../app/react/interfaces';
import type {MountDriverManagementConfig} from '../app/react/interfaces';
import type {MountOverviewConfig} from '../app/react/pages/overview/OverviewPage.interfaces';
import type {MountTaskDashboardConfig} from '../app/react/pages/task-dashboard/TaskDashboardPage.interfaces';
import type {MountErrorPageConfig} from '../app/react/pages/error-page/error-page-react.module';
import type {MountCourierMapConfig} from '../app/react/pages/courier-map/courier-map-react.module';

/** Common interface for lazy-loaded React modules with mount/unmount lifecycle */
interface ReactModuleBridge {
    mount: (containerId: string, props?: Record<string, unknown>) => void;
    unmount: () => void;
}

/** Typed interface for a React page module with specific config */
interface ReactPageModule<TConfig> {
    mount(containerId: string, config: TConfig): void;
    unmount(): void;
    refresh?(): void;
}

declare global {
    interface Window {
        // ── Server-injected user/tenant globals ──────────────────────────
        FirstName?: string;
        FullName?: string;
        ContactID?: number;
        ClientInternal?: boolean;
        TimeZone?: string;
        serverConfig?: {
            isProduction: boolean;
            isUSCustomer: boolean;
        };

        // ── React library globals (set by vendor-react bundle) ──────────
        React?: typeof React;
        ReactDOM?: typeof ReactDOM & typeof ReactDOMClient;
        ReactJsxRuntime?: typeof import('react/jsx-runtime');

        // ── React Query globals (set by vendor-react bundle) ─────────────
        QueryClient?: typeof QueryClient;
        QueryClientProvider?: typeof QueryClientProvider;
        useQuery?: typeof import('@tanstack/react-query').useQuery;
        useMutation?: typeof import('@tanstack/react-query').useMutation;
        useQueryClient?: typeof import('@tanstack/react-query').useQueryClient;
        ReactQueryClient?: QueryClient;

        // ── Utility library globals (set by vendor-core bundle) ──────────
        dayjs?: typeof import('dayjs').default;
        windowsIana?: typeof import('windows-iana');

        // ── AngularJS app module (set by vendor-plugins bundle) ──────────
        uDispatchApp?: angular.IModule;
        angular?: typeof angular;

        // ── Lazy-loaded React page modules ───────────────────────────────
        ReactAppShell?: ReactModuleBridge & {
            setToolbarActions: (actions: unknown) => void;
            updateTitle: (title: string) => void;
            updateState: (state: Record<string, unknown>) => void;
        };
        ReactRecurringJobs?: ReactPageModule<MountRecurringJobsConfig>;
        ReactOverview?: ReactPageModule<MountOverviewConfig>;
        ReactTaskDashboard?: ReactPageModule<MountTaskDashboardConfig>;
        ReactDriverManagement?: ReactPageModule<MountDriverManagementConfig>;
        ReactCourierMap?: ReactPageModule<MountCourierMapConfig>;
        ReactErrorPage?: ReactPageModule<MountErrorPageConfig>;

        // ── Lazy-loaded React dialog modules ─────────────────────────────
        ReactCreateJobDialog?: {
            open: (
                isUsTenant: boolean,
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                }
            ) => Promise<number | null>;
        };
        ReactVoidJobConfirmationDialog?: {
            open: (options: Record<string, unknown>) => Promise<unknown>;
        };
        ReactFlightAgentConfirmationDialog?: {
            openFlightDialog: (options: Record<string, unknown>) => Promise<unknown>;
            openAgentDialog: (options: Record<string, unknown>) => Promise<unknown>;
        };
        ReactEditDateTimeDialog?: {
            showEditTimeDialog: (options: Record<string, unknown>) => Promise<unknown>;
            showEditDateDialog: (options: Record<string, unknown>) => Promise<unknown>;
            showEditDateAndTimeDialog: (options: Record<string, unknown>) => Promise<unknown>;
        };
        ReactBulkPriceUploadDialog?: {
            open: (options: Record<string, unknown>) => Promise<boolean>;
        };
        ReactSendPodDialog?: {
            open: (options: Record<string, unknown>) => Promise<unknown>;
        };
        ReactPodPhotoViewer?: {
            open: (...args: unknown[]) => void;
            close: () => void;
        };

        // ── Lazy-loaded React utility modules ────────────────────────────
        ReactAiAssistant?: {
            analyzeLateAlert: (jobId: number) => Promise<{ summary: string }>;
            renderSummaryPanel: (container: HTMLElement, jobId: number) => void;
            renderOperationsInsightsPanel: (container: HTMLElement) => void;
            unmountSummaryPanel: (container: HTMLElement) => void;
        };

        // ── Diagnostic utilities ─────────────────────────────────────────
        __diagAiPanel?: () => void;
    }

    // ── Bare globals injected by server-rendered script tags ──────────
    // These are set via <script> in _Layout.cshtml and used without window. prefix
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: boolean;
    const TimeZone: string;
    const serverConfig: {
        isProduction: boolean;
        isUSCustomer: boolean;
    };
}

export {};
