/**
 * Tests for the Recurring Log panel.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen, waitFor} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {RecurringDeliveryJourney} from './RecurringDeliveryJourney';
import type {RecurringJourney} from './RecurringDeliveryJourney.types';

jest.mock('../../../utils/dateUtils', () => ({
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => 'EST'),
}));

const mockGetDeliveryJourney = jest.fn();
jest.mock('../../../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        getDeliveryJourney: (...args: unknown[]) => mockGetDeliveryJourney(...args),
    },
}));

const mockOpenJobInSearch = jest.fn();
jest.mock('../../../services/navigationService', () => ({
    openJobInSearch: (...args: unknown[]) => mockOpenJobInSearch(...args),
}));


function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0, staleTime: 0},
            mutations: {retry: false},
        },
    });
}

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>{ui}</MantineTestProvider>
        </QueryClientProvider>,
    );
};

const mockJourney = (): RecurringJourney => ({
    breakdown: {total: 3, completed: 1, voided: 0, pending: 2},
    runs: [
        {
            parentJobId: 3967,
            parentJobNumber: 'KT413VANS',
            serviceDate: dayjs('2025-10-31T20:20:00'),
            status: 'Completed',
            miles: 9,
            pod: {time: dayjs('2026-03-25T01:46:13'), signedBy: 'Test POD'},
            children: [],
        },
        {
            parentJobId: 3966,
            parentJobNumber: 'KT412VANS',
            serviceDate: dayjs('2025-10-30T20:20:00'),
            status: 'Pending',
            miles: 9,
            pod: null,
            children: [
                {jobId: 29481, jobNumber: 'KT412VANSA'},
                {jobId: 29482, jobNumber: 'KT412VANSB'},
            ],
        },
        {
            parentJobId: 3965,
            parentJobNumber: 'KT411VANS',
            serviceDate: dayjs('2025-10-29T20:20:00'),
            status: 'InProgress',
            miles: 9,
            pod: null,
            children: [],
        },
    ],
});

describe('RecurringDeliveryJourney', () => {
    beforeEach(() => {
        mockGetDeliveryJourney.mockResolvedValue(mockJourney());
        mockOpenJobInSearch.mockReset();
    });

    afterEach(() => {
        mockGetDeliveryJourney.mockReset();
    });

    it('renders the empty state when bookingId is null', () => {
        renderWithProviders(<RecurringDeliveryJourney bookingId={null} />);

        expect(screen.getByText('Recurring Log')).toBeInTheDocument();
        expect(screen.getByText('Select a recurring job to see its run history.')).toBeInTheDocument();
    });

    it('renders runs, child chips, breakdown counts, and the RECURRING badge', async () => {
        renderWithProviders(<RecurringDeliveryJourney bookingId={108} />);

        // Header badge + label
        expect(screen.getByText('Recurring Log')).toBeInTheDocument();
        expect(screen.getByText('RECURRING')).toBeInTheDocument();

        // Parent chips render as clickable role=button
        expect(await screen.findByRole('button', {name: 'KT413VANS'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'KT412VANS'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'KT411VANS'})).toBeInTheDocument();

        // Child chips appear under their parent
        expect(screen.getByRole('button', {name: 'KT412VANSA'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'KT412VANSB'})).toBeInTheDocument();

        // Breakdown labels (Completed/Pending also appear in run status meta —
        // use *AllByText* so the assertion just confirms the label is present).
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
        expect(screen.getByText('Voided')).toBeInTheDocument();
        expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);

        // POD signature
        expect(screen.getByText('Test POD')).toBeInTheDocument();

        // Latest-run line in the footer references the newest run
        expect(screen.getByText(/Latest run/)).toBeInTheDocument();
    });

    it('opens confirm dialog then calls openJobInSearch when parent chip clicked', async () => {
        const user = setupUser();
        renderWithProviders(<RecurringDeliveryJourney bookingId={108} />);

        const parentChip = await screen.findByRole('button', {name: 'KT413VANS'});
        await user.click(parentChip);

        // Confirm dialog visible (heading text)
        expect(await screen.findByText('Open job KT413VANS')).toBeInTheDocument();

        const openButton = screen.getByRole('button', {name: /open job/i});
        await user.click(openButton);

        expect(mockOpenJobInSearch).toHaveBeenCalledWith(3967);

        // Dialog dismissed
        await waitFor(() => {
            expect(screen.queryByText('Open job KT413VANS')).not.toBeInTheDocument();
        });
    });

    it('cancels without calling openJobInSearch', async () => {
        const user = setupUser();
        renderWithProviders(<RecurringDeliveryJourney bookingId={108} />);

        const childChip = await screen.findByRole('button', {name: 'KT412VANSA'});
        await user.click(childChip);

        expect(await screen.findByText('Open job KT412VANSA')).toBeInTheDocument();

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await user.click(cancelButton);

        expect(mockOpenJobInSearch).not.toHaveBeenCalled();
    });

    it('renders the empty-runs state when API returns no runs', async () => {
        mockGetDeliveryJourney.mockResolvedValue({
            breakdown: {total: 0, completed: 0, voided: 0, pending: 0},
            runs: [],
        });

        renderWithProviders(<RecurringDeliveryJourney bookingId={108} />);

        expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
    });
});
