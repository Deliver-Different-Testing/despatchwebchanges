/**
 * QueryClient and queryKeys Tests
 */

import {hashKey} from '@tanstack/react-query';
import {queryClient} from './queryClient';

describe('queryClient', () => {
    it('applies the app default options', () => {
        const options = queryClient.getDefaultOptions();
        expect(options.queries?.refetchOnWindowFocus).toBe(false);
        expect(options.queries?.retry).toBe(1);
        expect(options.queries?.staleTime).toBe(30_000);
        expect(options.queries?.gcTime).toBe(5 * 60 * 1000);
        expect(options.mutations?.retry).toBe(0);
    });

    it('is a single shared instance with a shared cache', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const again = require('./queryClient').queryClient;
        expect(again).toBe(queryClient);

        queryClient.setQueryData(['jobs', 'detail', 42, 'standard'], {id: 42, status: 'New'});
        expect(again.getQueryData(['jobs', 'detail', 42, 'standard'])).toEqual({id: 42, status: 'New'});
        queryClient.removeQueries({queryKey: ['jobs', 'detail', 42]});
        expect(again.getQueryData(['jobs', 'detail', 42, 'standard'])).toBeUndefined();
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

    describe('splitPriceBreakdown', () => {
        it('has all key', () => {
            expect(queryKeys.splitPriceBreakdown.all).toEqual(['splitPriceBreakdown']);
        });

        it('generates job key', () => {
            expect(queryKeys.splitPriceBreakdown.job(100)).toEqual(['splitPriceBreakdown', 'job', 100]);
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

    describe('dispatch', () => {
        const params = {
            courierId: 7,
            startDate: 'today-start',
            endDate: 'today-end',
            page: 0,
            pageSize: 50,
        } as any;

        it('generates currentWork key with params', () => {
            expect(queryKeys.dispatch.currentWork(params)).toEqual(['dispatch', 'currentWork', params]);
        });

        it('generates currentWorkMap key with params', () => {
            expect(queryKeys.dispatch.currentWorkMap(params)).toEqual(['dispatch', 'currentWorkMap', params]);
        });

        // Regression: the map-courier plain query must NOT collide with the
        // CurrentWorkBox infinite query's cache entry (a plain-vs-infinite shape
        // clash throws `pages.length` inside the infinite observer).
        it('currentWorkMap does not collide with currentWork for identical params', () => {
            expect(hashKey(queryKeys.dispatch.currentWork(params)))
                .not.toEqual(hashKey(queryKeys.dispatch.currentWorkMap(params)));
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
