import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverManagementPage} from './DriverManagementPage';
import {useFleetOptions} from '../../hooks/useDriverManagementApi';

jest.mock('../../hooks/useDriverManagementApi', () => ({
    useFleetOptions: jest.fn(),
}));

// Mock child tabs to keep tests focused
jest.mock('./components/DriverDetailsTab', () => ({
    DriverDetailsTab: ({showToast}: any) => <div data-testid="driver-details-tab">DriverDetailsTab</div>,
}));
jest.mock('./components/TodayActiveTab', () => ({
    TodayActiveTab: ({showToast, fleetOptions}: any) => <div data-testid="today-active-tab">TodayActiveTab</div>,
}));
jest.mock('./components/DriverComplianceTab', () => ({
    DriverComplianceTab: ({showToast, fleetOptions}: any) => <div data-testid="compliance-tab">DriverComplianceTab</div>,
}));
jest.mock('./components/AfterHoursTab', () => ({
    AfterHoursTab: ({showToast}: any) => <div data-testid="after-hours-tab">AfterHoursTab</div>,
}));
jest.mock('./components/DriverEmailsTab', () => ({
    DriverEmailsTab: ({showToast}: any) => <div data-testid="emails-tab">DriverEmailsTab</div>,
}));
jest.mock('./components/DriverEarningsTab', () => ({
    DriverEarningsTab: ({showToast}: any) => <div data-testid="earnings-tab">DriverEarningsTab</div>,
}));

const mockUseFleetOptions = useFleetOptions as jest.MockedFunction<typeof useFleetOptions>;

const theme = createTheme();
const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderPage = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <DriverManagementPage showToast={showToast} />
            </ThemeProvider>
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

            expect(screen.getByText('Driver Details')).toBeInTheDocument();
            expect(screen.getByText("Today's Active")).toBeInTheDocument();
            expect(screen.getByText('Driver Compliance')).toBeInTheDocument();
            expect(screen.getByText('After Hours Schedule')).toBeInTheDocument();
            expect(screen.getByText('Driver Emails')).toBeInTheDocument();
            expect(screen.getByText('Driver Earnings')).toBeInTheDocument();
        });

        it('should show DriverDetailsTab by default', () => {
            renderPage();
            expect(screen.getByTestId('driver-details-tab')).toBeInTheDocument();
        });
    });

    describe('Tab switching', () => {
        it('should switch to TodayActive tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText("Today's Active"));

            expect(screen.getByTestId('today-active-tab')).toBeInTheDocument();
            expect(screen.queryByTestId('driver-details-tab')).not.toBeInTheDocument();
        });

        it('should switch to Compliance tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver Compliance'));

            expect(screen.getByTestId('compliance-tab')).toBeInTheDocument();
        });

        it('should switch to After Hours tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('After Hours Schedule'));

            expect(screen.getByTestId('after-hours-tab')).toBeInTheDocument();
        });

        it('should switch to Emails tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver Emails'));

            expect(screen.getByTestId('emails-tab')).toBeInTheDocument();
        });

        it('should switch to Earnings tab when clicked', () => {
            renderPage();

            fireEvent.click(screen.getByText('Driver Earnings'));

            expect(screen.getByTestId('earnings-tab')).toBeInTheDocument();
        });
    });
});
