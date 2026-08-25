/**
 * Simple Price Edit Dialog React Module
 *
 * Entry point for the React-based Simple Price Edit Dialog.
 * Exposes global functions to open the dialog from AngularJS.
 */

import React from 'react';

import { SimplePriceEditDialog } from './SimplePriceEditDialog';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import { PriceEditResult, PricingMode, SimplePriceEditDialogOptions, ChildJobPrice, ChildPriceUpdate } from './types';
import type { IJobGroupDto } from '../../../../interfaces/job.interface';
import { apiClient } from '../../../services/apiClient';
import type { ToastService } from '../../../services/toastService';
import {createDialogHost} from '../../../utils/reactDialogHost';

interface SimplePriceEditPayload {
    jobId: number;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
    isBulk: boolean;
    hideRecalculate?: boolean;
    childJobs: ChildJobPrice[];
    readOnly: boolean;
    /** Set once a save succeeds, so closing afterwards reports what was saved. */
    saved?: PriceEditResult;
}

// --- API helpers ---

async function applyRecalculatedJobRate(jobId: number, isPrebook: boolean): Promise<number> {
    const result = await apiClient.post<{ rate: number }>('job/ApplyRecalculatedJobRate', null, {
        params: { jobId, isPrebook },
    });
    return result.rate;
}

async function getJobGroup(jobId: number): Promise<IJobGroupDto> {
    return apiClient.get<IJobGroupDto>('job/Detail', { jobId });
}

async function repriceJobWithBaseAmount(jobId: number, isPrebook: boolean, baseAmount: number): Promise<number> {
    return apiClient.post<number>('job/RepriceJobWithBaseAmount', { jobId, isPrebook, baseAmount });
}

async function simpleRepriceJobManual(jobId: number, isPrebook: boolean, isBulk: boolean, newPrice: number): Promise<void> {
    await apiClient.post('job/SimpleRepriceJobManual', { jobId, isPrebook, isBulk, newPrice });
}

async function loadChildJobs(jobId: number): Promise<ChildJobPrice[]> {
    try {
        const group = await getJobGroup(jobId);
        return group.relatedJobs
            .filter(j => j.rootParentId !== undefined && j.rootParentId === jobId)
            .map(j => ({
                jobId: j.id,
                jobNumber: j.jobNo,
                charge: j.charge,
                isPrebook: j.preBook,
                isBulkJob: j.isBulkJob,
            }));
    } catch {
        // Non-fatal — proceed without child jobs
        return [];
    }
}

async function save(
    payload: SimplePriceEditPayload,
    mode: PricingMode,
    amount: number,
    childUpdates: ChildPriceUpdate[],
): Promise<number> {
    const { jobId, isPrebook, isBulk } = payload;
    let savedAmount = 0;

    if (mode === 'recalculate') {
        savedAmount = await applyRecalculatedJobRate(jobId, isPrebook);
    } else if (mode === 'base') {
        savedAmount = await repriceJobWithBaseAmount(jobId, isPrebook, amount);
    } else if (mode === 'gross') {
        await simpleRepriceJobManual(jobId, isPrebook, isBulk, amount);
        savedAmount = amount;
    }

    await Promise.all(
        childUpdates.map(c => simpleRepriceJobManual(c.jobId, c.isPrebook, c.isBulkJob, c.newPrice))
    );

    host.update(state => ({...state, saved: {mode, amount: savedAmount}}));

    return savedAmount;
}

const host = createDialogHost<SimplePriceEditPayload, PriceEditResult | null>({
    containerId: 'react-simple-price-edit-dialog-root',
    render: ({open, payload, close, showToast}) => islandTree(
        <SimplePriceEditDialog
            open={open}
            jobNumber={payload.jobNumber}
            currentCharge={payload.currentCharge}
            isPrebook={payload.isPrebook}
            isBulk={payload.isBulk}
            hideRecalculate={payload.hideRecalculate}
            childJobs={payload.childJobs}
            readOnly={payload.readOnly}
            onClose={() => close(payload.saved ?? null)}
            onSubmit={(mode, amount, childUpdates) => save(payload, mode, amount, childUpdates)}
            showToast={showToast}
        />
    ),
});

export async function openSimplePriceEditDialog(options: SimplePriceEditDialogOptions): Promise<PriceEditResult | null> {
    // Fetch child jobs before showing — non-fatal if unavailable
    const childJobs = await loadChildJobs(options.jobId);

    return host.open({
        jobId: options.jobId,
        jobNumber: options.jobNumber,
        currentCharge: options.currentCharge,
        isPrebook: options.isPrebook,
        isBulk: options.isBulk ?? false,
        hideRecalculate: options.hideRecalculate,
        childJobs,
        readOnly: options.readOnly ?? false,
    });
}

export function setToastService(service: ToastService): void {
    host.setToastService(service);
}

// Expose to window for AngularJS access
window.ReactSimplePriceEditDialog = {
    open: openSimplePriceEditDialog,
    setToastService,
};

// Create AngularJS module for ocLazyLoad
const simplePriceEditDialogReactModule = window.angular!.module(
    'uDispatch.simplePriceEditDialogReact',
    []
);

console.log('[SimplePriceEditDialogReact] Module registered');

export default simplePriceEditDialogReactModule;
