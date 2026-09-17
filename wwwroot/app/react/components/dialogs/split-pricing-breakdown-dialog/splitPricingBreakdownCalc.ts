/**
 * Pure allocation/rounding functions for the split-parent pricing grid
 * (docs/pricing/job-splitting-price-breakdown.md §4.6, §7). No rendering, no state —
 * ported from Helpers/PricingBreakdownAllocationCalculator.cs (server) and
 * docs/pricing/split-pricing-demo.html's setLegShare (share normalization), so the
 * client-side preview matches what the server will actually persist.
 */

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Splits `amount` across `sharesPercent` (0-100, need not be provided pre-normalized),
 * giving any rounding remainder to the largest share — matches
 * PricingBreakdownAllocationCalculator.DistributeAmount server-side. Works in integer
 * cents throughout to avoid floating-point drift, same technique the demo prototype uses.
 */
export function distributeAmount(amount: number, sharesPercent: readonly number[]): number[] {
    if (sharesPercent.length === 0) {
        return [];
    }
    if (sharesPercent.length === 1) {
        return [round2(amount)];
    }

    let largestIndex = 0;
    for (let i = 1; i < sharesPercent.length; i++) {
        if (sharesPercent[i] > sharesPercent[largestIndex]) {
            largestIndex = i;
        }
    }

    const cents = Math.round(amount * 100);
    const partsCents = new Array(sharesPercent.length).fill(0);
    let runningCents = 0;
    for (let i = 0; i < sharesPercent.length; i++) {
        if (i === largestIndex) {
            continue;
        }
        const partCents = Math.round((cents * sharesPercent[i]) / 100);
        partsCents[i] = partCents;
        runningCents += partCents;
    }
    partsCents[largestIndex] = cents - runningCents;

    return partsCents.map((c) => c / 100);
}

/**
 * When one leg's share changes, redistributes the remainder proportionally across the
 * other legs (by their prior weight), then corrects any rounding drift onto whichever
 * of those legs currently holds the largest share — mirrors the demo's setLegShare.
 */
export function normalizeShares(
    sharesPercent: readonly number[],
    changedIndex: number,
    newValue: number,
): number[] {
    const clamped = Math.max(0, Math.min(100, newValue));
    const remain = 100 - clamped;
    const otherIndices = sharesPercent.map((_, i) => i).filter((i) => i !== changedIndex);
    const prevOthersSum = otherIndices.reduce((sum, i) => sum + sharesPercent[i], 0);

    const result = [...sharesPercent];
    otherIndices.forEach((i) => {
        result[i] = prevOthersSum > 0
            ? Math.round((remain * sharesPercent[i]) / prevOthersSum)
            : Math.round(remain / otherIndices.length);
    });
    result[changedIndex] = clamped;

    const drift = 100 - result.reduce((sum, v) => sum + v, 0);
    if (drift !== 0 && otherIndices.length > 0) {
        const target = otherIndices.slice().sort((a, b) => result[b] - result[a])[0];
        result[target] += drift;
    }

    return result;
}

/** Modal grows before it scrolls (spec §7.2) — width scales with leg count past 2. */
export function computeDialogWidth(legCount: number): number {
    return 1000 + Math.max(0, legCount - 2) * 175;
}
