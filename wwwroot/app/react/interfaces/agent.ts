/**
 * Agent-related interfaces for React components
 */

import {AddressViewModel} from './address';

export interface AirportViewModel {
    code: string;
    name: string;
    city: string;
    country: string;
    timezone: string;
    elevation: number;
    latitude: number;
    longitude: number;
}

export interface AgentInfo {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
    agentPhone?: string;
    agentEmail?: string;
    airports?: AirportViewModel[];
    address?: AddressViewModel;
}
