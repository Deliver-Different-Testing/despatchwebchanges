function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

export function distributeAmount(
    amount: number,
    sharesPercent: readonly number[],
    remainderTo: 'largest' | 'last' = 'largest',
): number[] {
    if (sharesPercent.length === 0) {
        return [];
    }
    if (sharesPercent.length === 1) {
        return [round2(amount)];
    }

    let remainderIndex = sharesPercent.length - 1;
    if (remainderTo === 'largest') {
        remainderIndex = 0;
        for (let i = 1; i < sharesPercent.length; i++) {
            if (sharesPercent[i] > sharesPercent[remainderIndex]) {
                remainderIndex = i;
            }
        }
    }

    const cents = Math.round(amount * 100);
    const partsCents = new Array(sharesPercent.length).fill(0);
    let runningCents = 0;
    for (let i = 0; i < sharesPercent.length; i++) {
        if (i === remainderIndex) {
            continue;
        }
        const partCents = Math.round((cents * sharesPercent[i]) / 100);
        partsCents[i] = partCents;
        runningCents += partCents;
    }
    partsCents[remainderIndex] = cents - runningCents;

    return partsCents.map((c) => c / 100);
}

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

const WIDTH_BY_LEG_COUNT: Record<number, number> = {2: 1120, 3: 1275, 4: 1400};
const WIDTH_STEP_PAST_FOUR = 125;

export function computeDialogWidth(legCount: number): number {
    if (legCount <= 2) {
        return WIDTH_BY_LEG_COUNT[2];
    }
    if (legCount <= 4) {
        return WIDTH_BY_LEG_COUNT[legCount];
    }
    return WIDTH_BY_LEG_COUNT[4] + (legCount - 4) * WIDTH_STEP_PAST_FOUR;
}
