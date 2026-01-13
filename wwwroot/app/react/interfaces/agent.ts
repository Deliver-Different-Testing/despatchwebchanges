/**
 * Agent-related interfaces for React components
 */

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

export interface AddressViewModel {
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    addressLine5: string;
    addressLine6: string;
    addressLine7: string;
    addressLine8: string;
    latitude?: number;
    longitude?: number;
    fullAddress: string;
    toSuburbId?: number;
    cbd?: boolean;
    address?: string;
    our_suburb?: string;
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
