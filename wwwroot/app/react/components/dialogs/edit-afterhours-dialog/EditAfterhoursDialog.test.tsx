/**
 * Tests for EditAfterhoursDialog React component
 *
 * Uses React Query hooks - tests mock the hooks to control data flow.
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {EditAfterhoursDialog, EditAfterhoursDialogProps} from './EditAfterhoursDialog';
import {AfterHoursCourierSchedule, CourierSuggestion, TimeZoneOption,} from '../../../interfaces';
import {useCourierSearch, useTimeZoneOptions} from '../../../hooks';

// Mock the React Query hooks
jest.mock('../../../hooks', () => ({
    useCourierSearch: jest.fn(),
    useTimeZoneOptions: jest.fn(),
}));

const mockUseCourierSearch = useCourierSearch as jest.MockedFunction<typeof useCourierSearch>;
const mockUseTimeZoneOptions = useTimeZoneOptions as jest.MockedFunction<typeof useTimeZoneOptions>;

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
function renderWithProviders(props: EditAfterhoursDialogProps) {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <EditAfterhoursDialog {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}

// Default props factory
function createDefaultProps(overrides?: Partial<EditAfterhoursDialogProps>): EditAfterhoursDialogProps {
    return {
        open: true,
        schedule: null,
        isUsTenant: false,
        onClose: jest.fn(),
        onSave: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

// Sample data
const sampleCouriers: CourierSuggestion[] = [
    {id: 1, text: 'JohnD (John Doe)'},
    {id: 2, text: 'JaneS (Jane Smith)'},
    {id: 3, text: 'BobJ (Bob Johnson)'},
];

const sampleTimeZones: TimeZoneOption[] = [
    {id: 1, text: 'Eastern Time (ET)', timeZoneIana: 'America/New_York'},
    {id: 2, text: 'Pacific Time (PT)', timeZoneIana: 'America/Los_Angeles'},
    {id: 3, text: 'Central Time (CT)', timeZoneIana: 'America/Chicago'},
];

const existingSchedule: AfterHoursCourierSchedule = {
    afterHoursScheduleId: 123,
    courierId: 1,
    courierName: 'JohnD (John Doe)',
    courierCode: 'JohnD',
    days: ['Monday', 'Tuesday'],
    startTime: '18:00',
    endTime: '06:00',
    timezone: 'America/New_York',
    duration: '12h 00m',
};

describe('EditAfterhoursDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        mockUseCourierSearch.mockReturnValue({
            data: [],
            isFetching: false,
            error: null,
        } as any);

        mockUseTimeZoneOptions.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as any);
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

        it('shows "Create Afterhours Schedule" title for new schedule', () => {
            const props = createDefaultProps({schedule: null});
            renderWithProviders(props);
            expect(screen.getByText('Create Afterhours Schedule')).toBeInTheDocument();
        });

        it('shows "Edit Afterhours Schedule" title for existing schedule', () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);
            expect(screen.getByText('Edit Afterhours Schedule')).toBeInTheDocument();
        });

        it('shows "Select Driver" label for new schedule', () => {
            const props = createDefaultProps({schedule: null});
            renderWithProviders(props);
            expect(screen.getByText('Select Driver')).toBeInTheDocument();
        });

        it('shows "Change Driver" label for existing schedule', () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);
            expect(screen.getByText('Change Driver')).toBeInTheDocument();
        });

        it('shows current driver info for existing schedule', () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);
            expect(screen.getByText('Current driver:')).toBeInTheDocument();
            expect(screen.getByText('JohnD (John Doe)')).toBeInTheDocument();
        });

        it('shows timezone selector for US tenants', async () => {
            mockUseTimeZoneOptions.mockReturnValue({
                data: sampleTimeZones,
                isLoading: false,
                error: null,
            } as any);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // The timezone label should be visible
            const timezoneElements = screen.getAllByText('Timezone');
            expect(timezoneElements.length).toBeGreaterThan(0);
        });

        it('does not show timezone selector for non-US tenants', () => {
            const props = createDefaultProps({isUsTenant: false});
            renderWithProviders(props);
            expect(screen.queryByText('Timezone')).not.toBeInTheDocument();
        });
    });

    describe('Form Inputs', () => {
        it('populates form fields with existing schedule data', async () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);

            // Check that time inputs are populated
            const startTimeInput = screen.getByLabelText('Start Time') as HTMLInputElement;
            expect(startTimeInput.value).toBe('18:00');

            const endTimeInput = screen.getByLabelText('End Time') as HTMLInputElement;
            expect(endTimeInput.value).toBe('06:00');
        });

        it('shows days selection chips for existing schedule', () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);

            // Check that selected days are shown as chips inside the select
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent('Monday');
            expect(dialog).toHaveTextContent('Tuesday');
        });

        it('allows changing start time', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const startTimeInput = screen.getByLabelText('Start Time');
            fireEvent.change(startTimeInput, {target: {value: '20:00'}});

            expect((startTimeInput as HTMLInputElement).value).toBe('20:00');
        });

        it('allows changing end time', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const endTimeInput = screen.getByLabelText('End Time');
            fireEvent.change(endTimeInput, {target: {value: '04:00'}});

            expect((endTimeInput as HTMLInputElement).value).toBe('04:00');
        });
    });

    describe('Courier Search', () => {
        it('shows search results from hook', async () => {
            mockUseCourierSearch.mockReturnValue({
                data: sampleCouriers,
                isFetching: false,
                error: null,
            } as any);

            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            const searchInput = screen.getByLabelText('Search driver...');
            await user.type(searchInput, 'John');

            expect(await screen.findByText('JohnD (John Doe)')).toBeInTheDocument();
        });

        it('shows loading state while searching', async () => {
            mockUseCourierSearch.mockReturnValue({
                data: [],
                isFetching: true,
                error: null,
            } as any);

            const props = createDefaultProps();
            renderWithProviders(props);

            // The loading indicator should be present
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('displays error toast when search fails', async () => {
            const showToast = jest.fn();
            mockUseCourierSearch.mockReturnValue({
                data: [],
                isFetching: false,
                error: new Error('Search failed'),
            } as any);

            const props = createDefaultProps({showToast});
            renderWithProviders(props);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'An error occurred while searching. Please try again later.',
                    'error'
                );
            });
        });
    });

    describe('Duration Calculation', () => {
        it('calculates duration for same-day shift', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const startTimeInput = screen.getByLabelText('Start Time');
            const endTimeInput = screen.getByLabelText('End Time');

            fireEvent.change(startTimeInput, {target: {value: '09:00'}});
            fireEvent.change(endTimeInput, {target: {value: '17:00'}});

            expect(await screen.findByText('8h 00m')).toBeInTheDocument();
        });

        it('calculates duration for overnight shift', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const startTimeInput = screen.getByLabelText('Start Time');
            const endTimeInput = screen.getByLabelText('End Time');

            fireEvent.change(startTimeInput, {target: {value: '22:00'}});
            fireEvent.change(endTimeInput, {target: {value: '06:00'}});

            expect(await screen.findByText('8h 00m')).toBeInTheDocument();
        });

        it('shows next day warning for overnight shift', async () => {
            const props = createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday'],
                },
            });
            renderWithProviders(props);

            expect(await screen.findByText(/spans across midnight/)).toBeInTheDocument();
        });
    });

    describe('Timezone Selection (US Tenant)', () => {
        it('loads timezones for US tenant', async () => {
            mockUseTimeZoneOptions.mockReturnValue({
                data: sampleTimeZones,
                isLoading: false,
                error: null,
            } as any);

            const props = createDefaultProps({isUsTenant: true});
            renderWithProviders(props);

            // Check that hook was called with enabled=true
            expect(mockUseTimeZoneOptions).toHaveBeenCalledWith({enabled: true});
        });

        it('shows error toast when timezone loading fails', async () => {
            const showToast = jest.fn();
            mockUseTimeZoneOptions.mockReturnValue({
                data: [],
                isLoading: false,
                error: new Error('Failed to load'),
            } as any);

            const props = createDefaultProps({
                isUsTenant: true,
                showToast,
            });
            renderWithProviders(props);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'Failed to load time zone options.',
                    'error'
                );
            });
        });
    });

    describe('Form Validation', () => {
        it('save button is disabled when form is incomplete', () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const saveButton = screen.getByRole('button', {name: /Create Schedule/i});
            expect(saveButton).toBeDisabled();
        });

        it('save button is disabled without courier selected', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            // Button should be disabled when form is invalid
            const saveButton = screen.getByRole('button', {name: /Create Schedule/i});
            expect(saveButton).toBeDisabled();
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

        it('calls onSave with schedule data for existing schedule', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createDefaultProps({
                schedule: existingSchedule,
                onSave,
                isUsTenant: false,
            });
            renderWithProviders(props);

            // The form should already be valid with the existing schedule data
            await waitFor(() => {
                const saveButton = screen.getByRole('button', {name: /Save Schedule/i});
                expect(saveButton).not.toBeDisabled();
            });

            await user.click(screen.getByRole('button', {name: /Save Schedule/i}));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    expect.objectContaining({
                        afterHoursScheduleId: 123,
                        courierId: 1,
                        courierName: 'JohnD (John Doe)',
                        days: ['Monday', 'Tuesday'],
                        startTime: '18:00',
                        endTime: '06:00',
                    })
                );
            });
        });
    });

    describe('Days Selection', () => {
        it('shows selected days count', async () => {
            const props = createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday', 'Tuesday', 'Wednesday'],
                },
            });
            renderWithProviders(props);

            expect(screen.getByText('3 days selected')).toBeInTheDocument();
        });

        it('shows "Every day" when all days selected', async () => {
            const props = createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                },
            });
            renderWithProviders(props);

            expect(screen.getByText('Every day')).toBeInTheDocument();
        });

        it('shows "1 day selected" for single day', async () => {
            const props = createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday'],
                },
            });
            renderWithProviders(props);

            expect(screen.getByText('1 day selected')).toBeInTheDocument();
        });
    });

    describe('Existing Schedule Editing', () => {
        it('preserves schedule ID when editing', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createDefaultProps({
                schedule: existingSchedule,
                onSave,
                isUsTenant: false,
            });
            renderWithProviders(props);

            // Just click save with existing data
            await waitFor(() => {
                const saveButton = screen.getByRole('button', {name: /Save Schedule/i});
                expect(saveButton).not.toBeDisabled();
            });

            await user.click(screen.getByRole('button', {name: /Save Schedule/i}));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    expect.objectContaining({
                        afterHoursScheduleId: 123,
                    })
                );
            });
        });

        it('shows "Save Schedule" button text for existing schedule', () => {
            const props = createDefaultProps({schedule: existingSchedule});
            renderWithProviders(props);

            expect(screen.getByRole('button', {name: /Save Schedule/i})).toBeInTheDocument();
        });
    });
});
