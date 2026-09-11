/** @jest-environment node */
import {ILayout} from '../../../../interfaces/layout.interfaces';
import {
    addColumnToPayload,
    MAX_COLUMNS,
    parsePercent,
    removeLastColumnFromPayload,
} from './columnLayout';

type LayoutPayload = ILayout['layout'];

function payload(...cols: Array<{id: string; width: string; boxNames?: string[]}>): LayoutPayload {
    return {
        columns: cols.map(c => ({
            id: c.id,
            width: c.width,
            boxes: (c.boxNames ?? []).map(name => ({name, height: '100%'})),
        })),
    };
}

function widths(p: LayoutPayload): number[] {
    return p.columns.map(c => parsePercent(c.width, NaN));
}

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
}

describe('parsePercent', () => {
    it('parses a percent string', () => {
        expect(parsePercent('33.33%', 0)).toBeCloseTo(33.33);
    });

    it('falls back when missing or unparseable', () => {
        expect(parsePercent(undefined, 25)).toBe(25);
        expect(parsePercent('abc', 25)).toBe(25);
    });
});

describe('addColumnToPayload', () => {
    it('appends an empty column and keeps widths summing to ~100', () => {
        const next = addColumnToPayload(payload(
            {id: 'col1', width: '20%'},
            {id: 'col2', width: '80%'},
        ));
        expect(next.columns).toHaveLength(3);
        expect(next.columns[2].boxes).toEqual([]);
        // Widths are stored at 2-decimal precision, so the sum lands within ~0.05 of 100.
        expect(sum(widths(next))).toBeCloseTo(100, 1);
    });

    it('gives the new column an equal share and preserves relative proportions', () => {
        const next = addColumnToPayload(payload(
            {id: 'col1', width: '20%'},
            {id: 'col2', width: '80%'},
        ));
        // New column = 100/3; existing scaled by 2/3 -> 13.33 / 53.33.
        expect(widths(next)[2]).toBeCloseTo(100 / 3);
        expect(widths(next)[0]).toBeCloseTo(20 * (2 / 3));
        expect(widths(next)[1]).toBeCloseTo(80 * (2 / 3));
        // Relative ratio between existing columns unchanged (1:4).
        expect(widths(next)[1] / widths(next)[0]).toBeCloseTo(4);
    });

    it('picks the lowest unused col{n} id', () => {
        const next = addColumnToPayload(payload(
            {id: 'col1', width: '50%'},
            {id: 'col3', width: '50%'},
        ));
        expect(next.columns[2].id).toBe('col2');
    });

    it('is a no-op at MAX_COLUMNS', () => {
        const cols = Array.from({length: MAX_COLUMNS}, (_, i) => ({
            id: `col${i + 1}`,
            width: `${100 / MAX_COLUMNS}%`,
        }));
        const start = payload(...cols);
        expect(addColumnToPayload(start)).toBe(start);
    });
});

describe('removeLastColumnFromPayload', () => {
    it('drops the rightmost column and redistributes width to ~100', () => {
        const next = removeLastColumnFromPayload(payload(
            {id: 'col1', width: '25%'},
            {id: 'col2', width: '25%'},
            {id: 'col3', width: '50%'},
        ));
        expect(next.columns.map(c => c.id)).toEqual(['col1', 'col2']);
        expect(sum(widths(next))).toBeCloseTo(100);
        // Survivors keep their 1:1 ratio.
        expect(widths(next)[0]).toBeCloseTo(widths(next)[1]);
    });

    it('appends the removed column boxes to the new rightmost column', () => {
        const next = removeLastColumnFromPayload(payload(
            {id: 'col1', width: '50%', boxNames: ['A']},
            {id: 'col2', width: '50%', boxNames: ['B', 'C']},
        ));
        expect(next.columns).toHaveLength(1);
        expect(next.columns[0].boxes.map(b => b.name)).toEqual(['A', 'B', 'C']);
    });

    it('is a no-op with a single column', () => {
        const start = payload({id: 'col1', width: '100%', boxNames: ['A']});
        expect(removeLastColumnFromPayload(start)).toBe(start);
    });
});
