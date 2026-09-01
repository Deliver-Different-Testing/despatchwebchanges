import React from 'react';
import {render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {createTestQueryClient} from '../../../__testUtils__';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverDetailsTab} from './DriverDetailsTab';
import {useDriverSearch, useCourierDetails} from '../../../hooks/useDriverManagementApi';
import type {CourierDataDashboard} from '../../../interfaces';

jest.mock('../../../hooks/useDriverManagementApi', () => ({
    useDriverSearch: jest.fn(),
    useCourierDetails: jest.fn(),
}));

const mockUseDriverSearch = useDriverSearch as jest.MockedFunction<typeof useDriverSearch>;
const mockUseCourierDetails = useCourierDetails as jest.MockedFunction<typeof useCourierDetails>;

const renderWithProviders = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverDetailsTab showToast={showToast} />
            </MantineTestProvider>
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
    describe('Search section', () => {
        it('should render search input', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByRole('combobox', {name: 'Select driver'})).toBeInTheDocument();
        });

        it('should render Driver Search header', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Driver search')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty state when no driver is selected', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('No driver selected')).toBeInTheDocument();
            expect(screen.getByText("Search above to see a driver's details.")).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator when details are loading', () => {
            setupMocks({isLoadingDetails: true});
            renderWithProviders();

            expect(screen.getByLabelText('Loading driver details')).toBeInTheDocument();
            expect(screen.queryByText('No driver selected')).not.toBeInTheDocument();
        });
    });

    describe('Driver details display', () => {
        it('should display basic information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Basic Information')).toBeInTheDocument();
            // The summary bar is a PanelHeader now, so the code is part of its
            // single title line rather than a chip of its own.
            expect(screen.getAllByText(/JS001/).length).toBeGreaterThan(0);
            // Once in the summary badge, once in the info row.
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

            expect(screen.queryByText('No driver selected')).not.toBeInTheDocument();
        });
    });
});
