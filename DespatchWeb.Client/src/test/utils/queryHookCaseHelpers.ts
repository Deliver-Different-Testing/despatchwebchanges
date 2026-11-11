import {renderHook, waitFor} from '@testing-library/react';
import {createQueryWrapper} from './index';

type QueryHookResult = {isSuccess: boolean; isError: boolean; data?: unknown; error?: unknown};

export async function expectQueryHookEmptyData(useHook: () => QueryHookResult) {
    const {result} = renderHook(useHook, {wrapper: createQueryWrapper()});

    await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
}

export async function expectQueryHookError(useHook: () => QueryHookResult, error: Error) {
    const {result} = renderHook(useHook, {wrapper: createQueryWrapper()});

    await waitFor(() => {
        expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
}
