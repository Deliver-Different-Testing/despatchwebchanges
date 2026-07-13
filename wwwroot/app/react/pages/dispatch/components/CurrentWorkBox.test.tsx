import React, {act} from 'react';
import {render, screen, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

// Stub the heavy children so the test exercises CurrentWorkBox's own wiring.
jest.mock('../../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix}: {storagePrefix: string}) => (
        <div data-testid={`mock-job-list-${storagePrefix}`} />
    ),
}));

type MockDriver = {courierId: number; name?: string};
const mockOverview: {onDriverSelect?: (d: MockDriver) => void} = {};
jest.mock('../../../components/common/current-work-all-drivers', () => ({
    CurrentWorkAllDrivers: ({onDriverSelect}: {onDriverSelect: (d: MockDriver) => void}) => {
        mockOverview.onDriverSelect = onDriverSelect;
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

import {CurrentWorkBox} from './CurrentWorkBox';
import {fetchDriverWorkOverview} from '../../../services/courierApi';

function renderBox(overrides: Partial<React.ComponentProps<typeof CurrentWorkBox>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <CurrentWorkBox showToast={jest.fn()} isUsCustomer={false} {...overrides} />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('CurrentWorkBox', () => {
    beforeEach(() => {
        mockOverview.onDriverSelect = undefined;
        jest.clearAllMocks();
    });

    describe('non-US tenant', () => {
        it('prompts to select a courier when none is provided', () => {
            renderBox();
            expect(screen.getByText(/select a courier to view/i)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /all drivers/i})).not.toBeInTheDocument();
        });

        it('renders the current-work job list for the selected courier', () => {
            renderBox({selectedJobCourierId: 42});
            expect(screen.getByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('shows the picked courier\'s job list after a courier search', async () => {
            renderBox();
            expect(screen.getByText(/select a courier to view/i)).toBeInTheDocument();

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

        it('returns to the All Drivers overview via the back link', async () => {
            renderBox({isUsCustomer: true});

            await act(async () => {
                mockOverview.onDriverSelect?.({courierId: 7, name: 'Jane Smith'});
            });
            expect(await screen.findByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();

            await act(async () => {
                screen.getByRole('button', {name: /all drivers/i}).click();
            });

            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();
        });

        it('focuses the selected job\'s courier and shows their job list', () => {
            renderBox({isUsCustomer: true, selectedJobCourierId: 99});
            expect(screen.getByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('does not render the duplicate courier search field for US tenants', () => {
            renderBox({isUsCustomer: true});
            expect(screen.queryByRole('button', {name: 'pick-courier'})).not.toBeInTheDocument();
        });
    });

    describe('header slot', () => {
        it('portals the breadcrumb back-link, driver name and truck button into the header slot', () => {
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
                // breadcrumb (back-link + driver name) rather than the old peer toggle.
                expect(within(slot).getByRole('button', {name: /all drivers/i})).toBeInTheDocument();
                expect(within(slot).getByText('Jane Smith')).toBeInTheDocument();
                expect(within(slot).getByRole('button', {name: 'Truck loading status'})).toBeInTheDocument();
            } finally {
                document.body.removeChild(slot);
            }
        });
    });
});
