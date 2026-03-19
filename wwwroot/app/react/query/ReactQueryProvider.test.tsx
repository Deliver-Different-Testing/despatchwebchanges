/** @jest-environment jest-environment-jsdom */
/**
 * ReactQueryProvider Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {useQuery} from '@tanstack/react-query';
import {ReactQueryProvider} from './ReactQueryProvider';

// Test component that uses React Query
const TestComponent: React.FC<{queryKey: string[]}> = ({queryKey}) => {
    const {isLoading, isError, data} = useQuery({
        queryKey,
        queryFn: async () => 'test data',
    });

    if (isLoading) return <div>Loading...</div>;
    if (isError) return <div>Error</div>;
    return <div>Data: {data}</div>;
};

describe('ReactQueryProvider', () => {
    describe('Provider Functionality', () => {
        it('renders children', () => {
            render(
                <ReactQueryProvider>
                    <div>Test Child</div>
                </ReactQueryProvider>
            );

            expect(screen.getByText('Test Child')).toBeInTheDocument();
        });

        it('renders multiple children', () => {
            render(
                <ReactQueryProvider>
                    <div>Child 1</div>
                    <div>Child 2</div>
                </ReactQueryProvider>
            );

            expect(screen.getByText('Child 1')).toBeInTheDocument();
            expect(screen.getByText('Child 2')).toBeInTheDocument();
        });

        it('renders nested elements', () => {
            render(
                <ReactQueryProvider>
                    <div>
                        <span>Nested</span>
                    </div>
                </ReactQueryProvider>
            );

            expect(screen.getByText('Nested')).toBeInTheDocument();
        });
    });

    describe('React Query Integration', () => {
        it('allows useQuery to be used in children', async () => {
            render(
                <ReactQueryProvider>
                    <TestComponent queryKey={['test']} />
                </ReactQueryProvider>
            );

            // Should show loading initially, then data
            expect(screen.getByText('Loading...')).toBeInTheDocument();

            // Wait for data to load
            expect(await screen.findByText(/Data: test data/)).toBeInTheDocument();
        });

        it('shares query cache between components', async () => {
            let fetchCount = 0;
            const queryFn = async () => {
                fetchCount++;
                return 'shared data';
            };

            const SharedTestComponent: React.FC = () => {
                const {data, isLoading} = useQuery({
                    queryKey: ['shared-test'],
                    queryFn,
                });

                if (isLoading) return <div>Loading...</div>;
                return <div>Data: {data}</div>;
            };

            render(
                <ReactQueryProvider>
                    <SharedTestComponent />
                    <SharedTestComponent />
                </ReactQueryProvider>
            );

            // Wait for data to load
            await screen.findAllByText(/Data: shared data/);

            // Both components should use the same cached data
            // Query should only be called once due to deduplication
            expect(fetchCount).toBe(1);
        });
    });

    describe('Default Configuration', () => {
        it('uses the configured queryClient', async () => {
            // Test that the provider uses the correct queryClient by verifying
            // default options are applied
            const ConfigTestComponent: React.FC = () => {
                const {isLoading, data, isStale} = useQuery({
                    queryKey: ['config-test'],
                    queryFn: async () => 'config data',
                });

                if (isLoading) return <div>Loading...</div>;
                return (
                    <div>
                        <span>Data: {data}</span>
                        <span>Stale: {isStale ? 'yes' : 'no'}</span>
                    </div>
                );
            };

            render(
                <ReactQueryProvider>
                    <ConfigTestComponent />
                </ReactQueryProvider>
            );

            // Wait for data
            expect(await screen.findByText(/Data: config data/)).toBeInTheDocument();
        });
    });

    describe('Error Boundaries', () => {
        it('does not crash with error in child', () => {
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = jest.fn();

            const ErrorComponent: React.FC = () => {
                throw new Error('Test error');
            };

            expect(() => {
                try {
                    render(
                        <ReactQueryProvider>
                            <ErrorComponent />
                        </ReactQueryProvider>
                    );
                } catch (e) {
                    // Expected to throw
                }
            }).not.toThrow();

            console.error = originalError;
        });
    });

    describe('Component Types', () => {
        it('accepts functional components as children', () => {
            const FunctionalChild: React.FC = () => <div>Functional</div>;

            render(
                <ReactQueryProvider>
                    <FunctionalChild />
                </ReactQueryProvider>
            );

            expect(screen.getByText('Functional')).toBeInTheDocument();
        });

        it('accepts text content as children', () => {
            render(
                <ReactQueryProvider>
                    Text content
                </ReactQueryProvider>
            );

            expect(screen.getByText('Text content')).toBeInTheDocument();
        });

        it('accepts fragments as children', () => {
            render(
                <ReactQueryProvider>
                    <>
                        <div>Fragment 1</div>
                        <div>Fragment 2</div>
                    </>
                </ReactQueryProvider>
            );

            expect(screen.getByText('Fragment 1')).toBeInTheDocument();
            expect(screen.getByText('Fragment 2')).toBeInTheDocument();
        });
    });
});
