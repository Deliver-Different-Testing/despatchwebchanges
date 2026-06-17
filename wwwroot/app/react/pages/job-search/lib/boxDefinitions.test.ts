/** @jest-environment node */
import JobSearchBoxes from '../../../../components/jobSearch/enums/jobSearchBoxes';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from './boxDefinitions';

describe('createJobSearchBoxes', () => {
    it('returns metadata for every JobSearchBoxes value', () => {
        const boxes = createJobSearchBoxes();
        for (const value of Object.values(JobSearchBoxes)) {
            expect(boxes[value]).toBeDefined();
            expect(boxes[value].name).toBe(value);
            expect(boxes[value].title).toBeTruthy();
            expect(boxes[value].icon).toBeTruthy();
        }
    });

    it('returns a fresh object each call (no shared mutation)', () => {
        const a = createJobSearchBoxes();
        const b = createJobSearchBoxes();
        a[JobSearchBoxes.JobDetail].visible = false;
        expect(b[JobSearchBoxes.JobDetail].visible).toBe(true);
    });

    it('marks JobList / BulkJobList / JobDetail as refreshable; others not', () => {
        const boxes = createJobSearchBoxes();
        expect(boxes[JobSearchBoxes.JobList].showRefresh).toBe(true);
        expect(boxes[JobSearchBoxes.BulkJobList].showRefresh).toBe(true);
        expect(boxes[JobSearchBoxes.JobDetail].showRefresh).toBe(true);
        expect(boxes[JobSearchBoxes.SearchWidget].showRefresh).toBe(false);
        expect(boxes[JobSearchBoxes.ScanList].showRefresh).toBe(false);
        expect(boxes[JobSearchBoxes.Map].showRefresh).toBe(false);
        expect(boxes[JobSearchBoxes.DeliveryJourney].showRefresh).toBe(false);
    });
});

describe('createDefaultJobSearchLayout', () => {
    it('has four columns', () => {
        expect(createDefaultJobSearchLayout().layout.columns).toHaveLength(4);
    });

    it('places every JobSearchBoxes value into the layout exactly once', () => {
        const layout = createDefaultJobSearchLayout();
        const names = layout.layout.columns.flatMap(c => c.boxes.map(b => b.name));
        for (const value of Object.values(JobSearchBoxes)) {
            expect(names.filter(n => n === value)).toHaveLength(1);
        }
    });

    it('is named "Default" so isDefaultLayout() keeps working', () => {
        expect(createDefaultJobSearchLayout().name).toBe('Default');
    });

    it('returns a fresh object each call', () => {
        const a = createDefaultJobSearchLayout();
        const b = createDefaultJobSearchLayout();
        a.layout.columns[0].width = '99%';
        expect(b.layout.columns[0].width).toBe('20%');
    });
});
