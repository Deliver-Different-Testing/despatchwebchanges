import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverDetailsTab} from './DriverDetailsTab';
import {useDriverSearch, useCourierDetails} from '../../../hooks';
import type {CourierDataDashboard} from '../../../interfaces';

jest.mock('../../../hooks', () => ({
    useDriverSearch: jest.fn(),
    useCourierDetails: jest.fn(),
}));

const mockUseDriverSearch = useDriverSearch as jest.MockedFunction<typeof useDriverSearch>;
const mockUseCourierDetails = useCourierDetails as jest.MockedFunction<typeof useCourierDetails>;

const theme = createTheme();
const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderWithProviders = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <DriverDetailsTab showToast={showToast} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const mockDriverData: CourierDataDashboard = {
    courierId: 10,
    basicInformation: {code: 'JS001', firstName: 'John', surname: 'Smith', email: 'john@example.com', address: '123 Main St'},
    contactInformation: {mobile: '021-123-4567', home: '09-123-4567', gstNumber: '12-345-678', irdNumber: '12-345-678'},
    vehicleInformation: {rego: 'ABC123', vehicleYear: 2020, vehicleModel: 'Toyota Hiace', vehicleInsurance: 'Full Cover'},
    compliance: {dangerousGoods: true, dangerousGoodsExpiry: '2025-12-01', driversLicenceExpiry: '2026-06-15'},
    bankingAndEmergency: {emergencyContact: true, bank: 'ANZ', securityCheck: true},
    additionalInformation: {contactSignDate: '2023-01-15', mobileInsurence: 50, dailyProfitAdjust: 0, notes: 'Reliable driver'},
};

const setupMocks = (options: {driver?: CourierDataDashboard | undefined; isLoadingDetails?: boolean; searchResults?: any[]; isSearching?: boolean} = {}) => {
    mockUseDriverSearch.mockReturnValue({
        data: options.searchResults ?? [],
        isLoading: options.isSearching ?? false,
        isError: false,
        error: null,
    } as any);
    mockUseCourierDetails.mockReturnValue({
        data: options.driver,
        isLoading: options.isLoadingDetails ?? false,
        isError: false,
        error: null,
    } as any);
};

describe('DriverDetailsTab', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('Search section', () => {
        it('should render search input', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByLabelText('Select Driver')).toBeInTheDocument();
        });

        it('should render Driver Search header', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Driver Search')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty state when no driver is selected', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('No Driver Selected')).toBeInTheDocument();
            expect(screen.getByText('Please select a driver from the search box above to view their details')).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator when details are loading', () => {
            setupMocks({isLoadingDetails: true});
            renderWithProviders();

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
            expect(screen.queryByText('No Driver Selected')).not.toBeInTheDocument();
        });
    });

    describe('Driver details display', () => {
        it('should display basic information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Basic Information')).toBeInTheDocument();
            // JS001 appears in both summary bar and info card
            expect(screen.getAllByText('JS001')).toHaveLength(2);
            // john@example.com appears in summary bar chip and info row
            expect(screen.getAllByText('john@example.com')).toHaveLength(2);
        });

        it('should display contact information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Contact Information')).toBeInTheDocument();
            expect(screen.getByText('021-123-4567')).toBeInTheDocument();
        });

        it('should display vehicle information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Vehicle Information')).toBeInTheDocument();
            expect(screen.getByText('ABC123')).toBeInTheDocument();
            expect(screen.getByText('Toyota Hiace')).toBeInTheDocument();
        });

        it('should display compliance information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Compliance')).toBeInTheDocument();
        });

        it('should display banking and emergency information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Banking & Emergency')).toBeInTheDocument();
            expect(screen.getByText('ANZ')).toBeInTheDocument();
        });

        it('should display additional information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Additional Information')).toBeInTheDocument();
            expect(screen.getByText('Reliable driver')).toBeInTheDocument();
        });

        it('should not show empty state when driver is loaded', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.queryByText('No Driver Selected')).not.toBeInTheDocument();
        });
    });
});
