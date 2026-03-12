/**
 * Tests for EditAddressDialog React component
 *
 * Uses React Query hooks - tests mock the hooks to control data flow.
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {EditAddressDialog, EditAddressDialogProps} from './EditAddressDialog';
import {EditAddressDialogViewModel, HereMapsLocationResult, HereMapsLookupResponse,} from '../../../interfaces';
import {useAddressSearch, useHereMapsApiKey} from '../../../hooks';
import {addressApi} from '../../../services/addressApi';

// Mock the React Query hooks
jest.mock('../../../hooks', () => ({
    useAddressSearch: jest.fn(),
    useHereMapsApiKey: jest.fn(),
}));

// Mock the addressApi
jest.mock('../../../services/addressApi', () => ({
    addressApi: {
        getLocationDetailsById: jest.fn(),
        fetchNearestAddress: jest.fn(),
    },
}));

const mockUseAddressSearch = useAddressSearch as jest.MockedFunction<typeof useAddressSearch>;
const mockUseHereMapsApiKey = useHereMapsApiKey as jest.MockedFunction<typeof useHereMapsApiKey>;
const mockAddressApi = addressApi as jest.Mocked<typeof addressApi>;

// Create a theme for testing
const theme = createTheme();

// Create a QueryClient for testing
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

// Helper to render component with theme and query client
function renderWithProviders(props: EditAddressDialogProps) {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <EditAddressDialog {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}

// Default props factory
function createDefaultProps(overrides?: Partial<EditAddressDialogProps>): EditAddressDialogProps {
    return {
        open: true,
        addressDetails: null,
        title: 'Edit Address',
        submitLabel: 'Save',
        showContactInfo: false,
        isUsTenant: true,
        onClose: jest.fn(),
        onSave: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

// Sample data
const sampleAddressResults: HereMapsLocationResult[] = [
    {
        title: '123 Main Street, New York, NY 10001',
        id: 'here:af:address:123',
        resultType: 'houseNumber',
        address: {
            label: '123 Main Street, New York, NY 10001',
            countryCode: 'USA',
            countryName: 'United States',
            stateCode: 'NY',
            state: 'New York',
            city: 'New York',
            street: 'Main Street',
            postalCode: '10001',
            houseNumber: '123',
        },
        position: {lat: 40.7128, lng: -74.006},
        access: [{lat: 40.7128, lng: -74.006}],
    },
    {
        title: '456 Broadway, New York, NY 10012',
        id: 'here:af:address:456',
        resultType: 'houseNumber',
        address: {
            label: '456 Broadway, New York, NY 10012',
            countryCode: 'USA',
            countryName: 'United States',
            stateCode: 'NY',
            state: 'New York',
            city: 'New York',
            street: 'Broadway',
            postalCode: '10012',
            houseNumber: '456',
        },
        position: {lat: 40.7223, lng: -73.9987},
        access: [{lat: 40.7223, lng: -73.9987}],
    },
];

const existingAddress: EditAddressDialogViewModel = {
    addressLine1: 'Empire State Building',
    addressLine2: 'Suite 100',
    addressLine3: '350',
    addressLine4: 'Fifth Avenue',
    addressLine5: 'New York',
    addressLine6: 'NY',
    addressLine7: '10118',
    addressLine8: 'Main entrance',
    latitude: 40.7484,
    longitude: -73.9857,
    fullAddress: 'Empire State Building, Suite 100, 350 Fifth Avenue, New York, NY 10118',
    stateAbbreviation: 'NY',
};

const existingAddressWithShipment: EditAddressDialogViewModel = {
    ...existingAddress,
    shipmentDetails: {
        contactName: 'John Doe',
        contactMobile: '555-123-4567',
        weight: 10,
        quantity: 2,
        length: 12,
        depth: 8,
        height: 6,
        jobNotes: 'Handle with care',
    },
};

const nzAddress: EditAddressDialogViewModel = {
    addressLine1: 'Sky Tower',
    addressLine2: 'Level 50',
    addressLine3: '1',
    addressLine4: 'Victoria Street West',
    addressLine5: 'Auckland CBD',
    addressLine6: 'Auckland',
    addressLine7: '1010',
    addressLine8: '',
    latitude: -36.8485,
    longitude: 174.7633,
    fullAddress: 'Sky Tower, Level 50, 1 Victoria Street West, Auckland CBD, Auckland 1010',
};

const sampleNzAddressResults: HereMapsLocationResult[] = [
    {
        title: '10 Queen Street, Auckland CBD, Auckland 1010',
        id: 'here:af:address:nz1',
        resultType: 'houseNumber',
        address: {
            label: '10 Queen Street, Auckland CBD, Auckland 1010',
            countryCode: 'NZL',
            countryName: 'New Zealand',
            district: 'Auckland CBD',
            city: 'Auckland',
            street: 'Queen Street',
            postalCode: '1010',
            houseNumber: '10',
        },
        position: {lat: -36.8485, lng: 174.7633},
        access: [{lat: -36.8485, lng: 174.7633}],
    },
];

const usLookupResponse: HereMapsLookupResponse = {
    title: '123 Main Street',
    id: 'here:af:address:123',
    address: {
        label: '123 Main Street, New York, NY 10001',
        countryCode: 'USA',
        countryName: 'United States',
        stateCode: 'NY',
        state: 'New York',
        city: 'New York',
        street: 'Main Street',
        postalCode: '10001',
        houseNumber: '123',
    },
    position: {lat: 40.7128, lng: -74.006},
};

const usLookupResponseWithStreetInfo: HereMapsLookupResponse = {
    ...usLookupResponse,
    streetInfo: [{
        baseName: 'Main',
        streetType: 'Street',
        streetTypePrecedes: false,
        prefix: 'North',
    }],
};

const nzLookupResponse: HereMapsLookupResponse = {
    title: 'Queen Street Building',
    id: 'here:af:address:nz1',
    address: {
        label: '10 Queen Street, Auckland CBD, Auckland 1010',
        countryCode: 'NZL',
        countryName: 'New Zealand',
        district: 'Auckland CBD',
        city: 'Auckland',
        street: 'Queen Street',
        postalCode: '1010',
        houseNumber: '10',
    },
    position: {lat: -36.8485, lng: 174.7633},
};

describe('EditAddressDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        mockUseAddressSearch.mockReturnValue({
            data: [],
            isFetching: false,
            error: null,
        } as any);

        mockUseHereMapsApiKey.mockReturnValue({
            data: undefined, // No API key means map won't initialize
            isLoading: false,
            error: null,
        } as any);

        mockAddressApi.getLocationDetailsById.mockResolvedValue({
            title: '123 Main Street',
            id: 'here:af:address:123',
            address: {
                label: '123 Main Street, New York, NY 10001',
                countryCode: 'USA',
                countryName: 'United States',
                stateCode: 'NY',
                city: 'New York',
                street: 'Main Street',
                postalCode: '10001',
                houseNumber: '123',
            },
            position: {lat: 40.7128, lng: -74.006},
        });
    });

    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const props = createDefaultProps({open: false});
            const {container} = renderWithProviders(props);
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders the dialog when open', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('displays the provided title', () => {
            const props = createDefaultProps({title: 'Update Delivery Address'});
            renderWithProviders(props);
            expect(screen.getByText('Update Delivery Address')).toBeInTheDocument();
        });

        it('displays the provided submit label', () => {
            const props = createDefaultProps({submitLabel: 'Update Address'});
            renderWithProviders(props);
            expect(screen.getByRole('button', {name: /Update Address/i})).toBeInTheDocument();
        });

        it('shows Address Lookup section', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Address Lookup')).toBeInTheDocument();
        });

        it('shows Address Details section', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Address Details')).toBeInTheDocument();
        });

        it('shows Location Preview section', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Location Preview')).toBeInTheDocument();
        });
    });

    describe('US Address Format', () => {
        it('shows US-specific field labels', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // City field for US
            const cityInputs = screen.getAllByLabelText(/City/);
            expect(cityInputs.length).toBeGreaterThan(0);

            // ZIP Code field
            expect(screen.getByLabelText(/ZIP Code/)).toBeInTheDocument();
        });

        it('shows Unit/Suite label for US tenant', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Unit\/Suite/)).toBeInTheDocument();
        });

        it('shows Country label for US tenant', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
        });

        it('shows state dropdown for US tenant', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // MUI Select uses InputLabel - find by label text
            const stateLabels = screen.getAllByText('State *');
            expect(stateLabels.length).toBeGreaterThan(0);
        });
    });

    describe('NZ Address Format', () => {
        it('shows NZ-specific field labels', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Suburb/)).toBeInTheDocument();
            expect(screen.getByLabelText(/City/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Post Code/)).toBeInTheDocument();
        });

        it('shows Unit/Flat/Suite label for NZ tenant', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Unit\/Flat\/Suite/)).toBeInTheDocument();
        });

        it('shows Country label for NZ tenant', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
        });
    });

    describe('Shipment Details Card', () => {
        it('does not show shipment details when showContactInfo is false', () => {
            const props = createDefaultProps({showContactInfo: false});
            renderWithProviders(props);

            expect(screen.queryByText('Shipment Details')).not.toBeInTheDocument();
        });

        it('shows shipment details when showContactInfo is true', () => {
            const props = createDefaultProps({showContactInfo: true});
            renderWithProviders(props);

            expect(screen.getByText('Shipment Details')).toBeInTheDocument();
        });

        it('shows contact fields in shipment details', () => {
            const props = createDefaultProps({showContactInfo: true});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Contact Name/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Contact Phone/)).toBeInTheDocument();
        });

        it('shows dimension fields with US units for US tenant', () => {
            const props = createDefaultProps({showContactInfo: true, isUsTenant: true});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Length \(in\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Width \(in\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Height \(in\)/)).toBeInTheDocument();
        });

        it('shows dimension fields with metric units for NZ tenant', () => {
            const props = createDefaultProps({showContactInfo: true, isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Weight \(kg\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Length \(cm\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Width \(cm\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Height \(cm\)/)).toBeInTheDocument();
        });

        it('can expand and collapse shipment details', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps({showContactInfo: true});
            renderWithProviders(props);

            // Initially expanded
            expect(screen.getByLabelText(/Contact Name/)).toBeVisible();

            // Click to collapse
            await user.click(screen.getByText('Shipment Details'));

            // Should collapse (contact name no longer visible)
            await waitFor(() => {
                expect(screen.queryByLabelText(/Contact Name/)).not.toBeVisible();
            });
        });
    });

    describe('Form Population with Existing Address', () => {
        it('populates form fields with existing address data', () => {
            const props = createDefaultProps({addressDetails: existingAddress});
            renderWithProviders(props);

            expect(screen.getByDisplayValue('Empire State Building')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument();
            expect(screen.getByDisplayValue('350')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Fifth Avenue')).toBeInTheDocument();
            expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
            expect(screen.getByDisplayValue('10118')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Main entrance')).toBeInTheDocument();
        });

        it('populates coordinates with existing data', () => {
            const props = createDefaultProps({addressDetails: existingAddress});
            renderWithProviders(props);

            expect(screen.getByDisplayValue('40.7484')).toBeInTheDocument();
            expect(screen.getByDisplayValue('-73.9857')).toBeInTheDocument();
        });

        it('populates shipment details with existing data', () => {
            const props = createDefaultProps({
                addressDetails: existingAddressWithShipment,
                showContactInfo: true,
            });
            renderWithProviders(props);

            expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
            expect(screen.getByDisplayValue('555-123-4567')).toBeInTheDocument();
            expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // weight
            expect(screen.getByDisplayValue('2')).toBeInTheDocument(); // quantity
            expect(screen.getByDisplayValue('Handle with care')).toBeInTheDocument();
        });

        it('populates NZ address correctly', () => {
            const props = createDefaultProps({
                addressDetails: nzAddress,
                isUsTenant: false,
            });
            renderWithProviders(props);

            expect(screen.getByDisplayValue('Sky Tower')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Victoria Street West')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Auckland CBD')).toBeInTheDocument(); // Suburb
            expect(screen.getByDisplayValue('Auckland')).toBeInTheDocument(); // City
            expect(screen.getByDisplayValue('1010')).toBeInTheDocument(); // Post Code
        });
    });

    describe('Address Search', () => {
        it('shows search results from hook', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);

            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123 Main');

            expect(await screen.findByText('123 Main Street, New York, NY 10001')).toBeInTheDocument();
        });

        it('shows loading state while searching', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: [],
                isFetching: true,
                error: null,
            } as any);

            const props = createDefaultProps();
            renderWithProviders(props);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('shows "Type at least 3 characters" message for short input', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, 'ab');
            await user.click(searchInput); // Focus to show dropdown

            // The placeholder text should indicate minimum characters
            expect(screen.getByPlaceholderText(/Type at least 3 characters/)).toBeInTheDocument();
        });
    });

    describe('Address Selection Field Population', () => {
        it('populates US form fields when selecting an address from search results', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponse);

            const user = userEvent.setup();
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // Open autocomplete and select an address
            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // Wait for async lookup to complete and fields to populate
            await waitFor(() => {
                expect(mockAddressApi.getLocationDetailsById).toHaveBeenCalledWith('here:af:address:123');
            });

            await waitFor(() => {
                expect((screen.getByLabelText(/Street Number/) as HTMLInputElement).value).toBe('123');
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('Main Street');
                expect((screen.getByLabelText(/ZIP Code/) as HTMLInputElement).value).toBe('10001');
            });

            // Company/Building is cleared when buildingName is not in the response
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');

            // Check coordinates
            expect((screen.getByLabelText(/Latitude/) as HTMLInputElement).value).toBe('40.7128');
            expect((screen.getByLabelText(/Longitude/) as HTMLInputElement).value).toBe('-74.006');
        });

        it('clears stale company name when selecting address without buildingName', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponse);

            const user = userEvent.setup();
            const props = createDefaultProps({
                isUsTenant: true,
                addressDetails: existingAddress, // Has 'Empire State Building' as addressLine1
            });
            renderWithProviders(props);

            // Verify company name is pre-populated
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Empire State Building');

            // Select a new address (without buildingName in the response)
            const searchInput = screen.getByLabelText(/Search Address/);
            await user.clear(searchInput);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // Company name should be cleared since the lookup has no buildingName
            // (prevents stale company names from pre-populated addresses persisting)
            await waitFor(() => {
                expect((screen.getByLabelText(/Street Number/) as HTMLInputElement).value).toBe('123');
            });
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
        });

        it('updates company name when selecting address with buildingName', async () => {
            const lookupWithBuilding: HereMapsLookupResponse = {
                ...usLookupResponse,
                mapReferences: {
                    pointAddress: {
                        addressId: 'addr-123',
                        buildingName: 'Freedom Tower',
                    },
                },
            };
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(lookupWithBuilding);

            const user = userEvent.setup();
            const props = createDefaultProps({
                isUsTenant: true,
                addressDetails: existingAddress, // Has 'Empire State Building'
            });
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.clear(searchInput);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // Company name should be updated to the buildingName from HERE
            await waitFor(() => {
                expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Freedom Tower');
            });
        });

        it('populates NZ form fields when selecting an address from search results', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleNzAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(nzLookupResponse);

            const user = userEvent.setup();
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '10 Queen');

            const option = await screen.findByRole('option', {
                name: /10 Queen Street, Auckland/,
            });
            await user.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Street Number/) as HTMLInputElement).value).toBe('10');
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('Queen Street');
                expect((screen.getByLabelText(/Suburb/) as HTMLInputElement).value).toBe('Auckland CBD');
                expect((screen.getByLabelText(/Post Code/) as HTMLInputElement).value).toBe('1010');
            });

            // Company/Building is cleared when buildingName is not in the response
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
        }, 30000);

        it('formats street name from streetInfo when available', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponseWithStreetInfo);

            const user = userEvent.setup();
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // streetInfo: prefix 'North' + baseName 'Main' + streetType 'Street' (not preceding)
            // Expected: 'North Main Street'
            await waitFor(() => {
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('North Main Street');
            });
        }, 30000);

        it('clears unit and notes fields when selecting an address', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponse);

            const user = userEvent.setup();
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // Pre-fill Unit/Suite (which handleAddressFieldsFromLookup clears)
            fireEvent.change(screen.getByLabelText(/Unit\/Suite/), {target: {value: 'Suite 200'}});
            expect((screen.getByLabelText(/Unit\/Suite/) as HTMLInputElement).value).toBe('Suite 200');

            // Select a new address
            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // Unit/Suite should be cleared by handleAddressFieldsFromLookup
            await waitFor(() => {
                expect((screen.getByLabelText(/Unit\/Suite/) as HTMLInputElement).value).toBe('');
            });

            // Country should be populated from the lookup response
            expect((screen.getByLabelText(/Country/) as HTMLInputElement).value).toBe('United States');
        });

        it('shows error toast when address lookup fails', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockRejectedValue(new Error('Network error'));

            const user = userEvent.setup();
            const showToast = jest.fn();
            const props = createDefaultProps({showToast});
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Error processing selected address.', 'error');
            });
        });

        it('uses basic coordinates when detailed lookup returns null', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(null as any);

            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            await user.type(searchInput, '123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            await user.click(option);

            // Should fall back to basic position from the search result
            await waitFor(() => {
                expect((screen.getByLabelText(/Latitude/) as HTMLInputElement).value).toBe('40.7128');
                expect((screen.getByLabelText(/Longitude/) as HTMLInputElement).value).toBe('-74.006');
            });

            // Form fields should NOT be populated (no detailed lookup)
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
        });
    });

    describe('Form Validation', () => {
        it('shows error for missing city', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            // Fill in other required fields but leave city empty
            fireEvent.change(screen.getByLabelText(/Street Name/), {target: {value: 'Main Street'}});
            fireEvent.change(screen.getByLabelText(/ZIP Code/), {target: {value: '10001'}});

            await user.click(screen.getByRole('button', {name: /Save/i}));

            expect(await screen.findByText(/City is required/)).toBeInTheDocument();
        });

        it('shows error for missing street name', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            // Fill in other required fields but leave street name empty
            fireEvent.change(screen.getByLabelText(/Company\/Building\/Complex/), {target: {value: 'Test Building'}});
            fireEvent.change(screen.getByLabelText(/City/), {target: {value: 'New York'}});
            fireEvent.change(screen.getByLabelText(/ZIP Code/), {target: {value: '10001'}});

            await user.click(screen.getByRole('button', {name: /Save/i}));

            expect(await screen.findByText(/Street name is required/)).toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose when cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({onClose});
            renderWithProviders(props);

            await user.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when close icon is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({onClose});
            renderWithProviders(props);

            // Find and click the close icon button in the header
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('svg[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await user.click(closeIconButton);
                expect(onClose).toHaveBeenCalled();
            }
        });

        it('calls onSave with address data when form is valid', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createDefaultProps({
                addressDetails: existingAddress,
                onSave,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    expect.objectContaining({
                        addressLine1: 'Empire State Building',
                        addressLine4: 'Fifth Avenue',
                        addressLine5: 'New York',
                        latitude: 40.7484,
                        longitude: -73.9857,
                    })
                );
            });
        });

        it('includes shipment details in save when showContactInfo is true', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createDefaultProps({
                addressDetails: existingAddressWithShipment,
                showContactInfo: true,
                onSave,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    expect.objectContaining({
                        shipmentDetails: expect.objectContaining({
                            contactName: 'John Doe',
                            contactMobile: '555-123-4567',
                            weight: 10,
                        }),
                    })
                );
            });
        });
    });

    describe('Form Input Changes', () => {
        it('allows changing company/building field', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const input = screen.getByLabelText(/Company\/Building\/Complex/);
            fireEvent.change(input, {target: {value: 'New Building Name'}});

            expect((input as HTMLInputElement).value).toBe('New Building Name');
        });

        it('allows changing street number', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const input = screen.getByLabelText(/Street Number/);
            fireEvent.change(input, {target: {value: '999'}});

            expect((input as HTMLInputElement).value).toBe('999');
        });

        it('allows changing latitude', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const input = screen.getByLabelText(/Latitude/);
            fireEvent.change(input, {target: {value: '41.8781'}});

            expect((input as HTMLInputElement).value).toBe('41.8781');
        });

        it('allows changing longitude', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const input = screen.getByLabelText(/Longitude/);
            fireEvent.change(input, {target: {value: '-87.6298'}});

            expect((input as HTMLInputElement).value).toBe('-87.6298');
        });
    });

    describe('State Selection (US)', () => {
        it('shows state selection for US tenant', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // Verify state label is present for US tenant
            const stateLabels = screen.getAllByText('State *');
            expect(stateLabels.length).toBeGreaterThan(0);
        });

        it('does not show state selection for NZ tenant', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            // State field should not be present for NZ tenant
            expect(screen.queryAllByText('State *')).toHaveLength(0);
        });
    });

    describe('New Address (empty form)', () => {
        it('starts with empty form fields for new address', () => {
            const props = createDefaultProps({addressDetails: null});
            renderWithProviders(props);

            const companyInput = screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement;
            const streetInput = screen.getByLabelText(/Street Name/) as HTMLInputElement;

            expect(companyInput.value).toBe('');
            expect(streetInput.value).toBe('');
        });

        it('has empty coordinates for new address', () => {
            const props = createDefaultProps({addressDetails: null});
            renderWithProviders(props);

            const latInput = screen.getByLabelText(/Latitude/) as HTMLInputElement;
            const lngInput = screen.getByLabelText(/Longitude/) as HTMLInputElement;

            expect(latInput.value).toBe('');
            expect(lngInput.value).toBe('');
        });
    });
});
