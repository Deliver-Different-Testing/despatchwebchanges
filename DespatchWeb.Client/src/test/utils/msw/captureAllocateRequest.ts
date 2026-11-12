import { http, HttpResponse } from 'msw';
import { server } from './setupIntegration';

export const captureAllocateRequest = () => {
    const captured: { body: unknown; csrfHeader: string | null } = { body: null, csrfHeader: null };

    server.use(
        http.post('*/job/Allocate', async ({ request }) => {
            captured.csrfHeader = request.headers.get('X-Requested-With');
            captured.body = await request.json();
            return new HttpResponse(null, { status: 200 });
        })
    );

    return captured;
};
