/**
 * API-related interfaces for React services
 */

export interface ApiError {
    status: number;
    statusText: string;
    message: string;
    /** Hub URL the server asks an unauthenticated client to go to (x-auth-redirect header). */
    authRedirect?: string;
}

export interface ApiKeyResponse {
    apiKey: string;
}