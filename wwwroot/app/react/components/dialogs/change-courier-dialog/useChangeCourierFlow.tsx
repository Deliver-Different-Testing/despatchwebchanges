/**
 * Shared entry-point flow for changing the paid courier on an archived job.
 *
 * Every launcher (job-search kebab, dispatch kebab, right-click context menu,
 * job-details courier field) goes through the same gate: fetch eligibility
 * first, then either open the ChangeCourierDialog or show an acknowledge-only
 * popup explaining why the courier can no longer be changed. The server
 * re-checks the same guards on save, so this is UX, not enforcement.
 */

import React, {useCallback, useState} from 'react';
import type {ShowToastFn} from '../../../services/toastService';
import {autocompleteSearch} from '../../../services/jobDetailApi';
import {changeArchivedJobCourier, getCourierChangeEligibility} from '../../../services/jobListApi';
import {ConfirmDialog} from '../confirm-dialog/ConfirmDialog';
import {ChangeCourierDialog} from './ChangeCourierDialog';

const BLOCKED_MESSAGES: Record<string, string> = {
    invoiced: 'This job has already been invoiced and the courier can no longer be changed.',
    settled: 'The courier on this job has already been paid in a settlement run and can no longer be changed.',
    notArchived: 'This job is not archived — change the courier by dispatching it instead.',
};

export interface ChangeCourierFlowOptions {
    showToast: ShowToastFn;
    /** Called after a successful change so the caller can refresh its lists/detail. */
    onChanged?: (jobId: number) => void | Promise<void>;
}

export interface ChangeCourierFlow {
    /** Check eligibility and open the dialog (or the blocked popup). */
    openChangeCourier: (job: {id: number; jobNo: string}) => Promise<void>;
    /** Render once near the caller's other dialogs. */
    changeCourierDialogs: React.ReactNode;
    /**
     * True while the flow has anything in flight or on screen — callers that
     * unmount themselves when idle (e.g. the context menu) must stay mounted
     * while this is set or the dialogs vanish.
     */
    changeCourierActive: boolean;
}

export function useChangeCourierFlow({showToast, onChanged}: ChangeCourierFlowOptions): ChangeCourierFlow {
    const [target, setTarget] =
        useState<{jobId: number; jobNo: string; currentCourierName?: string} | null>(null);
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    const openChangeCourier = useCallback(async (job: {id: number; jobNo: string}): Promise<void> => {
        setChecking(true);
        try {
            const eligibility = await getCourierChangeEligibility(job.id);
            if (!eligibility.canChange) {
                setBlockedMessage(BLOCKED_MESSAGES[eligibility.reason ?? 'invoiced'] ?? BLOCKED_MESSAGES.invoiced);
                return;
            }
            setTarget({jobId: job.id, jobNo: job.jobNo, currentCourierName: eligibility.currentCourierName});
        } catch {
            showToast('Could not check whether the courier can be changed. Please try again.', 'error');
        } finally {
            setChecking(false);
        }
    }, [showToast]);

    const changeCourierDialogs = (
        <>
            <ChangeCourierDialog
                open={target !== null}
                jobNo={target?.jobNo ?? ''}
                currentCourierName={target?.currentCourierName}
                onClose={() => setTarget(null)}
                onSave={async (courierId) => {
                    if (!target) return;
                    await changeArchivedJobCourier(target.jobId, courierId);
                    await onChanged?.(target.jobId);
                }}
                showToast={showToast}
                searchCouriers={(s) => autocompleteSearch(s, '/courier/AllActiveSearch')}
            />
            <ConfirmDialog
                opened={blockedMessage !== null}
                title="Courier cannot be changed"
                message={blockedMessage ?? ''}
                variant="warning"
                onClose={() => setBlockedMessage(null)}
            />
        </>
    );

    return {
        openChangeCourier,
        changeCourierDialogs,
        changeCourierActive: checking || target !== null || blockedMessage !== null,
    };
}
