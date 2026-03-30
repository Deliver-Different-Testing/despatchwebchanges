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
import {QueryClient, QueryClientProvider, keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

// Expose React globally for module bundles to use via shims
window.React = React;
// Combine ReactDOM (createPortal, flushSync) with ReactDOMClient (createRoot, hydrateRoot)
window.ReactDOM = {...ReactDOM, ...ReactDOMClient} as typeof ReactDOM & typeof ReactDOMClient;
window.ReactJsxRuntime = jsxRuntime;

// Expose TanStack Query components/hooks
window.QueryClient = QueryClient;
window.QueryClientProvider = QueryClientProvider;
window.keepPreviousData = keepPreviousData;
window.useQuery = useQuery;
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
