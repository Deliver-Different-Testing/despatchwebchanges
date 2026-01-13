/**
 * Agent API Service
 *
 * React-native API service for agent-related operations.
 * Uses fetch with proper security headers instead of AngularJS $http.
 */

import {apiClient} from './apiClient';
import {AgentInfo} from '../interfaces';

/**
 * Agent API Service Class
 * Handles all agent-related API operations.
 */
export class AgentApiService {
    /**
     * Get agent information for the agent info dialog
     */
    async getAgentInfo(agentId: number): Promise<AgentInfo> {
        return apiClient.get<AgentInfo>('nationwideJob/GetAgentInfo', {
            agentId,
        });
    }
}

export const agentApi = new AgentApiService();

export default agentApi;
