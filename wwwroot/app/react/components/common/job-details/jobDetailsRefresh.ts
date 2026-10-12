import {useSyncExternalStore} from 'react';
import {queryClient} from '../../../query/queryClient';

let nonce = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/**
 * Forces the mounted job-details panel to refetch (the nonce makes it call
 * refetch() directly) and invalidates its ancillary queries.
 */
export async function refreshJobDetails(): Promise<void> {
    nonce++;
    listeners.forEach(l => l());
    await Promise.all([
        queryClient.invalidateQueries({queryKey: ['jobs', 'photos']}),
        queryClient.invalidateQueries({queryKey: ['priceBreakdowns']}),
    ]);
}

export function useJobDetailsRefreshNonce(): number {
    return useSyncExternalStore(subscribe, () => nonce, () => nonce);
}
