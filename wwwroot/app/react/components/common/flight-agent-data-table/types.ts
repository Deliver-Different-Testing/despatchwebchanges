/**
 * Types for FlightAgentDataTable React Component
 *
 * The flight shapes are the API ones; the table adds the pre-formatted strings it renders
 * from them, so these extend the models rather than restating every field.
 */

import { Dayjs } from 'dayjs';
import type {
    FlightSegment as FlightSegmentModel,
    FlightViewModel,
} from '../../../interfaces/nationwideJobs';

/** Times and zones the table formats once and hangs off the row. */
interface FormattedFlightTimes {
    _departureTimeStr?: string;
    _arrivalTimeStr?: string;
    _departureTimeZoneStr?: string;
    _arrivalTimeZoneStr?: string;
}

export interface FlightSegment extends FlightSegmentModel, FormattedFlightTimes {}

export interface FlightOption extends Omit<FlightViewModel, 'flightSegments'>, FormattedFlightTimes {
    flightSegments: FlightSegment[];
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
