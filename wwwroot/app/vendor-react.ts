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
import {QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

// Expose React globally for module bundles to use via shims
(window as any).React = React;
// Combine ReactDOM (createPortal, flushSync) with ReactDOMClient (createRoot, hydrateRoot)
(window as any).ReactDOM = {...ReactDOM, ...ReactDOMClient};
(window as any).ReactJsxRuntime = jsxRuntime;

// Expose TanStack Query components/hooks
(window as any).QueryClientProvider = QueryClientProvider;
(window as any).useQuery = useQuery;
(window as any).useMutation = useMutation;
(window as any).useQueryClient = useQueryClient;

// Create and expose a shared QueryClient instance
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30000,
        },
    },
});
(window as any).ReactQueryClient = queryClient;

// Export for type checking
export {React, ReactDOMClient, jsxRuntime, queryClient, QueryClientProvider};

console.log('[vendor-react] React libraries loaded and exposed globally');
