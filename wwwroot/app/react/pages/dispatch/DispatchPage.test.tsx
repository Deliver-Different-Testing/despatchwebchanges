import React from 'react';
import { setupUser } from '../../__testUtils__/setupUser';
import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

const sampleJob = {id: 55, jobNo: 'JOB-55', assignedCourier: undefined};

// The job list and map pull in heavy dependencies (React Query data fetching,
// the HERE Maps SDK); stub them so the smoke test exercises the shell wiring.
// The job-list stub exposes a button that fires onJobSelect so tests can drive
// the page's selection (and the Dispatch affordance that depends on it).
const jobListFetchConfig: {initialParams?: {despatchViewIds?: number[]; statusFilter?: string}} = {};
jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, onJobSelect, onJobsLoaded, topSlot, fetchConfig}: {
        storagePrefix: string;
        onJobSelect?: (j: unknown) => void;
        onJobsLoaded?: (jobs: unknown[]) => void;
        topSlot?: React.ReactNode;
        fetchConfig?: {initialParams?: {despatchViewIds?: number[]; statusFilter?: string}};
    }) => {
        if (storagePrefix === 'dispatchJobList') jobListFetchConfig.initialParams = fetchConfig?.initialParams;
        return (
            <div data-testid={`mock-job-list-${storagePrefix}`}>
                {topSlot}
                <button onClick={() => onJobSelect?.(sampleJob)}>select-sample-job</button>
                <button onClick={() => onJobsLoaded?.([sampleJob])}>load-jobs</button>
            </div>
        );
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

jest.mock('../../services/dispatchExecutorApi', () => ({
    getDispatchJobDetail: jest.fn().mockResolvedValue({id: 55, jobNo: 'JOB-55'}),
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
    DispatchDialog: ({open, onDispatchCourier}: {open: boolean; onDispatchCourier: (t: string, d: {id: number; text: string}) => void}) =>
        open ? (
            <div data-testid="mock-dispatch-dialog">
                <button onClick={() => onDispatchCourier('Courier', {id: 9, text: 'Courier 9'})}>
                    confirm-dispatch
                </button>
            </div>
        ) : null,
}));

import {DispatchPage} from './DispatchPage';
import {SELECTED_VIEWS_KEY} from './lib/dispatchFilters';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';

function renderPage(overrides: Partial<React.ComponentProps<typeof DispatchPage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <DispatchPage
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('DispatchPage', () => {
    beforeEach(() => {
        localStorage.clear();
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
    });

    it('renders the BETA banner and the dispatch job list box', () => {
        renderPage();
        expect(screen.getByText(/rebuilt Dispatch page/i)).toBeInTheDocument();
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

    describe('beta banner', () => {
        it('can be dismissed and the dismissal persists', async () => {
            const user = setupUser();
            const {unmount} = renderPage();
            expect(screen.getByText(/rebuilt Dispatch page/i)).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: /dismiss beta notice/i}));
            expect(screen.queryByText(/rebuilt Dispatch page/i)).not.toBeInTheDocument();

            // Persisted: a fresh mount stays dismissed.
            unmount();
            renderPage();
            expect(screen.queryByText(/rebuilt Dispatch page/i)).not.toBeInTheDocument();
        });
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
});
