import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeJob, makeFlightJob, setupWindowMocks} from './nationwide.controller.test-helpers';

setupWindowMocks();

describe('calculateMapBounds', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.calculateMapBounds = ControllerClass.prototype.calculateMapBounds;
        return ctrl;
    }

    it('returns default config for null job', () => {
        const ctrl = setup();
        const result = ctrl.calculateMapBounds(null);
        expect(result.zoom).toBe(7);
        expect(result.center).toBeDefined();
    });

    it('returns default config for job missing addresses', () => {
        const ctrl = setup();
        const result = ctrl.calculateMapBounds({id: 1, pickupAddress: null, deliveryAddress: null});
        expect(result.zoom).toBe(7);
    });

    it('calculates center between pickup and delivery', () => {
        const ctrl = setup();
        const job = makeJob(1, {
            pickupAddress: {latitude: -36, longitude: 174},
            deliveryAddress: {latitude: -42, longitude: 172},
        });
        const result = ctrl.calculateMapBounds(job);
        expect(result.center.lat).toBeCloseTo(-39);
        expect(result.center.lng).toBeCloseTo(173);
    });

    it('sets zoom based on distance', () => {
        const ctrl = setup();
        // Close together (maxDiff < 0.1)
        const close = ctrl.calculateMapBounds(makeJob(1, {
            pickupAddress: {latitude: -36.80, longitude: 174.70},
            deliveryAddress: {latitude: -36.81, longitude: 174.71},
        }));
        expect(close.zoom).toBe(12);

        // Far apart (maxDiff > 20)
        const far = ctrl.calculateMapBounds(makeJob(1, {
            pickupAddress: {latitude: -36, longitude: 174},
            deliveryAddress: {latitude: -10, longitude: 150},
        }));
        expect(far.zoom).toBeLessThanOrEqual(4);
    });

    it('sets flight=true when speedId matches FLIGHT_SPEED_ID', () => {
        const ctrl = setup();
        const result = ctrl.calculateMapBounds(makeFlightJob(1, {speedId: 415}));
        expect(result.job.flight).toBe(true);
    });

    it('sets flight=false for non-flight speed', () => {
        const ctrl = setup();
        const result = ctrl.calculateMapBounds(makeJob(1, {speedId: 100}));
        expect(result.job.flight).toBe(false);
    });
});

describe('displayJobOnMap', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.displayJobOnMap = ControllerClass.prototype.displayJobOnMap;
        return ctrl;
    }

    it('returns early for null job', () => {
        const ctrl = setup();
        ctrl.displayJobOnMap(null);
        expect(ctrl.calculateMapBounds).not.toHaveBeenCalled();
    });

    it('skips recalculation for same job id with cached config', () => {
        const ctrl = setup({lastMapJobId: 42, cachedMapConfig: {zoom: 7}});
        ctrl.displayJobOnMap(makeJob(42));
        expect(ctrl.calculateMapBounds).not.toHaveBeenCalled();
    });

    it('calculates and caches for new job', () => {
        const mapConfig = {zoom: 10, center: {lat: 0, lng: 0}};
        const ctrl = setup();
        ctrl.calculateMapBounds = jest.fn().mockReturnValue(mapConfig);
        ctrl.displayJobOnMap(makeJob(42));
        expect(ctrl.mapConfig).toBe(mapConfig);
        expect(ctrl.cachedMapConfig).toBe(mapConfig);
        expect(ctrl.lastMapJobId).toBe(42);
    });

    it('shows error toast on calculation failure', () => {
        const ctrl = setup();
        ctrl.calculateMapBounds = jest.fn().mockImplementation(() => { throw new Error('fail'); });
        ctrl.displayJobOnMap(makeJob(42));
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalled();
    });
});

describe('handleJobDispatch', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.handleJobDispatch = ControllerClass.prototype.handleJobDispatch;
        return ctrl;
    }

    it('returns false with warning for US customers', async () => {
        const ctrl = setup({isUsCustomer: true});
        const result = await ctrl.handleJobDispatch(makeJob(1), 99);
        expect(result).toBe(false);
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith(expect.stringContaining('not supported'));
    });

    it('dispatches and shows success toast', async () => {
        const ctrl = setup();
        ctrl.DispatchData.getCourierById.mockResolvedValue({courierId: 99, name: 'Alice'});
        const job = makeJob(10) as any;

        await ctrl.handleJobDispatch(job, 99);

        expect(ctrl.dispatchJobService.dispatchJobs).toHaveBeenCalledWith(99, [job]);
        expect(job.assignedCourier).toEqual({id: 99, text: 'Alice'});
        expect(ctrl.toastrService.showSuccessToast).toHaveBeenCalledWith(expect.stringContaining('dispatched'));
    });

    it('does not throw on dispatch error', async () => {
        const ctrl = setup();
        ctrl.dispatchJobService.dispatchJobs.mockRejectedValue(new Error('fail'));
        await expect(ctrl.handleJobDispatch(makeJob(1), 99)).resolves.toBeUndefined();
    });
});

describe('addStopToJob', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.addStopToJob = ControllerClass.prototype.addStopToJob;
        return ctrl;
    }

    it('shows warning when no newStopJobId', async () => {
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockResolvedValue(null);
        await ctrl.addStopToJob({} as MouseEvent, makeJob(10));
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalledWith('Failed to add stop to job');
    });

    it('fetches and selects new stop job', async () => {
        const newJob = makeJob(20);
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockResolvedValue(20);
        ctrl.DispatchData.getDispatchJobDetail.mockResolvedValue(newJob);
        await ctrl.addStopToJob({} as MouseEvent, makeJob(10));
        expect(ctrl.selectJob).toHaveBeenCalledWith(newJob);
    });

    it('shows error toast on failure and resets loading', async () => {
        const ctrl = setup();
        ctrl.jobAddStopService.addNewStop.mockRejectedValue(new Error('fail'));
        await ctrl.addStopToJob({} as MouseEvent, makeJob(10));
        expect(ctrl.toastrService.showErrorToast).toHaveBeenCalled();
        expect(ctrl.isDataLoading).toBe(false);
    });
});
