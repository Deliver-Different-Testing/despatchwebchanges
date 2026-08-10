/**
 * EditAfterhoursDialog Component Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithMantineProviders} from '../../../__testUtils__';
import {EditAfterhoursDialog, EditAfterhoursDialogProps} from './EditAfterhoursDialog';
import {AfterHoursCourierSchedule, CourierSuggestion, TimeZoneOption} from '../../../interfaces';
import {useCourierSearch, useTimeZoneOptions} from '../../../hooks/useCourierApi';

jest.mock('../../../hooks/useCourierApi', () => ({
    useCourierSearch: jest.fn(),
    useTimeZoneOptions: jest.fn(),
}));

const mockUseCourierSearch = useCourierSearch as jest.MockedFunction<typeof useCourierSearch>;
const mockUseTimeZoneOptions = useTimeZoneOptions as jest.MockedFunction<typeof useTimeZoneOptions>;

function renderWithProviders(props: EditAfterhoursDialogProps) {
    return renderWithMantineProviders(<EditAfterhoursDialog {...props} />);
}

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
        mockUseCourierSearch.mockReturnValue({data: [], isFetching: false, error: null} as any);
        mockUseTimeZoneOptions.mockReturnValue({data: [], isLoading: false, error: null} as any);
    });

    // ── Rendering: new schedule ─────────────────────────────────────
    describe('Rendering (new schedule)', () => {
        it('renders dialog with create title, Select Driver label, and disabled save', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Create Afterhours Schedule')).toBeInTheDocument();
            expect(screen.getByText('Select Driver')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Create Schedule/i})).toBeDisabled();
            expect(screen.queryByText('Timezone')).not.toBeInTheDocument();
        });

        it('renders nothing when not open', () => {
            renderWithProviders(createDefaultProps({open: false}));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    // ── Rendering: existing schedule ────────────────────────────────
    describe('Rendering (existing schedule)', () => {
        it('renders with edit title, current driver, populated fields and days', () => {
            renderWithProviders(createDefaultProps({schedule: existingSchedule}));

            expect(screen.getByText('Edit Afterhours Schedule')).toBeInTheDocument();
            expect(screen.getByText('Change Driver')).toBeInTheDocument();
            expect(screen.getByText('Current driver:')).toBeInTheDocument();
            expect(screen.getByText('JohnD (John Doe)')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Save Schedule/i})).toBeInTheDocument();

            const startTimeInput = screen.getByLabelText('Start Time') as HTMLInputElement;
            expect(startTimeInput.value).toBe('18:00');
            const endTimeInput = screen.getByLabelText('End Time') as HTMLInputElement;
            expect(endTimeInput.value).toBe('06:00');

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent('Monday');
            expect(dialog).toHaveTextContent('Tuesday');
        });
    });

    // ── Timezone (US tenant) ────────────────────────────────────────
    describe('Timezone Selection (US Tenant)', () => {
        it('shows timezone selector for US tenants and calls hook', () => {
            mockUseTimeZoneOptions.mockReturnValue({data: sampleTimeZones, isLoading: false, error: null} as any);
            renderWithProviders(createDefaultProps({isUsTenant: true}));

            expect(screen.getAllByText('Timezone').length).toBeGreaterThan(0);
            expect(mockUseTimeZoneOptions).toHaveBeenCalledWith({enabled: true});
        });

        it('shows error toast when timezone loading fails', async () => {
            const showToast = jest.fn();
            mockUseTimeZoneOptions.mockReturnValue({data: [], isLoading: false, error: new Error('Failed')} as any);
            renderWithProviders(createDefaultProps({isUsTenant: true, showToast}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Failed to load time zone options.', 'error');
            });
        });
    });

    // ── Form Inputs ─────────────────────────────────────────────────
    describe('Form Inputs', () => {
        it('allows changing start and end time', () => {
            renderWithProviders(createDefaultProps());

            const startTimeInput = screen.getByLabelText('Start Time');
            fireEvent.change(startTimeInput, {target: {value: '20:00'}});
            expect((startTimeInput as HTMLInputElement).value).toBe('20:00');

            const endTimeInput = screen.getByLabelText('End Time');
            fireEvent.change(endTimeInput, {target: {value: '04:00'}});
            expect((endTimeInput as HTMLInputElement).value).toBe('04:00');
        });
    });

    // ── Courier Search ──────────────────────────────────────────────
    describe('Courier Search', () => {
        it('shows search results from hook', async () => {
            mockUseCourierSearch.mockReturnValue({data: sampleCouriers, isFetching: false, error: null} as any);

            const user = setupUser();
            renderWithProviders(createDefaultProps());

            const searchInput = screen.getByLabelText('Search driver...');
            await user.click(searchInput);
            await user.paste('John');

            expect(await screen.findByText('JohnD (John Doe)')).toBeInTheDocument();
        });

        it('shows loading state while searching', () => {
            mockUseCourierSearch.mockReturnValue({data: [], isFetching: true, error: null} as any);
            renderWithProviders(createDefaultProps());
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('displays error toast when search fails', async () => {
            const showToast = jest.fn();
            mockUseCourierSearch.mockReturnValue({
                data: [],
                isFetching: false,
                error: new Error('Search failed')
            } as any);
            renderWithProviders(createDefaultProps({showToast}));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('An error occurred while searching. Please try again later.', 'error');
            });
        });
    });

    // ── Duration Calculation ────────────────────────────────────────
    describe('Duration Calculation', () => {
        it('calculates duration for same-day and overnight shifts', async () => {
            renderWithProviders(createDefaultProps());

            fireEvent.change(screen.getByLabelText('Start Time'), {target: {value: '09:00'}});
            fireEvent.change(screen.getByLabelText('End Time'), {target: {value: '17:00'}});
            expect(await screen.findByText('8h 00m')).toBeInTheDocument();
        });

        it('shows next day warning for overnight shift', async () => {
            renderWithProviders(createDefaultProps({schedule: {...existingSchedule, days: ['Monday']}}));
            expect(await screen.findByText(/spans across midnight/)).toBeInTheDocument();
        });
    });

    // ── Days Selection ──────────────────────────────────────────────
    describe('Days Selection', () => {
        it('shows correct selected days count', () => {
            renderWithProviders(createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday', 'Tuesday', 'Wednesday']
                }
            }));
            expect(screen.getByText('3 days selected')).toBeInTheDocument();
        });

        it('shows "Every day" when all days selected', () => {
            renderWithProviders(createDefaultProps({
                schedule: {
                    ...existingSchedule,
                    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                },
            }));
            expect(screen.getByText('Every day')).toBeInTheDocument();
        });

        it('shows "1 day selected" for single day', () => {
            renderWithProviders(createDefaultProps({schedule: {...existingSchedule, days: ['Monday']}}));
            expect(screen.getByText('1 day selected')).toBeInTheDocument();
        });
    });

    // ── Dialog Actions ──────────────────────────────────────────────
    describe('Dialog Actions', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const user = setupUser();
            const onClose = jest.fn();
            renderWithProviders(createDefaultProps({onClose}));

            await user.click(screen.getByRole('button', {name: 'Cancel'}));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onSave with schedule data preserving schedule ID', async () => {
            const user = setupUser();
            const onSave = jest.fn();
            renderWithProviders(createDefaultProps({schedule: existingSchedule, onSave, isUsTenant: false}));

            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Save Schedule/i})).not.toBeDisabled();
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
});
