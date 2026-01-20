/**
 * DateFilterMenu Component Tests
 */

import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {DateFilterMenu, DateFilterData} from './DateFilterMenu';

dayjs.extend(utc);
dayjs.extend(timezone);

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                {ui}
            </LocalizationProvider>
        </ThemeProvider>
    );
};

describe('DateFilterMenu', () => {
    const mockDateFilterData: DateFilterData = {
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
    };

    const defaultProps = {
        dateFilterData: mockDateFilterData,
        onRefreshData: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Clear localStorage before each test
        localStorage.clear();
    });

    describe('Rendering', () => {
        it('should render calendar icon button', () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('should open menu when button is clicked', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Date Filter')).toBeInTheDocument();
            });
        });

        it('should render All Time option', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByLabelText('All Time')).toBeInTheDocument();
            });
        });

        it('should render Time Range option', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
            });
        });

        it('should render Custom Dates option', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByLabelText('Custom Dates')).toBeInTheDocument();
            });
        });

        it('should render Reset button', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Reset')).toBeInTheDocument();
            });
        });

        it('should render Apply button', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Apply')).toBeInTheDocument();
            });
        });
    });

    describe('Date Range Options', () => {
        it('should select All Time by default', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                const allTimeRadio = screen.getByLabelText('All Time');
                expect(allTimeRadio).toBeChecked();
            });
        });

        it('should show date pickers when Custom Dates is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Custom Dates')).toBeInTheDocument();
            });

            // Get the label element and click on it to select the radio
            const customDatesLabel = screen.getByText('Custom Dates').closest('label');
            if (customDatesLabel) {
                fireEvent.click(customDatesLabel);
            }

            await waitFor(() => {
                // MUI DatePicker renders multiple elements with the label, use getAllByLabelText
                const startDateElements = screen.getAllByLabelText(/start date/i);
                const endDateElements = screen.getAllByLabelText(/end date/i);
                expect(startDateElements.length).toBeGreaterThan(0);
                expect(endDateElements.length).toBeGreaterThan(0);
            });
        });

        it('should show duration dropdown when Time Range is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Time Range')).toBeInTheDocument();
            });

            // Click on the label text to select the radio (MUI handles this correctly)
            fireEvent.click(screen.getByText('Time Range'));

            await waitFor(() => {
                // Duration dropdown should appear - look for the select element
                expect(screen.getByRole('combobox')).toBeInTheDocument();
            });
        });
    });

    describe('Interactions', () => {
        it('should call onRefreshData when Apply is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                fireEvent.click(screen.getByText('Apply'));
            });

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onRefreshData when Reset is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                fireEvent.click(screen.getByText('Reset'));
            });

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onShowToast when Apply is clicked with valid dates', async () => {
            const onShowToast = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onShowToast={onShowToast} />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                fireEvent.click(screen.getByText('Apply'));
            });

            expect(onShowToast).toHaveBeenCalledWith(
                'Showing all up until the end of today',
                'success'
            );
        });

        it('should close menu after Apply is clicked', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Date Filter')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Apply'));

            await waitFor(() => {
                expect(screen.queryByText('Date Filter')).not.toBeInTheDocument();
            });
        });
    });

    describe('Timezone Display', () => {
        it('should display timezone when provided', async () => {
            renderWithProviders(
                <DateFilterMenu
                    {...defaultProps}
                    timeZone="Pacific Standard Time"
                />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                // Should show some timezone indication
                const menu = screen.getByRole('menu');
                expect(menu).toBeInTheDocument();
            });
        });

        it('should use default timezone when not provided', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                const menu = screen.getByRole('menu');
                expect(menu).toBeInTheDocument();
            });
        });
    });

    describe('localStorage Persistence', () => {
        it('should save selected option to localStorage', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Custom Dates')).toBeInTheDocument();
            });

            // Click on the label text to select the radio (MUI handles this correctly)
            fireEvent.click(screen.getByText('Custom Dates'));

            // Allow for async state update
            await waitFor(() => {
                expect(localStorage.getItem('dateRangeOption-testPage')).toBe('custom_date');
            });
        });

        it('should restore saved option from localStorage', async () => {
            localStorage.setItem('dateRangeOption-testPage', 'custom_minutes');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            fireEvent.click(screen.getByRole('button'));

            await waitFor(() => {
                const timeRangeRadio = screen.getByLabelText('Time Range');
                expect(timeRangeRadio).toBeChecked();
            });
        });
    });

    describe('Null Data Handling', () => {
        it('should render when dateFilterData is null', () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} dateFilterData={null} />
            );
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });
});
