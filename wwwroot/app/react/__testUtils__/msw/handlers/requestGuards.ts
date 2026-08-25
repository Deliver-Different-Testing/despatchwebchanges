/**
 * Shared MSW request guards
 *
 * apiClient sends `X-Requested-With` on every write, and the server rejects writes without
 * it. The handlers assert that, so the check appeared verbatim in every write handler across
 * nine files — the header name, the message and the status all repeated.
 */

import {HttpResponse} from 'msw';

/** The rejection the server would send for a write that skipped apiClient, or nothing. */
export function rejectWithoutCsrf(request: Request): HttpResponse<string> | undefined {
    if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
        return new HttpResponse('Missing CSRF header', {status: 400});
    }
    return undefined;
}
