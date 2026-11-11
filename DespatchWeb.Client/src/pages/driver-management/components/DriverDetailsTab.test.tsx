import type {MockedFunction} from 'vitest';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../test/utils';
import {createTestQueryClient} from '../../../test/utils';
import {setupUser} from '../../../test/utils/setupUser';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverDetailsTab} from './DriverDetailsTab';
import {useDriverSearch, useCourierDetails} from '../../../hooks/useDriverManagementApi';
import type {CourierDataDashboard} from '../../../types';

vi.mock('../../../hooks/useDriverManagementApi', () => ({
    useDriverSearch: vi.fn(),
    useCourierDetails: vi.fn(),
}));

const mockUseDriverSearch = useDriverSearch as MockedFunction<typeof useDriverSearch>;
const mockUseCourierDetails = useCourierDetails as MockedFunction<typeof useCourierDetails>;

const renderWithProviders = () => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverDetailsTab />
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

const mockDriverData: CourierDataDashboard = {
    courierId: 10,
    basicInformation: {code: 'JS001', firstName: 'John', surname: 'Smith', email: 'john@example.com', address: '123 Main St'},
    contactInformation: {mobile: '021-123-4567', home: '09-123-4567', gstNumber: '12-345-678', irdNumber: '12-345-678'},
    vehicleInformation: {rego: 'ABC123', vehicleYear: 2020, vehicleModel: 'Toyota Hiace', vehicleInsurance: 'Full Cover'},
    compliance: {dangerousGoods: true, dangerousGoodsExpiry: '2025-12-01', driversLicenceExpiry: '2026-06-15', wofExpiry: '2026-03-10', registrationExpiry: '2026-04-20'},
    bankingAndEmergency: {emergencyContact: true, bank: 'ANZ', securityCheck: true, emergencyContactName: 'Mary Smith', emergencyContactPhone: '021-555-0000', emergencyContactRelationship: 'Spouse', securityCheckDate: '2024-03-01'},
    additionalInformation: {contactSignDate: '2023-01-15', mobileInsurence: 50, notes: 'Reliable driver'},
};

const refetchDetails = vi.fn();
const refetchSearch = vi.fn();

const setupMocks = (options: {driver?: CourierDataDashboard | undefined; isLoadingDetails?: boolean; searchResults?: any[]; isSearching?: boolean; detailsError?: boolean; searchError?: boolean} = {}) => {
    mockUseDriverSearch.mockReturnValue({
        data: options.searchResults ?? [],
        isLoading: options.isSearching ?? false,
        isError: options.searchError ?? false,
        error: null,
        refetch: refetchSearch,
    } as any);
    mockUseCourierDetails.mockReturnValue({
        data: options.driver,
        isLoading: options.isLoadingDetails ?? false,
        isError: options.detailsError ?? false,
        error: null,
        refetch: refetchDetails,
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

        it('collapses duplicate driver names from the search result instead of crashing', async () => {
            setupMocks({
                searchResults: [
                    {id: 1, text: 'John Smith'},
                    {id: 2, text: 'John Smith'},
                ],
            });
            const user = setupUser();
            renderWithProviders();

            await user.click(screen.getByRole('combobox', {name: 'Select driver'}));
            const matches = await screen.findAllByText('John Smith');
            expect(matches).toHaveLength(1);
        });
    });

    describe('Error states', () => {
        it('shows a retryable error when the details fail to load', () => {
            setupMocks({detailsError: true});
            renderWithProviders();

            expect(screen.getByText("Couldn't load driver details")).toBeInTheDocument();
            expect(screen.queryByText('No driver selected')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
            expect(refetchDetails).toHaveBeenCalled();
        });

        it('shows a retryable error when the driver search fails', () => {
            setupMocks({searchError: true});
            renderWithProviders();

            fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
            expect(refetchSearch).toHaveBeenCalled();
        });

        it('only shows the no-match hint once a search of 2+ characters ran', async () => {
            setupMocks();
            const user = setupUser();
            renderWithProviders();

            await user.type(screen.getByRole('combobox', {name: 'Select driver'}), 'j');
            expect(screen.queryByText(/No drivers match that search/)).not.toBeInTheDocument();
            await user.type(screen.getByRole('combobox', {name: 'Select driver'}), 'o');
            expect(screen.getByText(/No drivers match that search/)).toBeInTheDocument();
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

            expect(screen.getByText('Basic information')).toBeInTheDocument();
            // The summary bar is a PanelHeader now, so the code is part of its
            // single title line rather than a chip of its own.
            expect(screen.getAllByText(/JS001/).length).toBeGreaterThan(0);
            // Once in the summary badge, once in the info row.
            expect(screen.getAllByText('john@example.com')).toHaveLength(2);
        });

        it('should display contact information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Contact information')).toBeInTheDocument();
            expect(screen.getByText('021-123-4567')).toBeInTheDocument();
        });

        it('should display vehicle information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Vehicle information')).toBeInTheDocument();
            expect(screen.getByText('ABC123')).toBeInTheDocument();
            expect(screen.getByText('Toyota Hiace')).toBeInTheDocument();
        });

        it('should display compliance information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Compliance')).toBeInTheDocument();
            expect(screen.getByText('WOF expiry')).toBeInTheDocument();
            expect(screen.getByText('10/03/2026')).toBeInTheDocument();
            expect(screen.getByText('Registration expiry')).toBeInTheDocument();
            expect(screen.getByText('20/04/2026')).toBeInTheDocument();
        });

        it('should display banking and emergency information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Banking & emergency')).toBeInTheDocument();
            expect(screen.getByText('ANZ')).toBeInTheDocument();
            expect(screen.getByText('Mary Smith')).toBeInTheDocument();
            expect(screen.getByText('021-555-0000')).toBeInTheDocument();
            expect(screen.getByText('Spouse')).toBeInTheDocument();
            expect(screen.getByText('Security check date')).toBeInTheDocument();
            expect(screen.getByText('01/03/2024')).toBeInTheDocument();
        });

        it('should display additional information', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.getByText('Additional information')).toBeInTheDocument();
            expect(screen.getByText('Reliable driver')).toBeInTheDocument();
            expect(screen.queryByText('Daily profit adjust')).not.toBeInTheDocument();
        });

        it('should not show empty state when driver is loaded', () => {
            setupMocks({driver: mockDriverData});
            renderWithProviders();

            expect(screen.queryByText('No driver selected')).not.toBeInTheDocument();
        });
    });
});
