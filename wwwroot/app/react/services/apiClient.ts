/**
 * React API Client
 *
 * An axios-based HTTP client with security headers for React components.
 * This replaces the AngularJS $http service for React dialogs.
 */

import axios, {AxiosError, AxiosInstance, AxiosRequestConfig} from 'axios';
import {ApiError} from '../interfaces';
import {RequestOptions} from "./requestOptions";

// Re-export for backward compatibility
export type {ApiError};

/** Options for file upload requests */
export interface UploadOptions extends RequestOptions {
    /** Progress callback — receives percent complete (0–100) */
    onProgress?: (percent: number) => void;
}

/** Extract error message from various response formats */
function extractErrorMessage(error: AxiosError): string {
    const data = error.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
        // Handle common error response formats
        const obj = data as Record<string, unknown>;
        if (typeof obj.message === 'string') return obj.message;
        if (typeof obj.error === 'string') return obj.error;
        if (typeof obj.title === 'string') return obj.title; // ASP.NET ProblemDetails
    }
    return error.message ?? 'Unknown error';
}

class ApiClient {
    private readonly instance: AxiosInstance;

    constructor(baseUrl: string = '') {
        this.instance = axios.create({
            baseURL: baseUrl,
            timeout: 30000, // 30 second default timeout
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest', // CSRF protection header
            },
            withCredentials: true, // Include cookies for authentication
            paramsSerializer: {
                // Serialize arrays as repeated params: ids=1&ids=2 (ASP.NET compatible)
                indexes: null,
            },
        });

        // Response interceptor for error handling
        this.instance.interceptors.response.use(
            response => response,
            (error: AxiosError) => {
                // Don't transform cancelled requests - let them propagate naturally
                if (axios.isCancel(error)) {
                    return Promise.reject(error);
                }

                const apiError: ApiError = {
                    status: error.response?.status ?? 0,
                    statusText: error.response?.statusText ?? 'Network Error',
                    message: extractErrorMessage(error),
                };
                return Promise.reject(apiError);
            }
        );
    }

    async get<T>(
        url: string,
        params?: Record<string, unknown>,
        options?: RequestOptions
    ): Promise<T> {
        const config: AxiosRequestConfig = {
            params: params ?? options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
        };
        const response = await this.instance.get<T>(url, config);
        return response.data;
    }

    async post<T>(
        url: string,
        data?: unknown,
        options?: RequestOptions
    ): Promise<T> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
        };
        const response = await this.instance.post<T>(url, data, config);
        return response.data;
    }

    async put<T>(
        url: string,
        data?: unknown,
        options?: RequestOptions
    ): Promise<T> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
        };
        const response = await this.instance.put<T>(url, data, config);
        return response.data;
    }

    async delete<T>(url: string, options?: RequestOptions): Promise<T> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
        };
        const response = await this.instance.delete<T>(url, config);
        return response.data;
    }

    async postFormData<T>(
        url: string,
        formData: FormData,
        options?: RequestOptions
    ): Promise<T> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
            headers: {
                'Content-Type': 'multipart/form-data', // Axios will set boundary automatically
            },
        };
        const response = await this.instance.post<T>(url, formData, config);
        return response.data;
    }

    async uploadFormData<T>(
        url: string,
        formData: FormData,
        options?: UploadOptions
    ): Promise<T> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress(event) {
                if (event.total && options?.onProgress) {
                    options.onProgress(Math.round((100 * event.loaded) / event.total));
                }
            },
        };
        const response = await this.instance.post<T>(url, formData, config);
        return response.data;
    }

    async postForBlob(
        url: string,
        data?: unknown,
        options?: RequestOptions
    ): Promise<{ data: Blob; headers: Record<string, unknown> }> {
        const config: AxiosRequestConfig = {
            params: options?.params,
            signal: options?.signal,
            timeout: options?.timeout,
            responseType: 'blob',
        };
        const response = await this.instance.post(url, data, config);
        return { data: response.data, headers: response.headers as Record<string, unknown> };
    }
}

// Singleton instance - lazy initialized on first access
let _instance: ApiClient | null = null;
const getInstance = (): ApiClient => (_instance ??= new ApiClient());

export const apiClient = {
    get: <T>(url: string, params?: Record<string, unknown>, options?: RequestOptions) =>
        getInstance().get<T>(url, params, options),
    post: <T>(url: string, data?: unknown, options?: RequestOptions) =>
        getInstance().post<T>(url, data, options),
    put: <T>(url: string, data?: unknown, options?: RequestOptions) =>
        getInstance().put<T>(url, data, options),
    delete: <T>(url: string, options?: RequestOptions) =>
        getInstance().delete<T>(url, options),
    postFormData: <T>(url: string, formData: FormData, options?: RequestOptions) =>
        getInstance().postFormData<T>(url, formData, options),
    uploadFormData: <T>(url: string, formData: FormData, options?: UploadOptions) =>
        getInstance().uploadFormData<T>(url, formData, options),
    postForBlob: (url: string, data?: unknown, options?: RequestOptions) =>
        getInstance().postForBlob(url, data, options),
};

/** Download a blob response as a file */
export function downloadBlob(
    response: { data: Blob; headers: Record<string, unknown> },
    fallbackFilename: string
): void {
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    let filename = fallbackFilename;
    if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) filename = match[1].replace(/['"]/g, '');
    }
    const blob = new Blob([response.data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default ApiClient;
