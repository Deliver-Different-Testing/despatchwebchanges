import React from 'react';
import { setupUser } from '../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

const sampleJob = {id: 55, jobNo: 'JOB-55', assignedCourier: undefined};

// The job list and map pull in heavy dependencies (React Query data fetching,
// the HERE Maps SDK); stub them so the smoke test exercises the shell wiring.
// The job-list stub exposes a button that fires onJobSelect so tests can drive
// the page's selection (and the Dispatch affordance that depends on it).
jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, onJobSelect, onJobsLoaded}: {
        storagePrefix: string;
        onJobSelect?: (j: unknown) => void;
        onJobsLoaded?: (jobs: unknown[]) => void;
    }) => (
        <div data-testid={`mock-job-list-${storagePrefix}`}>
            <button onClick={() => onJobSelect?.(sampleJob)}>select-sample-job</button>
            <button onClick={() => onJobsLoaded?.([sampleJob])}>load-jobs</button>
        </div>
    ),
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
