/**
 * React Query Provider Component
 *
 * Wraps components with QueryClientProvider for React Query support.
 * Use this in dialog modules and React pages.
 */

import React from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from './queryClient';

interface ReactQueryProviderProps {
    children: React.ReactNode;
}

/**
 * Provider component that enables React Query throughout its children.
 *
 * Usage in dialog modules:
 * ```tsx
 * <ReactQueryProvider>
 *   <ThemeProvider theme={theme}>
 *     <YourDialog />
 *   </ThemeProvider>
 * </ReactQueryProvider>
 * ```
 */
export const ReactQueryProvider: React.FC<ReactQueryProviderProps> = ({children}) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default ReactQueryProvider;
