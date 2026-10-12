/** @jest-environment node */
import DispatchBoxes from './dispatchBoxes';
import {createDefaultDispatchLayout, createDispatchBoxes} from './boxDefinitions';

describe('createDispatchBoxes', () => {
    it('returns metadata for every DispatchBoxes value', () => {
        const boxes = createDispatchBoxes();
        for (const value of Object.values(DispatchBoxes)) {
            expect(boxes[value]).toBeDefined();
            expect(boxes[value].name).toBe(value);
            expect(boxes[value].title).toBeTruthy();
            expect(boxes[value].icon).toBeTruthy();
        }
    });

    it('returns a fresh object each call (no shared mutation)', () => {
        const a = createDispatchBoxes();
        const b = createDispatchBoxes();
        a[DispatchBoxes.JobDetail].visible = false;
        expect(b[DispatchBoxes.JobDetail].visible).toBe(true);
    });

    it('marks the data panels as refreshable; the rest not', () => {
        const boxes = createDispatchBoxes();
        expect(boxes[DispatchBoxes.JobsList].showRefresh).toBe(true);
        expect(boxes[DispatchBoxes.JobDetail].showRefresh).toBe(true);
        expect(boxes[DispatchBoxes.CurrentWork].showRefresh).toBe(true);
        expect(boxes[DispatchBoxes.OverviewDeliveries].showRefresh).toBe(true);
        expect(boxes[DispatchBoxes.OpenJobs].showRefresh).toBe(true);
        expect(boxes[DispatchBoxes.Supports].showRefresh).toBe(false);
        expect(boxes[DispatchBoxes.DriverLocations].showRefresh).toBe(false);
        expect(boxes[DispatchBoxes.Map].showRefresh).toBe(false);
    });

    /*
     * The two Overview panels ship hidden: they are an opt-in addition to the
     * dispatch board, not part of its shipped arrangement. Every other panel is
     * on, so a bare `visible` check would not catch a regression here.
     */
    it('defaults the Overview panels to hidden and everything else to visible', () => {
        const boxes = createDispatchBoxes();
        expect(boxes[DispatchBoxes.OverviewDeliveries].visible).toBe(false);
        expect(boxes[DispatchBoxes.OpenJobs].visible).toBe(false);
        for (const value of Object.values(DispatchBoxes)) {
            if (value === DispatchBoxes.OverviewDeliveries || value === DispatchBoxes.OpenJobs) continue;
            expect(boxes[value].visible).toBe(true);
        }
    });
});

describe('createDefaultDispatchLayout', () => {
    it('places every DispatchBoxes value into the layout exactly once', () => {
        const layout = createDefaultDispatchLayout();
        const names = layout.layout.columns.flatMap(c => c.boxes.map(b => b.name));
        for (const value of Object.values(DispatchBoxes)) {
            expect(names.filter(n => n === value)).toHaveLength(1);
        }
    });

    it('is named "Default" so isDefaultLayout() keeps working', () => {
        expect(createDefaultDispatchLayout().name).toBe('Default');
    });

    it('returns a fresh object each call', () => {
        const a = createDefaultDispatchLayout();
        const b = createDefaultDispatchLayout();
        const originalWidth = b.layout.columns[0].width;
        a.layout.columns[0].width = '99%';
        expect(b.layout.columns[0].width).toBe(originalWidth);
    });

    it('matches the V1 dispatch board arrangement', () => {
        const {columns} = createDefaultDispatchLayout().layout;
        expect(columns.map(c => c.width)).toEqual(['50%', '25%', '25%']);
        expect(columns.map(c => c.boxes.map(b => ({name: b.name, height: b.height})))).toEqual([
            [
                {name: DispatchBoxes.JobsList, height: '50%'},
                {name: DispatchBoxes.JobDetail, height: '50%'},
                {name: DispatchBoxes.OverviewDeliveries, height: '50%'},
                {name: DispatchBoxes.OpenJobs, height: '50%'},
            ],
            [
                {name: DispatchBoxes.CurrentWork, height: '50%'},
                {name: DispatchBoxes.Supports, height: '50%'},
            ],
            [
                {name: DispatchBoxes.DriverLocations, height: '50%'},
                {name: DispatchBoxes.Map, height: '50%'},
            ],
        ]);
    });
});
