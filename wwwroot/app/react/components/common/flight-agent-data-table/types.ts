/**
 * Types for FlightAgentDataTable React Component
 */

import { Dayjs } from 'dayjs';

export interface FlightSegment {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirportFsCode: string;
    departureTerminal?: string;
    arrivalAirportFsCode: string;
    arrivalTerminal?: string;
    flightEquipmentIataCode: string;
    elapsedTime: number;
    stopsInSegment: number;
    departureAirportName?: string;
    departureAirportCity?: string;
    departureAirportTimeZone: string;
    departureAirportId?: number;
    arrivalAirportName?: string;
    arrivalAirportCity?: string;
    arrivalAirportTimeZone: string;
    arrivalAirportId?: number;
    aircraftName?: string;
    airlineName?: string;
    _departureTimeStr?: string;
    _arrivalTimeStr?: string;
    _departureTimeZoneStr?: string;
    _arrivalTimeZoneStr?: string;
}

export interface FlightOption {
    airline: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirport: string;
    arrivalAirport: string;
    duration: string;
    stops: number;
    aircraft: string;
    serviceClasses: string[];
    isCodeShare: boolean;
    serviceType: string;
    isCharter: boolean;
    serviceTypeDescription: string;
    amount: number;
    codeShareAirline: string;
    airlineId: number;
    departureTimeZone: string;
    arrivalTimeZone: string;
    isMultiSegment: boolean;
    elapsedTime: number;
    score: number;
    connectionId: string;
    flightSegments: FlightSegment[];
    _departureTimeStr?: string;
    _arrivalTimeStr?: string;
    _departureTimeZoneStr?: string;
    _arrivalTimeZoneStr?: string;
    showSegments?: boolean;
}

export interface AgentOption {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
    agentPhone?: string;
    agentEmail?: string;
}

export interface AirlineSuggestion {
    id: number;
    text: string;
    fullAirlineName?: string;
}

export interface AirportSuggestion {
    id: number;
    text: string;
}

export interface CurrentJob {
    id: number;
    jobNo: string;
    assignedFlight?: unknown;
    assignedAgent?: unknown;
    toAirportId?: number;
    fromAirportId?: number;
}

export interface FlightAgentDataTableProps {
    // Mode
    isDeliveryJobType: boolean;

    // Current job
    currentJob: CurrentJob | null;

    // Loading states
    flightsLoading: boolean;
    agentsLoading: boolean;

    // Flight data
    flightOptions: FlightOption[];
    filteredFlightOptions: FlightOption[];
    flightSearchText: string;
    flightMessage?: string;

    // Agent data
    agentOptions: AgentOption[];
    agentMessage?: string;

    // Airline filter
    activeAirlineOptions: AirlineSuggestion[];
    selectedAirline?: AirlineSuggestion;

    // Nearby-airport search (includes flights from alternate airports near the selected ones)
    includeNearbyAirports: boolean;

    // Airport selection
    outboundAirportOptions: AirportSuggestion[];
    inboundAirportOptions: AirportSuggestion[];
    selectedOutboundAirport?: AirportSuggestion;
    selectedInboundAirport?: AirportSuggestion;

    // UI State Flags - Flight
    showNoJobSelectedMessage: boolean;
    showJobHasAssignedFlightMessage: boolean;
    showMissingAirportInfoMessage: boolean;
    showNoFlightsAvailableMessage: boolean;
    showFlightList: boolean;

    // UI State Flags - Agent
    showNoAgentJobSelectedMessage: boolean;
    showJobHasAssignedAgentMessage: boolean;
    showNotDeliveryJobMessage: boolean;
    showNoAgentsAvailableMessage: boolean;
    showAgentList: boolean;

    // Callbacks
    onFlightSearchChange: (searchText: string) => void;
    onFilterFlightsByAirline: (airline: AirlineSuggestion | null) => void;
    onToggleNearbyAirports: (value: boolean) => void;
    onOutboundAirportChange: (airport: AirportSuggestion | null) => void;
    onInboundAirportChange: (airport: AirportSuggestion | null) => void;
    onAddFlightToJob: (flight: FlightOption) => void;
    onLoadMoreFlights: () => void;
    onLoadNextDayFlights: () => void;
    onAddAgentToJob: (agent: AgentOption) => void;
    onSendQuoteRequest: (agent: AgentOption) => void;
    onOpenAgentSearchDialog: () => void;
    onOpenRecoveryAgentDialog: () => void;

    // Utilities
    formatAirportCodeForDropdown: (text: string) => string;
    getConnectionTime: (firstSegment: FlightSegment, secondSegment: FlightSegment) => string;
    formatMinutesToTime: (minutes: number) => string;

    // Theme
    isUsCustomer: boolean;
}
