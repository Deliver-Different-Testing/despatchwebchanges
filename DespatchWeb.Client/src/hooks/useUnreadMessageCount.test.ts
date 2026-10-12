import {act, renderHook} from '@testing-library/react';
import {useUnreadMessageCount} from './useUnreadMessageCount';
import {messagingApi} from '../api/messagingApi';

jest.mock('../api/messagingApi', () => ({
    messagingApi: {getUnreadMessageCount: jest.fn()},
}));

const getCount = messagingApi.getUnreadMessageCount as jest.Mock;

describe('useUnreadMessageCount', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getCount.mockReset().mockResolvedValue(3);
    });
    afterEach(() => jest.useRealTimers());

    it('loads on mount, polls every 60s, refreshes on demand and stops on unmount', async () => {
        const {result, unmount} = renderHook(() => useUnreadMessageCount());
        await act(async () => {});
        expect(result.current.count).toBe(3);

        getCount.mockResolvedValue(5);
        await act(async () => {
            jest.advanceTimersByTime(59_000);
        });
        expect(result.current.count).toBe(3);
        await act(async () => {
            jest.advanceTimersByTime(1_000);
        });
        expect(result.current.count).toBe(5);

        getCount.mockResolvedValue(8);
        await act(() => result.current.refresh());
        expect(result.current.count).toBe(8);

        const calls = getCount.mock.calls.length;
        unmount();
        await act(async () => {
            jest.advanceTimersByTime(180_000);
        });
        expect(getCount).toHaveBeenCalledTimes(calls);
    });

    it('logs failures instead of throwing and keeps the last count', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const {result} = renderHook(() => useUnreadMessageCount());
        await act(async () => {});

        getCount.mockRejectedValue(new Error('boom'));
        await act(() => result.current.refresh());
        expect(result.current.count).toBe(3);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
