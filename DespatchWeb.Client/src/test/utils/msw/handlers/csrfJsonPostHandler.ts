import { http, HttpResponse } from 'msw';
import { rejectWithoutCsrf } from './requestGuards';

/** POST handler that requires the CSRF header and a JSON object body, then replies with `respond()` (default 200 empty). */
export const csrfJsonPostHandler = (
    path: string,
    respond: () => Response = () => new HttpResponse(null, { status: 200 })
) =>
    http.post(path, async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return respond();
    });
