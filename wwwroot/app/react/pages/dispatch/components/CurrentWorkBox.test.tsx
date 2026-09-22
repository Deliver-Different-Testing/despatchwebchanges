import React, {act} from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

// Stub the heavy children so the test exercises CurrentWorkBox's own wiring.
const jobListPanelProps: {fetchConfig?: any; defaultCategory?: string} = {};
jest.mock('../../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, fetchConfig, defaultCategory}: {storagePrefix: string; fetchConfig: any; defaultCategory?: string}) => {
        jobListPanelProps.fetchConfig = fetchConfig;
        jobListPanelProps.defaultCategory = defaultCategory;
        return <div data-testid={`mock-job-list-${storagePrefix}`} />;
    },
}));

type MockDriver = {courierId: number; name?: string; driverStatusText?: string};
const mockOverview: {onDriverSelect?: (d: MockDriver) => void; drivers?: MockDriver[]} = {};
jest.mock('../../../components/common/current-work-all-drivers', () => ({
    CurrentWorkAllDrivers: ({drivers, onDriverSelect}: {drivers: MockDriver[]; onDriverSelect: (d: MockDriver) => void}) => {
        mockOverview.onDriverSelect = onDriverSelect;
        mockOverview.drivers = drivers;
        return <div data-testid="mock-all-drivers" />;
    },
}));

jest.mock('../../../services/courierApi', () => ({
    fetchDriverWorkOverview: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../services/jobSearchApi', () => ({
    fetchCurrentWorkJobs: jest.fn().mockResolvedValue({jobs: [], totalCount: 0, hasMore: false}),
}));

// Stub the courier search so CurrentWorkBox doesn't hit the courier API.
const courierSearchSelectRef: {fn?: (c: {id: number; text: string}) => void} = {};
jest.mock('./CourierSearchField', () => ({
    CourierSearchField: ({onSelect}: {onSelect: (c: {id: number; text: string}) => void}) => {
        courierSearchSelectRef.fn = onSelect;
        return <button onClick={() => onSelect({id: 99, text: 'Courier 99'})}>pick-courier</button>;
    },
}));

jest.mock('./TruckLoadingStatusDialog', () => ({
    TruckLoadingStatusDialog: ({open}: {open: boolean}) =>
        open ? <div data-testid="mock-truck-status" /> : null,
}));

import dayjs from 'dayjs';
import {CurrentWorkBox} from './CurrentWorkBox';
import {fetchDriverWorkOverview} from '../../../services/courierApi';
import {MantineTestProvider} from '../../../__testUtils__';

const defaultStart = dayjs('2026-07-10T00:00:00');
const defaultEnd = dayjs('2026-07-12T23:59:59');

function renderBox(overrides: Partial<React.ComponentProps<typeof CurrentWorkBox>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <CurrentWorkBox
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    startDate={defaultStart}
                    endDate={defaultEnd}
                    {...overrides}
                />
            </MantineTestProvider>
        </QueryClientProvider>,
    );
}

describe('CurrentWorkBox', () => {
    beforeEach(() => {
        mockOverview.onDriverSelect = undefined;
        mockOverview.drivers = undefined;
        jobListPanelProps.fetchConfig = undefined;
        jobListPanelProps.defaultCategory = undefined;
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    describe('non-US tenant', () => {
        it('prompts to select a courier when none is provided', () => {
            renderBox();
            expect(screen.getByText(/select a courier to view/i)).toBeInTheDocument();
            expect(screen.queryByRole('radio', {name: /all drivers/i})).not.toBeInTheDocument();
        });

        it('renders the current-work job list for the selected courier', () => {
            renderBox({selectedJobCourierId: 42});
            expect(screen.getByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('defaults the courier job list to their active work, not all of it', () => {
            renderBox({selectedJobCourierId: 42});
            expect(jobListPanelProps.defaultCategory).toBe('in-progress');
        });

        it('drives the current-work fetch off the page date filter (matching the other lists)', () => {
            const startDate = dayjs('2026-01-01T00:00:00');
            const endDate = dayjs('2026-01-05T23:59:59');
            renderBox({selectedJobCourierId: 42, startDate, endDate});
            expect(jobListPanelProps.fetchConfig.initialParams.startDate).toBe(startDate);
            expect(jobListPanelProps.fetchConfig.initialParams.endDate).toBe(endDate);
        });

        it('marks its fetchConfig for client-side search (GetCurrentWorkList has no searchText support)', () => {
            renderBox({selectedJobCourierId: 42});
            expect(jobListPanelProps.fetchConfig.clientSideSearch).toBe(true);
        });

        it('shows the picked courier\'s job list after a courier search', async () => {
            renderBox();
            expect(screen.getByText(/select a courier to view/i)).toBeInTheDocument();

            await act(async () => {
                screen.getByRole('button', {name: 'Search courier'}).click();
            });
            await act(async () => {
                courierSearchSelectRef.fn?.({id: 99, text: 'Courier 99'});
            });

            expect(await screen.findByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });
    });

    describe('US tenant', () => {
        it('defaults to the All Drivers overview and fetches the overview data', () => {
            renderBox({isUsCustomer: true});
            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();
            expect(fetchDriverWorkOverview).toHaveBeenCalled();
        });

        it('drills into a driver\'s job list when a driver is picked', async () => {
            renderBox({isUsCustomer: true});
            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();

            await act(async () => {
                mockOverview.onDriverSelect?.({courierId: 7, name: 'Jane Smith'});
            });

            expect(await screen.findByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('toggles between the All Drivers overview and the focused driver via the scope toggle', async () => {
            renderBox({isUsCustomer: true});

            // Overview mode: the focused-driver toggle has no courier yet, so it is disabled.
            expect(screen.getByRole('radio', {name: /selected driver/i})).toBeDisabled();

            await act(async () => {
                mockOverview.onDriverSelect?.({courierId: 7, name: 'Jane Smith'});
            });
            expect(await screen.findByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
            // The focused-driver toggle now carries the picked driver's name.
            expect(screen.getByRole('radio', {name: 'Jane Smith'})).toBeEnabled();

            await act(async () => {
                screen.getByRole('radio', {name: /all drivers/i}).click();
            });

            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();
        });

        it('shows only active drivers when the Active Drivers scope is selected', async () => {
            (fetchDriverWorkOverview as jest.Mock).mockResolvedValue([
                {courierId: 1, name: 'Active Amy', driverStatusText: 'Active'},
                {courierId: 2, name: 'Idle Ian', driverStatusText: 'Inactive'},
                {courierId: 3, name: 'Active Al', driverStatusText: 'Active'},
            ]);
            renderBox({isUsCustomer: true});

            // Overview shows every driver once the query resolves.
            await waitFor(() => expect(mockOverview.drivers?.map(d => d.courierId)).toEqual([1, 2, 3]));

            await act(async () => {
                screen.getByRole('radio', {name: /active drivers/i}).click();
            });

            // Active scope narrows the list to logged-in (Active) drivers only.
            expect(mockOverview.drivers?.map(d => d.courierId)).toEqual([1, 3]);
        });

        it('focuses the selected job\'s courier and shows their job list', () => {
            renderBox({isUsCustomer: true, selectedJobCourierId: 99});
            expect(screen.getByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('does not offer the direct courier search — the drivers overview already has its own filter', () => {
            renderBox({isUsCustomer: true});
            expect(screen.queryByRole('button', {name: 'Search courier'})).not.toBeInTheDocument();
            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();
        });
    });

    describe('header slot', () => {
        it('portals the scope toggle and truck button into the header slot, but not the courier search (US tenant)', () => {
            const slot = document.createElement('div');
            document.body.appendChild(slot);
            try {
                renderBox({
                    isUsCustomer: true,
                    selectedJobCourierId: 42,
                    selectedJobCourierName: 'Jane Smith',
                    headerSlot: slot,
                });
                // The selected job drills straight into its courier, so the header shows the
                // "All Drivers / <driver>" scope toggle with the driver name on the focused side.
                expect(within(slot).getByRole('radio', {name: /all drivers/i})).toBeInTheDocument();
                expect(within(slot).getByRole('radio', {name: 'Jane Smith'})).toBeInTheDocument();
                expect(within(slot).getByRole('button', {name: 'Truck loading status'})).toBeInTheDocument();
                expect(within(slot).queryByRole('button', {name: 'Search courier'})).not.toBeInTheDocument();
            } finally {
                document.body.removeChild(slot);
            }
        });

        it('portals the courier search into the header slot for non-US tenants', () => {
            const slot = document.createElement('div');
            document.body.appendChild(slot);
            try {
                renderBox({headerSlot: slot});
                expect(within(slot).getByRole('button', {name: 'Search courier'})).toBeInTheDocument();
            } finally {
                document.body.removeChild(slot);
            }
        });
    });

    describe('courier search toggle', () => {
        it('keeps the search field collapsed behind a header button until clicked', () => {
            renderBox();
            expect(screen.getByRole('button', {name: 'Search courier'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'pick-courier'})).not.toBeInTheDocument();
        });

        it('reveals the search field and hides the toggle button when clicked', async () => {
            renderBox();

            await act(async () => {
                screen.getByRole('button', {name: 'Search courier'}).click();
            });

            expect(screen.getByRole('button', {name: 'pick-courier'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Search courier'})).not.toBeInTheDocument();
        });

        it('collapses back to the toggle button after picking a courier', async () => {
            renderBox();

            await act(async () => {
                screen.getByRole('button', {name: 'Search courier'}).click();
            });
            await act(async () => {
                courierSearchSelectRef.fn?.({id: 99, text: 'Courier 99'});
            });

            expect(screen.getByRole('button', {name: 'Search courier'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'pick-courier'})).not.toBeInTheDocument();
        });

        it('collapses back to the toggle button on blur, without picking a courier', async () => {
            renderBox();

            await act(async () => {
                screen.getByRole('button', {name: 'Search courier'}).click();
            });
            await act(async () => {
                screen.getByRole('button', {name: 'pick-courier'}).focus();
                screen.getByRole('button', {name: 'pick-courier'}).blur();
            });

            expect(screen.getByRole('button', {name: 'Search courier'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'pick-courier'})).not.toBeInTheDocument();
        });
    });
});
