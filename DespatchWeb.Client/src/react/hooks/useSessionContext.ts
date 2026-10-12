import {useQuery} from '@tanstack/react-query';
import {apiClient, ApiError} from '../services/apiClient';
import {setSessionContext, SessionContextDto} from '../session';

export const sessionContextKey = ['session', 'context'] as const;

/** Fetches the session and publishes it into the session store so getSession() is populated. */
export async function fetchSessionContext(): Promise<SessionContextDto> {
    const context = await apiClient.get<SessionContextDto>('/api/context');
    setSessionContext(context);
    return context;
}

/** `initialData` is a context the bootstrap already fetched (and published), so no second request is made. */
export function useSessionContext(initialData?: SessionContextDto) {
    return useQuery<SessionContextDto, ApiError>({
        queryKey: sessionContextKey,
        queryFn: fetchSessionContext,
        initialData,
        retry: false,
        staleTime: Infinity,
    });
}
