/**
 * Renders the job-details panel in the host's React tree.
 *
 * Gives every page's detail box one shared mount path.
 *
 * This was copy-pasted into `DispatchPage` and `JobSearchPage` and the two had
 * drifted: Dispatch grew the related-job/update callbacks and the
 * remount-avoidance below, while Job Search kept `isBulkJob` but tore the panel
 * down on every prop change. This is the union of the two.
 */

import React, {useCallback, useMemo, useRef} from 'react';
import {JobDetails} from './JobDetails';
import {ErrorBoundary} from '../error-boundary';
import {useJobDetailsRefreshNonce} from './jobDetailsRefresh';
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
    // Latest callbacks live in refs so a host re-render with new inline functions
    // keeps the config (and the panel's internal tab state) stable.
    const onRelatedJobChangeRef = useRef(onRelatedJobChange);
    const onJobUpdateRef = useRef(onJobUpdate);
    onRelatedJobChangeRef.current = onRelatedJobChange;
    onJobUpdateRef.current = onJobUpdate;

    const stableRelatedJobChange = useCallback((id: number) => onRelatedJobChangeRef.current?.(id), []);
    const stableJobUpdate = useCallback(() => onJobUpdateRef.current?.(), []);
    const refreshNonce = useJobDetailsRefreshNonce();

    const config = useMemo(() => ({
        jobId,
        isBulkJob,
        isRecurringJob: false,
        isUsCustomer,
        showToast,
        onRelatedJobChange: stableRelatedJobChange,
        onJobUpdate: stableJobUpdate,
        _refreshNonce: refreshNonce,
    }), [jobId, isBulkJob, isUsCustomer, showToast, stableRelatedJobChange, stableJobUpdate, refreshNonce]);

    return (
        <div id={containerId} style={{height: '100%', overflow: 'auto', backgroundColor: 'var(--mantine-color-gray-1)'}}>
            <ErrorBoundary>
                <JobDetails config={config}/>
            </ErrorBoundary>
        </div>
    );
};

export default JobDetailsMount;
