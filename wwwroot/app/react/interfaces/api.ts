/**
 * API-related interfaces for React services
 */

export interface ApiError {
    status: number;
    statusText: string;
    message: string;
}

export interface ApiKeyResponse {
    apiKey: string;
}