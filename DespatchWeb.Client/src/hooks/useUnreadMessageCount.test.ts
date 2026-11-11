import type {Mock} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {useUnreadMessageCount} from './useUnreadMessageCount';
import {messagingApi} from '../api/messagingApi';

vi.mock('../api/messagingApi', () => ({
    messagingApi: {getUnreadMessageCount: vi.fn()},
}));

const getCount = messagingApi.getUnreadMessageCount as Mock;

describe('useUnreadMessageCount', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        getCount.mockReset().mockResolvedValue(3);
    });
    afterEach(() => vi.useRealTimers());

    it('loads on mount, polls every 60s, refreshes on demand and stops on unmount', async () => {
        const {result, unmount} = renderHook(() => useUnreadMessageCount());
        await act(async () => {});
        expect(result.current.count).toBe(3);

        getCount.mockResolvedValue(5);
        await act(async () => {
            vi.advanceTimersByTime(59_000);
        });
        expect(result.current.count).toBe(3);
        await act(async () => {
            vi.advanceTimersByTime(1_000);
        });
        expect(result.current.count).toBe(5);

        getCount.mockResolvedValue(8);
        await act(() => result.current.refresh());
        expect(result.current.count).toBe(8);

        const calls = getCount.mock.calls.length;
        unmount();
        await act(async () => {
            vi.advanceTimersByTime(180_000);
        });
        expect(getCount).toHaveBeenCalledTimes(calls);
    });

    it('logs failures instead of throwing and keeps the last count', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const {result} = renderHook(() => useUnreadMessageCount());
        await act(async () => {});

        getCount.mockRejectedValue(new Error('boom'));
        await act(() => result.current.refresh());
        expect(result.current.count).toBe(3);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
