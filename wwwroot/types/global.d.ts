/**
 * Global Window type augmentations for the vendor bundles and the two
 * lazily loaded React utilities that are still reached through window.
 */

import type * as React from 'react';
import type * as ReactDOM from 'react-dom';
import type * as ReactDOMClient from 'react-dom/client';
import type {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {PodPhoto} from '../app/react/components/common/pod-photo-viewer/pod-photo-viewer.types';

declare global {
    interface Window {
        // ── React library globals (set by vendor-react bundle) ──────────
        React?: typeof React;
        ReactDOM?: typeof ReactDOM & typeof ReactDOMClient;
        ReactJsxRuntime?: typeof import('react/jsx-runtime');

        // ── React Query globals (set by vendor-react bundle) ─────────────
        QueryClient?: typeof QueryClient;
        QueryClientProvider?: typeof QueryClientProvider;
        keepPreviousData?: typeof import('@tanstack/react-query').keepPreviousData;
        useQuery?: typeof import('@tanstack/react-query').useQuery;
        useInfiniteQuery?: typeof import('@tanstack/react-query').useInfiniteQuery;
        useMutation?: typeof import('@tanstack/react-query').useMutation;
        useQueryClient?: typeof import('@tanstack/react-query').useQueryClient;
        ReactQueryClient?: QueryClient;

        // ── Mantine globals (set by vendor-react bundle) ─────────────────
        MantineCore?: typeof import('@mantine/core');
        MantineHooks?: typeof import('@mantine/hooks');
        MantineDates?: typeof import('@mantine/dates');
        MantineNotifications?: typeof import('@mantine/notifications');

        // ── Utility library globals (set by vendor-core bundle) ──────────
        dayjs?: typeof import('dayjs').default;
        windowsIana?: typeof import('windows-iana');

        // ── Lazy-loaded React utilities ──────────────────────────────────
        ReactPodPhotoViewer?: {
            open: (photos: PodPhoto[], initialPhotoIndex?: number, timeZone?: string, onClose?: () => void) => void;
            close: () => void;
        };
        ReactAiAssistant?: {
            renderSummaryPanel: (container: HTMLElement, jobId: number) => void;
            renderOperationsInsightsPanel: (container: HTMLElement) => void;
            unmountSummaryPanel: (container: HTMLElement) => void;
        };
    }
}

export {};
