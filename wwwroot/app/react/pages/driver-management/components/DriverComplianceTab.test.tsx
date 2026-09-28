/** @jest-environment jest-environment-jsdom */
/**
 * Optimised: read-only tests consolidated to reduce render count.
 */
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverComplianceTab} from './DriverComplianceTab';
import {CourierCompliancePaginated} from '../../../interfaces';
import {useComplianceList, useSendComplianceReminder, useSendBulkComplianceReminders} from '../../../hooks/useDriverManagementApi';

jest.mock('../../../hooks/useDriverManagementApi', () => ({
    useComplianceList: jest.fn(),
    useSendComplianceReminder: jest.fn(),
    useSendBulkComplianceReminders: jest.fn(),
}));

jest.mock('../../../services/driverManagementApi', () => ({
    driverManagementApi: {
        exportComplianceCsv: jest.fn(),
    },
}));

const mockUseComplianceList = useComplianceList as jest.MockedFunction<typeof useComplianceList>;
const mockUseSendComplianceReminder = useSendComplianceReminder as jest.MockedFunction<typeof useSendComplianceReminder>;
const mockUseSendBulkComplianceReminders = useSendBulkComplianceReminders as jest.MockedFunction<typeof useSendBulkComplianceReminders>;

const theme = createTheme();
const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderWithProviders = (showToast = jest.fn(), fleetOptions = [{id: 1, text: 'Fleet A'}]) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <DriverComplianceTab showToast={showToast} fleetOptions={fleetOptions} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

// Use a date 10 days ago for expired (within -30 day remindable window)
const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const createMockData = (): CourierCompliancePaginated => ({
    items: [
        {courierId: 10, code: 'JS001', name: 'John Smith', complianceType: "Driver's License", itemNumber: 'DL-12345', expiryDate: tenDaysAgo, status: 'Expired', daysUntilExpiry: '-10'},
        {courierId: 20, code: 'JD002', name: 'Jane Doe', complianceType: 'Insurance', itemNumber: 'INS-67890', expiryDate: '2099-06-15', status: 'Valid', daysUntilExpiry: '9999'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalExpired: 1,
    totalExpiringSoon: 0,
    totalValid: 1,
});

const setupMocks = (data?: CourierCompliancePaginated, isLoading = false) => {
    mockUseComplianceList.mockReturnValue({
        data: data ?? createMockData(),
        isLoading,
        isError: false,
        error: null,
    } as any);
    mockUseSendComplianceReminder.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
    mockUseSendBulkComplianceReminders.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
};

describe('DriverComplianceTab', () => {
    it('should render column headers and stats', () => {
        setupMocks();
        renderWithProviders();

        // Column headers
        expect(screen.getByText('Code')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        // 'Type' also appears as filter label
        expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Item/Number')).toBeInTheDocument();
        expect(screen.getByText('Expiry Date')).toBeInTheDocument();
        // 'Status' also appears as filter label
        expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Days Until Expiry')).toBeInTheDocument();

        // Stats: Expired
        expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1);

        // Stats: Expiring Soon
        expect(screen.getByText('Expiring Soon')).toBeInTheDocument();

        // Stats: Valid
        expect(screen.getAllByText('Valid').length).toBeGreaterThanOrEqual(1);

        // Stats: Total Drivers
        expect(screen.getByText('Total Drivers')).toBeInTheDocument();
    });

    it('should update orderBy when Name header is clicked', async () => {
        setupMocks();
        renderWithProviders();

        fireEvent.click(screen.getByText('Name'));

        await waitFor(() => {
            const lastCall = mockUseComplianceList.mock.calls[mockUseComplianceList.mock.calls.length - 1];
            expect(lastCall[0].orderBy).toBe('name');
        });
    });

    describe('Bulk reminders dialog', () => {
        it('should open dialog when Send Reminders button is clicked and there are remindable items', () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByRole('button', {name: /Send Reminders/}));

            expect(screen.getByText('Send Bulk Reminders')).toBeInTheDocument();
            expect(screen.getByText(/Send reminder emails to 1 driver/)).toBeInTheDocument();
        });

        it('should close dialog when Cancel is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByRole('button', {name: /Send Reminders/}));
            expect(screen.getByText('Send Bulk Reminders')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            await waitFor(() => {
                expect(screen.queryByText('Send Bulk Reminders')).not.toBeInTheDocument();
            });
        });
    });

    it('should show loading indicator when isLoading is true', () => {
        setupMocks(undefined, true);
        renderWithProviders();

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show empty message when no items', () => {
        setupMocks({
            items: [], total: 0, page: 1, pages: 0,
            totalExpired: 0, totalExpiringSoon: 0, totalValid: 0,
        });
        renderWithProviders();

        expect(screen.getByText('No Compliance Records')).toBeInTheDocument();
        expect(screen.getByText('No compliance records match your criteria.')).toBeInTheDocument();
    });
});
