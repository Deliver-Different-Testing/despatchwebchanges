/**
 * Tests for FlightAgentConfirmationDialog React component
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {screen, waitFor} from '@testing-library/react';
import {renderWithMantineOverMui} from '../../../__testUtils__';
import {QueryClient} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {FlightAgentConfirmationDialog} from './FlightAgentConfirmationDialog';
import {AgentSuggestion, FlightCargoProcessing, FlightSegment, FlightViewModel} from './types';

// The agent-mode pre-flight notice fetches an inbound-email preview via react-query.
// Keep it inert here (never resolves → renders nothing) so these tests stay focused on
// the dialog's own content; the notice has its own dedicated tests.
jest.mock('../../../services/dispatchExecutorApi', () => ({
    getAgentInboundEmailPreview: jest.fn(() => new Promise(() => { /* never resolves */ })),
}));

import {getAgentInboundEmailPreview} from '../../../services/dispatchExecutorApi';
const mockPreview = getAgentInboundEmailPreview as jest.Mock;
const neverResolves = () => new Promise(() => { /* never resolves */ });

// Create a theme for testing

// Helper to render the dialog with both themes + a QueryClient. Mantine goes outside,
// MUI inside: the dialog is still MUI but its two date fields are Mantine.
// (Production mounts this dialog inside ReactQueryProvider via its bridge module.)
function renderWithTheme(ui: React.ReactElement) {
    return renderWithMantineOverMui(ui, {
        queryClient: new QueryClient({defaultOptions: {queries: {retry: false}}}),
    });
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
    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    open={false}
                    flight={createFlight()}
                />
            );
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

            expect(await screen.findByText('AKL')).toBeInTheDocument();
            expect(screen.getByText('SYD')).toBeInTheDocument();
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

            expect(await screen.findByText('Cargo Facility')).toBeInTheDocument();
        });

        it('displays processing time section', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            expect(await screen.findByText('Processing Time')).toBeInTheDocument();
        });

        it('displays package ready section', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            expect(await screen.findByText('Package Ready')).toBeInTheDocument();
        });

        it('displays cargo hours after calculation', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            // Cargo hours format: "06:00 - 22:00"
            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();
        });

        it('displays processing time after calculation', async () => {
            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                />
            );

            expect(await screen.findByText('90 min')).toBeInTheDocument();
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
            const user = setupUser();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            const awbInput = screen.getByLabelText('AWB Number');
            await user.click(awbInput);
            await user.paste('987-65432109');

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
            const user = setupUser();

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                />
            );

            const notesInput = screen.getByLabelText('Delivery Instructions');
            await user.click(notesInput);
            await user.paste('Handle with care');

            expect(screen.getByDisplayValue('Handle with care')).toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const user = setupUser();
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
            const user = setupUser();
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
            await user.click(awbInput);
            await user.paste('111-22233344');

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
            const user = setupUser();
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

            expect(await screen.findByText(/Package Available After Cargo Hours/)).toBeInTheDocument();
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

            expect(await screen.findByText(/Set to.*Cargo Opens/)).toBeInTheDocument();
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

            expect(await screen.findByText('Baggage Carousel')).toBeInTheDocument();
        });
    });

    describe('Operating Hours Boundary Conditions', () => {
        // Verifies the isBetween fix using valueOf() comparison
        it.each([
            ['exactly at opening (06:00)', '2024-03-15T04:00:00', 120],
            ['exactly at closing (22:00)', '2024-03-15T20:00:00', 120],
            ['within hours (14:00)', '2024-03-15T12:00:00', 120],
        ])('does not show warning when package ready %s', async (_, arrivalTime, processingMins) => {
            const cargoProcessing = createCargoProcessing({
                arrivalTime: dayjs(arrivalTime),
                processingTimeMins: processingMins,
                cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={jest.fn().mockResolvedValue(cargoProcessing)}
                />
            );

            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();

            expect(screen.queryByText(/Package Available After Cargo Hours/)).not.toBeInTheDocument();
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

    describe('Issue #3: Package Ready Time Calculation', () => {
        it('calculates packageReadyTime as arrival + processing time', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();

            // Arrival at 10:30, processing time 90 mins = ready at 12:00
            const cargoProcessing = createCargoProcessing({
                arrivalTime: dayjs('2024-03-15T10:30:00'),
                processingTimeMins: 90,
                cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(cargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                    onConfirm={onConfirm}
                />
            );

            // Wait for cargo calculation to complete
            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();

            // Click confirm
            await user.click(screen.getByText('Confirm Assignment'));

            // Verify packageReadyTime is set correctly (arrival 10:30 + 90 mins = 12:00)
            expect(onConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    shouldAssign: true,
                    packageReadyTime: expect.any(Object), // Dayjs object
                })
            );

            const result = onConfirm.mock.calls[0][0];
            expect(result.packageReadyTime).toBeDefined();
            // Package ready should be around 12:00 (10:30 + 90 mins)
            expect(result.packageReadyTime.hour()).toBe(12);
            expect(result.packageReadyTime.minute()).toBe(0);
        });

        it('uses cargo opening time if arrival + processing is before opening', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();

            // Arrival at 04:00, processing time 60 mins = 05:00 (before cargo opens at 06:00)
            const cargoProcessing = createCargoProcessing({
                arrivalTime: dayjs('2024-03-15T04:00:00'),
                processingTimeMins: 60,
                cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(cargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                    onConfirm={onConfirm}
                />
            );

            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();

            await user.click(screen.getByText('Confirm Assignment'));

            const result = onConfirm.mock.calls[0][0];
            expect(result.packageReadyTime).toBeDefined();
            // Should use cargo opening time (06:00) since 05:00 is before opening
            expect(result.packageReadyTime.hour()).toBe(6);
            expect(result.packageReadyTime.minute()).toBe(0);
        });
    });

    describe('Issue #5: Invalid Cargo Hours Handling', () => {
        it('displays fallback text when cargo opening time is invalid', async () => {
            // Simulate the bug scenario: backend returns DateTime without timezone offset
            // which causes parseDateFromApi to create an invalid Dayjs object
            const invalidCargoProcessing = createCargoProcessing({
                cargoOpeningTime: dayjs(null), // Invalid Dayjs object
                cargoClosingTime: dayjs(null), // Invalid Dayjs object
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(invalidCargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            // Should display fallback text instead of "Invalid Date"
            expect(await screen.findByText('--:-- - --:--')).toBeInTheDocument();
        });

        it('displays formatted time when cargo times are valid', async () => {
            const validCargoProcessing = createCargoProcessing({
                cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
                cargoClosingTime: dayjs('2024-03-15T22:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(validCargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            // Should display properly formatted times
            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();
        });

        it('handles cargo times with timezone offset correctly', async () => {
            // Simulate the fix: backend returns DateTimeOffset with timezone
            // parseDateFromApi correctly preserves the time
            const cargoWithTimezone = createCargoProcessing({
                // These simulate times parsed from "2024-03-15T07:00:00-08:00" format
                cargoOpeningTime: dayjs('2024-03-15T07:00:00'),
                cargoClosingTime: dayjs('2024-03-15T23:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(cargoWithTimezone);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                />
            );

            expect(await screen.findByText('07:00 - 23:00')).toBeInTheDocument();
        });
    });

    describe('Agent Email Template', () => {
        const DEFAULT_SUBJECT = 'New job assigned [JobNumber]';
        const DEFAULT_BODY = 'Hi [AgentName]\n\nYou have been assigned a new job [JobNumber]. [InboundUrl]';

        const willEmailPreview = {
            status: 'Queued',
            agentEmail: 'agent@example.com',
            willEmail: true,
            defaultSubject: DEFAULT_SUBJECT,
            defaultBody: DEFAULT_BODY,
        };

        afterEach(() => {
            // Restore the never-resolving default the other suites rely on.
            mockPreview.mockImplementation(neverResolves);
        });

        it('renders subject and body fields seeded from the server default templates', async () => {
            mockPreview.mockResolvedValue(willEmailPreview);

            renderWithTheme(
                <FlightAgentConfirmationDialog {...defaultProps} mode="agent" agent={createAgent()}/>
            );

            expect(await screen.findByLabelText('Subject')).toHaveValue(DEFAULT_SUBJECT);
            expect(screen.getByLabelText('Message')).toHaveValue(DEFAULT_BODY);
        });

        it('passes the edited subject and body to onConfirm', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();
            mockPreview.mockResolvedValue(willEmailPreview);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    onConfirm={onConfirm}
                />
            );

            const bodyInput = await screen.findByLabelText('Message');
            await user.clear(bodyInput);
            await user.click(bodyInput);
            await user.paste('Edited body for the agent');

            await user.click(screen.getByText('Confirm Assignment'));

            expect(onConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    emailSubject: DEFAULT_SUBJECT,
                    emailBody: 'Edited body for the agent',
                })
            );
        });

        it('hides the email fields and omits the template when no email will be sent', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();
            mockPreview.mockResolvedValue({
                status: 'NoAgentEmail',
                agentEmail: null,
                willEmail: false,
                defaultSubject: DEFAULT_SUBJECT,
                defaultBody: DEFAULT_BODY,
            });

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="agent"
                    agent={createAgent()}
                    onConfirm={onConfirm}
                />
            );

            // The warning notice resolves; the editable fields must not appear.
            await waitFor(() => expect(mockPreview).toHaveBeenCalled());
            expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();

            await user.click(screen.getByText('Confirm Assignment'));

            const result = onConfirm.mock.calls[0][0];
            expect(result.emailSubject).toBeUndefined();
            expect(result.emailBody).toBeUndefined();
        });
    });

    describe('Issue #4: Delivery By Time', () => {
        it('includes deliverByTime from API response in confirmation result', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();

            const cargoProcessing = createCargoProcessing({
                deliverByTime: dayjs('2024-03-15T18:00:00'),
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(cargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                    onConfirm={onConfirm}
                />
            );

            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();

            await user.click(screen.getByText('Confirm Assignment'));

            const result = onConfirm.mock.calls[0][0];
            expect(result.packageDeliverByTime).toBeDefined();
            expect(result.packageDeliverByTime.hour()).toBe(18);
        });

        it('does not include deliverByTime when not provided by API', async () => {
            const user = setupUser();
            const onConfirm = jest.fn();

            // No deliverByTime in the response
            const cargoProcessing = createCargoProcessing({
                deliverByTime: undefined,
            });

            const onCalculateCargoTimes = jest.fn().mockResolvedValue(cargoProcessing);

            renderWithTheme(
                <FlightAgentConfirmationDialog
                    {...defaultProps}
                    mode="flight"
                    flight={createFlight()}
                    onCalculateCargoTimes={onCalculateCargoTimes}
                    onConfirm={onConfirm}
                />
            );

            expect(await screen.findByText('06:00 - 22:00')).toBeInTheDocument();

            await user.click(screen.getByText('Confirm Assignment'));

            const result = onConfirm.mock.calls[0][0];
            // deliverByTime should be undefined if not provided by API
            expect(result.packageDeliverByTime).toBeUndefined();
        });
    });
});
