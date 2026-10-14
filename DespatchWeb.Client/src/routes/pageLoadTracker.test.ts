import {getPendingPageLoads, subscribePageLoads, trackPageLoad} from './pageLoadTracker';

describe('pageLoadTracker', () => {
    it('counts a load as pending until it settles, notifying subscribers', async () => {
        const listener = jest.fn();
        const unsubscribe = subscribePageLoads(listener);
        let resolve!: (v: string) => void;

        const loading = trackPageLoad(() => new Promise<string>(r => (resolve = r)));
        expect(getPendingPageLoads()).toBe(1);

        resolve('page');
        await expect(loading).resolves.toBe('page');
        expect(getPendingPageLoads()).toBe(0);
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
    });

    it('settles the count when the load fails', async () => {
        await expect(trackPageLoad(() => Promise.reject(new Error('chunk')))).rejects.toThrow('chunk');
        expect(getPendingPageLoads()).toBe(0);
    });
});
