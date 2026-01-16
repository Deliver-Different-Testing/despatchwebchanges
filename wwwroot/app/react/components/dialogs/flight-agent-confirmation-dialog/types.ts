/**
 * Flight Agent Confirmation Dialog Types
 */

import { Dayjs } from 'dayjs';

// Re-export flight interfaces for convenience
export interface FlightSegment {
    segmentOrder: number;
    departureAirportFsCode: string;
    departureAirportName: string;
    departureAirportCity: string;
    departureAirportId?: number;
    departureAirportTimeZone: string;
    arrivalAirportFsCode: string;
    arrivalAirportName: string;
    arrivalAirportCity: string;
    arrivalAirportId?: number;
    arrivalAirportTimeZone: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    carrierFsCode: string;
    flightNumber: string;
    airlineName: string;
    departureTerminal?: string;
    arrivalTerminal?: string;
}

export interface FlightViewModel {
    flightNumber: string;
    departureTime?: Dayjs;
    arrivalTime?: Dayjs;
    departureTimeZone?: string;
    arrivalTimeZone?: string;
    flightSegments: FlightSegment[];
}

export interface AgentSuggestion {
    id: number;
    text: string;
}

export interface DispatchJob {
    id: number;
    jobNo: string;
    awb?: string;
    dgClass?: number;
    children?: DispatchJob[];
}

// Cargo processing from backend
export interface FlightCargoProcessingDto {
    arrivalTime: string;
    processingTimeMins: number;
    cargoOpeningTime: string;
    cargoClosingTime: string;
    deliverByTime?: string;
}

export interface FlightCargoProcessing {
    arrivalTime: Dayjs;
    processingTimeMins: number;
    cargoOpeningTime: Dayjs;
    cargoClosingTime: Dayjs;
    deliverByTime?: Dayjs;
}

// Status display interfaces
export interface CargoStatus {
    class: string;
    icon: string;
    hours: string;
    text: string;
}

export interface CargoIndicator {
    class: string;
    icon: string;
    text: string;
}

export interface AvailableTime {
    class: string;
    icon: string;
    text: string;
    subtext: string;
}

// Dialog input options
export interface FlightConfirmationDialogOptions {
    jobId: number;
    jobNumber: string;
    flight: FlightViewModel;
    existingAwb?: string;
    dgClass?: number;
}

export interface AgentConfirmationDialogOptions {
    jobId: number;
    jobNumber: string;
    agent: AgentSuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
}

// Dialog result
export interface FlightAgentDialogResult {
    shouldAssign: boolean;
    awb?: string;
    shouldAssignToStopJobs: boolean;
    packageReadyTime?: Dayjs;
    packageDeliverByTime?: Dayjs;
    packageDeliveryNotes?: string;
}

// Component props
export interface FlightAgentConfirmationDialogProps {
    open: boolean;
    mode: 'flight' | 'agent';
    jobId: number;
    jobNumber: string;
    flight?: FlightViewModel;
    agent?: AgentSuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
    timezone: string;
    onClose: () => void;
    onConfirm: (result: FlightAgentDialogResult) => void;
    onCalculateCargoTimes: (
        jobId: number,
        carrierFsCode: string,
        arrivalTime: Dayjs,
        timezone: string
    ) => Promise<FlightCargoProcessing | null>;
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

// Toast service interface
export interface ToastService {
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}
