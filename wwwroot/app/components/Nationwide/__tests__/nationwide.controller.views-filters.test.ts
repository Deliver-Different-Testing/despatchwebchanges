import './nationwide.controller.test-setup';
import {ControllerClass, createController, setupWindowMocks, JobDataType} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('initializeViews', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.initializeViews = ControllerClass.prototype.initializeViews;
        ctrl.loadViewsFromStorage = ControllerClass.prototype.loadViewsFromStorage;
        ctrl.saveViewsToStorage = ControllerClass.prototype.saveViewsToStorage;
        ctrl.SelectedViewsKey = 'test-selectedViews';
        return ctrl;
    }

    beforeEach(() => localStorage.clear());

    it('sets viewsInitialized true', () => {
        const ctrl = setup({views: [{id: 1, selected: false}]});
        localStorage.setItem('test-selectedViews', JSON.stringify([{id: 1}]));
        ctrl.initializeViews();
        expect(ctrl.viewsInitialized).toBe(true);
    });

    it('auto-selects first view on first visit (no localStorage key)', () => {
        const ctrl = setup({views: [{id: 1, selected: false}, {id: 2, selected: false}]});
        ctrl.initializeViews();
        expect(ctrl.selectedViews).toHaveLength(1);
        expect(ctrl.selectedViews[0].id).toBe(1);
        expect(ctrl.views[0].selected).toBe(true);
    });

    it('respects empty selection when user explicitly cleared all views', () => {
        const ctrl = setup({views: [{id: 1, selected: false}, {id: 2, selected: false}]});
        // User previously cleared all views — saved empty array
        localStorage.setItem('test-selectedViews', '[]');
        ctrl.initializeViews();
        expect(ctrl.selectedViews).toHaveLength(0);
        expect(ctrl.views.every((v: any) => !v.selected)).toBe(true);
    });

    it('marks views as selected from stored selection', () => {
        const ctrl = setup({views: [{id: 1, selected: false}, {id: 2, selected: false}]});
        localStorage.setItem('test-selectedViews', JSON.stringify([{id: 2}]));
        ctrl.initializeViews();
        expect(ctrl.views[1].selected).toBe(true);
        expect(ctrl.views[0].selected).toBe(false);
    });

    it('rebuilds selectedViews from fresh server objects, not stale localStorage copies', () => {
        const ctrl = setup({views: [{id: 1, name: 'Updated'}, {id: 2, name: 'Also Updated'}]});
        // localStorage has stale objects with old names
        localStorage.setItem('test-selectedViews', JSON.stringify([{id: 1, name: 'Old Name'}]));
        ctrl.initializeViews();
        // selectedViews should reference the fresh server view, not the stale one
        expect(ctrl.selectedViews).toHaveLength(1);
        expect(ctrl.selectedViews[0].name).toBe('Updated');
        expect(ctrl.selectedViews[0]).toBe(ctrl.views[0]);
    });

    it('ignores saved view IDs that no longer exist on server', () => {
        const ctrl = setup({views: [{id: 1, selected: false}]});
        // localStorage references a view (id: 99) that was deleted on the server
        localStorage.setItem('test-selectedViews', JSON.stringify([{id: 99}]));
        ctrl.initializeViews();
        expect(ctrl.selectedViews).toHaveLength(0);
    });
});

describe('toggleView', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.toggleView = ControllerClass.prototype.toggleView;
        return ctrl;
    }

    it('adds view when selected=true', async () => {
        const view = {id: 1, selected: true};
        const ctrl = setup({selectedViews: []});
        await ctrl.toggleView(view);
        expect(ctrl.selectedViews).toContainEqual(view);
    });

    it('does not duplicate', async () => {
        const view = {id: 1, selected: true};
        const ctrl = setup({selectedViews: [view]});
        await ctrl.toggleView(view);
        expect(ctrl.selectedViews.filter((v: any) => v.id === 1)).toHaveLength(1);
    });

    it('removes view when selected=false', async () => {
        const view = {id: 1, selected: false};
        const ctrl = setup({selectedViews: [{id: 1, selected: true}, {id: 2, selected: true}]});
        await ctrl.toggleView(view);
        expect(ctrl.selectedViews.find((v: any) => v.id === 1)).toBeUndefined();
    });
});

describe('loadDateFilterFromStorage', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadDateFilterFromStorage = ControllerClass.prototype.loadDateFilterFromStorage;
        ctrl.DateFilterKey = 'test-dateFilter';
        ctrl.timeZone = 'Pacific/Auckland';
        return ctrl;
    }

    beforeEach(() => localStorage.clear());

    it('keeps defaults when no saved state exists', () => {
        const ctrl = setup();
        const original = {...ctrl.dateFilterData};
        ctrl.loadDateFilterFromStorage();
        expect(ctrl.dateFilterData.startDate).toEqual(original.startDate);
        expect(ctrl.dateFilterData.endDate).toEqual(original.endDate);
    });

    it('restores saved dates and useTime across page refreshes', () => {
        const ctrl = setup();
        localStorage.setItem('test-dateFilter', JSON.stringify({
            startDate: '2026-03-20T00:00:00Z',
            endDate: '2026-03-20T23:59:59Z',
            useTime: true,
        }));
        ctrl.loadDateFilterFromStorage();
        expect(ctrl.dateFilterData.useTime).toBe(true);
        expect(ctrl.dateFilterData.startDate.toISOString()).toBe('2026-03-20T00:00:00.000Z');
        expect(ctrl.dateFilterData.endDate.toISOString()).toBe('2026-03-20T23:59:59.000Z');
    });

    it('defaults useTime to false when not saved', () => {
        const ctrl = setup();
        localStorage.setItem('test-dateFilter', JSON.stringify({
            startDate: '2026-03-20T00:00:00Z',
            endDate: '2026-03-20T23:59:59Z',
        }));
        ctrl.loadDateFilterFromStorage();
        expect(ctrl.dateFilterData.useTime).toBe(false);
    });

    it('recalculates endDate for "all time" mode (epoch startDate)', () => {
        const ctrl = setup();
        const now = Date.now();
        localStorage.setItem('test-dateFilter', JSON.stringify({
            startDate: '1970-01-01T00:00:00.000Z',
            endDate: '2026-01-01T00:00:00Z',
        }));
        ctrl.loadDateFilterFromStorage();
        expect(ctrl.dateFilterData.startDate.valueOf()).toBe(0);
        // endDate should be recalculated to ~24h from now, not the stale saved value
        expect(ctrl.dateFilterData.endDate.valueOf()).toBeGreaterThan(now);
    });

    it('falls back to defaults on corrupted localStorage', () => {
        const ctrl = setup();
        localStorage.setItem('test-dateFilter', 'not-valid-json');
        ctrl.loadDateFilterFromStorage();
        expect(ctrl.dateFilterData).toBeDefined();
    });
});

describe('updateDateFilters', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.updateDateFilters = ControllerClass.prototype.updateDateFilters;
        ctrl.dateFilterData = {startDate: 'start', endDate: 'end', useTime: true};
        return ctrl;
    }

    it('returns early if dates missing', () => {
        const ctrl = setup();
        ctrl.dateFilterData = {startDate: undefined, endDate: undefined};
        ctrl.updateDateFilters(JobDataType.NEW);
        expect(ctrl.jobFilters.startDate).toBeUndefined();
    });

    it('updates jobFilters for NEW', () => {
        const ctrl = setup();
        ctrl.updateDateFilters([JobDataType.NEW]);
        expect(ctrl.jobFilters.startDate).toBe('start');
        expect(ctrl.jobFilters.endDate).toBe('end');
    });

    it('updates jobPodFilters for POD', () => {
        const ctrl = setup();
        ctrl.updateDateFilters([JobDataType.POD]);
        expect(ctrl.jobPodFilters.startDate).toBe('start');
    });

    it('updates jobRepriceFilters for REPRICE', () => {
        const ctrl = setup();
        ctrl.updateDateFilters([JobDataType.REPRICE]);
        expect(ctrl.jobRepriceFilters.startDate).toBe('start');
    });
});

describe('filterByStaff', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.filterByStaff = ControllerClass.prototype.filterByStaff;
        return ctrl;
    }

    it('sets staffFilter from string', async () => {
        const ctrl = setup();
        await ctrl.filterByStaff('open');
        expect(ctrl.staffFilter).toBe('open');
        expect(ctrl.tasksService.saveStaffFilter).toHaveBeenCalled();
    });

    it('sets staffFilter from ISuggestion.id', async () => {
        const ctrl = setup();
        await ctrl.filterByStaff({id: 42, text: 'Bob'});
        expect(ctrl.staffFilter).toBe('42');
    });

    it('falls back to "all" when id is undefined', async () => {
        const ctrl = setup();
        await ctrl.filterByStaff({id: undefined, text: ''});
        expect(ctrl.staffFilter).toBe('all');
    });
});

describe('filterBySupportType', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.filterBySupportType = ControllerClass.prototype.filterBySupportType;
        return ctrl;
    }

    it('sets eventTypeFilter from string', async () => {
        const ctrl = setup();
        await ctrl.filterBySupportType('open');
        expect(ctrl.eventTypeFilter).toBe('open');
    });

    it('sets from ISuggestion.id', async () => {
        const ctrl = setup();
        await ctrl.filterBySupportType({id: 42, text: 'Type'});
        expect(ctrl.eventTypeFilter).toBe('42');
    });
});

/*
 * `formatDuration` moved to
 * `react/pages/nationwide/lib/refreshInterval.formatIntervalDuration`, shared
 * with the React page. Its table-driven test there is a superset of the four
 * cases that were here (30 / 60 / 300 / 90 / 150 seconds), and also pins the
 * singular-only-at-one-minute rule and the 15-minute ceiling.
 */
