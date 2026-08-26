/**
 * React Vendor Bundle
 *
 * This file bundles React and related libraries, exposing them as window globals
 * so that React module bundles can use global shims instead of bundling React again.
 */

// Mantine global stylesheets — imported here so they land in a single
// `vendor-react.css` bundle (linked once in _Layout), rather than duplicated
// into every React island. The `.layer.css` variants scope Mantine's rules to
// an `@layer mantine`, keeping its internal cascade clean alongside the
// (unlayered) Angular Material + app CSS in the shared document.
//
// There is no companion reset: `mantineReset.css` existed only to undo
// Bootstrap's reboot (`p{margin-bottom}`, `button{border-radius:0}`), which
// beat the layer regardless of specificity. Bootstrap is gone and nothing
// else in the document sets those at element level, so Mantine's own rules
// apply. Re-check that before adding any unlayered stylesheet.
import '@mantine/core/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import '@mantine/notifications/styles.layer.css';

// Mantine JS — bundled once here and exposed as window globals for the same
// reason MUI is (see below). Without this every migrated island embeds its own
// copy of Mantine core (~190 KB each). The global-shim plugin in build.ts
// rewrites `@mantine/*` barrel imports onto these.
import * as MantineCore from '@mantine/core';
import * as MantineHooks from '@mantine/hooks';
import * as MantineDates from '@mantine/dates';
import * as MantineNotifications from '@mantine/notifications';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import {QueryClient, QueryClientProvider, keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

// MUI — bundled once here (together with its single Emotion instance) and
// exposed as window globals so the React module bundles resolve
// @mui/material/* and @mui/material/styles to these shared instances (see
// createReactGlobalShimPlugin in build.ts) instead of each embedding its own
// full copy of MUI + Emotion.
import * as MUIMaterial from '@mui/material';
import * as MUIStyles from '@mui/material/styles';
// @mui/icons-material stays bundled per-module (small, tree-shaken), but every
// icon imports the NAMED createSvgIcon from @mui/material/SvgIcon — which the
// main barrel doesn't re-export — so expose that module's members explicitly.
import MUISvgIcon, {createSvgIcon as muiCreateSvgIcon, svgIconClasses as muiSvgIconClasses} from '@mui/material/SvgIcon';

// Expose React globally for module bundles to use via shims
window.React = React;
// Combine ReactDOM (createPortal, flushSync) with ReactDOMClient (createRoot, hydrateRoot)
window.ReactDOM = {...ReactDOM, ...ReactDOMClient} as typeof ReactDOM & typeof ReactDOMClient;
window.ReactJsxRuntime = jsxRuntime;

// Expose MUI and Mantine globally for module bundles to use via shims. dayjs
// itself is redirected to the configured window.dayjs by the global-shim plugin
// applied to this bundle.
window.MantineCore = MantineCore;
window.MantineHooks = MantineHooks;
window.MantineDates = MantineDates;
window.MantineNotifications = MantineNotifications;

window.MUI = MUIMaterial;
window.MUIStyles = MUIStyles;
window.MUISvgIcon = {default: MUISvgIcon, createSvgIcon: muiCreateSvgIcon, svgIconClasses: muiSvgIconClasses};

// Expose TanStack Query components/hooks
window.QueryClient = QueryClient;
window.QueryClientProvider = QueryClientProvider;
window.keepPreviousData = keepPreviousData;
window.useQuery = useQuery;
window.useInfiniteQuery = useInfiniteQuery;
window.useMutation = useMutation;
window.useQueryClient = useQueryClient;

// Create and expose a shared QueryClient instance.
// Full default options are applied by queryClient.ts via setDefaultOptions()
// when React modules load. Keep minimal defaults here as a baseline.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
        },
        mutations: {
            retry: 0,
        },
    },
});
window.ReactQueryClient = queryClient;

// Export for type checking
export {React, ReactDOMClient, jsxRuntime, queryClient, QueryClientProvider};

console.log('[vendor-react] React libraries loaded and exposed globally');
