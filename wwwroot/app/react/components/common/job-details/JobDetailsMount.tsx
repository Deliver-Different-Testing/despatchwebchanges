/**
 * Adapter for the imperative job-details mount API.
 *
 * Keeps the existing module boundary (`window.ReactJobDetails`) so every page's
 * detail box reuses the one job-details bundle the app already loads.
 *
 * This was copy-pasted into `DispatchPage` and `JobSearchPage` and the two had
 * drifted: Dispatch grew the related-job/update callbacks and the
 * remount-avoidance below, while Job Search kept `isBulkJob` but tore the panel
 * down on every prop change. This is the union of the two.
 */

import React, {useEffect, useRef} from 'react';
import type {ShowToastFn} from '../../../services/toastService';

export interface JobDetailsMountProps {
    jobId: number;
    /** DOM id for this page's container; pages must not share one. */
    containerId: string;
    isUsCustomer: boolean;
    showToast: ShowToastFn;
    /** Bulk jobs resolve their detail from a different endpoint. */
    isBulkJob?: boolean;
    /** A related job was picked inside the panel (V1 `jobChanged`). */
    onRelatedJobChange?: (jobId: number) => void;
    /** The panel edited the job — the host should refresh its lists. */
    onJobUpdate?: () => void;
}

export const JobDetailsMount: React.FC<JobDetailsMountProps> = ({
    jobId,
    containerId,
    isUsCustomer,
    showToast,
    isBulkJob = false,
    onRelatedJobChange,
    onJobUpdate,
}) => {
    /*
     * Hold the latest callbacks in refs so a host re-render handing down new
     * inline functions does not churn the mount. The panel is its own React
     * root and has to stay continuously mounted across re-renders (auto-refresh,
     * related-job clicks) for its internal tab state to survive — a remount
     * silently snaps the selected tab back to the first one.
     */
    const onRelatedJobChangeRef = useRef(onRelatedJobChange);
    const onJobUpdateRef = useRef(onJobUpdate);
    onRelatedJobChangeRef.current = onRelatedJobChange;
    onJobUpdateRef.current = onJobUpdate;

    useEffect(() => {
        const w = window as any;
        if (!w.ReactJobDetails?.mount) return;

        // mount() reuses the existing root for the same container, so this
        // re-renders the panel with new props rather than remounting it.
        w.ReactJobDetails.mount(containerId, {
            jobId,
            isBulkJob,
            isUsCustomer,
            showToast,
            onRelatedJobChange: (id: number) => onRelatedJobChangeRef.current?.(id),
            onJobUpdate: () => onJobUpdateRef.current?.(),
        });
    }, [jobId, containerId, isBulkJob, isUsCustomer, showToast]);

    // Unmount only when this adapter leaves the tree (box hidden / page torn down),
    // never on a prop change.
    useEffect(() => () => {
        (window as any).ReactJobDetails?.unmount?.();
    }, []);

    return <div id={containerId} style={{height: '100%', overflow: 'auto'}}/>;
};

export default JobDetailsMount;
