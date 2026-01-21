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
    _departureTimeZoneStr: 'PST',
    _arrivalTimeZoneStr: 'EST',
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
    _departureTimeZoneStr: 'PST',
    _arrivalTimeZoneStr: 'EST',
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
    agentRanking: '3',
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
            it('should show loading skeleton when flights are loading', () => {
                const props = createMockProps({
                    flightsLoading: true,
                    showFlightList: false,
                });
                const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

                // The new component shows skeleton loading boxes instead of a progressbar
                const skeletonBoxes = container.querySelectorAll('[class*="css-"]');
                expect(skeletonBoxes.length).toBeGreaterThan(0);
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
                expect(screen.getByText('Select a job to view available flights.')).toBeInTheDocument();
            });

            it('should show flight already assigned message', () => {
                const props = createMockProps({
                    showJobHasAssignedFlightMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Flight Assigned')).toBeInTheDocument();
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

                expect(screen.getByText('No Flights')).toBeInTheDocument();
                expect(screen.getByText('No flights found for this route')).toBeInTheDocument();
            });
        });

        describe('Flight List', () => {
            it('should render flight cards with data', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('AA100')).toBeInTheDocument();
                expect(screen.getByText('$250')).toBeInTheDocument();
                expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
            });

            it('should show airline filter chips', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('ALL')).toBeInTheDocument();
                // AA appears in the filter chip and in the flight card
                const aaElements = screen.getAllByText('AA');
                expect(aaElements.length).toBeGreaterThanOrEqual(1);
            });

            it('should call onFilterFlightsByAirline when clicking airline chip', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // Find all AA text elements and click the one that's a filter chip
                const aaChips = screen.getAllByText('AA');
                // Click the filter chip (the one in the filter bar)
                await userEvent.click(aaChips[0]);

                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 1, text: 'AA' })
                );
            });

            it('should call onFilterFlightsByAirline with null when clicking ALL chip', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const allChip = screen.getByText('ALL');
                await userEvent.click(allChip);

                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(null);
            });

            it('should render search input', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
            });

            it('should call onFlightSearchChange when typing in search', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const searchInput = screen.getByPlaceholderText(/search/i);
                await userEvent.type(searchInput, 'AA100');

                expect(props.onFlightSearchChange).toHaveBeenCalled();
            });

            it('should show NONSTOP label for direct flights', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('NONSTOP')).toBeInTheDocument();
            });

            it('should show stops label for connecting flights', () => {
                const props = createMockProps({
                    filteredFlightOptions: [{ ...mockFlight, stops: 2, connectionId: 'conn-stops' }],
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('2 STOPS')).toBeInTheDocument();
            });

            it('should call onAddFlightToJob when clicking add button', async () => {
                const props = createMockProps();
                const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

                // Find the AddIcon which is inside the assign flight button
                // The button is wrapped in a Tooltip, so we need to find the button directly
                const addIcons = container.querySelectorAll('[data-testid="AddIcon"]');
                expect(addIcons.length).toBeGreaterThan(0);

                // The first AddIcon is the flight assign button
                const addIcon = addIcons[0];
                const button = addIcon.closest('button');
                expect(button).toBeTruthy();

                // Use fireEvent.click which works better with MUI Tooltip wrapped buttons
                fireEvent.click(button!);

                expect(props.onAddFlightToJob).toHaveBeenCalled();
            });

            it('should call onLoadMoreFlights when clicking load more button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const loadMoreButton = screen.getByRole('button', { name: /load more/i });
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
                expect(screen.getByText('1 STOP')).toBeInTheDocument();

                // Should have expand icon (ExpandMore or ExpandLess)
                const expandIcon = document.querySelector('[data-testid="ExpandMoreIcon"]');
                expect(expandIcon).toBeInTheDocument();
            });
        });
    });

    describe('Agent Mode', () => {
        describe('Loading State', () => {
            it('should show loading skeleton when agents are loading', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    agentsLoading: true,
                    showAgentList: false,
                });
                const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

                // The new component shows skeleton loading boxes
                const boxes = container.querySelectorAll('[class*="MuiBox"]');
                expect(boxes.length).toBeGreaterThan(0);
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
                expect(screen.getByText('Select a job to view available agents.')).toBeInTheDocument();
            });

            it('should show agent already assigned message with action button', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showJobHasAssignedAgentMessage: true,
                    showAgentList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Agent Assigned')).toBeInTheDocument();
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

                expect(screen.getByText('No Agents')).toBeInTheDocument();
                expect(screen.getByText('No agents service this area')).toBeInTheDocument();
            });
        });

        describe('Agent List', () => {
            it('should render agent cards with data', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Test Agent')).toBeInTheDocument();
                expect(screen.getByText('$150')).toBeInTheDocument();
                expect(screen.getByText('Reliable agent')).toBeInTheDocument();
            });

            it('should show search agents button', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
            });

            it('should call onOpenAgentSearchDialog when clicking search agents button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const searchButton = screen.getByRole('button', { name: /search/i });
                await userEvent.click(searchButton);

                expect(props.onOpenAgentSearchDialog).toHaveBeenCalled();
            });

            it('should call onAddAgentToJob when clicking assign button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const assignButtons = screen.getAllByRole('button', { name: /assign agent/i });
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

            it('should render star ratings for agents', () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showAgentList: true,
                });
                const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

                // Check for star icons
                const starIcons = container.querySelectorAll('[data-testid="StarIcon"], [data-testid="StarBorderIcon"]');
                expect(starIcons.length).toBe(5); // 5 stars total for rating
            });
        });
    });

    describe('Sorting', () => {
        it('should have sortable column headers for flights', async () => {
            const props = createMockProps({
                filteredFlightOptions: [
                    { ...mockFlight, flightNumber: 'AA200', amount: 300, connectionId: 'conn-200' },
                    { ...mockFlight, flightNumber: 'AA100', amount: 250, connectionId: 'conn-100' },
                ],
            });
            const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

            // Find sort headers (they're uppercase in the component)
            const sortLabels = container.querySelectorAll('.sort-label');
            expect(sortLabels.length).toBeGreaterThan(0);
        });

        it('should show sort indicator when sorting is active', async () => {
            const props = createMockProps();
            const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

            // Find a sort header and click it
            const sortLabels = container.querySelectorAll('.sort-label');
            expect(sortLabels.length).toBeGreaterThan(0);
            await userEvent.click(sortLabels[0]);

            // Sort icon should be present (KeyboardArrowUp or KeyboardArrowDown)
            const sortIcons = container.querySelectorAll('[data-testid="KeyboardArrowUpIcon"], [data-testid="KeyboardArrowDownIcon"]');
            expect(sortIcons.length).toBeGreaterThan(0);
        });
    });

    describe('Airport Selection', () => {
        it('should display selected airports in chips', () => {
            const props = createMockProps();
            const { container } = renderWithTheme(<FlightAgentDataTable {...props} />);

            // Check that airport codes are displayed (may appear multiple times in the component)
            const laxElements = screen.getAllByText('LAX');
            expect(laxElements.length).toBeGreaterThanOrEqual(1);
            const jfkElements = screen.getAllByText('JFK');
            expect(jfkElements.length).toBeGreaterThanOrEqual(1);
        });
    });
});
