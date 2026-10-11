import {renderHook, waitFor} from '@testing-library/react';
import {apiClient} from '../services/apiClient';
import {clearSessionContext, getSession, SessionContextDto} from '../session';
import {createQueryWrapper, createTestQueryClient} from '../__testUtils__';
import {useSessionContext} from './useSessionContext';

jest.mock('../services/apiClient', () => ({apiClient: {get: jest.fn()}}));

const dto = {contactId: 5, firstName: 'Jane', currencyCode: 'USD'} as SessionContextDto;

afterEach(() => clearSessionContext());

it('fetches /api/context once, no retry, and publishes it to getSession()', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(dto);
    const client = createTestQueryClient();
    const {result} = renderHook(() => useSessionContext(), {wrapper: createQueryWrapper(client)});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/api/context');
    expect(getSession()).toMatchObject({contactId: 5, firstName: 'Jane'});
    expect(client.getQueryCache().find({queryKey: ['session', 'context']})).toBeDefined();
});

it('does not retry a failure', async () => {
    (apiClient.get as jest.Mock).mockClear().mockRejectedValue({status: 500, message: 'x'});
    const {result} = renderHook(() => useSessionContext(), {wrapper: createQueryWrapper(createTestQueryClient())});

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(apiClient.get).toHaveBeenCalledTimes(1);
});
