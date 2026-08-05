/**
 * React Vendor Bundle
 *
 * This file bundles React and related libraries, exposing them as window globals
 * so that React module bundles can use global shims instead of bundling React again.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import {QueryClient, QueryClientProvider, keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

// MUI — bundled once here (together with its single Emotion instance) and
// exposed as window globals so the ~35 React module bundles resolve
// @mui/material/*, @mui/material/styles and @mui/x-date-pickers/* to these
// shared instances (see createReactGlobalShimPlugin in build.ts) instead of
// each embedding its own full copy of MUI + Emotion.
import * as MUIMaterial from '@mui/material';
import * as MUIStyles from '@mui/material/styles';
import * as MUIXDatePickers from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
// @mui/icons-material stays bundled per-module (small, tree-shaken), but every
// icon imports the NAMED createSvgIcon from @mui/material/SvgIcon — which the
// main barrel doesn't re-export — so expose that module's members explicitly.
import MUISvgIcon, {createSvgIcon as muiCreateSvgIcon, svgIconClasses as muiSvgIconClasses} from '@mui/material/SvgIcon';

// Expose React globally for module bundles to use via shims
window.React = React;
// Combine ReactDOM (createPortal, flushSync) with ReactDOMClient (createRoot, hydrateRoot)
window.ReactDOM = {...ReactDOM, ...ReactDOMClient} as typeof ReactDOM & typeof ReactDOMClient;
window.ReactJsxRuntime = jsxRuntime;

// Expose MUI globally for module bundles to use via shims.
// AdapterDayjs lives on its own subpath (not in the main x-date-pickers barrel),
// so merge it in explicitly. dayjs itself is redirected to the configured
// window.dayjs by the global-shim plugin applied to this bundle.
window.MUI = MUIMaterial;
window.MUIStyles = MUIStyles;
window.MUIXDatePickers = {...MUIXDatePickers, AdapterDayjs};
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
