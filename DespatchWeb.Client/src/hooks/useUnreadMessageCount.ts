import {useCallback, useEffect, useRef, useState} from 'react';
import {messagingApi} from '../api/messagingApi';

const POLL_INTERVAL_MS = 60_000;

export function useUnreadMessageCount(): {count: number; refresh: () => Promise<void>} {
    const [count, setCount] = useState(0);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const next = await messagingApi.getUnreadMessageCount();
            if (mounted.current) setCount(next);
        } catch (err) {
            console.error('[messaging] unread count error', err);
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        void refresh();
        const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
        return () => {
            mounted.current = false;
            clearInterval(id);
        };
    }, [refresh]);

    return {count, refresh};
}
