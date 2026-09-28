import {summarisePodImpact, needsRestoreConfirmation} from './restorePodImpact';
import type {RestorePodImpactRow} from './restorePodImpact';

const row = (overrides: Partial<RestorePodImpactRow> & {jobId: number}): RestorePodImpactRow => ({
    podName: null,
    capturedImageCount: 0,
    imageCountKnown: true,
    ...overrides,
});

describe('summarisePodImpact', () => {
    it('counts the jobs carrying a POD name and totals the captured images', () => {
        const summary = summarisePodImpact([
            row({jobId: 1, podName: 'J. Smith', capturedImageCount: 2}),
            row({jobId: 2, podName: '  ', capturedImageCount: 1}),
            row({jobId: 3, podName: 'A. Jones'}),
        ]);

        expect(summary).toEqual({jobsWithPodName: 2, podName: undefined, imageCount: 3});
    });

    it('exposes the POD name itself when a single job is being restored', () => {
        expect(summarisePodImpact([row({jobId: 1, podName: 'J. Smith', capturedImageCount: 4})]))
            .toEqual({jobsWithPodName: 1, podName: 'J. Smith', imageCount: 4});
    });

    it('reports an unknown total when any row could not be counted', () => {
        const summary = summarisePodImpact([
            row({jobId: 1, capturedImageCount: 2}),
            row({jobId: 2, capturedImageCount: 0, imageCountKnown: false}),
        ]);

        expect(summary.imageCount).toBeNull();
    });

    it('returns an empty summary for no rows', () => {
        expect(summarisePodImpact([])).toEqual({jobsWithPodName: 0, podName: undefined, imageCount: 0});
    });
});

describe('needsRestoreConfirmation', () => {
    it('confirms a completed job even when it has no POD', () => {
        expect(needsRestoreConfirmation(true, {jobsWithPodName: 0, imageCount: 0})).toBe(true);
    });

    it('confirms a non-completed job that still carries a POD name', () => {
        expect(needsRestoreConfirmation(false, {jobsWithPodName: 1, imageCount: 0})).toBe(true);
    });

    it('confirms a non-completed job that has captured images', () => {
        expect(needsRestoreConfirmation(false, {jobsWithPodName: 0, imageCount: 2})).toBe(true);
    });

    it('confirms when the image count could not be established', () => {
        expect(needsRestoreConfirmation(false, {jobsWithPodName: 0, imageCount: null})).toBe(true);
    });

    it('skips confirmation for a plain job with nothing to lose', () => {
        expect(needsRestoreConfirmation(false, {jobsWithPodName: 0, imageCount: 0})).toBe(false);
    });
});
