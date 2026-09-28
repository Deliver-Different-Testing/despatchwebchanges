/**
 * FlightAgentDataTable React Module
 *
 * Entry point for the React-based FlightAgentDataTable component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { FlightAgentDataTable } from './FlightAgentDataTable';
import { getTheme } from '../../../theme/muiTheme';
import { IAppConfig } from '../../../../interfaces/app-config.interface';
import angular from 'angular';
import {
    FlightAgentDataTableProps,
    FlightOption,
    FlightSegment,
    AgentOption,
    AirlineSuggestion,
    AirportSuggestion,
    CurrentJob,
} from './types';

/**
 * AngularJS Component Controller for React FlightAgentDataTable
 */
class FlightAgentDataTableReactController implements angular.IController {
    static $inject = ['$element', '$scope', 'APP_CONFIG'];

    private root: Root | null = null;
    private readonly isUsCustomer: boolean;

    // Data bindings from AngularJS
    isDeliveryJobType?: boolean;
    currentJob?: CurrentJob | null;
    flightsLoading?: boolean;
    agentsLoading?: boolean;
    flightOptions?: FlightOption[];
    filteredFlightOptions?: FlightOption[];
    flightSearchText?: string;
    flightMessage?: string;
    agentOptions?: AgentOption[];
    agentMessage?: string;
    activeAirlineOptions?: AirlineSuggestion[];
    selectedAirline?: AirlineSuggestion;
    outboundAirportOptions?: AirportSuggestion[];
    inboundAirportOptions?: AirportSuggestion[];
    selectedOutboundAirport?: AirportSuggestion;
    selectedInboundAirport?: AirportSuggestion;

    // UI State Flags - Flight
    showNoJobSelectedMessage?: boolean;
    showJobHasAssignedFlightMessage?: boolean;
    showMissingAirportInfoMessage?: boolean;
    showNoFlightsAvailableMessage?: boolean;
    showFlightList?: boolean;

    // UI State Flags - Agent
    showNoAgentJobSelectedMessage?: boolean;
    showJobHasAssignedAgentMessage?: boolean;
    showNotDeliveryJobMessage?: boolean;
    showNoAgentsAvailableMessage?: boolean;
    showAgentList?: boolean;

    // Callbacks
    onFlightSearchChange?: (params: { searchText: string }) => void;
    onFilterFlightsByAirline?: (params: { airline: AirlineSuggestion | null }) => void;
    onOutboundAirportChange?: (params: { airport: AirportSuggestion | null }) => void;
    onInboundAirportChange?: (params: { airport: AirportSuggestion | null }) => void;
    onAddFlightToJob?: (params: { flight: FlightOption }) => void;
    onLoadMoreFlights?: () => void;
    onLoadNextDayFlights?: () => void;
    onAddAgentToJob?: (params: { agent: AgentOption }) => void;
    onSendQuoteRequest?: (params: { agent: AgentOption }) => void;
    onOpenAgentSearchDialog?: () => void;
    onOpenRecoveryAgentDialog?: () => void;

    // Utilities
    formatAirportCodeForDropdown?: (params: { text: string }) => string;
    getConnectionTime?: (params: { firstSegment: FlightSegment; secondSegment: FlightSegment }) => string;
    formatMinutesToTime?: (params: { minutes: number }) => string;

    constructor(
        private $element: JQLite,
        private $scope: angular.IScope,
        appConfig: IAppConfig
    ) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    $onInit(): void {
        this.root = createRoot(this.$element[0]);
        this.render();
    }

    $onChanges(): void {
        this.render();
    }

    $onDestroy(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }

    private render(): void {
        if (!this.root) return;

        const currentTheme = getTheme();

        // Wrap AngularJS callbacks to match React expected signatures
        const handleFlightSearchChange = (searchText: string) => {
            if (this.onFlightSearchChange) {
                this.onFlightSearchChange({ searchText });
                this.$scope.$applyAsync();
            }
        };

        const handleFilterFlightsByAirline = (airline: AirlineSuggestion | null) => {
            if (this.onFilterFlightsByAirline) {
                this.onFilterFlightsByAirline({ airline });
                this.$scope.$applyAsync();
            }
        };

        const handleOutboundAirportChange = (airport: AirportSuggestion | null) => {
            if (this.onOutboundAirportChange) {
                this.onOutboundAirportChange({ airport });
                this.$scope.$applyAsync();
            }
        };

        const handleInboundAirportChange = (airport: AirportSuggestion | null) => {
            if (this.onInboundAirportChange) {
                this.onInboundAirportChange({ airport });
                this.$scope.$applyAsync();
            }
        };

        const handleAddFlightToJob = (flight: FlightOption) => {
            if (this.onAddFlightToJob) {
                this.onAddFlightToJob({ flight });
                this.$scope.$applyAsync();
            }
        };

        const handleLoadMoreFlights = () => {
            if (this.onLoadMoreFlights) {
                this.onLoadMoreFlights();
                this.$scope.$applyAsync();
            }
        };

        const handleLoadNextDayFlights = () => {
            if (this.onLoadNextDayFlights) {
                this.onLoadNextDayFlights();
                this.$scope.$applyAsync();
            }
        };

        const handleAddAgentToJob = (agent: AgentOption) => {
            if (this.onAddAgentToJob) {
                this.onAddAgentToJob({ agent });
                this.$scope.$applyAsync();
            }
        };

        const handleSendQuoteRequest = (agent: AgentOption) => {
            if (this.onSendQuoteRequest) {
                this.onSendQuoteRequest({ agent });
                this.$scope.$applyAsync();
            }
        };

        const handleOpenAgentSearchDialog = () => {
            if (this.onOpenAgentSearchDialog) {
                this.onOpenAgentSearchDialog();
                this.$scope.$applyAsync();
            }
        };

        const handleOpenRecoveryAgentDialog = () => {
            if (this.onOpenRecoveryAgentDialog) {
                this.onOpenRecoveryAgentDialog();
                this.$scope.$applyAsync();
            }
        };

        // Utility function wrappers
        const formatAirportCode = (text: string): string => {
            if (this.formatAirportCodeForDropdown) {
                return this.formatAirportCodeForDropdown({ text });
            }
            // Default implementation
            if (!text) return '';
            const spaceIndex = text.indexOf(' ');
            if (spaceIndex === -1) return text;
            return text.substring(0, spaceIndex + 1);
        };

        const getConnectionTimeFn = (firstSegment: FlightSegment, secondSegment: FlightSegment): string => {
            if (this.getConnectionTime) {
                return this.getConnectionTime({ firstSegment, secondSegment });
            }
            return '';
        };

        const formatMinutesToTimeFn = (minutes: number): string => {
            if (this.formatMinutesToTime) {
                return this.formatMinutesToTime({ minutes });
            }
            // Default implementation
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours > 0) {
                return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
            }
            return `${mins}m`;
        };

        const props: FlightAgentDataTableProps = {
            isDeliveryJobType: this.isDeliveryJobType ?? false,
            currentJob: this.currentJob ?? null,
            flightsLoading: this.flightsLoading ?? false,
            agentsLoading: this.agentsLoading ?? false,
            flightOptions: this.flightOptions ?? [],
            filteredFlightOptions: this.filteredFlightOptions ?? [],
            flightSearchText: this.flightSearchText ?? '',
            flightMessage: this.flightMessage,
            agentOptions: this.agentOptions ?? [],
            agentMessage: this.agentMessage,
            activeAirlineOptions: this.activeAirlineOptions ?? [],
            selectedAirline: this.selectedAirline,
            outboundAirportOptions: this.outboundAirportOptions ?? [],
            inboundAirportOptions: this.inboundAirportOptions ?? [],
            selectedOutboundAirport: this.selectedOutboundAirport,
            selectedInboundAirport: this.selectedInboundAirport,
            showNoJobSelectedMessage: this.showNoJobSelectedMessage ?? false,
            showJobHasAssignedFlightMessage: this.showJobHasAssignedFlightMessage ?? false,
            showMissingAirportInfoMessage: this.showMissingAirportInfoMessage ?? false,
            showNoFlightsAvailableMessage: this.showNoFlightsAvailableMessage ?? false,
            showFlightList: this.showFlightList ?? false,
            showNoAgentJobSelectedMessage: this.showNoAgentJobSelectedMessage ?? false,
            showJobHasAssignedAgentMessage: this.showJobHasAssignedAgentMessage ?? false,
            showNotDeliveryJobMessage: this.showNotDeliveryJobMessage ?? false,
            showNoAgentsAvailableMessage: this.showNoAgentsAvailableMessage ?? false,
            showAgentList: this.showAgentList ?? false,
            onFlightSearchChange: handleFlightSearchChange,
            onFilterFlightsByAirline: handleFilterFlightsByAirline,
            onOutboundAirportChange: handleOutboundAirportChange,
            onInboundAirportChange: handleInboundAirportChange,
            onAddFlightToJob: handleAddFlightToJob,
            onLoadMoreFlights: handleLoadMoreFlights,
            onLoadNextDayFlights: handleLoadNextDayFlights,
            onAddAgentToJob: handleAddAgentToJob,
            onSendQuoteRequest: handleSendQuoteRequest,
            onOpenAgentSearchDialog: handleOpenAgentSearchDialog,
            onOpenRecoveryAgentDialog: handleOpenRecoveryAgentDialog,
            formatAirportCodeForDropdown: formatAirportCode,
            getConnectionTime: getConnectionTimeFn,
            formatMinutesToTime: formatMinutesToTimeFn,
            isUsCustomer: this.isUsCustomer,
        };

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <FlightAgentDataTable {...props} />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React FlightAgentDataTable
 */
export const FlightAgentDataTableReactComponent: angular.IComponentOptions = {
    controller: FlightAgentDataTableReactController,
    bindings: {
        // Data bindings (< - one-way binding)
        isDeliveryJobType: '<',
        currentJob: '<',
        flightsLoading: '<',
        agentsLoading: '<',
        flightOptions: '<',
        filteredFlightOptions: '<',
        flightSearchText: '<',
        flightMessage: '<',
        agentOptions: '<',
        agentMessage: '<',
        activeAirlineOptions: '<',
        selectedAirline: '<',
        outboundAirportOptions: '<',
        inboundAirportOptions: '<',
        selectedOutboundAirport: '<',
        selectedInboundAirport: '<',
        showNoJobSelectedMessage: '<',
        showJobHasAssignedFlightMessage: '<',
        showMissingAirportInfoMessage: '<',
        showNoFlightsAvailableMessage: '<',
        showFlightList: '<',
        showNoAgentJobSelectedMessage: '<',
        showJobHasAssignedAgentMessage: '<',
        showNotDeliveryJobMessage: '<',
        showNoAgentsAvailableMessage: '<',
        showAgentList: '<',
        // Callback bindings (& - expression)
        onFlightSearchChange: '&',
        onFilterFlightsByAirline: '&',
        onOutboundAirportChange: '&',
        onInboundAirportChange: '&',
        onAddFlightToJob: '&',
        onLoadMoreFlights: '&',
        onLoadNextDayFlights: '&',
        onAddAgentToJob: '&',
        onSendQuoteRequest: '&',
        onOpenAgentSearchDialog: '&',
        onOpenRecoveryAgentDialog: '&',
        // Utility function bindings
        formatAirportCodeForDropdown: '&',
        getConnectionTime: '&',
        formatMinutesToTime: '&',
    },
};

export default FlightAgentDataTableReactComponent;
