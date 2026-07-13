import React, {useState} from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

// Mock JobListPanel: expose the courierId it fetches for, and let the test
// simulate selecting one of that driver's jobs (drives the parent's currentJob).
let currentListCourierId: number | undefined;
jest.mock('../../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({fetchConfig, onJobSelect}: any) => {
        const cid = fetchConfig?.initialParams?.courierId;
        currentListCourierId = cid;
        return (
            <div data-testid="mock-job-list" data-courier-id={String(cid)}>
                <button onClick={() => onJobSelect?.({id: cid * 100, courierData: {courierId: cid}})}>
                    select-job
                </button>
            </div>
        );
    },
}));

jest.mock('../../../services/courierApi', () => ({
    fetchDriverWorkOverview: jest.fn().mockResolvedValue([
        {courierId: 7, name: 'Alice', vehicleType: 'Van', jobCount: 2, driverStatusText: 'Active'},
        {courierId: 8, name: 'Bob', vehicleType: 'Van', jobCount: 3, driverStatusText: 'Active'},
    ]),
}));

jest.mock('../../../services/jobSearchApi', () => ({
    fetchCurrentWorkJobs: jest.fn().mockResolvedValue({jobs: [], totalCount: 0, hasMore: false}),
}));

jest.mock('./CourierSearchField', () => ({CourierSearchField: () => <div />}));
jest.mock('./TruckLoadingStatusDialog', () => ({TruckLoadingStatusDialog: () => null}));

import {CurrentWorkBox} from './CurrentWorkBox';

// Mimics DispatchPage: currentJob drives selectedJobCourierId, and the box
// remounts when `layoutBump` changes (JobSearchShell keys boxes by layoutVersion).
function Harness() {
    const [currentJob, setCurrentJob] = useState<any>(undefined);
    const [layoutBump, setLayoutBump] = useState(0);
    return (
        <>
            <button onClick={() => setLayoutBump(n => n + 1)}>bump-layout</button>
            <CurrentWorkBox
                key={`currentwork-${layoutBump}`}
                showToast={jest.fn()}
                isUsCustomer
                selectedJobCourierId={currentJob?.courierData?.courierId}
                onJobSelect={setCurrentJob}
            />
        </>
    );
}

function renderHarness() {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <Harness />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

async function drillInto(name: string) {
    fireEvent.click(await screen.findByText(name));
    await screen.findByTestId('mock-job-list');
}
const backToAllDrivers = () => fireEvent.click(screen.getByRole('button', {name: /all drivers/i}));
const selectShownJob = () => fireEvent.click(screen.getByRole('button', {name: 'select-job'}));
const bumpLayout = () => fireEvent.click(screen.getByRole('button', {name: 'bump-layout'}));

describe('CurrentWorkBox — driver switch after search + drill-down', () => {
    beforeEach(() => sessionStorage.clear());

    it('A: search → drill Alice → back → drill Bob shows Bob', async () => {
        renderHarness();
        fireEvent.change(await screen.findByPlaceholderText(/search courier/i), {target: {value: 'Alice'}});
        await drillInto('Alice');
        expect(currentListCourierId).toBe(7);
        backToAllDrivers();
        await drillInto('Bob');
        await waitFor(() => expect(screen.getByTestId('mock-job-list')).toHaveAttribute('data-courier-id', '8'));
    });

    it('B: select Alice job → back → drill Bob keeps Bob (effect must not snap back)', async () => {
        renderHarness();
        await drillInto('Alice');
        selectShownJob(); // currentJob -> Alice, selectedJobCourierId = 7
        await waitFor(() => expect(screen.getByTestId('mock-job-list')).toHaveAttribute('data-courier-id', '7'));
        backToAllDrivers();
        await drillInto('Bob');
        await waitFor(() => expect(screen.getByTestId('mock-job-list')).toHaveAttribute('data-courier-id', '8'));
    });

    it('C: after picking Bob, a layout remount must not snap back to the selected job\'s driver', async () => {
        renderHarness();
        await drillInto('Alice');
        selectShownJob(); // selectedJobCourierId = 7 (Alice)
        backToAllDrivers();
        await drillInto('Bob'); // now viewing Bob (8); selectedJobCourierId still 7
        expect(screen.getByTestId('mock-job-list')).toHaveAttribute('data-courier-id', '8');
        bumpLayout(); // JobSearchShell-style remount of the box
        await waitFor(() => expect(screen.getByTestId('mock-job-list')).toHaveAttribute('data-courier-id', '8'));
    });
});
