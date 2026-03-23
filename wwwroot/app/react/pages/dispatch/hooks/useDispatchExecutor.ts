/**
 * Dispatch Executor Hook
 *
 * React equivalent of the AngularJS dispatch-executor.service.ts.
 * Handles the full job dispatch workflow: validation, confirmation dialogs,
 * dangerous goods checks, chilled vehicle warnings, and job allocation.
 */

import {useState, useCallback, useRef} from 'react';
import dayjs from 'dayjs';
import {allocateJobs, reAllocateJobs} from '../../../services/jobListApi';
import {getCourierById, addFollowupEvent} from '../../../services/dispatchExecutorApi';
import type {ActiveCourierViewModel} from '../../../../interfaces/courier.interface';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import type {ShowToastFn} from '../../../services/toastService';

// ── Types ───────────────────────────────────────────────────────────

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export interface DispatchConfirmation {
    type: 'offline-courier' | 'chilled-warning';
    title: string;
    message: string;
    confirmLabel: string;
    /** Resolve the pending confirmation */
    resolve: (proceed: boolean) => void;
}

export interface CourierSelectionRequest {
    jobNo: string;
    /** Resolve with the selected courier ID, or null to cancel */
    resolve: (courierId: number | null) => void;
}

export interface UseDispatchExecutorReturn {
    /** Whether a dispatch operation is currently in progress */
    dispatching: boolean;
    /** Pending confirmation dialog (null if none) */
    pendingConfirmation: DispatchConfirmation | null;
    /** Pending courier selection dialog (null if none) */
    pendingCourierSelection: CourierSelectionRequest | null;
    /** Dispatch one or more jobs to a courier */
    dispatchJobs: (courierId: number, jobs: DispatchJob[]) => Promise<boolean>;
    /** Dispatch a single job by its ID to a courier */
    assignSingleJobById: (courierId: number, jobId: number) => Promise<boolean>;
    /** Reassign a job - opens courier selection dialog */
    reassignJob: (job: DispatchJob) => Promise<boolean>;
    /** Respond to a pending confirmation */
    resolveConfirmation: (proceed: boolean) => void;
    /** Respond to a pending courier selection */
    resolveCourierSelection: (courierId: number | null) => void;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useDispatchExecutor(showToast: ShowToastFn): UseDispatchExecutorReturn {
    const [dispatching, setDispatching] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState<DispatchConfirmation | null>(null);
    const [pendingCourierSelection, setPendingCourierSelection] = useState<CourierSelectionRequest | null>(null);
    const processingRef = useRef(false);

    // ── Confirmation helper ─────────────────────────────────────────

    const requestConfirmation = useCallback((
        type: DispatchConfirmation['type'],
        title: string,
        message: string,
        confirmLabel: string,
    ): Promise<boolean> => {
        return new Promise((resolve) => {
            setPendingConfirmation({type, title, message, confirmLabel, resolve});
        });
    }, []);

    const resolveConfirmation = useCallback((proceed: boolean) => {
        pendingConfirmation?.resolve(proceed);
        setPendingConfirmation(null);
    }, [pendingConfirmation]);

    // ── Courier selection helper ────────────────────────────────────

    const requestCourierSelection = useCallback((jobNo: string): Promise<number | null> => {
        return new Promise((resolve) => {
            setPendingCourierSelection({jobNo, resolve});
        });
    }, []);

    const resolveCourierSelection = useCallback((courierId: number | null) => {
        pendingCourierSelection?.resolve(courierId);
        setPendingCourierSelection(null);
    }, [pendingCourierSelection]);

    // ── Validation ──────────────────────────────────────────────────

    const isDangerousGoodsJob = (job: DispatchJob): boolean => {
        return job.dgClass != null && job.dgClass > 0;
    };

    const isChilledJob = (job: DispatchJob): boolean => {
        const vehicleName = (job.vehicle as any)?.text?.toLowerCase() ?? '';
        return vehicleName.includes('chilled') || vehicleName.includes('frozen');
    };

    const isChilledCourier = (courier: ActiveCourierViewModel): boolean => {
        const vehicleType = courier.vehicleType?.toLowerCase() ?? '';
        return vehicleType.includes('chilled') || vehicleType.includes('frozen');
    };

    const validateJobForDispatch = (job: DispatchJob, courier: ActiveCourierViewModel): ValidationResult => {
        // Check if job already has a courier assigned
        if (job.courierData?.courierId) {
            return {
                isValid: false,
                message: `Restore ${job.jobNo} prior to dispatching to another courier`,
            };
        }

        // Validate dangerous goods requirements
        if (isDangerousGoodsJob(job)) {
            if (!courier.dangerousGoods) {
                return {
                    isValid: false,
                    message: `DG job ${job.jobNo} cannot be dispatched to courier ${courier.id} - doesn't have DG License.`,
                };
            }

            if (courier.dgLicenseExpiry && dayjs(courier.dgLicenseExpiry) < dayjs().add(1, 'days')) {
                return {
                    isValid: false,
                    message: `Courier ${courier.id} doesn't have a DG License or license has expired.`,
                };
            }
        }

        return {isValid: true, message: ''};
    };

    // ── Chilled job warning ─────────────────────────────────────────

    const checkChilledJobWarning = async (
        jobs: DispatchJob[],
        courier: ActiveCourierViewModel,
    ): Promise<boolean> => {
        const chilledJobs = jobs.filter(isChilledJob);
        if (chilledJobs.length === 0 || isChilledCourier(courier)) {
            return true;
        }

        const jobNos = chilledJobs.map(j => j.jobNo).join(', ');
        const plural = chilledJobs.length > 1;

        return requestConfirmation(
            'chilled-warning',
            'Chilled Job Warning',
            `${plural ? 'Jobs' : 'Job'} ${jobNos} ` +
            `require${plural ? '' : 's'} a chilled/frozen vehicle, ` +
            `but courier ${courier.id} has vehicle type "${courier.vehicleType || 'unknown'}". ` +
            `Dispatch anyway?`,
            'Dispatch Anyway',
        );
    };

    // ── Core dispatch execution ─────────────────────────────────────

    const executeJobDispatch = async (
        courier: ActiveCourierViewModel,
        jobs: DispatchJob[],
    ): Promise<boolean> => {
        // Check chilled job / non-chilled courier mismatch
        const shouldProceed = await checkChilledJobWarning(jobs, courier);
        if (!shouldProceed) return false;

        // Validate all jobs
        const validJobs: DispatchJob[] = [];
        const errorMessages: string[] = [];

        for (const job of jobs) {
            const result = validateJobForDispatch(job, courier);
            if (result.isValid) {
                validJobs.push(job);
            } else {
                errorMessages.push(result.message);
            }
        }

        if (errorMessages.length > 0) {
            showToast(errorMessages.join('\n'), 'error');
            if (validJobs.length === 0) return false;
        }

        // Create followup events for dangerous goods jobs
        const dgJobs = validJobs.filter(isDangerousGoodsJob);
        if (dgJobs.length > 0) {
            await Promise.all(dgJobs.map(job => addFollowupEvent(job.id)));
        }

        // Allocate jobs to courier
        const jobIds = validJobs.map(job => job.id);
        await allocateJobs(courier.courierId, jobIds);

        return true;
    };

    // ── Find courier with offline confirmation ──────────────────────

    const findCourierWithConfirmation = async (courierId: number): Promise<ActiveCourierViewModel | null> => {
        const courier = await getCourierById(courierId);
        if (courier) return courier;

        // Courier not found (offline) - ask for confirmation
        const shouldDispatch = await requestConfirmation(
            'offline-courier',
            'Courier Offline',
            'This courier appears to be offline. Dispatch anyway?',
            'Yes, Dispatch',
        );

        if (!shouldDispatch) return null;

        // Try again (the backend may still have the courier)
        return getCourierById(courierId);
    };

    // ── Public API ──────────────────────────────────────────────────

    const dispatchJobs = useCallback(async (courierId: number, jobs: DispatchJob[]): Promise<boolean> => {
        if (processingRef.current || !jobs.length) return false;

        processingRef.current = true;
        setDispatching(true);

        try {
            const courier = await findCourierWithConfirmation(courierId);
            if (!courier) return false;

            const success = await executeJobDispatch(courier, jobs);
            if (success) {
                const jobNos = jobs.map(j => j.jobNo || j.id).join(', ');
                showToast(`Dispatched ${jobs.length === 1 ? `job #${jobNos}` : `${jobs.length} jobs`} to ${courier.id}`, 'success');
            }
            return success;
        } catch (error) {
            console.error('Error dispatching jobs:', error);
            showToast(`Failed to dispatch jobs: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return false;
        } finally {
            processingRef.current = false;
            setDispatching(false);
        }
    }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

    const assignSingleJobById = useCallback(async (courierId: number, jobId: number): Promise<boolean> => {
        if (processingRef.current) return false;

        processingRef.current = true;
        setDispatching(true);

        try {
            const courier = await findCourierWithConfirmation(courierId);
            if (!courier) return false;

            // We don't have the full job object, so just allocate directly
            await allocateJobs(courier.courierId, [jobId]);
            showToast(`Job dispatched to ${courier.id}`, 'success');
            return true;
        } catch (error) {
            console.error('Error dispatching job:', error);
            showToast(`Failed to dispatch job: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return false;
        } finally {
            processingRef.current = false;
            setDispatching(false);
        }
    }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

    const reassignJob = useCallback(async (job: DispatchJob): Promise<boolean> => {
        if (processingRef.current) return false;

        processingRef.current = true;
        setDispatching(true);

        try {
            const selectedCourierId = await requestCourierSelection(job.jobNo ?? String(job.id));
            if (!selectedCourierId) return false;

            const courier = await findCourierWithConfirmation(selectedCourierId);
            if (!courier) return false;

            // Use reAllocate since the job already has a courier
            await reAllocateJobs(courier.courierId, [job.id]);
            showToast(`Job #${job.jobNo} reallocated to ${courier.id}`, 'success');
            return true;
        } catch (error) {
            console.error('Error reassigning job:', error);
            showToast(`Failed to reassign job: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            return false;
        } finally {
            processingRef.current = false;
            setDispatching(false);
        }
    }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        dispatching,
        pendingConfirmation,
        pendingCourierSelection,
        dispatchJobs,
        assignSingleJobById,
        reassignJob,
        resolveConfirmation,
        resolveCourierSelection,
    };
}
