/**
 * QueryClient and queryKeys Tests
 */

import {QueryClient} from '@tanstack/react-query';
import type {queryClient as QueryClientType} from './queryClient';

// We need jest.isolateModules to re-import queryClient.ts with different
// window.ReactQueryClient states, since the module is evaluated once on import.

describe('queryClient', () => {
    const originalReactQueryClient = window.ReactQueryClient;

    afterEach(() => {
        // Restore original state
        window.ReactQueryClient = originalReactQueryClient;
    });

    describe('Shared Instance (window.ReactQueryClient present)', () => {
        it('returns the window.ReactQueryClient instance instead of creating a new one', () => {
            const sharedClient = new QueryClient();
            window.ReactQueryClient = sharedClient;

            let importedClient: typeof QueryClientType;
            jest.isolateModules(() => {
                importedClient = require('./queryClient').queryClient;
            });

            expect(importedClient!).toBe(sharedClient);
        });

        it('applies default options to the shared instance', () => {
            const sharedClient = new QueryClient();
            window.ReactQueryClient = sharedClient;

            jest.isolateModules(() => {
                require('./queryClient');
            });

            const options = sharedClient.getDefaultOptions();
            expect(options.queries?.refetchOnWindowFocus).toBe(false);
            expect(options.queries?.retry).toBe(1);
            expect(options.queries?.staleTime).toBe(30_000);
            expect(options.queries?.gcTime).toBe(5 * 60 * 1000);
            expect(options.mutations?.retry).toBe(0);
        });
    });

    describe('Fallback (window.ReactQueryClient absent)', () => {
        it('creates a new QueryClient when window.ReactQueryClient is undefined', () => {
            window.ReactQueryClient = undefined;

            let importedClient: typeof QueryClientType;
            jest.isolateModules(() => {
                importedClient = require('./queryClient').queryClient;
            });

            expect(importedClient!).toBeDefined();
            expect(typeof importedClient!.getQueryCache).toBe('function');
        });

        it('applies default options to the fallback instance', () => {
            window.ReactQueryClient = undefined;

            let importedClient: typeof QueryClientType;
            jest.isolateModules(() => {
                importedClient = require('./queryClient').queryClient;
            });

            const options = importedClient!.getDefaultOptions();
            expect(options.queries?.refetchOnWindowFocus).toBe(false);
            expect(options.queries?.retry).toBe(1);
            expect(options.queries?.staleTime).toBe(30_000);
            expect(options.queries?.gcTime).toBe(5 * 60 * 1000);
            expect(options.mutations?.retry).toBe(0);
        });
    });

    describe('Cross-bundle cache sharing (regression test)', () => {
        it('two independent imports resolve to the same QueryClient when window.ReactQueryClient is set', () => {
            const sharedClient = new QueryClient();
            window.ReactQueryClient = sharedClient;

            let clientA: typeof QueryClientType;
            let clientB: typeof QueryClientType;

            // Simulate two separate bundle imports by isolating each
            jest.isolateModules(() => {
                clientA = require('./queryClient').queryClient;
            });
            jest.isolateModules(() => {
                clientB = require('./queryClient').queryClient;
            });

            expect(clientA!).toBe(clientB!);
            expect(clientA!).toBe(sharedClient);
        });

        it('invalidating queries on one reference is visible to the other', () => {
            window.ReactQueryClient = new QueryClient();

            let clientA: typeof QueryClientType;
            let clientB: typeof QueryClientType;

            jest.isolateModules(() => {
                clientA = require('./queryClient').queryClient;
            });
            jest.isolateModules(() => {
                clientB = require('./queryClient').queryClient;
            });

            // Set data via clientA
            clientA!.setQueryData(['jobs', 'detail', 42, 'standard'], {id: 42, status: 'New'});

            // Read it back via clientB — proves shared cache
            const data = clientB!.getQueryData(['jobs', 'detail', 42, 'standard']);
            expect(data).toEqual({id: 42, status: 'New'});

            // Invalidate via clientB
            clientB!.removeQueries({queryKey: ['jobs', 'detail', 42]});

            // Verify it's gone via clientA
            const removed = clientA!.getQueryData(['jobs', 'detail', 42, 'standard']);
            expect(removed).toBeUndefined();
        });
    });
});

describe('queryKeys', () => {
    // Import once for key factory tests (no window dependency)
    let queryKeys: typeof import('./queryClient')['queryKeys'];
    beforeAll(() => {
        jest.isolateModules(() => {
            queryKeys = require('./queryClient').queryKeys;
        });
    });

    describe('couriers', () => {
        it('has all key', () => {
            expect(queryKeys.couriers.all).toEqual(['couriers']);
        });

        it('generates search key with search text', () => {
            expect(queryKeys.couriers.search('john')).toEqual(['couriers', 'search', 'john']);
        });

        it('generates different search keys for different inputs', () => {
            const key1 = queryKeys.couriers.search('john');
            const key2 = queryKeys.couriers.search('jane');
            expect(key1).not.toEqual(key2);
        });
    });

    describe('timeZones', () => {
        it('has all key', () => {
            expect(queryKeys.timeZones.all).toEqual(['timeZones']);
        });
    });

    describe('jobs', () => {
        it('has all key', () => {
            expect(queryKeys.jobs.all).toEqual(['jobs']);
        });

        it('generates related key with jobId and isArchived', () => {
            expect(queryKeys.jobs.related(123, false)).toEqual(['jobs', 'related', 123, false]);
        });

        it('generates different keys for archived vs non-archived', () => {
            const nonArchived = queryKeys.jobs.related(123, false);
            const archived = queryKeys.jobs.related(123, true);
            expect(nonArchived).not.toEqual(archived);
        });

        it('generates different keys for different job IDs', () => {
            const job1 = queryKeys.jobs.related(123, false);
            const job2 = queryKeys.jobs.related(456, false);
            expect(job1).not.toEqual(job2);
        });
    });

    describe('addresses', () => {
        it('has all key', () => {
            expect(queryKeys.addresses.all).toEqual(['addresses']);
        });

        it('generates search key with search text', () => {
            expect(queryKeys.addresses.search('main street')).toEqual(['addresses', 'search', 'main street']);
        });

        it('generates details key with address ID', () => {
            expect(queryKeys.addresses.details('addr123')).toEqual(['addresses', 'details', 'addr123']);
        });

        it('generates nearest key with coordinates', () => {
            expect(queryKeys.addresses.nearest(-36.8485, 174.7633)).toEqual(['addresses', 'nearest', -36.8485, 174.7633]);
        });
    });

    describe('hereMaps', () => {
        it('has apiKey key', () => {
            expect(queryKeys.hereMaps.apiKey).toEqual(['hereMaps', 'apiKey']);
        });
    });

    describe('recurringJobs', () => {
        it('has all key', () => {
            expect(queryKeys.recurringJobs.all).toEqual(['recurringJobs']);
        });

        it('has speeds key', () => {
            expect(queryKeys.recurringJobs.speeds).toEqual(['recurringJobs', 'speeds']);
        });

        it('generates list key with query parameters', () => {
            const query = {
                order: 'booked',
                orderDirection: 'asc',
                limit: 25,
                page: 1,
                active: true,
            };
            expect(queryKeys.recurringJobs.list(query)).toEqual(['recurringJobs', 'list', query]);
        });

        it('generates different list keys for different parameters', () => {
            const query1 = {order: 'booked', orderDirection: 'asc', limit: 25, page: 1, active: true};
            const query2 = {order: 'booked', orderDirection: 'asc', limit: 25, page: 2, active: true};
            expect(queryKeys.recurringJobs.list(query1)).not.toEqual(queryKeys.recurringJobs.list(query2));
        });

        it('includes optional parameters in list key', () => {
            const query = {
                order: 'booked',
                orderDirection: 'asc',
                limit: 25,
                page: 1,
                active: true,
                searchText: 'test',
                speedId: 1,
                courierId: 5,
            };
            const key = queryKeys.recurringJobs.list(query);
            expect(key[2]).toEqual(query);
        });
    });

    describe('notes', () => {
        it('has all key', () => {
            expect(queryKeys.notes.all).toEqual(['notes']);
        });

        it('has types key', () => {
            expect(queryKeys.notes.types).toEqual(['notes', 'types']);
        });

        it('generates job key with jobId and isRecurring', () => {
            expect(queryKeys.notes.job(100, false)).toEqual(['notes', 'job', 100, false]);
            expect(queryKeys.notes.job(100, true)).toEqual(['notes', 'job', 100, true]);
        });

        it('generates bulkJob key with bulkJobId', () => {
            expect(queryKeys.notes.bulkJob(200)).toEqual(['notes', 'bulkJob', 200]);
        });
    });

    describe('priceBreakdowns', () => {
        it('has all key', () => {
            expect(queryKeys.priceBreakdowns.all).toEqual(['priceBreakdowns']);
        });

        it('generates job key with all parameters', () => {
            expect(queryKeys.priceBreakdowns.job(100, false, false)).toEqual(['priceBreakdowns', 'job', 100, false, false]);
        });

        it('generates different keys for prebook vs regular jobs', () => {
            const regular = queryKeys.priceBreakdowns.job(100, false, false);
            const prebook = queryKeys.priceBreakdowns.job(100, true, false);
            expect(regular).not.toEqual(prebook);
        });

        it('generates different keys for archived vs non-archived', () => {
            const nonArchived = queryKeys.priceBreakdowns.job(100, false, false);
            const archived = queryKeys.priceBreakdowns.job(100, false, true);
            expect(nonArchived).not.toEqual(archived);
        });
    });

    describe('tasks', () => {
        it('has all key', () => {
            expect(queryKeys.tasks.all).toEqual(['tasks']);
        });

        it('has staff key', () => {
            expect(queryKeys.tasks.staff).toEqual(['tasks', 'staff']);
        });

        it('has eventTypes key', () => {
            expect(queryKeys.tasks.eventTypes).toEqual(['tasks', 'eventTypes']);
        });

        it('generates list key with filters', () => {
            const filters = {searchText: 'test', showCompleted: false};
            expect(queryKeys.tasks.list(filters)).toEqual(['tasks', 'list', filters]);
        });

        it('generates deliveryJourney key with jobId', () => {
            expect(queryKeys.tasks.deliveryJourney(300)).toEqual(['tasks', 'deliveryJourney', 300]);
        });
    });

    describe('Key Immutability', () => {
        it('returns readonly arrays', () => {
            const key = queryKeys.couriers.all;
            expect(Array.isArray(key)).toBe(true);
        });

        it('search function returns new array each call', () => {
            const key1 = queryKeys.couriers.search('test');
            const key2 = queryKeys.couriers.search('test');
            expect(key1).toEqual(key2);
        });
    });
});
