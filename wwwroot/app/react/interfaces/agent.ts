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

/**
 * An agent as returned by the job-scoped lookup
 * (`nationwideJob/GetAgentsForJob`) — the rate/ranking/notes an operator picks
 * from. Mirrors the AngularJS `IAgent`.
 */
export interface Agent {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
    agentNotes: string;
    agentPhone?: string;
    agentEmail?: string;
}

/**
 * The richer payload behind the agent-info dialog
 * (`nationwideJob/GetAgentInfo`), which adds the agent's airports and address.
 */
export interface AgentInfo extends Agent {
    airports?: AirportViewModel[];
    address?: AddressViewModel;
}
