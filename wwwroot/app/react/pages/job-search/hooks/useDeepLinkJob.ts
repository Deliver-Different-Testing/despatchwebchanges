import {useEffect, useRef} from 'react';

export interface UseDeepLinkJobOptions {
    deepLinkJobId?: number;
    onSelectJob: (jobId: number) => void;
}

export function useDeepLinkJob({deepLinkJobId, onSelectJob}: UseDeepLinkJobOptions): void {
    const fired = useRef(false);
    useEffect(() => {
        if (fired.current || !deepLinkJobId) return;
        fired.current = true;
        onSelectJob(deepLinkJobId);
    }, [deepLinkJobId, onSelectJob]);
}
