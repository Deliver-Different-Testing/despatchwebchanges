/**
 * Tests for FlightAgentConfirmationDialog React component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import dayjs from 'dayjs';
import { FlightAgentConfirmationDialog } from './FlightAgentConfirmationDialog';
import {
    FlightViewModel,
    FlightSegment,
    AgentSuggestion,
    FlightCargoProcessing,
    FlightAgentDialogResult,
} from './types';

// Create a theme for testing
const theme = createTheme();

// Helper to render component with theme
function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// Create sample flight segment
function createFlightSegment(overrides?: Partial<FlightSegment>): FlightSegment {
    return {
        segmentOrder: 0,
        departureAirportFsCode: 'AKL',
        departureAirportName: 'Auckland Airport',
        departureAirportCity: 'Auckland',
        departureAirportId: 1,
        departureAirportTimeZone: 'Pacific/Auckland',
        arrivalAirportFsCode: 'SYD',
        arrivalAirportName: 'Sydney Airport',
        arrivalAirportCity: 'Sydney',
        arrivalAirportId: 2,
        arrivalAirportTimeZone: 'Australia/Sydney',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        carrierFsCode: 'NZ',
        flightNumber: '123',
        airlineName: 'Air New Zealand',
        departureTerminal: '1',
        arrivalTerminal: '2',
        ...overrides,
    };
}

// Create sample flight
function createFlight(overrides?: Partial<FlightViewModel>): FlightViewModel {
    return {
        flightNumber: 'NZ123',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        departureTimeZone: 'Pacific/Auckland',
        arrivalTimeZone: 'Australia/Sydney',
        flightSegments: [createFlightSegment()],
        ...overrides,
    };
}

// Create sample agent
function createAgent(overrides?: Partial<AgentSuggestion>): AgentSuggestion {
    return {
        id: 1,
        text: 'Sydney Cargo Services',
        ...overrides,
    };
}

// Create sample cargo processing result
function createCargoProcessing(overrides?: Partial<FlightCargoProcessing>): FlightCargoProcessing {
    return {
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        processingTimeMins: 90,
        cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
        cargoClosingTime: dayjs('2024-03-15T22:00:00'),
        deliverByTime: dayjs('2024-03-15T18:00:00'),
        ...overrides,
    };
}

// Default props
const defaultProps = {
    open: true,
    mode: 'flight' as const,
    jobId: 123,
    jobNumber: 'JOB-001',
    timezone: 'Pacific/Auckland',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    onCalculateCargoTimes: jest.fn().mockResolvedValue(createCargoProcessing()),
    showToast: jest.fn(),
};

describe('FlightAgentConfirmationDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const { container } = renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    open={false}
                    flight={createFlight()}
                />
            );
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders the dialog when open', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    flight={createFlight()}
                />
            );
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('displays flight number in title for flight mode', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );
            expect(screen.getByText(/Assign Flight.*NZ123/)).toBeInTheDocument();
        });

        it('displays agent name in title for agent mode', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );
            expect(screen.getByText(/Assign Agent.*Sydney Cargo Services/)).toBeInTheDocument();
        });
    });

    describe('Flight Mode', () => {
        it('displays departure and arrival airports', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('AKL')).toBeInTheDocument();
                expect(screen.getByText('SYD')).toBeInTheDocument();
            });
        });

        it('calls onCalculateCargoTimes when flight is provided', async () => {
            const onCalculateCargoTimes = jest.fn().mockResolvedValue(createCargoProcessing());

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            await waitFor(() => {
                expect(onCalculateCargoTimes).toHaveBeenCalledWith(
                    123,
                    'NZ',
                    expect.any(Object), // Dayjs object
                    'Australia/Sydney'
                );
            });
        });

        it('displays cargo facility section', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Cargo Facility')).toBeInTheDocument();
            });
        });

        it('displays processing time section', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Processing Time')).toBeInTheDocument();
            });
        });

        it('displays package ready section', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Package Ready')).toBeInTheDocument();
            });
        });

        it('displays cargo hours after calculation', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                // Cargo hours format: "06:00 - 22:00"
                expect(screen.getByText('06:00 - 22:00')).toBeInTheDocument();
            });
        });

        it('displays processing time after calculation', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('90 min')).toBeInTheDocument();
            });
        });
    });

    describe('Agent Mode', () => {
        it('does not show flight route section in agent mode', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            expect(screen.queryByText('AKL')).not.toBeInTheDocument();
            expect(screen.queryByText('Cargo Facility')).not.toBeInTheDocument();
        });

        it('shows include stop jobs checkbox when stopJobCount > 0', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    stopJobCount={3}
                />
            );

            expect(screen.getByText(/Assign to 3 stop jobs/)).toBeInTheDocument();
        });

        it('does not show stop jobs checkbox when stopJobCount is 0', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    stopJobCount={0}
                />
            );

            expect(screen.queryByText(/Assign to.*stop job/)).not.toBeInTheDocument();
        });
    });

    describe('AWB Field', () => {
        it('displays AWB input field', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            expect(screen.getByLabelText('AWB Number')).toBeInTheDocument();
        });

        it('pre-fills AWB when existingAwb is provided', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    existingAwb="123-45678901"
                />
            );

            expect(screen.getByDisplayValue('123-45678901')).toBeInTheDocument();
        });

        it('disables AWB field when existingAwb is provided', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    existingAwb="123-45678901"
                />
            );

            expect(screen.getByLabelText('AWB Number')).toBeDisabled();
        });

        it('allows AWB input when no existingAwb', async () => {
            const user = userEvent.setup();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            const awbInput = screen.getByLabelText('AWB Number');
            await user.type(awbInput, '987-65432109');

            expect(screen.getByDisplayValue('987-65432109')).toBeInTheDocument();
        });
    });

    describe('Dangerous Goods', () => {
        it('displays dangerous goods warning when dgClass is provided', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    dgClass={3}
                />
            );

            expect(screen.getByText(/Dangerous Goods.*Flammable Liquids/)).toBeInTheDocument();
        });

        it('does not display dangerous goods warning when dgClass is undefined', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            expect(screen.queryByText(/Dangerous Goods/)).not.toBeInTheDocument();
        });
    });

    describe('Delivery Notes', () => {
        it('displays delivery notes field', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            expect(screen.getByLabelText('Delivery Instructions')).toBeInTheDocument();
        });

        it('allows entering delivery notes', async () => {
            const user = userEvent.setup();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            const notesInput = screen.getByLabelText('Delivery Instructions');
            await user.type(notesInput, 'Handle with care');

            expect(screen.getByDisplayValue('Handle with care')).toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    onClose={onClose}
                />
            );

            await user.click(screen.getByText('Cancel'));

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onConfirm with correct data when Confirm button is clicked', async () => {
            const user = userEvent.setup();
            const onConfirm = jest.fn();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    onConfirm={onConfirm}
                />
            );

            // Enter AWB
            const awbInput = screen.getByLabelText('AWB Number');
            await user.type(awbInput, '111-22233344');

            // Click confirm
            await user.click(screen.getByText('Confirm Assignment'));

            expect(onConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    shouldAssign: true,
                    awb: '111-22233344',
                    shouldAssignToStopJobs: false,
                })
            );
        });

        it('includes stop jobs flag when checkbox is checked', async () => {
            const user = userEvent.setup();
            const onConfirm = jest.fn();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    stopJobCount={2}
                    onConfirm={onConfirm}
                />
            );

            // Check the stop jobs checkbox
            const checkbox = screen.getByRole('checkbox');
            await user.click(checkbox);

            // Click confirm
            await user.click(screen.getByText('Confirm Assignment'));

            expect(onConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    shouldAssignToStopJobs: true,
                })
            );
        });
    });

    describe('Cargo Hours Warning', () => {
        it('shows warning when package ready time is after cargo closes', async () => {
            // Package ready at 23:00, but cargo closes at 22:00
            const lateCargoProcessing = createCargoProcessing({
                arrivalTime: dayjs('2024-03-15T21:00:00'),
                processingTimeMins: 120, // Would be ready at 23:00
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(lateCargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Package Available After Cargo Hours/)).toBeInTheDocument();
            });
        });

        it('provides option to set next morning time', async () => {
            const lateCargoProcessing = createCargoProcessing({
                arrivalTime: dayjs('2024-03-15T21:00:00'),
                processingTimeMins: 120,
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(lateCargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Set to.*Cargo Opens/)).toBeInTheDocument();
            });
        });

        it('provides baggage carousel option when package after hours', async () => {
            const lateCargoProcessing = createCargoProcessing({
                arrivalTime: dayjs('2024-03-15T21:00:00'),
                processingTimeMins: 120,
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(lateCargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Baggage Carousel')).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('shows error toast when no flight segments available', async () => {
            const showToast = jest.fn();
            const flightWithNoSegments = createFlight({ flightSegments: [] });

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={flightWithNoSegments}
                    showToast={showToast}
                />
            );

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('No flight segments available', 'error');
            });
        });

        it('shows error when cargo calculation fails', async () => {
            const showToast = jest.fn();
            const onCalculateCargoTimes = jest.fn().mockResolvedValue(null);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                    showToast={showToast}
                />
            );

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'Failed to calculate cargo processing times',
                    'error'
                );
            });
        });
    });

    describe('Multi-Segment Flights', () => {
        it('uses last segment for cargo calculation', async () => {
            const onCalculateCargoTimes = jest.fn().mockResolvedValue(createCargoProcessing());

            const multiSegmentFlight = createFlight({
                flightSegments: [
                    createFlightSegment({
                        segmentOrder: 0,
                        arrivalAirportFsCode: 'MEL',
                        arrivalAirportId: 3,
                        arrivalAirportTimeZone: 'Australia/Melbourne',
                    }),
                    createFlightSegment({
                        segmentOrder: 1,
                        departureAirportFsCode: 'MEL',
                        arrivalAirportFsCode: 'SYD',
                        arrivalAirportId: 2,
                        arrivalAirportTimeZone: 'Australia/Sydney',
                        carrierFsCode: 'QF',
                    }),
                ],
            });

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={multiSegmentFlight}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            await waitFor(() => {
                // Should use QF (last segment carrier) not NZ (first segment)
                expect(onCalculateCargoTimes).toHaveBeenCalledWith(
                    123,
                    'QF',
                    expect.any(Object),
                    'Australia/Sydney'
                );
            });
        });
    });
});
