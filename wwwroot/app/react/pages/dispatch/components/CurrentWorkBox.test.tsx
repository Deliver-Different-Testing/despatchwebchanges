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

const mockOverview: {onDriverSelect?: (d: {courierId: number}) => void} = {};
jest.mock('../../../components/common/current-work-all-drivers', () => ({
    CurrentWorkAllDrivers: ({onDriverSelect}: {onDriverSelect: (d: {courierId: number}) => void}) => {
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

        it('switches to the selected driver job list when a driver is picked', async () => {
            renderBox({isUsCustomer: true});
            expect(screen.getByTestId('mock-all-drivers')).toBeInTheDocument();

            await act(async () => {
                mockOverview.onDriverSelect?.({courierId: 7});
            });

            expect(await screen.findByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });

        it('focuses the selected job\'s courier and shows their job list', () => {
            renderBox({isUsCustomer: true, selectedJobCourierId: 99});
            expect(screen.getByTestId('mock-job-list-dispatchCurrentWork')).toBeInTheDocument();
        });
    });

    describe('header slot', () => {
        it('portals the All/Selected toggle and truck button into the provided header slot', () => {
            const slot = document.createElement('div');
            document.body.appendChild(slot);
            try {
                renderBox({isUsCustomer: true, selectedJobCourierId: 42, headerSlot: slot});
                // Controls render inside the header slot, not the card body.
                expect(within(slot).getByRole('button', {name: /all drivers/i})).toBeInTheDocument();
                expect(within(slot).getByRole('button', {name: 'Truck loading status'})).toBeInTheDocument();
            } finally {
                document.body.removeChild(slot);
            }
        });
    });
});
