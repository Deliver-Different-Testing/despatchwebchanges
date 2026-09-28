/**
 * FlightAgentDataTable Component Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {renderWithMantine} from '../../../__testUtils__';
import {FlightAgentDataTable} from './FlightAgentDataTable';
import {AgentOption, FlightAgentDataTableProps, FlightOption, FlightSegment} from './types';
import dayjs from 'dayjs';
import {openFlightDetailsDialog} from '../../dialogs/flight-details-dialog';
import {openAgentInfoDialog} from '../../dialogs/agent-info-dialog';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

jest.mock('../../dialogs/flight-details-dialog', () => ({
    openFlightDetailsDialog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../dialogs/agent-info-dialog', () => ({
    openAgentInfoDialog: jest.fn().mockResolvedValue(undefined),
}));


const renderWithTheme = (ui: React.ReactElement) =>
    renderWithMantine(ui);

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
    serviceType: 'J',
    isCharter: false,
    serviceTypeDescription: 'Scheduled Passenger',
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
    currentJob: {id: 1, jobNo: 'JOB001', toAirportId: 1, fromAirportId: 2},
    flightsLoading: false,
    agentsLoading: false,
    flightOptions: [mockFlight],
    filteredFlightOptions: [mockFlight],
    flightSearchText: '',
    flightMessage: undefined,
    agentOptions: [mockAgent],
    agentMessage: undefined,
    activeAirlineOptions: [{id: 1, text: 'AA', fullAirlineName: 'American Airlines'}],
    selectedAirline: undefined,
    includeNearbyAirports: false,
    outboundAirportOptions: [{id: 1, text: 'LAX - Los Angeles'}],
    inboundAirportOptions: [{id: 2, text: 'JFK - New York'}],
    selectedOutboundAirport: {id: 1, text: 'LAX - Los Angeles'},
    selectedInboundAirport: {id: 2, text: 'JFK - New York'},
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
    onToggleNearbyAirports: jest.fn(),
    onOutboundAirportChange: jest.fn(),
    onInboundAirportChange: jest.fn(),
    onAddFlightToJob: jest.fn(),
    onLoadMoreFlights: jest.fn(),
    onLoadNextDayFlights: jest.fn(),
    onAddAgentToJob: jest.fn(),
    onSendQuoteRequest: jest.fn(),
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
    // ── Flight Mode ─────────────────────────────────────────────────
    describe('Flight Mode', () => {
        it('shows loading indicator when flights are loading', () => {
            renderWithTheme(
                <FlightAgentDataTable {...createMockProps({flightsLoading: true, showFlightList: false})} />
            );
            expect(screen.getByRole('progressbar', {name: /loading/i})).toBeInTheDocument();
        });

        // ── Flight empty states (single render each) ────────────────
        describe('Empty States', () => {
            it.each([
                ['showNoJobSelectedMessage', 'No Job Selected'],
                ['showJobHasAssignedFlightMessage', 'Flight Already Assigned'],
                ['showMissingAirportInfoMessage', 'Missing Airport Info'],
            ] as const)('shows %s message', (propName, expectedText) => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({[propName]: true, showFlightList: false})} />
                );
                expect(screen.getByText(expectedText)).toBeInTheDocument();
            });

            it('shows no flights available message with airline chips and airport selectors', () => {
                const props = createMockProps({
                    showNoFlightsAvailableMessage: true,
                    showFlightList: false,
                    flightMessage: 'No flights found for this route',
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // No flights message
                expect(screen.getByText('No Flights Available')).toBeInTheDocument();
                expect(screen.getByText('No flights found for this route')).toBeInTheDocument();

                // Airline filter chips visible
                expect(screen.getByText('All')).toBeInTheDocument();
                expect(screen.getAllByText('AA').length).toBeGreaterThanOrEqual(1);

                // Airport selectors visible
                expect(screen.getAllByText('LAX').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('JFK').length).toBeGreaterThanOrEqual(1);
            });

            it('allows changing airline filter from no-flights state', async () => {
                const props = createMockProps({
                    showNoFlightsAvailableMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await userEvent.click(screen.getAllByText('AA')[0]);
                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(expect.objectContaining({id: 1, text: 'AA'}));

                await userEvent.click(screen.getByText('All'));
                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(null);
            });

            it('opens departure airport menu from no-flights state', async () => {
                const props = createMockProps({
                    showNoFlightsAvailableMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const departureButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('LAX'));
                await userEvent.click(departureButton!);
                expect(await screen.findByText('LAX - Los Angeles')).toBeInTheDocument();
            });

            it('opens arrival airport menu from no-flights state', async () => {
                const props = createMockProps({
                    showNoFlightsAvailableMessage: true,
                    showFlightList: false,
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                const arrivalButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('JFK'));
                await userEvent.click(arrivalButton!);
                expect(await screen.findByText('JFK - New York')).toBeInTheDocument();
            });
        });

        // ── Flight list (consolidated read-only) ────────────────────
        describe('Flight List', () => {
            it('renders flight table with data, filters, search and action buttons', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // Flight data
                expect(screen.getByText('AA100')).toBeInTheDocument();
                expect(screen.getByText('$250.00')).toBeInTheDocument();
                expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
                expect(screen.getByText('Nonstop')).toBeInTheDocument();

                // Airline filter chips
                expect(screen.getByText('All')).toBeInTheDocument();
                expect(screen.getAllByText('AA').length).toBeGreaterThanOrEqual(1);

                // Search input
                expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();

                // Action buttons
                expect(screen.getAllByRole('button', {name: 'Assign Flight'}).length).toBeGreaterThan(0);
                expect(screen.getAllByRole('button', {name: 'More Info'}).length).toBeGreaterThan(0);
                expect(screen.getByRole('button', {name: /^more$/i})).toBeInTheDocument();
                expect(screen.getByRole('button', {name: /next day/i})).toBeInTheDocument();

                // Airport selectors
                expect(screen.getAllByText('LAX').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('JFK').length).toBeGreaterThanOrEqual(1);

                // Sortable headers
                const sortLabels = screen.getAllByRole('button', {name: /airline|flight no|departure|arrival|duration|stops|rate|aircraft/i});
                expect(sortLabels.length).toBeGreaterThan(0);
            });

            it('shows a Charter chip for charter flights and hides it for scheduled flights', () => {
                // Scheduled flight (default mock) - no chip
                const {unmount} = renderWithTheme(<FlightAgentDataTable {...createMockProps()} />);
                expect(screen.queryByText('Charter')).not.toBeInTheDocument();
                unmount();

                // Charter flight - chip visible
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        filteredFlightOptions: [{
                            ...mockFlight,
                            connectionId: 'conn-charter',
                            serviceType: 'C',
                            isCharter: true,
                            serviceTypeDescription: 'Charter (Passenger)',
                        }],
                    })} />
                );
                expect(screen.getByText('Charter')).toBeInTheDocument();
            });

            it('toggles nearby-airport search when clicking the Nearby button', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await userEvent.click(screen.getByRole('button', {name: /nearby/i}));
                expect(props.onToggleNearbyAirports).toHaveBeenCalledWith(true);
            });

            it('reflects active nearby-airport state via aria-pressed', () => {
                renderWithTheme(<FlightAgentDataTable {...createMockProps({includeNearbyAirports: true})} />);
                expect(screen.getByRole('button', {name: /nearby/i})).toHaveAttribute('aria-pressed', 'true');
            });

            it('shows stops label for connecting flights', () => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        filteredFlightOptions: [{...mockFlight, stops: 2, connectionId: 'conn-stops'}],
                    })} />
                );
                expect(screen.getByText('2 stops')).toBeInTheDocument();
            });

            it('calls onFilterFlightsByAirline when clicking airline chip', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await userEvent.click(screen.getAllByText('AA')[0]);
                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(expect.objectContaining({
                    id: 1,
                    text: 'AA'
                }));

                await userEvent.click(screen.getByText('All'));
                expect(props.onFilterFlightsByAirline).toHaveBeenCalledWith(null);
            });

            it('calls onFlightSearchChange when typing in search', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                fireEvent.change(screen.getByPlaceholderText(/search/i), {target: {value: 'AA100'}});
                expect(props.onFlightSearchChange).toHaveBeenCalled();
            });

            it('calls onAddFlightToJob when clicking add button', () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                fireEvent.click(screen.getAllByRole('button', {name: 'Assign Flight'})[0]);
                expect(props.onAddFlightToJob).toHaveBeenCalled();
            });

            it('opens flight details dialog when clicking info button', () => {
                const mockOpen = openFlightDetailsDialog as jest.Mock;
                mockOpen.mockClear();
                renderWithTheme(<FlightAgentDataTable {...createMockProps()} />);

                fireEvent.click(screen.getAllByRole('button', {name: 'More Info'})[0]);
                expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({flightNumber: 'AA100', airline: 'AA'}));
            });

            it('calls onLoadMoreFlights and onLoadNextDayFlights', async () => {
                const props = createMockProps();
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await userEvent.click(screen.getByRole('button', {name: /^more$/i}));
                expect(props.onLoadMoreFlights).toHaveBeenCalled();

                await userEvent.click(screen.getByRole('button', {name: /next day/i}));
                expect(props.onLoadNextDayFlights).toHaveBeenCalled();
            });

            it('opens airport menu when clicking departure airport button', async () => {
                renderWithTheme(<FlightAgentDataTable {...createMockProps()} />);

                const departureButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('LAX'));
                await userEvent.click(departureButton!);
                expect(await screen.findByText('LAX - Los Angeles')).toBeInTheDocument();
            });
        });

        // ── Multi-Segment Flights ───────────────────────────────────
        describe('Multi-Segment Flights', () => {
            it('shows expand button for multi-segment flights', () => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({filteredFlightOptions: [mockMultiSegmentFlight]})} />
                );
                expect(screen.getByText('1 stop')).toBeInTheDocument();
                expect(screen.getByRole('button', {name: /expand segments/i})).toHaveAttribute('aria-expanded', 'false');
            });
        });

        // ── Airport menus ───────────────────────────────────────────
        // Chunk 4 moves these off `anchorEl` onto `Menu.Target`. Nothing below
        // was covered before, so the restructure could have dropped any of it.
        describe('Airport menus', () => {
            // The no-flights state is used because it renders the filter bar without a
            // table, so 'LAX' resolves to the airport button and not a row cell.
            const filterBarOnly = {showNoFlightsAvailableMessage: true, showFlightList: false};

            const openOutboundMenu = async () =>
                userEvent.click(screen.getByRole('button', {name: 'Departure airport'}));

            it('selects an airport from the menu', async () => {
                const props = createMockProps({...filterBarOnly, selectedOutboundAirport: undefined});
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await openOutboundMenu();
                await userEvent.click(await screen.findByText('LAX - Los Angeles'));

                expect(props.onOutboundAirportChange).toHaveBeenCalledWith(
                    expect.objectContaining({id: 1}),
                );
            });

            it('clears the selection when one is set', async () => {
                const props = createMockProps(filterBarOnly);
                renderWithTheme(<FlightAgentDataTable {...props} />);

                await openOutboundMenu();
                await userEvent.click(await screen.findByText('Clear selection'));

                expect(props.onOutboundAirportChange).toHaveBeenCalledWith(null);
            });

            it('marks the selected airport in the list', async () => {
                renderWithTheme(<FlightAgentDataTable {...createMockProps(filterBarOnly)} />);

                await openOutboundMenu();

                // The check glyph is the only thing distinguishing the selected item, and
                // Lucide emits no test hook — hence the data attribute on the item.
                const item = (await screen.findByText('LAX - Los Angeles')).closest('[data-selected]');
                expect(item).toHaveAttribute('data-selected', 'true');
            });

            it('offers no Clear item when nothing is selected', async () => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        ...filterBarOnly,
                        selectedOutboundAirport: undefined,
                    })} />
                );

                await openOutboundMenu();
                await screen.findByText('LAX - Los Angeles');
                expect(screen.queryByText('Clear selection')).not.toBeInTheDocument();
            });
        });

        // ── Expand / collapse ───────────────────────────────────────
        describe('Segment expansion', () => {
            const multiSegmentProps = {
                filteredFlightOptions: [
                    {...mockMultiSegmentFlight, flightNumber: 'AA200', amount: 300},
                    {...mockFlight, flightNumber: 'AA100', amount: 250},
                ],
            };

            it('toggles aria-expanded and reveals the segment airports', async () => {
                const user = setupUser();
                renderWithTheme(<FlightAgentDataTable {...createMockProps(multiSegmentProps)} />);

                const toggle = screen.getByRole('button', {name: /expand segments/i});
                expect(toggle).toHaveAttribute('aria-expanded', 'false');

                await user.click(toggle);

                // aria-expanded is asserted rather than visibility: MUI's Collapse hides
                // with `visibility`, Mantine's with `height`, so toBeVisible() inverts
                // silently across the conversion.
                const expanded = screen.getByRole('button', {name: /collapse segments/i});
                expect(expanded).toHaveAttribute('aria-expanded', 'true');
                expect(screen.getAllByText('ORD').length).toBeGreaterThan(0);
                expect(screen.getByText('2h 30m')).toBeInTheDocument();
            });

            it('keeps a flight expanded across a re-sort', async () => {
                const user = setupUser();
                renderWithTheme(<FlightAgentDataTable {...createMockProps(multiSegmentProps)} />);

                await user.click(screen.getByRole('button', {name: /expand segments/i}));
                expect(screen.getByRole('button', {name: /collapse segments/i})).toBeInTheDocument();

                // Expansion is keyed on connectionId, not row index — re-sorting must
                // not reset it.
                await user.click(screen.getByRole('button', {name: /rate/i}));

                expect(screen.getByRole('button', {name: /collapse segments/i}))
                    .toHaveAttribute('aria-expanded', 'true');
            });
        });

        // ── Codeshare marker ────────────────────────────────────────
        it('marks codeshare flights with an asterisk', () => {
            const {unmount} = renderWithTheme(<FlightAgentDataTable {...createMockProps()} />);
            expect(screen.queryByText('*')).not.toBeInTheDocument();
            unmount();

            renderWithTheme(
                <FlightAgentDataTable {...createMockProps({
                    filteredFlightOptions: [{...mockFlight, isCodeShare: true}],
                })} />
            );
            expect(screen.getByText('*')).toBeInTheDocument();
        });

        // ── Sorting ─────────────────────────────────────────────────
        describe('Sorting', () => {
            it('has sortable column headers and sorts on click', async () => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        filteredFlightOptions: [
                            {...mockFlight, flightNumber: 'AA200', amount: 300, connectionId: 'conn-200'},
                            {...mockFlight, flightNumber: 'AA100', amount: 250, connectionId: 'conn-100'},
                        ],
                    })} />
                );

                // Row order is the library-independent proof that the sort ran;
                // aria-sort is the accessibility contract SortableTh added, which
                // MUI's TableSortLabel never set.
                // getAllByText returns document order, and the flight number is its own
                // element — the row's textContent runs the cells together with no
                // separator, so a regex over the row cannot find its boundary.
                const flightNumbersInOrder = () =>
                    screen.getAllByText(/^AA\d{3}$/).map(el => el.textContent);

                const rateHeader = screen.getByRole('button', {name: /rate/i});

                await userEvent.click(rateHeader);
                expect(flightNumbersInOrder()).toEqual(['AA100', 'AA200']);
                expect(rateHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');

                // Clicking the same column again flips the direction.
                await userEvent.click(rateHeader);
                expect(flightNumbersInOrder()).toEqual(['AA200', 'AA100']);
                expect(rateHeader.closest('th')).toHaveAttribute('aria-sort', 'descending');

                // A new column starts ascending again rather than inheriting 'desc'.
                const flightHeader = screen.getByRole('button', {name: /^flight$/i});
                await userEvent.click(flightHeader);
                expect(flightNumbersInOrder()).toEqual(['AA100', 'AA200']);
                expect(flightHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
                expect(rateHeader.closest('th')).toHaveAttribute('aria-sort', 'none');
            });
        });
    });

    // ── Agent Mode ──────────────────────────────────────────────────
    describe('Agent Mode', () => {
        it('shows loading indicator when agents are loading', () => {
            renderWithTheme(
                <FlightAgentDataTable {...createMockProps({
                    isDeliveryJobType: true,
                    agentsLoading: true,
                    showAgentList: false
                })} />
            );
            expect(screen.getByRole('progressbar', {name: /loading/i})).toBeInTheDocument();
        });

        // ── Agent empty states ──────────────────────────────────────
        describe('Empty States', () => {
            it.each([
                ['showNoAgentJobSelectedMessage', 'No Job Selected'],
                ['showNotDeliveryJobMessage', 'Not a Delivery Job'],
            ] as const)('shows %s message', (propName, expectedText) => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        isDeliveryJobType: true,
                        [propName]: true,
                        showAgentList: false
                    })} />
                );
                expect(screen.getByText(expectedText)).toBeInTheDocument();
            });

            it('shows agent already assigned message with action button', async () => {
                const props = createMockProps({
                    isDeliveryJobType: true,
                    showJobHasAssignedAgentMessage: true,
                    showAgentList: false
                });
                renderWithTheme(<FlightAgentDataTable {...props} />);

                expect(screen.getByText('Agent Already Assigned')).toBeInTheDocument();
                expect(screen.getByText('Manage Recovery Agent(s)')).toBeInTheDocument();

                await userEvent.click(screen.getByText('Manage Recovery Agent(s)'));
                expect(props.onOpenRecoveryAgentDialog).toHaveBeenCalled();
            });

            it('shows no agents available message', () => {
                renderWithTheme(
                    <FlightAgentDataTable {...createMockProps({
                        isDeliveryJobType: true,
                        showNoAgentsAvailableMessage: true,
                        showAgentList: false,
                        agentMessage: 'No agents service this area',
                    })} />
                );
                expect(screen.getByText('No Agents Available')).toBeInTheDocument();
            });
        });

        // ── Agent List (consolidated read-only) ─────────────────────
        describe('Agent List', () => {
            const agentListProps = {isDeliveryJobType: true, showAgentList: true};

            it('renders agent table with data and action buttons', () => {
                renderWithTheme(<FlightAgentDataTable {...createMockProps(agentListProps)} />);

                expect(screen.getByText('Test Agent')).toBeInTheDocument();
                expect(screen.getByText('$150.00')).toBeInTheDocument();
                expect(screen.getByText('Reliable agent')).toBeInTheDocument();
                expect(screen.getByText('3')).toBeInTheDocument(); // ranking
                expect(screen.getByRole('button', {name: /search agents/i})).toBeInTheDocument();
            });

            it('calls agent action handlers', async () => {
                const props = createMockProps(agentListProps);
                renderWithTheme(<FlightAgentDataTable {...props} />);

                // Search agents
                await userEvent.click(screen.getByRole('button', {name: /search agents/i}));
                expect(props.onOpenAgentSearchDialog).toHaveBeenCalled();

                // Assign agent
                fireEvent.click(screen.getAllByRole('button', {name: 'Assign Job'})[0]);
                expect(props.onAddAgentToJob).toHaveBeenCalledWith(mockAgent);

                // Quote request
                fireEvent.click(screen.getAllByRole('button', {name: 'Send Quote Request'})[0]);
                expect(props.onSendQuoteRequest).toHaveBeenCalledWith(mockAgent);
            });

            it('opens agent info dialog when clicking info button', () => {
                const mockOpen = openAgentInfoDialog as jest.Mock;
                mockOpen.mockClear();
                renderWithTheme(<FlightAgentDataTable {...createMockProps(agentListProps)} />);

                fireEvent.click(screen.getAllByRole('button', {name: 'More Info'})[0]);
                expect(mockOpen).toHaveBeenCalledWith({agentId: mockAgent.agentId});
            });
        });
    });
});
