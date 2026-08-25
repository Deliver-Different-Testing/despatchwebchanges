/**
 * Tests for EditAddressDialog React component
 *
 * Uses React Query hooks - tests mock the hooks to control data flow.
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {EditAddressDialog, EditAddressDialogProps} from './EditAddressDialog';
import {EditAddressDialogViewModel, HereMapsLocationResult, HereMapsLookupResponse,} from '../../../interfaces';
import {useAddressSearch, useHereMapsApiKey} from '../../../hooks/useAddressApi';
import {addressApi} from '../../../services/addressApi';
import {suppressConsoleError} from '../../../__testUtils__';
import {HERE_US_ADDRESS_FIELDS} from '../../../__testUtils__/mockData';

// Mock the React Query hooks
jest.mock('../../../hooks/useAddressApi', () => ({
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

// MUI <Select> renders the trigger as a div[role="combobox"] (vs MUI Autocomplete's
// input[role="combobox"]). The State Select has no explicit labelId, so we locate
// it by walking up from its visible "State *" label to the enclosing FormControl
// and then querying the combobox role within that subtree.
function getStateSelect(): HTMLElement {
    const label = screen.getAllByText('State *').find((el) => el.tagName === 'LABEL');
    if (!label) throw new Error('State * label not found');
    const formControl = label.closest('.MuiFormControl-root');
    if (!formControl) throw new Error('FormControl not found for State select');
    const combobox = formControl.querySelector('[role="combobox"]');
    if (!combobox) throw new Error('combobox not found within State FormControl');
    return combobox as HTMLElement;
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
        address: {...HERE_US_ADDRESS_FIELDS},
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
    resultType: 'houseNumber',
    address: {...HERE_US_ADDRESS_FIELDS},
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
};

/** Focus the search box and type — the first two steps of every suggestion test. */
function typeAddressSearch(value: string) {
    const searchInput = screen.getByLabelText(/Search Address/);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, {target: {value}});
    return searchInput;
}

describe('EditAddressDialog', () => {
    beforeEach(() => {
        mockUseAddressSearch.mockReturnValue({
            data: [],
            isFetching: false,
            error: null,
        } as any);

        mockUseHereMapsApiKey.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: null,
        } as any);

        mockAddressApi.getLocationDetailsById.mockResolvedValue({
            title: '123 Main Street',
            id: 'here:af:address:123',
            resultType: 'houseNumber',
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

    describe('Read-only mode', () => {
        it('hides Save, shows Close, disables inputs and shows the view-only subtitle', () => {
            renderWithProviders(createDefaultProps({readOnly: true, addressDetails: existingAddress}));

            expect(screen.getByText('View only — this job is locked')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /Save/i})).not.toBeInTheDocument();

            const textboxes = screen.getAllByRole('textbox');
            expect(textboxes.length).toBeGreaterThan(0);
            textboxes.forEach((tb) => expect(tb).toBeDisabled());
        });
    });

    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const props = createDefaultProps({open: false});
            renderWithProviders(props);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders dialog with title, submit label, and all sections', () => {
            const props = createDefaultProps({title: 'Update Delivery Address', submitLabel: 'Update Address'});
            renderWithProviders(props);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Update Delivery Address')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Update Address/i})).toBeInTheDocument();
            expect(screen.getByText('Address Lookup')).toBeInTheDocument();
            expect(screen.getByText('Address Details')).toBeInTheDocument();
            expect(screen.getByText('Location Preview')).toBeInTheDocument();
        });
    });

    describe('Address Format', () => {
        it('shows US-specific fields (City, ZIP, Unit/Suite, Country, State)', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            const cityInputs = screen.getAllByLabelText(/City/);
            expect(cityInputs.length).toBeGreaterThan(0);
            expect(screen.getByLabelText(/ZIP Code/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Unit\/Suite/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
            const stateLabels = screen.getAllByText('State *');
            expect(stateLabels.length).toBeGreaterThan(0);
        });

        it('shows NZ-specific fields (Suburb, City, Post Code, Unit/Flat/Suite, Country)', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Suburb/)).toBeInTheDocument();
            expect(screen.getByLabelText(/City/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Post Code/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Unit\/Flat\/Suite/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
        });
    });

    describe('Shipment Details Card', () => {
        it('does not show shipment details when showContactInfo is false', () => {
            const props = createDefaultProps({showContactInfo: false});
            renderWithProviders(props);
            expect(screen.queryByText('Shipment Details')).not.toBeInTheDocument();
        });

        it('shows section with contacts, US dimensions, and supports expand/collapse', async () => {
            const props = createDefaultProps({showContactInfo: true, isUsTenant: true});
            renderWithProviders(props);

            // Section visible
            expect(screen.getByText('Shipment Details')).toBeInTheDocument();

            // Contact fields
            expect(screen.getByLabelText(/Contact Name/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Contact Phone/)).toBeInTheDocument();

            // US dimension fields
            expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Length \(in\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Width \(in\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Height \(in\)/)).toBeInTheDocument();

            // Initially expanded
            expect(screen.getByLabelText(/Contact Name/)).toBeVisible();

            // Click to collapse
            fireEvent.click(screen.getByText('Shipment Details'));
            await waitFor(() => {
                expect(screen.queryByLabelText(/Contact Name/)).not.toBeVisible();
            });
        });

        it('shows metric dimensions for NZ tenant', () => {
            const props = createDefaultProps({showContactInfo: true, isUsTenant: false});
            renderWithProviders(props);

            expect(screen.getByLabelText(/Weight \(kg\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Length \(cm\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Width \(cm\)/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Height \(cm\)/)).toBeInTheDocument();
        });
    });

    describe('Form Population with Existing Address', () => {
        it('populates US address fields and coordinates with existing data', () => {
            const props = createDefaultProps({addressDetails: existingAddress});
            renderWithProviders(props);

            // Address fields
            expect(screen.getByDisplayValue('Empire State Building')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument();
            expect(screen.getByDisplayValue('350')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Fifth Avenue')).toBeInTheDocument();
            expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
            expect(screen.getByDisplayValue('10118')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Main entrance')).toBeInTheDocument();

            // Coordinates
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
            expect(screen.getByDisplayValue('10')).toBeInTheDocument();
            expect(screen.getByDisplayValue('2')).toBeInTheDocument();
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
            expect(screen.getByDisplayValue('Auckland CBD')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Auckland')).toBeInTheDocument();
            expect(screen.getByDisplayValue('1010')).toBeInTheDocument();
        });
    });

    describe('Address Search', () => {
        it('shows search results from hook', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);

            const props = createDefaultProps();
            renderWithProviders(props);

            typeAddressSearch('123 Main');

            expect(await screen.findByText('123 Main Street, New York, NY 10001')).toBeInTheDocument();
        });

        it('shows loading state while searching', () => {
            mockUseAddressSearch.mockReturnValue({
                data: [],
                isFetching: true,
                error: null,
            } as any);

            const props = createDefaultProps();
            renderWithProviders(props);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('shows "Type at least 3 characters" message for short input', () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            typeAddressSearch('ab');

            expect(screen.getByPlaceholderText(/Type at least 3 characters/)).toBeInTheDocument();
        });
    });

    describe('Address Selection Field Population', () => {
        let errorSpy: jest.SpyInstance;
        beforeEach(() => { errorSpy = suppressConsoleError('[EditAddressDialog] Error processing selected address'); });
        afterEach(() => { errorSpy.mockRestore(); });

        it('populates US fields, coordinates, clears unit/notes, and sets country when selecting address', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponse);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // Pre-fill Unit/Suite to verify it gets cleared
            fireEvent.change(screen.getByLabelText(/Unit\/Suite/), {target: {value: 'Suite 200'}});
            expect((screen.getByLabelText(/Unit\/Suite/) as HTMLInputElement).value).toBe('Suite 200');

            // Select address
            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect(mockAddressApi.getLocationDetailsById).toHaveBeenCalledWith('here:af:address:123');
            });

            // Form fields populated
            await waitFor(() => {
                expect((screen.getByLabelText(/Street Number/) as HTMLInputElement).value).toBe('123');
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('Main Street');
                expect((screen.getByLabelText(/ZIP Code/) as HTMLInputElement).value).toBe('10001');
            });

            // Company cleared (no buildingName in response)
            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');

            // Coordinates
            expect((screen.getByLabelText(/Latitude/) as HTMLInputElement).value).toBe('40.7128');
            expect((screen.getByLabelText(/Longitude/) as HTMLInputElement).value).toBe('-74.006');

            // Unit/Suite cleared
            expect((screen.getByLabelText(/Unit\/Suite/) as HTMLInputElement).value).toBe('');

            // Country populated
            expect((screen.getByLabelText(/Country/) as HTMLInputElement).value).toBe('United States');
        });

        it('clears stale company name when selecting houseNumber result without buildingName', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponse);

            const props = createDefaultProps({
                isUsTenant: true,
                addressDetails: existingAddress,
            });
            renderWithProviders(props);

            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Empire State Building');

            const searchInput = screen.getByLabelText(/Search Address/);
            fireEvent.change(searchInput, {target: {value: ''}});
            fireEvent.focus(searchInput);
            fireEvent.change(searchInput, {target: {value: '123'}});

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

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

            const props = createDefaultProps({
                isUsTenant: true,
                addressDetails: existingAddress,
            });
            renderWithProviders(props);

            const searchInput = screen.getByLabelText(/Search Address/);
            fireEvent.change(searchInput, {target: {value: ''}});
            fireEvent.focus(searchInput);
            fireEvent.change(searchInput, {target: {value: '123'}});

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Freedom Tower');
            });
        });

        it('uses title as company name when resultType is place', async () => {
            const placeLookupResponse: HereMapsLookupResponse = {
                title: 'Starbucks Coffee',
                id: 'here:af:place:abc',
                resultType: 'place',
                address: {...HERE_US_ADDRESS_FIELDS},
                position: {lat: 40.7128, lng: -74.006},
            };
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(placeLookupResponse);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Starbucks Coffee');
            });
        });

        it('prefers buildingName over title even for place results', async () => {
            const placeWithBuildingName: HereMapsLookupResponse = {
                title: 'Starbucks Coffee',
                id: 'here:af:place:abc',
                resultType: 'place',
                address: {...HERE_US_ADDRESS_FIELDS},
                position: {lat: 40.7128, lng: -74.006},
                mapReferences: {
                    pointAddress: {
                        addressId: 'addr-123',
                        buildingName: 'Main Street Plaza',
                    },
                },
            };
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(placeWithBuildingName);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('Main Street Plaza');
            });
        });

        it('populates NZ form fields when selecting an address from search results', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleNzAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(nzLookupResponse);

            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            typeAddressSearch('10 Queen');

            const option = await screen.findByRole('option', {
                name: /10 Queen Street, Auckland/,
            });
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Street Number/) as HTMLInputElement).value).toBe('10');
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('Queen Street');
                expect((screen.getByLabelText(/Suburb/) as HTMLInputElement).value).toBe('Auckland CBD');
                expect((screen.getByLabelText(/Post Code/) as HTMLInputElement).value).toBe('1010');
            });

            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
        });

        it('formats street name from streetInfo when available', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockResolvedValue(usLookupResponseWithStreetInfo);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('North Main Street');
            });
        });

        it('shows error toast when address lookup fails', async () => {
            mockUseAddressSearch.mockReturnValue({
                data: sampleAddressResults,
                isFetching: false,
                error: null,
            } as any);
            mockAddressApi.getLocationDetailsById.mockRejectedValue(new Error('Network error'));

            const showToast = jest.fn();
            const props = createDefaultProps({showToast});
            renderWithProviders(props);

            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

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

            const props = createDefaultProps();
            renderWithProviders(props);

            typeAddressSearch('123');

            const option = await screen.findByRole('option', {name: /123 Main Street, New York/});
            fireEvent.click(option);

            await waitFor(() => {
                expect((screen.getByLabelText(/Latitude/) as HTMLInputElement).value).toBe('40.7128');
                expect((screen.getByLabelText(/Longitude/) as HTMLInputElement).value).toBe('-74.006');
            });

            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
        });
    });

    describe('Form Validation', () => {
        it('shows error for missing city', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            fireEvent.change(screen.getByLabelText(/Street Name/), {target: {value: 'Main Street'}});
            fireEvent.change(screen.getByLabelText(/ZIP Code/), {target: {value: '10001'}});

            fireEvent.click(screen.getByRole('button', {name: /Save/i}));

            expect(await screen.findByText(/City is required/)).toBeInTheDocument();
        });

        it('shows error for missing street name', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            fireEvent.change(screen.getByLabelText(/Company\/Building\/Complex/), {target: {value: 'Test Building'}});
            fireEvent.change(screen.getByLabelText(/City/), {target: {value: 'New York'}});
            fireEvent.change(screen.getByLabelText(/ZIP Code/), {target: {value: '10001'}});

            fireEvent.click(screen.getByRole('button', {name: /Save/i}));

            expect(await screen.findByText(/Street name is required/)).toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose via cancel and close icon buttons', () => {
            const onClose = jest.fn();
            const props = createDefaultProps({onClose});
            renderWithProviders(props);

            // Cancel button
            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
            expect(onClose).toHaveBeenCalledTimes(1);

            // Close icon
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('svg[data-testid="CloseIcon"]')
            );
            if (closeIconButton) {
                fireEvent.click(closeIconButton);
                expect(onClose).toHaveBeenCalledTimes(2);
            }
        });

        it('calls onSave with address data when form is valid', async () => {
            const onSave = jest.fn();
            const props = createDefaultProps({
                addressDetails: existingAddress,
                onSave,
            });
            renderWithProviders(props);

            fireEvent.click(screen.getByRole('button', {name: /Save/i}));

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
            const onSave = jest.fn();
            const props = createDefaultProps({
                addressDetails: existingAddressWithShipment,
                showContactInfo: true,
                onSave,
            });
            renderWithProviders(props);

            fireEvent.click(screen.getByRole('button', {name: /Save/i}));

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
        it('allows changing all form fields', () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const companyInput = screen.getByLabelText(/Company\/Building\/Complex/);
            fireEvent.change(companyInput, {target: {value: 'New Building Name'}});
            expect((companyInput as HTMLInputElement).value).toBe('New Building Name');

            const streetInput = screen.getByLabelText(/Street Number/);
            fireEvent.change(streetInput, {target: {value: '999'}});
            expect((streetInput as HTMLInputElement).value).toBe('999');

            const latInput = screen.getByLabelText(/Latitude/);
            fireEvent.change(latInput, {target: {value: '41.8781'}});
            expect((latInput as HTMLInputElement).value).toBe('41.8781');

            const lngInput = screen.getByLabelText(/Longitude/);
            fireEvent.change(lngInput, {target: {value: '-87.6298'}});
            expect((lngInput as HTMLInputElement).value).toBe('-87.6298');
        });
    });

    describe('State Selection (US)', () => {
        it('shows state selection for US tenant', () => {
            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            const stateLabels = screen.getAllByText('State *');
            expect(stateLabels.length).toBeGreaterThan(0);
        });

        it('does not show state selection for NZ tenant', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);

            expect(screen.queryAllByText('State *')).toHaveLength(0);
        });

        // Regression tests for the bug where the State dropdown was left blank when
        // the loaded address carried a full state name (e.g. "New York") rather than
        // its abbreviation. The Select MenuItems are keyed by abbreviation, so the
        // init path must normalise either form to the abbreviation.
        it('populates the State dropdown when only stateAbbreviation is set', () => {
            const props = createDefaultProps({addressDetails: existingAddress});
            renderWithProviders(props);

            const stateSelect = getStateSelect();
            expect(stateSelect).toHaveTextContent('New York');
        });

        it('populates the State dropdown when addressLine6 holds the full state name', () => {
            const fullNameAddress: EditAddressDialogViewModel = {
                ...existingAddress,
                addressLine6: 'New York',
                stateAbbreviation: undefined,
            };
            const props = createDefaultProps({addressDetails: fullNameAddress});
            renderWithProviders(props);

            const stateSelect = getStateSelect();
            expect(stateSelect).toHaveTextContent('New York');
        });

        it('populates the State dropdown when stateAbbreviation itself is a full name', () => {
            const mismatchedAddress: EditAddressDialogViewModel = {
                ...existingAddress,
                addressLine6: 'NY',
                stateAbbreviation: 'New York',
            };
            const props = createDefaultProps({addressDetails: mismatchedAddress});
            renderWithProviders(props);

            const stateSelect = getStateSelect();
            expect(stateSelect).toHaveTextContent('New York');
        });

        it('handles multi-word state names in addressLine6', () => {
            const ncAddress: EditAddressDialogViewModel = {
                ...existingAddress,
                addressLine6: 'North Carolina',
                stateAbbreviation: undefined,
            };
            const props = createDefaultProps({addressDetails: ncAddress});
            renderWithProviders(props);

            const stateSelect = getStateSelect();
            expect(stateSelect).toHaveTextContent('North Carolina');
        });
    });

    describe('New Address (empty form)', () => {
        it('starts with empty form fields and coordinates', () => {
            const props = createDefaultProps({addressDetails: null});
            renderWithProviders(props);

            expect((screen.getByLabelText(/Company\/Building\/Complex/) as HTMLInputElement).value).toBe('');
            expect((screen.getByLabelText(/Street Name/) as HTMLInputElement).value).toBe('');
            expect((screen.getByLabelText(/Latitude/) as HTMLInputElement).value).toBe('');
            expect((screen.getByLabelText(/Longitude/) as HTMLInputElement).value).toBe('');
        });
    });
});
