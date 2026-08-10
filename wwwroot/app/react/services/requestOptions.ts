/** Request options that can be passed to API methods */
export interface RequestOptions {
    /** AbortSignal for request cancellation (integrates with React Query) */
    signal?: AbortSignal;
    /** Query parameters */
    params?: Record<string, unknown>;
    /** Override default timeout (ms) */
    timeout?: number;
}