import React from 'react';
import { setupUser } from '../../__testUtils__/setupUser';
import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
    DRIVER_LOCATION_REFRESH_KEY,
    REFRESH_INTERVAL_KEY,
    TASK_REFRESH_KEY,
} from './lib/dispatchFilters';

const sampleJob = {id: 55, jobNo: 'JOB-55', assignedCourier: undefined};

// The job list and map pull in heavy dependencies (React Query data fetching,
// the HERE Maps SDK); stub them so the smoke test exercises the shell wiring.
// The job-list stub exposes a button that fires onJobSelect so tests can drive
// the page's selection (and the Dispatch affordance that depends on it).
const jobListFetchConfig: {
    initialParams?: {despatchViewIds?: number[]; statusFilter?: string; selectedClearListId?: number};
    refetchInterval?: number | false;
    forcedCategory?: string;
} = {};
// What the page pushed into the mounted list instead of remounting it.
const jobListParamPushes: Record<string, unknown>[] = [];
jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, onJobSelect, onJobsLoaded, topSlot, fetchConfig, forcedCategory, setUpdateSearchParamsCallback}: {
        storagePrefix: string;
        onJobSelect?: (j: unknown) => void;
        onJobsLoaded?: (jobs: unknown[]) => void;
        topSlot?: React.ReactNode;
        fetchConfig?: {
            initialParams?: {despatchViewIds?: number[]; statusFilter?: string; selectedClearListId?: number};
            refetchInterval?: number | false;
        };
        forcedCategory?: string;
        setUpdateSearchParamsCallback?: (cb: (params: Record<string, unknown>) => void) => void;
    }) => {
        if (storagePrefix === 'dispatchJobList') {
            jobListFetchConfig.initialParams = fetchConfig?.initialParams;
            jobListFetchConfig.refetchInterval = fetchConfig?.refetchInterval;
            jobListFetchConfig.forcedCategory = forcedCategory;
            setUpdateSearchParamsCallback?.((params) => { jobListParamPushes.push(params); });
        }
        return (
            <div data-testid={`mock-job-list-${storagePrefix}`}>
                {topSlot}
                <button onClick={() => onJobSelect?.(sampleJob)}>select-sample-job</button>
                <button onClick={() => onJobsLoaded?.([sampleJob])}>load-jobs</button>
            </div>
        );
    },
}));

const boxProps: {
    driverLocations?: {refetchIntervalMs?: number | false; activeAreaId?: number};
    supports?: {refetchIntervalMs?: number | false};
    currentWork?: {refetchIntervalMs?: number | false};
    overviewDeliveries?: {refetchIntervalMs?: number | false};
    openJobs?: {refetchIntervalMs?: number | false};
} = {};
let selectArea: ((id: number) => void) | undefined;
jest.mock('./components/DriverLocationsBox', () => ({
    DriverLocationsBox: (props: {refetchIntervalMs?: number | false; activeAreaId?: number; onAreaSelect?: (id: number) => void}) => {
        boxProps.driverLocations = {refetchIntervalMs: props.refetchIntervalMs, activeAreaId: props.activeAreaId};
        selectArea = props.onAreaSelect;
        return <div data-testid="mock-driver-locations"/>;
    },
}));
jest.mock('../../components/common/tasks-box/TasksBox', () => ({
    TasksBox: (props: {refetchIntervalMs?: number | false}) => {
        boxProps.supports = {refetchIntervalMs: props.refetchIntervalMs};
        return <div data-testid="mock-supports"/>;
    },
}));
jest.mock('./components/CurrentWorkBox', () => ({
    CurrentWorkBox: (props: {refetchIntervalMs?: number | false}) => {
        boxProps.currentWork = {refetchIntervalMs: props.refetchIntervalMs};
        return <div data-testid="mock-current-work"/>;
    },
}));
jest.mock('./components/OverviewDeliveriesBox', () => ({
    OverviewDeliveriesBox: (props: {refetchIntervalMs?: number | false; onSelectJob: (id: number) => void}) => {
        boxProps.overviewDeliveries = {refetchIntervalMs: props.refetchIntervalMs};
        return (
            <div data-testid="mock-overview-deliveries">
                <button onClick={() => props.onSelectJob(4242)}>select-overview-job</button>
            </div>
        );
    },
}));
jest.mock('./components/OpenJobsBox', () => ({
    OpenJobsBox: (props: {refetchIntervalMs?: number | false}) => {
        boxProps.openJobs = {refetchIntervalMs: props.refetchIntervalMs};
        return <div data-testid="mock-open-jobs"/>;
    },
}));

const serverViews = [
    {id: 11, name: 'Auckland', centerLatitude: -36.85, centerLongitude: 174.76, selected: false},
    {id: 22, name: 'Airport', centerLatitude: -37.0, centerLongitude: 174.79, selected: false},
];
const fetchPageViewsMock = jest.fn().mockResolvedValue(serverViews);
jest.mock('../../services/dispatchViewsApi', () => ({
    fetchPageViews: (...a: unknown[]) => fetchPageViewsMock(...a),
}));

const dispatchMapProps: {
    showAvailableCouriers?: boolean;
    jobs?: {jobId: number}[];
    mapCenter?: {lat: number; lng: number};
    mapZoom?: number;
    preferenceScope?: string | number;
} = {};
jest.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: (props: {
        onMarkerClick?: (item: {jobId: number}) => void;
        showAvailableCouriers?: boolean;
        jobs?: {jobId: number}[];
        mapCenter?: {lat: number; lng: number};
        mapZoom?: number;
        preferenceScope?: string | number;
    }) => {
        dispatchMapProps.showAvailableCouriers = props.showAvailableCouriers;
        dispatchMapProps.jobs = props.jobs;
        dispatchMapProps.mapCenter = props.mapCenter;
        dispatchMapProps.mapZoom = props.mapZoom;
        dispatchMapProps.preferenceScope = props.preferenceScope;
        return (
            <div data-testid="mock-dispatch-map">
                <button onClick={() => props.onMarkerClick?.({jobId: 55})}>click-marker</button>
            </div>
        );
    },
}));

// Without this the real layout sync fires a live XHR at DispatchLayout/GetLayouts.
jest.mock('../../services/dispatchLayoutApi', () => ({
    getLayouts: jest.fn().mockResolvedValue([]),
    saveLayouts: jest.fn().mockResolvedValue(undefined),
}));
const getDispatchJobDetailMock = jest.fn().mockResolvedValue({id: 55, jobNo: 'JOB-55'});
jest.mock('../../services/dispatchExecutorApi', () => ({
    getDispatchJobDetail: (...a: unknown[]) => getDispatchJobDetailMock(...a),
}));

const allocateJobsMock = jest.fn().mockResolvedValue(undefined);
const reAllocateJobsMock = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/jobListApi', () => ({
    allocateJobs: (...a: unknown[]) => allocateJobsMock(...a),
    reAllocateJobs: (...a: unknown[]) => reAllocateJobsMock(...a),
    sendToPartner: jest.fn().mockResolvedValue({success: true, trackingNumber: 'T1'}),
    getActivePartnerOptions: jest.fn().mockResolvedValue([]),
    getPartnerRateForJob: jest.fn().mockResolvedValue({}),
}));

// These dialog modules register an AngularJS module at import time
// (window.angular is undefined under jsdom) — stub them.
jest.mock('../../components/dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module', () => ({
    openInterCourierChargeDialog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../components/dialogs/edit-address-dialog/edit-address-dialog-react.module', () => ({
    openEditAddressDialog: jest.fn().mockResolvedValue(null),
}));

// Stub the DispatchDialog: when open, expose a button that fires the courier
// dispatch callback so we can assert the page's allocate wiring.
jest.mock('../../components/dialogs/dispatch-dialog', () => ({
    DispatchDialog: ({open, onDispatchCourier}: {
        open: boolean;
        onDispatchCourier: (c: {type: string; destination: {id: number; text: string}}) => void;
    }) =>
        open ? (
            <div data-testid="mock-dispatch-dialog">
                <button onClick={() => onDispatchCourier({
                    type: 'Courier',
                    destination: {id: 9, text: 'Courier 9'},
                })}>
                    confirm-dispatch
                </button>
            </div>
        ) : null,
}));

import {DispatchPage} from './DispatchPage';
import dayjs from 'dayjs';
import {SELECTED_VIEWS_KEY} from './lib/dispatchFilters';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {MantineTestProvider} from '../../__testUtils__';

function renderPage(overrides: Partial<React.ComponentProps<typeof DispatchPage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DispatchPage
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </MantineTestProvider>
        </QueryClientProvider>,
    );
}

describe('DispatchPage', () => {
    beforeEach(() => {
        localStorage.clear();
        jobListParamPushes.length = 0;
    });

    describe('persisted category filter', () => {
        // The job list is re-keyed (and so remounted) on every view/date change, so the
        // dispatcher's Unassigned/Active choice has to be seeded back into the fetch
        // params — otherwise the restored tab would filter an unfiltered page of results.
        const categoryKey = 'dispatchJobList_selectedCategory_0';

        it('seeds the job list status filter from the persisted category', () => {
            localStorage.setItem(categoryKey, 'needs-dispatch');
            renderPage();
            expect(jobListFetchConfig.initialParams?.statusFilter).toBe('needs-dispatch');
        });

        it('sends no status filter when the persisted category is All or absent', () => {
            localStorage.setItem(categoryKey, 'all');
            renderPage();
            expect(jobListFetchConfig.initialParams?.statusFilter).toBeUndefined();
        });

        it('forces needs-dispatch when a clear-list area is active, overriding the stored category', async () => {
            // V1 selectAndActivateArea set queryParams.statusFilter = 'needs-dispatch'
            // and bounced defaultJobCategory through undefined to force the tab across.
            // The scope has to win over the operator's stored choice, and the fetch
            // params and the visible category chip have to agree.
            localStorage.setItem(categoryKey, 'delivered');
            renderPage();
            expect(jobListFetchConfig.initialParams?.statusFilter).toBe('delivered');

            await act(async () => { selectArea?.(7); });

            expect(jobListFetchConfig.initialParams?.selectedClearListId).toBe(7);
            expect(jobListFetchConfig.initialParams?.statusFilter).toBe('needs-dispatch');
            expect(jobListFetchConfig.forcedCategory).toBe('needs-dispatch');
        });

        it('does not force a category outside the clear-list scope', () => {
            localStorage.setItem(categoryKey, 'delivered');
            renderPage();
            expect(jobListFetchConfig.forcedCategory).toBeUndefined();
        });
    });

    describe('refresh interval threading', () => {
        // Three independent cadences (jobs / driver locations / tasks) are persisted
        // separately and pushed in via updateRefreshIntervals. Nothing asserted that
        // they actually reach the queries, so a broken prop would have been silent.
        it('threads each persisted cadence to the box that owns it', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            localStorage.setItem(DRIVER_LOCATION_REFRESH_KEY, '15');
            localStorage.setItem(TASK_REFRESH_KEY, '60');

            renderPage();

            expect(jobListFetchConfig.refetchInterval).toBe(30_000);
            expect(boxProps.driverLocations?.refetchIntervalMs).toBe(15_000);
            expect(boxProps.supports?.refetchIntervalMs).toBe(60_000);
            expect(boxProps.currentWork?.refetchIntervalMs).toBe(30_000);
        });
    });

    it('renders the dispatch job list box', () => {
        renderPage();
        expect(screen.getByTestId('mock-job-list-dispatchJobList')).toBeInTheDocument();
    });

    it('prompts to select a job when none is selected', () => {
        renderPage();
        expect(screen.getByText(/select a job from the list/i)).toBeInTheDocument();
    });

    it('exposes a layout bridge to the host on mount', () => {
        const onLayoutBridgeReady = jest.fn();
        renderPage({onLayoutBridgeReady});
        expect(onLayoutBridgeReady).toHaveBeenCalledWith(
            expect.objectContaining({
                setCurrentLayoutName: expect.any(Function),
                reloadFromStorage: expect.any(Function),
                promptSaveLayout: expect.any(Function),
                promptDeleteLayout: expect.any(Function),
            }),
        );
    });

    describe('job detail panel mount', () => {
        let mountMock: jest.Mock;
        let unmountMock: jest.Mock;
        let originalReactJobDetails: unknown;

        beforeEach(() => {
            mountMock = jest.fn();
            unmountMock = jest.fn();
            originalReactJobDetails = (window as {ReactJobDetails?: unknown}).ReactJobDetails;
            (window as {ReactJobDetails?: unknown}).ReactJobDetails = {
                mount: mountMock,
                unmount: unmountMock,
                refresh: jest.fn(),
            };
        });

        afterEach(() => {
            (window as {ReactJobDetails?: unknown}).ReactJobDetails = originalReactJobDetails;
        });

        const selectSampleJob = async (user: ReturnType<typeof setupUser>) => {
            await user.click(screen.getByRole('button', {name: 'load-jobs'}));
            await user.click(screen.getByRole('button', {name: 'click-marker'}));
            expect(await screen.findByRole('button', {name: 'Job actions'})).toBeInTheDocument();
        };

        it('mounts the detail panel once and keeps it mounted across unrelated re-renders', async () => {
            const user = setupUser();
            renderPage();

            await selectSampleJob(user);
            expect(mountMock).toHaveBeenCalledTimes(1);
            expect(mountMock).toHaveBeenLastCalledWith(
                'react-dispatch-job-detail',
                expect.objectContaining({jobId: 55}),
            );

            // A re-render that does not change the selected job (e.g. list reload /
            // auto-refresh) must not tear the panel down — that would reset the tab.
            await user.click(screen.getByRole('button', {name: 'load-jobs'}));
            expect(unmountMock).not.toHaveBeenCalled();
            expect(mountMock).toHaveBeenCalledTimes(1);
        });

        it('unmounts the detail panel only when the page is torn down', async () => {
            const user = setupUser();
            const {unmount} = renderPage();

            await selectSampleJob(user);
            expect(unmountMock).not.toHaveBeenCalled();

            unmount();
            expect(unmountMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('map', () => {
        it('selects a job when its map marker is clicked', async () => {
            const user = setupUser();
            renderPage();

            // Marker click resolves against the loaded job set.
            await user.click(screen.getByRole('button', {name: 'load-jobs'}));
            await user.click(screen.getByRole('button', {name: 'click-marker'}));

            // Selecting a job surfaces the detail action menu in the Job Detail header.
            expect(await screen.findByRole('button', {name: 'Job actions'})).toBeInTheDocument();
        });

        it('always shows available couriers on the map (parity with the AngularJS page)', () => {
            renderPage();
            expect(dispatchMapProps.showAvailableCouriers).toBe(true);
        });

        it('defaults to the tenant overview (zoom 4) and scopes map preferences when no view is selected', () => {
            renderPage();
            expect(dispatchMapProps.mapZoom).toBe(4);
            expect(dispatchMapProps.mapCenter).toEqual(expect.objectContaining({lat: expect.any(Number), lng: expect.any(Number)}));
            expect(dispatchMapProps.preferenceScope).toBeDefined();
        });

        it('recentres the map on a single selected despatch view at zoom 7', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([
                {id: 7, name: 'Auckland', centerLatitude: -36.85, centerLongitude: 174.76, selected: true},
            ]));
            renderPage();
            expect(dispatchMapProps.mapZoom).toBe(7);
            expect(dispatchMapProps.mapCenter).toEqual({lat: -36.85, lng: 174.76});
        });

        it('narrows the map to just the selected job when it has no courier', async () => {
            const user = setupUser();
            renderPage();

            await user.click(screen.getByRole('button', {name: 'load-jobs'}));
            await user.click(screen.getByRole('button', {name: 'select-sample-job'}));

            await screen.findByRole('button', {name: 'Job actions'});
            expect(dispatchMapProps.jobs).toEqual([{jobId: 55, jobNo: 'JOB-55', pickupAddress: undefined, deliveryAddress: undefined, assignedCourier: undefined, statusId: undefined}]);
        });
    });

    describe('views rail', () => {
        const railPill = (name: string) => screen.getByRole('button', {name});

        it('selects the first view on a first visit and persists it', async () => {
            renderPage();

            expect(await screen.findByRole('button', {name: 'Auckland', pressed: true})).toBeInTheDocument();
            expect(railPill('Airport')).toHaveAttribute('aria-pressed', 'false');
            expect(fetchPageViewsMock).toHaveBeenCalledWith(LegacyAppPage.Dispatch);
            expect(JSON.parse(localStorage.getItem(SELECTED_VIEWS_KEY)!)).toEqual([
                expect.objectContaining({id: 11, selected: true}),
            ]);
            expect(jobListFetchConfig.initialParams?.despatchViewIds).toEqual([11]);
        });

        it('restores a stored selection instead of defaulting', async () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([{...serverViews[1], selected: true}]));
            renderPage();

            expect(await screen.findByRole('button', {name: 'Airport', pressed: true})).toBeInTheDocument();
            expect(railPill('Auckland')).toHaveAttribute('aria-pressed', 'false');
        });

        it('scopes the job list and persists when a view is toggled on', async () => {
            const user = setupUser();
            renderPage();
            await screen.findByRole('button', {name: 'Auckland', pressed: true});

            await user.click(railPill('Airport'));

            expect(railPill('Airport')).toHaveAttribute('aria-pressed', 'true');
            expect(jobListFetchConfig.initialParams?.despatchViewIds).toEqual([11, 22]);
            expect(JSON.parse(localStorage.getItem(SELECTED_VIEWS_KEY)!).map((v: {id: number}) => v.id))
                .toEqual([11, 22]);
        });

        // The rail scrolls horizontally and lives inside the job list card, so a
        // remount on every pill click threw away both its scroll position and the
        // table's. The selection now travels as a params push instead.
        it('keeps the job list mounted when a view is toggled', async () => {
            const user = setupUser();
            renderPage();
            await screen.findByRole('button', {name: 'Auckland', pressed: true});
            const listNode = screen.getByTestId('mock-job-list-dispatchJobList');

            await user.click(railPill('Airport'));

            expect(screen.getByTestId('mock-job-list-dispatchJobList')).toBe(listNode);
        });

        it('pushes the new view selection into the mounted list', async () => {
            const user = setupUser();
            renderPage();
            await screen.findByRole('button', {name: 'Auckland', pressed: true});
            jobListParamPushes.length = 0;

            await user.click(railPill('Airport'));

            const push = jobListParamPushes.at(-1);
            expect(push).toMatchObject({despatchViewIds: [11, 22], page: 0});
            // The category chip owns the status filter; re-pushing the stored
            // value here would fight the dispatcher's live choice.
            expect(push).not.toHaveProperty('statusFilter');
        });

        // The host toolbar hands over a fresh dayjs on every push, so an unchanged
        // range must not restart the query underneath the operator.
        it('ignores a filter push that repeats the current date range', async () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            await screen.findByRole('button', {name: 'Auckland', pressed: true});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];
            const range = () => ({startDate: dayjs('2025-02-01'), endDate: dayjs('2025-02-02')});
            jobListParamPushes.length = 0;

            act(() => { bridge.updateFilters(range()); });
            expect(jobListParamPushes).toHaveLength(1);

            act(() => { bridge.updateFilters(range()); });
            expect(jobListParamPushes).toHaveLength(1);
        });

        it('clears the selection and keeps it cleared in storage', async () => {
            const user = setupUser();
            renderPage();
            await screen.findByRole('button', {name: 'Auckland', pressed: true});

            await user.click(screen.getByRole('button', {name: 'Clear'}));

            expect(railPill('Auckland')).toHaveAttribute('aria-pressed', 'false');
            expect(localStorage.getItem(SELECTED_VIEWS_KEY)).toBe('[]');
            expect(screen.getByText('Select a view to load jobs.')).toBeInTheDocument();
            expect(jobListFetchConfig.initialParams?.despatchViewIds).toEqual([]);
        });

        it('holds the first host notification until the views have loaded', async () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];

            const listener = jest.fn();
            bridge.registerViewsListener(listener);
            // Still loading — the toolbar keeps its spinner rather than
            // flashing "No views available".
            expect(listener).not.toHaveBeenCalled();

            await screen.findByRole('button', {name: 'Auckland', pressed: true});
            expect(listener).toHaveBeenCalled();
        });

        it('keeps the host toolbar in sync in both directions', async () => {
            const user = setupUser();
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];

            const listener = jest.fn();
            const unregister = bridge.registerViewsListener(listener);
            await screen.findByRole('button', {name: 'Auckland', pressed: true});

            // React → host: the loaded list arrives with the resolved selection.
            expect(listener).toHaveBeenLastCalledWith([
                expect.objectContaining({id: 11, name: 'Auckland', selected: true}),
                expect.objectContaining({id: 22, name: 'Airport', selected: false}),
            ]);

            // Host → React: the toolbar menu drives the rail.
            await act(async () => bridge.setViewSelection([22]));
            expect(railPill('Airport')).toHaveAttribute('aria-pressed', 'true');
            expect(railPill('Auckland')).toHaveAttribute('aria-pressed', 'false');

            listener.mockClear();
            unregister();
            await user.click(railPill('Auckland'));
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('dispatch FAB', () => {
        it('hides the FAB until a job is selected', () => {
            renderPage();
            expect(screen.queryByRole('button', {name: 'Job actions'})).not.toBeInTheDocument();
        });

        it('dispatches the selected job to a courier via the dialog', async () => {
            const user = setupUser();
            renderPage();

            await user.click(screen.getByRole('button', {name: 'select-sample-job'}));

            // The action menu appears once a job is selected; the kebab opens it.
            await user.click(screen.getByRole('button', {name: 'Job actions'}));
            await user.click(screen.getByRole('menuitem', {name: 'Dispatch to Courier'}));
            expect(await screen.findByTestId('mock-dispatch-dialog')).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: 'confirm-dispatch'}));

            expect(allocateJobsMock).toHaveBeenCalledWith(9, [55]);
            expect(reAllocateJobsMock).not.toHaveBeenCalled();
        });
    });
    /*
     * Both Overview panels ship hidden, and panel visibility is only editable on a
     * saved layout — so enabling them means seeding a custom layout the way the
     * Customize-panels dialog would.
     */
    describe('Overview panels', () => {
        // Must match useBoxLayout's keys in DispatchPage (AppPage.Dispatch === 1).
        const LAYOUTS_KEY = 'layoutV2-0';
        const LAST_ACTIVE_KEY = 'lastActiveLayoutV2-0';
        const VISIBILITY_KEY = 'boxVisibilityV2-1-0-Mine';

        const enableOverviewPanels = (visible = true) => {
            localStorage.setItem(LAYOUTS_KEY, JSON.stringify([{
                name: 'Mine',
                layout: {
                    columns: [{
                        id: 'col1',
                        width: '100%',
                        boxes: [
                            {name: 'overviewDeliveries', height: '50%'},
                            {name: 'openJobs', height: '50%'},
                        ],
                    }],
                },
            }]));
            localStorage.setItem(LAST_ACTIVE_KEY, 'Mine');
            localStorage.setItem(VISIBILITY_KEY, JSON.stringify({
                overviewDeliveries: {visible, collapsed: false},
                openJobs: {visible, collapsed: false},
            }));
        };

        it('leaves both panels off on the shipped Default layout', () => {
            renderPage();

            expect(screen.queryByTestId('mock-overview-deliveries')).not.toBeInTheDocument();
            expect(screen.queryByTestId('mock-open-jobs')).not.toBeInTheDocument();
        });

        it('renders both panels once a saved layout turns them on', () => {
            enableOverviewPanels();
            renderPage();

            expect(screen.getByTestId('mock-overview-deliveries')).toBeInTheDocument();
            expect(screen.getByTestId('mock-open-jobs')).toBeInTheDocument();
        });

        it('keeps them off when the saved layout has them switched off', () => {
            enableOverviewPanels(false);
            renderPage();

            expect(screen.queryByTestId('mock-overview-deliveries')).not.toBeInTheDocument();
        });

        it('gives both panels the toolbar refresh cadence', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            enableOverviewPanels();
            renderPage();

            expect(boxProps.overviewDeliveries?.refetchIntervalMs).toBe(30000);
            expect(boxProps.openJobs?.refetchIntervalMs).toBe(30000);
        });

        /*
         * These panels read from the 'overview' query key, not 'dispatch', so the
         * shared fall-through in handleRefreshBox would leave their refresh button
         * doing nothing at all.
         */
        it('refreshes the overview queries, not the dispatch ones', async () => {
            const invalidate = jest.spyOn(QueryClient.prototype, 'invalidateQueries');
            enableOverviewPanels();
            const user = setupUser();
            renderPage();

            // The seeded layout holds only these two panels, so the refresh buttons
            // on screen are theirs — Deliveries first.
            expect(screen.getByText('Deliveries')).toBeInTheDocument();
            invalidate.mockClear();
            await user.click(screen.getAllByRole('button', {name: 'Refresh'})[0]);

            expect(invalidate).toHaveBeenCalledWith({queryKey: ['overview']});
            invalidate.mockRestore();
        });

        it('selects an overview row into the Job Detail panel', async () => {
            enableOverviewPanels();
            const user = setupUser();
            renderPage();

            await user.click(screen.getByRole('button', {name: 'select-overview-job'}));

            expect(getDispatchJobDetailMock).toHaveBeenCalledWith(4242);
        });
    });
});
