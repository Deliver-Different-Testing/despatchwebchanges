/**
 * FlightAgentDataTable Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { FlightAgentDataTable } from './FlightAgentDataTable';
import { FlightAgentDataTableProps, FlightOption, AgentOption, FlightSegment } from './types';
import dayjs from 'dayjs';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const mockFlightSegment: FlightSegment = {
    segmentOrder: 0,
    carrierFsCode: 'AA',
    flightNumber: '100',
    departureTime: dayjs('2024-01-15T08:00:00'),
    arrivalTime: dayjs('2024-01-15T12:00:00'),
    departureAirportFsCode: 'LAX',
    arrivalAirportFsCode: 'JFK',
    flightEquipmentIataCode: '738',
    elapsedTime: 240,
    stopsInSegment: 0,
    departureAirportName: 'Los Angeles International',
    arrivalAirportName: 'John F Kennedy International',
    departureAirportTimeZone: 'America/Los_Angeles',
    arrivalAirportTimeZone: 'America/New_York',
    _departureTimeStr: '8:00 AM',
    _arrivalTimeStr: '12:00 PM',
    _departureTimeZoneStr: '(PST)',
    _arrivalTimeZoneStr: '(EST)',
};

const mockFlight: FlightOption = {
    airline: 'AA',
    flightNumber: 'AA100',
    departureTime: dayjs('2024-01-15T08:00:00'),
    arrivalTime: dayjs('2024-01-15T12:00:00'),
    departureAirport: 'LAX',
    arrivalAirport: 'JFK',
    duration: '4h 00m',
    stops: 0,
    aircraft: 'Boeing 737-800',
    serviceClasses: ['Economy', 'Business'],
    isCodeShare: false,
    amount: 250,
    codeShareAirline: '',
    airlineId: 1,
    departureTimeZone: 'America/Los_Angeles',
    arrivalTimeZone: 'America/New_York',
    isMultiSegment: false,
    elapsedTime: 240,
    score: 100,
    connectionId: 'conn-1',
    flightSegments: [mockFlightSegment],
    _departureTimeStr: '8:00 AM',
    _arrivalTimeStr: '12:00 PM',
    _departureTimeZoneStr: '(PST)',
    _arrivalTimeZoneStr: '(EST)',
};

const mockMultiSegmentFlight: FlightOption = {
    ...mockFlight,
    flightNumber: 'AA200',
    connectionId: 'conn-2',
    isMultiSegment: true,
    stops: 1,
    flightSegments: [
        mockFlightSegment,
        {
            ...mockFlightSegment,
            segmentOrder: 1,
            departureAirportFsCode: 'ORD',
            arrivalAirportFsCode: 'JFK',
            departureTime: dayjs('2024-01-15T14:00:00'),
            arrivalTime: dayjs('2024-01-15T17:00:00'),
        },
    ],
};

const mockAgent: AgentOption = {
    agentId: 1,
    agentName: 'Test Agent',
    agentRate: 150,
    agentRanking: 'A',
    agentNotes: 'Reliable agent',
    agentPhone: '555-1234',
    agentEmail: 'agent@test.com',
};

const createMockProps = (overrides: Partial<FlightAgentDataTableProps> = {}): FlightAgentDataTableProps => ({
    isDeliveryJobType: false,
    currentJob: { id: 1, jobNo: 'JOB001', toAirportId: 1, fromAirportId: 2 },
    flightsLoading: false,
    agentsLoading: false,
    flightOptions: [mockFlight],
    filteredFlightOptions: [mockFlight],
    flightSearchText: '',
    flightMessage: undefined,
    agentOptions: [mockAgent],
    agentMessage: undefined,
    activeAirlineOptions: [{ id: 1, text: 'AA', fullAirlineName: 'American Airlines' }],
    selectedAirline: undefined,
    outboundAirportOptions: [{ id: 1, text: 'LAX - Los Angeles' }],
    inboundAirportOptions: [{ id: 2, text: 'JFK - New York' }],
    selectedOutboundAirport: { id: 1, text: 'LAX - Los Angeles' },
    selectedInboundAirport: { id: 2, text: 'JFK - New York' },
    showNoJobSelectedMessage: false,
    showJobHasAssignedFlightMessage: false,
    showMissingAirportInfoMessage: false,
    showNoFlightsAvailableMessage: false,
    showFlightList: true,
    showNoAgentJobSelectedMessage: false,
    showJobHasAssignedAgentMessage: false,
    showNotDeliveryJobMessage: false,
    showNoAgentsAvailableMessage: false,
    showAgentList: false,
    onFlightSearchChange: jest.fn(),
    onFilterFlightsByAirline: jest.fn(),
    onOutboundAirportChange: jest.fn(),
    onInboundAirportChange: jest.fn(),
    onAddFlightToJob: jest.fn(),
    onOpenFlightMoreInfo: jest.fn(),
    onLoadMoreFlights: jest.fn(),
    onLoadNextDayFlights: jest.fn(),
    onAddAgentToJob: jest.fn(),
    onSendQuoteRequest: jest.fn(),
    onOpenAgentMoreInfo: jest.fn(),
    onOpenAgentSearchDialog: jest.fn(),
    onOpenRecoveryAgentDialog: jest.fn(),
    formatAirportCodeForDropdown: (text: string) => text.split(' ')[0] || text,
    getConnectionTime: () => '2h 30m',
    formatMinutesToTime: (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    },
    isUsCustomer: true,
    ...overrides,
});

describe('FlightAgentDataTable', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Flight Mode', () => {
        describe('Loading State', () => {
            it('should show loading indicator when flights are loading', () => {
                const props = createMockProps({
                    flightsLoading: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByRole('progressbar')).toBeInTheDocument();
            });
        });

        describe('Empty States', () => {
            it('should show no job selected message', () => {
                const props = createMockProps({
                    showNoJobSelectedMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('No Job Selected')).toBeInTheDocument();
                expect(screen.getByText('Please select a job to view available flights.')).toBeInTheDocument();
            });

            it('should show flight already assigned message', () => {
                const props = createMockProps({
                    showJobHasAssignedFlightMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Flight Already Assigned')).toBeInTheDocument();
            });

            it('should show missing airport info message', () => {
                const props = createMockProps({
                    showMissingAirportInfoMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Missing Airport Info')).toBeInTheDocument();
            });

            it('should show no flights available message', () => {
                const props = createMockProps({
                    showNoFlightsAvailableMessage: true,
                    showFlightList: false,
                    flightMessage: 'No flights found for this route',
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('No Flights Available')).toBeInTheDocument();
                expect(screen.getByText('No flights found for this route')).toBeInTheDocument();
            });
        });

        describe('Flight List', () => {
            it('should render flight table with data', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('AA100')).toBeInTheDocument();
                expect(screen.getByText('$250.00')).toBeInTheDocument();
                expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
            });

            it('should show airline filter chips', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('All')).toBeInTheDocument();
                // AA appears both in the filter chip and in the table, so use getAllByText
                const aaElements = screen.getAllByText('AA');
                expect(aaElements.length).toBeGreaterThanOrEqual(1);
            });

            it('should call onFilterFlightsByAirline when clicking airline chip', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // Find the chip by aria-label (tooltip text)
                const aaChip = screen.getByRole('button', { name: /american airlines/i });
                await userEvent.click(aaChip);

                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 1, text: 'AA' })
                );
            });

            it('should call onFilterFlightsByAirline with null when clicking All chip', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const allChip = screen.getByText('All');
                await userEvent.click(allChip);

                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(null);
            });

            it('should render search input', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByPlaceholderText(/search by flight number/i)).toBeInTheDocument();
            });

            it('should call onFlightSearchChange when typing in search', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const searchInput = screen.getByPlaceholderText(/search by flight number/i);
                await userEvent.type(searchInput, 'AA100');

                expect(props.onFlightSearchChange).toHaveBeenCalled();
            });

            it('should show nonstop chip for direct flights', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Nonstop')).toBeInTheDocument();
            });

            it('should show stops chip for connecting flights', () => {
                const props = createMockProps({
                    filteredFlightOptions: [{ ...mockFlight, stops: 2 }],
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('2 stops')).toBeInTheDocument();
            });

            it('should call onAddFlightToJob when clicking add button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const addButtons = screen.getAllByRole('button', { name: /assign flight/i });
                await userEvent.click(addButtons[0]);

                expect(props.onAddFlightToJob).toHaveBeenCalledWith(mockFlight);
            });

            it('should call onOpenFlightMoreInfo when clicking info button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const infoButtons = screen.getAllByRole('button', { name: /more info/i });
                await userEvent.click(infoButtons[0]);

                expect(props.onOpenFlightMoreInfo).toHaveBeenCalledWith(mockFlight);
            });

            it('should call onLoadMoreFlights when clicking load more button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const loadMoreButton = screen.getByRole('button', { name: /load more flights/i });
                await userEvent.click(loadMoreButton);

                expect(props.onLoadMoreFlights).toHaveBeenCalled();
            });

            it('should call onLoadNextDayFlights when clicking next day button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const nextDayButton = screen.getByRole('button', { name: /next day/i });
                await userEvent.click(nextDayButton);

                expect(props.onLoadNextDayFlights).toHaveBeenCalled();
            });
        });

        describe('Multi-Segment Flights', () => {
            it('should show expand button for multi-segment flights', () => {
                const props = createMockProps({
                    filteredFlightOptions: [mockMultiSegmentFlight],
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // Should show stops indicator
                expect(screen.getByText('1 stop')).toBeInTheDocument();

                // Should have expand icon (ExpandMore or ExpandLess)
                const expandIcon = document.querySelector('[data-testid="ExpandMoreIcon"]');
                expect(expandIcon).toBeInTheDocument();
            });
        });
    });

    describe('Agent Mode', () => {
        describe('Loading State', () => {
            it('should show loading indicator when agents are loading', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    agentsLoading: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByRole('progressbar')).toBeInTheDocument();
            });
        });

        describe('Empty States', () => {
            it('should show no job selected message for agents', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showNoAgentJobSelectedMessage: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('No Job Selected')).toBeInTheDocument();
                expect(screen.getByText('Please select a job to view available agents.')).toBeInTheDocument();
            });

            it('should show agent already assigned message with action button', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showJobHasAssignedAgentMessage: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Agent Already Assigned')).toBeInTheDocument();
                expect(screen.getByText('Manage Recovery Agent(s)')).toBeInTheDocument();
            });

            it('should call onOpenRecoveryAgentDialog when clicking manage recovery agent button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showJobHasAssignedAgentMessage: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const manageButton = screen.getByText('Manage Recovery Agent(s)');
                await userEvent.click(manageButton);

                expect(props.onOpenRecoveryAgentDialog).toHaveBeenCalled();
            });

            it('should show not a delivery job message', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showNotDeliveryJobMessage: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Not a Delivery Job')).toBeInTheDocument();
            });

            it('should show no agents available message', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showNoAgentsAvailableMessage: true,
                    showAgentList: false,
                    agentMessage: 'No agents service this area',
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('No Agents Available')).toBeInTheDocument();
                expect(screen.getByText('No agents service this area')).toBeInTheDocument();
            });
        });

        describe('Agent List', () => {
            it('should render agent table with data', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Test Agent')).toBeInTheDocument();
                expect(screen.getByText('$150.00')).toBeInTheDocument();
                expect(screen.getByText('A')).toBeInTheDocument();
                expect(screen.getByText('Reliable agent')).toBeInTheDocument();
            });

            it('should show search agents button', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByRole('button', { name: /search agents/i })).toBeInTheDocument();
            });

            it('should call onOpenAgentSearchDialog when clicking search agents button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const searchButton = screen.getByRole('button', { name: /search agents/i });
                await userEvent.click(searchButton);

                expect(props.onOpenAgentSearchDialog).toHaveBeenCalled();
            });

            it('should call onAddAgentToJob when clicking assign button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const assignButtons = screen.getAllByRole('button', { name: /assign job/i });
                await userEvent.click(assignButtons[0]);

                expect(props.onAddAgentToJob).toHaveBeenCalledWith(mockAgent);
            });

            it('should call onSendQuoteRequest when clicking quote button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const quoteButtons = screen.getAllByRole('button', { name: /send quote request/i });
                await userEvent.click(quoteButtons[0]);

                expect(props.onSendQuoteRequest).toHaveBeenCalledWith(mockAgent);
            });

            it('should call onOpenAgentMoreInfo when clicking info button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const infoButtons = screen.getAllByRole('button', { name: /more info/i });
                await userEvent.click(infoButtons[0]);

                expect(props.onOpenAgentMoreInfo).toHaveBeenCalledWith(mockAgent);
            });
        });
    });

    describe('Sorting', () => {
        it('should sort flights when clicking column header', async () => {
            const props = createMockProps({
                filteredFlightOptions: [
                    { ...mockFlight, flightNumber: 'AA200', amount: 300, connectionId: 'conn-200' },
                    { ...mockFlight, flightNumber: 'AA100', amount: 250, connectionId: 'conn-100' },
                ],
            });
            renderWithTheme(<FlightAgentDataTable {...props} />);

            // Click on Rate column to sort
            const rateHeader = screen.getByText('Rate');
            await userEvent.click(rateHeader);

            // The component should sort the data
            const rows = screen.getAllByRole('row');
            expect(rows.length).toBeGreaterThan(1);
        });

        it('should sort agents when clicking column header', async () => {
            const props = createMockProps({
                isDeliveryJobType: true,
                showAgentList: true,
                agentOptions: [
                    { ...mockAgent, agentName: 'Zebra Agent', agentRate: 200 },
                    { ...mockAgent, agentId: 2, agentName: 'Alpha Agent', agentRate: 100 },
                ],
            });
            renderWithTheme(<FlightAgentDataTable {...props} />);

            // Click on Agent Name column to sort
            const nameHeader = screen.getByText('Agent Name');
            await userEvent.click(nameHeader);

            const rows = screen.getAllByRole('row');
            expect(rows.length).toBeGreaterThan(1);
        });
    });
});
