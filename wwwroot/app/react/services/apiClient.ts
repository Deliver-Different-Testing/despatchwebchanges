/**
 * React API Client
 *
 * A fetch-based HTTP client with security headers for React components.
 * This replaces the AngularJS $http service for React dialogs.
 */

import {ApiError} from '../interfaces';

// Re-export for backward compatibility
export type {ApiError};

class ApiClient {
    private readonly baseUrl: string;

    constructor(baseUrl: string = '') {
        this.baseUrl = baseUrl;
    }

    private getDefaultHeaders(): HeadersInit {
        return {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest', // CSRF protection header
        };
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const errorMessage = await response.text().catch(() => 'Unknown error');
            throw {
                status: response.status,
                statusText: response.statusText,
                message: errorMessage,
            };
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return undefined as T;
        }

        const text = await response.text();
        if (!text) {
            return undefined as T;
        }

        return JSON.parse(text) as T;
    }

    async get<T>(url: string, params?: Record<string, string | number | boolean>): Promise<T> {
        let fullUrl = `${this.baseUrl}${url}`;

        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                fullUrl += `?${queryString}`;
            }
        }

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.getDefaultHeaders(),
            credentials: 'same-origin', // Include cookies for authentication
        });

        return this.handleResponse<T>(response);
    }

    async post<T>(
        url: string,
        data?: unknown,
        config?: { params?: Record<string, unknown> }
    ): Promise<T> {
        let fullUrl = `${this.baseUrl}${url}`;

        if (config?.params) {
            const searchParams = new URLSearchParams();
            Object.entries(config.params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        value.forEach(v => searchParams.append(key, String(v)));
                    } else {
                        searchParams.append(key, String(value));
                    }
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                fullUrl += `?${queryString}`;
            }
        }

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: this.getDefaultHeaders(),
            credentials: 'same-origin',
            body: data ? JSON.stringify(data) : undefined,
        });

        return this.handleResponse<T>(response);
    }

    async put<T>(url: string, data?: unknown): Promise<T> {
        const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'PUT',
            headers: this.getDefaultHeaders(),
            credentials: 'same-origin',
            body: data ? JSON.stringify(data) : undefined,
        });

        return this.handleResponse<T>(response);
    }

    async delete<T>(url: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'DELETE',
            headers: this.getDefaultHeaders(),
            credentials: 'same-origin',
        });

        return this.handleResponse<T>(response);
    }
}

// Default singleton instance
export const apiClient = new ApiClient();

export default ApiClient;
