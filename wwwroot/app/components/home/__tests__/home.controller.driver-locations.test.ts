/**
 * HomeController — Driver Locations & Area Filtering
 *
 * clearDriverLocationFilter, fetchDriverLocations, getDriverLocationsData,
 * updateDriverLocationsDisplay, selectAndActivateArea, refreshDataTimeSpan
 */

import './home.controller.test-setup';
import {
    ControllerClass, createController, setupWindowMocks,
} from './home.controller.test-helpers';

setupWindowMocks();

// =====================================================================
// clearDriverLocationFilter
// =====================================================================

describe('clearDriverLocationFilter', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.clearDriverLocationFilter = ControllerClass.prototype.clearDriverLocationFilter;
        return ctrl;
    }

    it('returns early when no driverLocations', async () => {
        const ctrl = setup({driverLocations: undefined});
        await ctrl.clearDriverLocationFilter();
        expect(ctrl.getJobList).not.toHaveBeenCalled();
    });

    it('deactivates all areas and clears filters', async () => {
        const areas = [{id: 1, isActive: true}, {id: 2, isActive: true}];
        const ctrl = setup({driverLocations: {areas}});

        await ctrl.clearDriverLocationFilter();

        expect(areas[0].isActive).toBe(false);
        expect(areas[1].isActive).toBe(false);
        expect(ctrl.queryParams.statusFilter).toBeUndefined();
        expect(ctrl.selectedClearListId).toBeUndefined();
        expect(ctrl.clearListId).toBeUndefined();
        expect(ctrl.defaultJobCategory).toBeUndefined();
    });

    it('refreshes current work list when courier selected', async () => {
        const ctrl = setup({
            driverLocations: {areas: []},
            currentCourier: {id: 42, text: 'C42'},
        });
        await ctrl.clearDriverLocationFilter();
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('restores full map list when no courier and no current job', async () => {
        const full = [{jobId: 1}];
        const ctrl = setup({
            driverLocations: {areas: []},
            currentCourier: undefined,
            currentJob: undefined,
            mapJobListFull: full,
        });
        await ctrl.clearDriverLocationFilter();
        expect(ctrl.mapJobList).toBe(full);
    });

    it('shows error toast on failure', async () => {
        const ctrl = setup({driverLocations: {areas: []}});
        ctrl.getJobList = jest.fn().mockRejectedValue(new Error('fail'));
        await ctrl.clearDriverLocationFilter();
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith(
            expect.stringContaining('Error clearing filter'),
        );
    });
});

// =====================================================================
// fetchDriverLocations
// =====================================================================

describe('fetchDriverLocations', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.fetchDriverLocations = ControllerClass.prototype.fetchDriverLocations;
        ctrl.getDriverLocationsData = jest.fn().mockResolvedValue(undefined);
        return ctrl;
    }

    it('sets loading true, calls getDriverLocationsData, then resets loading', async () => {
        const ctrl = setup();

        await ctrl.fetchDriverLocations();

        expect(ctrl.updateDriverLocationsDisplay).toHaveBeenCalledTimes(2); // before and after
        expect(ctrl.driverLocationsLoading).toBe(false);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });
});

// =====================================================================
// getDriverLocationsData
// =====================================================================

describe('getDriverLocationsData', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.getDriverLocationsData = ControllerClass.prototype.getDriverLocationsData;
        return ctrl;
    }

    it('returns empty areas when selectedViews is empty', async () => {
        const ctrl = setup({selectedViews: []});
        await ctrl.getDriverLocationsData();
        expect(ctrl.driverLocations).toEqual({areas: []});
        expect(ctrl.DispatchData.getDriverLocations).not.toHaveBeenCalled();
    });

    it('fetches driver locations from API', async () => {
        const result = {areas: [{id: 1}]};
        const ctrl = setup({selectedViews: [{id: 1, selected: true}]});
        ctrl.DispatchData.getDriverLocations.mockResolvedValue(result);

        await ctrl.getDriverLocationsData();

        expect(ctrl.driverLocations).toBe(result);
        expect(ctrl.updateDriverLocationsDisplay).toHaveBeenCalled();
    });

    it('sets empty areas on API error', async () => {
        const ctrl = setup({selectedViews: [{id: 1}]});
        ctrl.DispatchData.getDriverLocations.mockRejectedValue(new Error('fail'));

        await ctrl.getDriverLocationsData();

        expect(ctrl.driverLocations).toEqual({areas: []});
    });
});

// =====================================================================
// updateDriverLocationsDisplay
// =====================================================================

describe('updateDriverLocationsDisplay', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.updateDriverLocationsDisplay = ControllerClass.prototype.updateDriverLocationsDisplay;
        return ctrl;
    }

    it('shows no-data when not loading and no areas', () => {
        const ctrl = setup({driverLocationsLoading: false, driverLocations: {areas: []}});
        ctrl.updateDriverLocationsDisplay();
        expect(ctrl.showDriverLocationsNoData).toBe(true);
        expect(ctrl.showDriverLocationsData).toBe(false);
    });

    it('shows data when not loading and has areas', () => {
        const ctrl = setup({driverLocationsLoading: false, driverLocations: {areas: [{id: 1}]}});
        ctrl.updateDriverLocationsDisplay();
        expect(ctrl.showDriverLocationsNoData).toBe(false);
        expect(ctrl.showDriverLocationsData).toBe(true);
    });

    it('shows neither during loading', () => {
        const ctrl = setup({driverLocationsLoading: true, driverLocations: {areas: [{id: 1}]}});
        ctrl.updateDriverLocationsDisplay();
        expect(ctrl.showDriverLocationsNoData).toBe(false);
        expect(ctrl.showDriverLocationsData).toBe(false);
    });

    it('handles undefined driverLocations', () => {
        const ctrl = setup({driverLocationsLoading: false, driverLocations: undefined});
        ctrl.updateDriverLocationsDisplay();
        expect(ctrl.showDriverLocationsNoData).toBe(true);
        expect(ctrl.showDriverLocationsData).toBe(false);
    });
});

// =====================================================================
// selectAndActivateArea
// =====================================================================

describe('selectAndActivateArea', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectAndActivateArea = ControllerClass.prototype.selectAndActivateArea;
        ctrl.$timeoutService = jest.fn((fn: any) => fn());
        return ctrl;
    }

    it('returns early when selectedArea or driverLocations is falsy', async () => {
        const ctrl = setup({driverLocations: undefined});
        await ctrl.selectAndActivateArea({id: 1} as any);
        expect(ctrl.processClearListJobs).not.toHaveBeenCalled();

        const ctrl2 = setup({driverLocations: {areas: []}});
        await ctrl2.selectAndActivateArea(null);
        expect(ctrl2.processClearListJobs).not.toHaveBeenCalled();
    });

    it('activates only the selected area', async () => {
        const area1 = {id: 1, isActive: true};
        const area2 = {id: 2, isActive: false};
        const ctrl = setup({driverLocations: {areas: [area1, area2]}});

        await ctrl.selectAndActivateArea(area2);

        expect(area1.isActive).toBe(false);
        expect(area2.isActive).toBe(true);
    });

    it('sets clearListId and status filter', async () => {
        const area = {id: 5, isActive: false};
        const ctrl = setup({driverLocations: {areas: [area]}});

        await ctrl.selectAndActivateArea(area);

        expect(ctrl.clearListId).toBe(5);
        expect(ctrl.queryParams.statusFilter).toBe('needs-dispatch');
    });

    it('calls processClearListJobs and applyScope', async () => {
        const area = {id: 5, isActive: false};
        const ctrl = setup({driverLocations: {areas: [area]}});

        await ctrl.selectAndActivateArea(area);

        expect(ctrl.processClearListJobs).toHaveBeenCalledWith(5);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('clears jobList on processClearListJobs error', async () => {
        const area = {id: 5, isActive: false};
        const ctrl = setup({driverLocations: {areas: [area]}, jobList: [{id: 1}]});
        ctrl.processClearListJobs = jest.fn().mockRejectedValue(new Error('fail'));

        await ctrl.selectAndActivateArea(area);

        expect(ctrl.jobList).toEqual([]);
    });
});

// =====================================================================
// refreshDataTimeSpan
// =====================================================================

describe('refreshDataTimeSpan', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.refreshDataTimeSpan = ControllerClass.prototype.refreshDataTimeSpan;
        return ctrl;
    }

    it('stores dateFilterData and saves to storage', async () => {
        const ctrl = setup();
        const newData = {startDate: 'a', endDate: 'b'} as any;

        await ctrl.refreshDataTimeSpan(newData);

        expect(ctrl.dateFilterData).toBe(newData);
        expect(ctrl.saveDateFilterToStorage).toHaveBeenCalled();
    });

    it('calls getData and fetchDriverLocations in parallel', async () => {
        const ctrl = setup();
        await ctrl.refreshDataTimeSpan({} as any);
        expect(ctrl.getData).toHaveBeenCalled();
        expect(ctrl.fetchDriverLocations).toHaveBeenCalled();
    });

    it('re-fetches current work for the loaded courier so it follows the new range', async () => {
        const ctrl = setup({currentCourier: {id: 42}});
        await ctrl.refreshDataTimeSpan({startDate: 'a', endDate: 'b'} as any);
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('does not re-fetch current work when no courier is loaded', async () => {
        const ctrl = setup({currentCourier: undefined});
        await ctrl.refreshDataTimeSpan({} as any);
        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
    });
});
