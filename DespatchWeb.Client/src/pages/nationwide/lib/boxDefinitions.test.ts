/** @vitest-environment node */
/**
 * Extracted from `NationwideControl.initializeBoxes` (603),
 * `getBoxVisibilityKey` (672), `saveBoxVisibility` (676) and
 * `loadBoxVisibility` (694).
 */

import {NationwideBoxes} from './nationwideBoxes';
import {
    boxVisibilityKey,
    createDefaultNationwideLayout,
    createNationwideBoxes,
} from './boxDefinitions';

describe('createNationwideBoxes', () => {
    const boxes = createNationwideBoxes();

    it('defines all seven panels, keyed by the enum value', () => {
        expect(Object.keys(boxes).sort()).toEqual(Object.values(NationwideBoxes).sort());
    });

    it('starts every panel visible and expanded', () => {
        expect(Object.values(boxes).every(b => b.visible === true)).toBe(true);
        expect(Object.values(boxes).every(b => !b.collapsed)).toBe(true);
    });

    it('gives every panel a title, icon, description and refresh button', () => {
        for (const box of Object.values(boxes)) {
            expect(box.title).toBeTruthy();
            expect(box.icon).toBeTruthy();
            expect(box.description).toBeTruthy();
            expect(box.showRefresh).toBe(true);
        }
    });

    it('keeps V1 titles, which operators recognise', () => {
        expect(boxes[NationwideBoxes.PodJobs].title).toBe('Awaiting POD');
        expect(boxes[NationwideBoxes.FlightAgents].title).toBe('Available');
        expect(boxes[NationwideBoxes.NewJobs].title).toBe('New jobs');
    });

    it('marks only the job-detail panel as owning the detail buttons', () => {
        expect(boxes[NationwideBoxes.JobDetail].showDetailButtons).toBe(true);
        const others = Object.values(NationwideBoxes).filter(n => n !== NationwideBoxes.JobDetail);
        expect(others.every(n => !boxes[n].showDetailButtons)).toBe(true);
    });

    it('carries no templateUrl', () => {
        // Deliberate: `templateUrl` points at AngularJS partials that go away in
        // Phase 3. The AngularJS controller adds them; job-search's equivalent
        // lib still carries dead templateUrl fields and this avoids repeating it.
        expect(Object.values(boxes).every(b => !('templateUrl' in b))).toBe(true);
    });

    it('returns a fresh object each call so callers cannot share mutable state', () => {
        const a = createNationwideBoxes();
        const b = createNationwideBoxes();
        a[NationwideBoxes.Map].visible = false;
        expect(b[NationwideBoxes.Map].visible).toBe(true);
    });
});

describe('boxVisibilityKey', () => {
    it('scopes visibility per layout, so layouts do not share panel state', () => {
        expect(boxVisibilityKey('boxVisibility-3-42', 'Default')).toBe('boxVisibility-3-42-Default');
        expect(boxVisibilityKey('boxVisibility-3-42', 'Night shift'))
            .toBe('boxVisibility-3-42-Night shift');
    });
});

describe('createDefaultNationwideLayout', () => {
    const layout = createDefaultNationwideLayout();

    it('is the read-only Default layout', () => {
        expect(layout.name).toBe('Default');
    });

    it('has three columns at 35/35/30', () => {
        expect(layout.layout.columns.map(c => c.width)).toEqual(['35%', '35%', '30%']);
        expect(layout.layout.columns.map(c => c.id)).toEqual(['col1', 'col2', 'col3']);
    });

    it('places every panel exactly once, in V1 order', () => {
        const placed = layout.layout.columns.flatMap(c => c.boxes.map(b => b.name));

        expect(placed).toEqual([
            NationwideBoxes.NewJobs, NationwideBoxes.FlightAgents,
            NationwideBoxes.JobDetail, NationwideBoxes.Map,
            NationwideBoxes.PodJobs, NationwideBoxes.Tasks, NationwideBoxes.RepriceJobs,
        ]);
        expect(new Set(placed).size).toBe(Object.values(NationwideBoxes).length);
    });

    it('keeps V1 heights verbatim, even though they do not sum to 100%', () => {
        // Changing these would re-proportion every operator's default layout.
        expect(layout.layout.columns.map(c => c.boxes.map(b => b.height))).toEqual([
            ['60%', '30%'],
            ['60%', '30%'],
            ['40%', '50%', '50%'],
        ]);
    });

    it('returns a fresh layout each call', () => {
        const a = createDefaultNationwideLayout();
        a.layout.columns[0].width = '99%';
        expect(createDefaultNationwideLayout().layout.columns[0].width).toBe('35%');
    });
});
