import {useQuery} from '@tanstack/react-query';
import {apiClient, ApiError} from '../services/apiClient';
import {setSessionContext, SessionContextDto} from '../session';

export const sessionContextKey = ['session', 'context'] as const;

/** Publishes into the session store in the queryFn so getSession() is populated before children render. */
export function useSessionContext() {
    return useQuery<SessionContextDto, ApiError>({
        queryKey: sessionContextKey,
        queryFn: async () => {
            const context = await apiClient.get<SessionContextDto>('/api/context');
            setSessionContext(context);
            return context;
        },
        retry: false,
        staleTime: Infinity,
    });
}
