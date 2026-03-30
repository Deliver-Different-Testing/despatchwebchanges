/** @jest-environment jest-environment-jsdom */
/**
 * HomeController — Courier Lookup & Selection
 *
 * onCourierSearchSelect, updateCourierData, getPotentialCouriers,
 * selectCourier, searchCourier, onExactCourierMatchSearch
 */

import './home.controller.test-setup';
import {
    ControllerClass, createController, setupWindowMocks, CurrentWorkLists,
} from './home.controller.test-helpers';

setupWindowMocks();

// =====================================================================
// onCourierSearchSelect
// =====================================================================

describe('onCourierSearchSelect', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.onCourierSearchSelect = ControllerClass.prototype.onCourierSearchSelect;
        return ctrl;
    }

    it('calls getCurrentJobs with selected courier id', async () => {
        const ctrl = setup();
        await ctrl.onCourierSearchSelect({id: 42, text: 'C42'});
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('clears courierSearchText', async () => {
        const ctrl = setup({courierSearchText: 'test'});
        await ctrl.onCourierSearchSelect({id: 42, text: 'C42'});
        expect(ctrl.courierSearchText).toBeUndefined();
    });

    it('calls applyScope even when getCurrentJobs throws', async () => {
        const ctrl = setup();
        ctrl.getCurrentJobs = jest.fn().mockRejectedValue(new Error('fail'));
        await ctrl.onCourierSearchSelect({id: 42, text: 'C42'});
        expect(ctrl.applyScope).toHaveBeenCalled();
    });
});

// =====================================================================
// updateCourierData
// =====================================================================

describe('updateCourierData', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.updateCourierData = ControllerClass.prototype.updateCourierData;
        return ctrl;
    }

    it('sets selection text with code', async () => {
        const ctrl = setup();
        await ctrl.updateCourierData(1, 'John', 'JD01');
        expect(ctrl.currentWorkSelection).toBe(' for Courier JD01: John');
        expect(ctrl.currentCourier).toEqual({id: 1, text: 'John'});
    });

    it('sets selection text without code', async () => {
        const ctrl = setup();
        await ctrl.updateCourierData(1, 'John');
        expect(ctrl.currentWorkSelection).toBe(' for Courier John');
    });

    it('calls getCurrentJobs and truckCourierStatus', async () => {
        const ctrl = setup();
        await ctrl.updateCourierData(42, 'Test');
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
        expect(ctrl.DispatchData.truckCourierStatus).toHaveBeenCalledWith(42);
    });
});

// =====================================================================
// getPotentialCouriers
// =====================================================================

describe('getPotentialCouriers', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.getPotentialCouriers = ControllerClass.prototype.getPotentialCouriers;
        return ctrl;
    }

    it('sets potentialCouriers from API', async () => {
        const couriers = [{id: 1}, {id: 2}];
        const ctrl = setup();
        ctrl.DispatchData.getPotentialCouriers.mockResolvedValue(couriers);
        await ctrl.getPotentialCouriers(10);
        expect(ctrl.potentialCouriers).toBe(couriers);
    });

    it('does not throw on API error', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getPotentialCouriers.mockRejectedValue(new Error('fail'));
        await expect(ctrl.getPotentialCouriers(10)).resolves.toBeUndefined();
    });
});

// =====================================================================
// selectCourier
// =====================================================================

describe('selectCourier', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectCourier = ControllerClass.prototype.selectCourier;
        return ctrl;
    }

    it('sets loading state and switches to SelectedDriver mode', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({
            courierId: 42, name: 'Alice', id: 'DR42',
        });

        await ctrl.selectCourier({courierId: 42} as any);

        // Finally block should have reset loading
        expect(ctrl.currentListLoading).toBe(false);
        expect(ctrl.currentWorkViewMode).toBe(CurrentWorkLists.SelectedDriver);
    });

    it('returns early for null or missing courierId', async () => {
        const ctrl = setup();

        await ctrl.selectCourier(null);
        await ctrl.selectCourier({courierId: 0} as any);

        expect(ctrl.DispatchData.getCourierById).not.toHaveBeenCalled();
    });

    it('sets currentCourier, currentWorkSelection, and calls getCurrentJobs', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({
            courierId: 42, name: 'Alice', id: 'DR42',
        });

        await ctrl.selectCourier({courierId: 42} as any);

        expect(ctrl.currentCourier).toEqual({id: 42, text: 'Alice'});
        expect(ctrl.currentWorkSelection).toBe(' for Courier DR42: Alice');
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
    });

    it('falls back to name when id is missing', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({
            courierId: 42, name: 'Alice', id: '',
        });

        await ctrl.selectCourier({courierId: 42} as any);

        expect(ctrl.currentCourier).toEqual({id: 42, text: 'Alice'});
        expect(ctrl.currentWorkSelection).toBe(' for Courier Alice');
    });

    it('fetches truck courier status for found courier', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({
            courierId: 42, name: 'Alice', id: 'DR42',
        });

        await ctrl.selectCourier({courierId: 42} as any);

        expect(ctrl.DispatchData.truckCourierStatus).toHaveBeenCalledWith(42);
    });

    it('shows error toast when courier not found', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue(null);

        await ctrl.selectCourier({courierId: 42} as any);

        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith(
            expect.stringContaining('unexpected error'),
        );
    });

    it('shows error toast on exception and resets loading', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockRejectedValue(new Error('net error'));

        await ctrl.selectCourier({courierId: 42} as any);

        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalledWith('Error loading courier information');
        expect(ctrl.currentListLoading).toBe(false);
    });
});

// =====================================================================
// searchCourier
// =====================================================================

describe('searchCourier', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.searchCourier = ControllerClass.prototype.searchCourier;
        return ctrl;
    }

    it('returns early when selectedCourier is falsy', async () => {
        const ctrl = setup({selectedCourier: undefined});
        await ctrl.searchCourier();
        expect(ctrl.DispatchData.getCourierById).not.toHaveBeenCalled();
    });

    it('fetches courier and calls updateCourierData', async () => {
        const ctrl = setup({selectedCourier: {id: 42, text: 'C42'}});
        ctrl.DispatchData.getCourierById.mockResolvedValue({
            courierId: 42, name: 'Alice', id: 'DR42',
        });

        await ctrl.searchCourier();

        expect(ctrl.DispatchData.getCourierById).toHaveBeenCalledWith(42);
        expect(ctrl.updateCourierData).toHaveBeenCalledWith(42, 'Alice', 'DR42');
    });

    it('shows warning when courier not found', async () => {
        const ctrl = setup({selectedCourier: {id: 42, text: 'C42'}});
        ctrl.DispatchData.getCourierById.mockResolvedValue(null);

        await ctrl.searchCourier();

        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith('Courier not found');
        expect(ctrl.updateCourierData).not.toHaveBeenCalled();
    });

    it('does not throw on API error', async () => {
        const ctrl = setup({selectedCourier: {id: 42, text: 'C42'}});
        ctrl.DispatchData.getCourierById.mockRejectedValue(new Error('fail'));
        await expect(ctrl.searchCourier()).resolves.toBeUndefined();
    });
});

// =====================================================================
// onExactCourierMatchSearch
// =====================================================================

describe('onExactCourierMatchSearch', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.onExactCourierMatchSearch = ControllerClass.prototype.onExactCourierMatchSearch;
        return ctrl;
    }

    it('returns early for empty string', async () => {
        const ctrl = setup();
        await ctrl.onExactCourierMatchSearch('');
        await ctrl.onExactCourierMatchSearch(undefined);
        expect(ctrl.DispatchData.getExactCourierMatch).not.toHaveBeenCalled();
    });

    it('sets courier, calls getCurrentJobs, clears search text', async () => {
        const match = {id: 42, text: 'Alice'};
        const ctrl = setup({exactCourierMatchSearchText: 'A42'});
        ctrl.DispatchData.getExactCourierMatch.mockResolvedValue(match);

        await ctrl.onExactCourierMatchSearch('A42');

        expect(ctrl.currentCourier).toBe(match);
        expect(ctrl.currentWorkSelection).toBe(' for Courier Alice');
        expect(ctrl.getCurrentJobs).toHaveBeenCalledWith(42);
        expect(ctrl.exactCourierMatchSearchText).toBe('');
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('fetches truck status for matched courier', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getExactCourierMatch.mockResolvedValue({id: 42, text: 'Alice'});

        await ctrl.onExactCourierMatchSearch('A42');

        expect(ctrl.DispatchData.truckCourierStatus).toHaveBeenCalledWith(42);
    });

    it('shows warning toast when no match found', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getExactCourierMatch.mockResolvedValue(null);

        await ctrl.onExactCourierMatchSearch('NOPE');

        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith(
            expect.stringContaining('No courier found'),
        );
        expect(ctrl.getCurrentJobs).not.toHaveBeenCalled();
    });
});

// =====================================================================
// selectDriverFromOverview
// =====================================================================

describe('selectDriverFromOverview', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.selectDriverFromOverview = ControllerClass.prototype.selectDriverFromOverview;
        return ctrl;
    }

    it('switches to SelectedDriver mode before delegating', async () => {
        const ctrl = setup({currentWorkViewMode: CurrentWorkLists.Overview});

        await ctrl.selectDriverFromOverview({courierId: 42, name: 'Alice'} as any);

        expect(ctrl.currentWorkViewMode).toBe(CurrentWorkLists.SelectedDriver);
        expect(ctrl.onCourierSearchSelect).toHaveBeenCalledWith({id: 42, text: 'Alice'});
        expect(ctrl.applyScope).toHaveBeenCalled();
    });
});

// =====================================================================
// loadDriversWithJobCounts (private)
// =====================================================================

describe('loadDriversWithJobCounts', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadDriversWithJobCounts = ControllerClass.prototype.loadDriversWithJobCounts;
        return ctrl;
    }

    it('fetches driver overview and calls applyScope', async () => {
        const drivers = [{courierId: 1, name: 'A', jobCount: 3}];
        const ctrl = setup();
        ctrl.DispatchData.getDriverWorkOverview.mockResolvedValue(drivers);

        await ctrl.loadDriversWithJobCounts();

        expect(ctrl.driversWithJobCounts).toBe(drivers);
        expect(ctrl.applyScope).toHaveBeenCalled();
    });

    it('sets empty array on error', async () => {
        const ctrl = setup({driversWithJobCounts: [{courierId: 1}]});
        ctrl.DispatchData.getDriverWorkOverview.mockRejectedValue(new Error('fail'));

        await ctrl.loadDriversWithJobCounts();

        expect(ctrl.driversWithJobCounts).toEqual([]);
    });
});
