import {
    ALL_COLUMNS,
    availableColumns,
    DEFAULT_COLUMN_WIDTHS,
    orderColumns,
} from './jobListColumns';

const keys = (cols: {key: string}[]) => cols.map(c => c.key);

describe('DEFAULT_COLUMN_WIDTHS', () => {
    it('mirrors the catalogue widths', () => {
        expect(Object.keys(DEFAULT_COLUMN_WIDTHS)).toEqual(keys(ALL_COLUMNS));
        expect(DEFAULT_COLUMN_WIDTHS.delivery).toBe(380);
        expect(DEFAULT_COLUMN_WIDTHS.priority).toBe(50);
        expect(DEFAULT_COLUMN_WIDTHS.refA).toBe(110);
    });
});

describe('availableColumns', () => {
    it('hides Client for US tenants and Archived outside job search', () => {
        expect(keys(availableColumns(true, true))).not.toContain('client');
        expect(keys(availableColumns(false, false))).not.toContain('isArchived');
        expect(keys(availableColumns(false, true))).toEqual(expect.arrayContaining(['client', 'isArchived']));
    });

    it('offers Ref A on job search only, between Client and Pickup', () => {
        expect(keys(availableColumns(false, false))).not.toContain('refA');
        expect(keys(availableColumns(false, true)).join()).toContain('jobNo,client,refA,pickup');
        expect(keys(availableColumns(true, true)).join()).toContain('jobNo,refA,pickup');
    });
});

describe('orderColumns', () => {
    const available = availableColumns(false, true);

    it('returns every available column when there are no preferences', () => {
        expect(keys(orderColumns(available))).toEqual(keys(available));
    });

    it('applies the saved order', () => {
        const result = orderColumns(available, ['status', 'courier', 'date']);
        expect(keys(result).slice(0, 4)).toEqual(['priority', 'status', 'courier', 'date']);
    });

    it('slots columns missing from the saved order beside their catalogue neighbours', () => {
        const result = orderColumns(available, ['status', 'jobNo']);
        expect(keys(result)).toEqual([
            'priority', 'date', 'time', 'speed', 'isArchived', 'vehicle',
            'status', 'jobNo', 'client', 'refA', 'pickup', 'delivery', 'courier', 'remaining',
        ]);
    });

    it('keeps a newly added column at its catalogue position for users with a saved order', () => {
        const savedBeforeRefA = keys(available).filter(k => k !== 'refA');
        const result = keys(orderColumns(available, savedBeforeRefA));
        expect(result.indexOf('refA')).toBe(result.indexOf('pickup') - 1);
        expect(result.indexOf('refA')).toBe(result.indexOf('client') + 1);
    });

    it('ignores stale and duplicate keys in the saved order', () => {
        const result = orderColumns(available, ['gone', 'status', 'status']);
        expect(keys(result)).toHaveLength(available.length);
        expect(keys(result).filter(k => k === 'status')).toHaveLength(1);
        expect(keys(result)).not.toContain('gone');
    });

    it('removes hidden columns', () => {
        const result = orderColumns(available, [], ['client', 'speed']);
        expect(keys(result)).not.toContain('client');
        expect(keys(result)).not.toContain('speed');
        expect(keys(result)).toHaveLength(available.length - 2);
    });

    it('keeps the locked indicator column first and unhideable', () => {
        const result = orderColumns(available, ['status', 'priority'], ['priority']);
        expect(keys(result)[0]).toBe('priority');
    });
});
