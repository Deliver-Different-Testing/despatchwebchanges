import {computeDialogWidth, distributeAmount, normalizeShares} from './splitPricingBreakdownCalc';

describe('distributeAmount', () => {
    it('splits the worked example exactly (80/20 of 64.00)', () => {
        expect(distributeAmount(64.00, [80, 20])).toEqual([51.20, 12.80]);
    });

    it('splits the worked example exactly (80/20 of 16.00)', () => {
        expect(distributeAmount(16.00, [80, 20])).toEqual([12.80, 3.20]);
    });

    it('gives the rounding remainder to the largest share, not the last leg', () => {
        // 100 / 3 legs at equal share: 33.33 + 33.33 + 33.34 must sum back to 100 exactly.
        const parts = distributeAmount(100, [34, 33, 33]);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
        expect(parts[0]).toBeGreaterThanOrEqual(parts[1]);
    });

    it('returns the whole amount for a single leg', () => {
        expect(distributeAmount(45.5, [100])).toEqual([45.5]);
    });

    it('returns empty for no legs', () => {
        expect(distributeAmount(45.5, [])).toEqual([]);
    });

    it('always reconciles exactly to the input amount regardless of rounding', () => {
        const parts = distributeAmount(9.00, [80, 20]);
        expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(9.00, 10);
    });
});

describe('normalizeShares', () => {
    it('gives the remainder to the other leg on a 2-leg split', () => {
        expect(normalizeShares([80, 20], 0, 60)).toEqual([60, 40]);
    });

    it('proportionally redistributes across more than one other leg', () => {
        // Others were 20/20 (equal weight) — moving leg 0 down to 40 leaves 60 to split evenly.
        const result = normalizeShares([60, 20, 20], 0, 40);
        expect(result[0]).toBe(40);
        expect(result[1] + result[2]).toBe(60);
        expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('clamps to the 0-100 range', () => {
        expect(normalizeShares([80, 20], 0, 150)).toEqual([100, 0]);
        expect(normalizeShares([80, 20], 0, -10)).toEqual([0, 100]);
    });

    it('splits evenly among others when they previously summed to zero', () => {
        const result = normalizeShares([100, 0, 0], 0, 40);
        expect(result[0]).toBe(40);
        expect(result[1]).toBe(30);
        expect(result[2]).toBe(30);
    });
});

describe('computeDialogWidth', () => {
    it('stays at the base width for 2 legs', () => {
        expect(computeDialogWidth(2)).toBe(1000);
    });

    it('grows per leg past 2', () => {
        expect(computeDialogWidth(3)).toBe(1175);
        expect(computeDialogWidth(4)).toBe(1350);
    });

    it('never shrinks below the base width for fewer than 2 legs', () => {
        expect(computeDialogWidth(1)).toBe(1000);
    });
});
