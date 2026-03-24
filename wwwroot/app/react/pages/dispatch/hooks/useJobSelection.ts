/**
 * useJobSelection Hook
 *
 * Manages the currently selected job and related state.
 */

import React, {useCallback, useState, useRef} from 'react';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

export interface UseJobSelectionReturn {
    /** Currently selected job ID */
    currentJobId: number | null;
    /** Currently selected job object */
    currentJob: DispatchJob | null;
    /** Subtitle text for job detail header */
    currentSelection: string;
    /** Select a job (from list click, map click, etc.) */
    selectJob: (job: DispatchJob | null) => void;
    /** Select a job by ID only (when full object isn't available) */
    selectJobById: (jobId: number | null) => void;
    /** Callback ref for when job list provides a selectJob function */
    selectJobInListRef: React.RefObject<((jobId: number) => void) | null>;
    /** Callback ref for refreshing the job list */
    refreshJobListRef: React.RefObject<(() => void) | null>;
}

export function useJobSelection(initialJobId?: number | null): UseJobSelectionReturn {
    const [currentJobId, setCurrentJobId] = useState<number | null>(initialJobId ?? null);
    const [currentJob, setCurrentJob] = useState<DispatchJob | null>(null);
    const [currentSelection, setCurrentSelection] = useState('');

    // Refs for imperative callbacks from child components
    const selectJobInListRef = useRef<((jobId: number) => void) | null>(null);
    const refreshJobListRef = useRef<(() => void) | null>(null);

    const selectJob = useCallback((job: DispatchJob | null) => {
        if (job) {
            setCurrentJobId(job.id);
            setCurrentJob(job);
            setCurrentSelection(` - Job #${job.jobNo || job.id}`);
        } else {
            setCurrentJobId(null);
            setCurrentJob(null);
            setCurrentSelection('');
        }
    }, []);

    const selectJobById = useCallback((jobId: number | null) => {
        setCurrentJobId(jobId);
        if (!jobId) {
            setCurrentJob(null);
            setCurrentSelection('');
        } else {
            setCurrentSelection(` - Job #${jobId}`);
        }
    }, []);

    return {
        currentJobId,
        currentJob,
        currentSelection,
        selectJob,
        selectJobById,
        selectJobInListRef,
        refreshJobListRef,
    };
}
