import type {MockedFunction} from 'vitest';
import React from 'react';
import {MantineTestProvider} from '../../test/utils';
import {fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverManagementPage} from './DriverManagementPage';
import {useFleetOptions} from '../../hooks/useDriverManagementApi';

vi.mock('../../hooks/useDriverManagementApi', () => ({
    useFleetOptions: vi.fn(),
}));

// Mock child tabs to keep tests focused
vi.mock('./components/DriverDetailsTab', () => ({
    DriverDetailsTab: ({showToast}: any) => <div data-testid="driver-details-tab">DriverDetailsTab</div>,
}));
vi.mock('./components/TodayActiveTab', () => ({
    TodayActiveTab: ({showToast, fleetOptions}: any) => <div data-testid="today-active-tab">TodayActiveTab</div>,
}));
vi.mock('./components/DriverComplianceTab', () => ({
    DriverComplianceTab: ({showToast, fleetOptions}: any) => <div data-testid="compliance-tab">DriverComplianceTab</div>,
}));
vi.mock('./components/AfterHoursTab', () => ({
    AfterHoursTab: ({showToast}: any) => <div data-testid="after-hours-tab">AfterHoursTab</div>,
}));
vi.mock('./components/DriverEmailsTab', () => ({
    DriverEmailsTab: ({showToast}: any) => <div data-testid="emails-tab">DriverEmailsTab</div>,
}));
vi.mock('./components/DriverEarningsTab', () => ({
    DriverEarningsTab: ({showToast}: any) => <div data-testid="earnings-tab">DriverEarningsTab</div>,
}));

const mockUseFleetOptions = useFleetOptions as MockedFunction<typeof useFleetOptions>;

const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderPage = (showToast = vi.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverManagementPage showToast={showToast} />
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

describe('DriverManagementPage', () => {
    beforeEach(() => {
        localStorage.clear();
        mockUseFleetOptions.mockReturnValue({data: [{id: 1, text: 'Fleet A'}], isLoading: false, isError: false, error: null} as any);
    });

    describe('Tab rendering', () => {
        it('should render all 6 tab labels', () => {
            renderPage();

            expect(screen.getByText('Driver details')).toBeInTheDocument();
            expect(screen.getByText("Today's active")).toBeInTheDocument();
            expect(screen.getByText('Driver compliance')).toBeInTheDocument();
            expect(screen.getByText('After hours schedule')).toBeInTheDocument();
            expect(screen.getByText('Driver emails')).toBeInTheDocument();
            expect(screen.getByText('Driver earnings')).toBeInTheDocument();
        });

        it('should show DriverDetailsTab by default', () => {
            renderPage();
            expect(screen.getByTestId('driver-details-tab')).toBeInTheDocument();
        });
    });

    describe('Fleet options', () => {
        it('shows a retryable notice when the fleet options fail to load', () => {
            const refetch = vi.fn();
            mockUseFleetOptions.mockReturnValue({data: undefined, isLoading: false, isError: true, error: null, refetch} as any);
            renderPage();

            expect(screen.getByRole('alert')).toHaveTextContent('fleet filter is unavailable');
            fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
            expect(refetch).toHaveBeenCalled();
        });
    });

    describe('Tab switching', () => {
        it('should switch to TodayActive tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText("Today's active"));

            expect(screen.getByTestId('today-active-tab')).toBeInTheDocument();
            expect(screen.queryByTestId('driver-details-tab')).not.toBeInTheDocument();
        });

        it('should switch to Compliance tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver compliance'));

            expect(screen.getByTestId('compliance-tab')).toBeInTheDocument();
        });

        it('should switch to After Hours tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('After hours schedule'));

            expect(screen.getByTestId('after-hours-tab')).toBeInTheDocument();
        });

        it('should switch to Emails tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver emails'));

            expect(screen.getByTestId('emails-tab')).toBeInTheDocument();
        });

        it('should switch to Earnings tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver earnings'));

            expect(screen.getByTestId('earnings-tab')).toBeInTheDocument();
        });
    });
});
