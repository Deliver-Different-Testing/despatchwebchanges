/**
 * Tests for JobHighlightService
 * Tests the pub/sub pattern for highlighting related jobs in the job list
 */

import JobHighlightService from './job-highlight.service';

describe('JobHighlightService', () => {
    let service: JobHighlightService;

    beforeEach(() => {
        service = new JobHighlightService();
        // Suppress console logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('$get', () => {
        it('should return itself as the service instance', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('updateHighlightedRelatedJobs', () => {
        it('should clear highlights when selectedJob is null', () => {
            // First set some highlights
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }, { id: 2 }]
            } as any);
            expect(service.getHighlightedRelatedJobIds()).toHaveLength(2);

            // Then pass null
            service.updateHighlightedRelatedJobs(null as any);
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should clear highlights when selectedJob is undefined', () => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);

            service.updateHighlightedRelatedJobs(undefined as any);
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should clear highlights when relatedJobs is undefined', () => {
            service.updateHighlightedRelatedJobs({} as any);
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should clear highlights when relatedJobs is empty array', () => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: []
            } as any);
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should extract job IDs from related jobs', () => {
            const selectedJob = {
                id: 100,
                relatedJobs: [
                    { id: 1 },
                    { id: 2 },
                    { id: 3 }
                ]
            };

            service.updateHighlightedRelatedJobs(selectedJob as any);

            expect(service.getHighlightedRelatedJobIds()).toEqual([1, 2, 3]);
        });

        it('should replace previous highlights with new ones', () => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }, { id: 2 }]
            } as any);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 5 }, { id: 6 }, { id: 7 }]
            } as any);

            expect(service.getHighlightedRelatedJobIds()).toEqual([5, 6, 7]);
        });

        it('should notify listeners when highlights change', () => {
            const listener = jest.fn();
            service.subscribe(listener);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }, { id: 2 }]
            } as any);

            expect(listener).toHaveBeenCalledWith([1, 2]);
        });

        it('should notify listeners when highlights are cleared', () => {
            const listener = jest.fn();
            service.subscribe(listener);

            service.updateHighlightedRelatedJobs(null as any);

            expect(listener).toHaveBeenCalledWith([]);
        });
    });

    describe('getHighlightedRelatedJobIds', () => {
        it('should return empty array initially', () => {
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should return a copy of the array, not the original', () => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);

            const ids = service.getHighlightedRelatedJobIds();
            ids.push(999);

            expect(service.getHighlightedRelatedJobIds()).toEqual([1]);
        });
    });

    describe('isJobHighlighted', () => {
        beforeEach(() => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }, { id: 2 }, { id: 3 }]
            } as any);
        });

        it('should return true for highlighted job IDs', () => {
            expect(service.isJobHighlighted(1)).toBe(true);
            expect(service.isJobHighlighted(2)).toBe(true);
            expect(service.isJobHighlighted(3)).toBe(true);
        });

        it('should return false for non-highlighted job IDs', () => {
            expect(service.isJobHighlighted(4)).toBe(false);
            expect(service.isJobHighlighted(100)).toBe(false);
            expect(service.isJobHighlighted(0)).toBe(false);
        });

        it('should return false when no jobs are highlighted', () => {
            service.clearHighlights();
            expect(service.isJobHighlighted(1)).toBe(false);
        });
    });

    describe('subscribe', () => {
        it('should call listener immediately when highlights change', () => {
            const listener = jest.fn();
            service.subscribe(listener);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 5 }]
            } as any);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith([5]);
        });

        it('should support multiple listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            const listener3 = jest.fn();

            service.subscribe(listener1);
            service.subscribe(listener2);
            service.subscribe(listener3);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 10 }]
            } as any);

            expect(listener1).toHaveBeenCalledWith([10]);
            expect(listener2).toHaveBeenCalledWith([10]);
            expect(listener3).toHaveBeenCalledWith([10]);
        });

        it('should return an unsubscribe function', () => {
            const listener = jest.fn();
            const unsubscribe = service.subscribe(listener);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should stop notifying after unsubscribe is called', () => {
            const listener = jest.fn();
            const unsubscribe = service.subscribe(listener);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 2 }]
            } as any);
            expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it('should handle unsubscribe being called multiple times', () => {
            const listener = jest.fn();
            const unsubscribe = service.subscribe(listener);

            unsubscribe();
            unsubscribe(); // Should not throw
            unsubscribe();

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);
            expect(listener).not.toHaveBeenCalled();
        });

        it('should pass a copy of the IDs to listeners', () => {
            service.subscribe((ids) => {
                ids.push(999); // Try to modify
            });

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);

            // Original should be unaffected
            expect(service.getHighlightedRelatedJobIds()).toEqual([1]);
        });

        it('should continue notifying other listeners if one throws', () => {
            const errorListener = jest.fn().mockImplementation(() => {
                throw new Error('Listener error');
            });
            const goodListener = jest.fn();

            jest.spyOn(console, 'error').mockImplementation(() => {});

            service.subscribe(errorListener);
            service.subscribe(goodListener);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);

            expect(errorListener).toHaveBeenCalled();
            expect(goodListener).toHaveBeenCalled();
        });
    });

    describe('clearHighlights', () => {
        it('should clear all highlighted job IDs', () => {
            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }, { id: 2 }, { id: 3 }]
            } as any);

            service.clearHighlights();

            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });

        it('should notify listeners when clearing', () => {
            const listener = jest.fn();
            service.subscribe(listener);

            service.updateHighlightedRelatedJobs({
                relatedJobs: [{ id: 1 }]
            } as any);
            listener.mockClear();

            service.clearHighlights();

            expect(listener).toHaveBeenCalledWith([]);
        });

        it('should be safe to call when already empty', () => {
            service.clearHighlights();
            expect(service.getHighlightedRelatedJobIds()).toEqual([]);
        });
    });
});
