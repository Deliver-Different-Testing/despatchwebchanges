/** @jest-environment node */
import { GitLabApi } from './gitlabApi';

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

const api = (fetchImpl: typeof fetch) =>
    new GitLabApi({
        apiUrl: 'https://git.customd.com/api/v4',
        projectId: '42',
        token: 'super-secret-token',
        fetchImpl,
    });

describe('GitLabApi', () => {
    it('authenticates with the private token and pages through every tag', async () => {
        const fetchImpl = jest
            .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
            .mockResolvedValueOnce(jsonResponse([{ name: 'rc-2026.09.1' }], { 'x-next-page': '2' }))
            .mockResolvedValueOnce(jsonResponse([{ name: 'rc-2026.08.1' }], { 'x-next-page': '' }));

        await expect(api(fetchImpl).listTagNames()).resolves.toEqual(['rc-2026.09.1', 'rc-2026.08.1']);

        const [firstUrl, firstInit] = fetchImpl.mock.calls[0];
        expect(String(firstUrl)).toBe('https://git.customd.com/api/v4/projects/42/repository/tags?per_page=100&page=1');
        expect((firstInit?.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('super-secret-token');
        expect(String(fetchImpl.mock.calls[1][0])).toContain('page=2');
    });

    it('encodes the refs it compares and returns the head commit with the range', async () => {
        const fetchImpl = jest
            .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
            .mockResolvedValue(jsonResponse({ commit: { id: 'head' }, commits: [{ id: 'head', title: 'x' }] }));

        const result = await api(fetchImpl).compare('rc-2026.08.1', 'rc-2026.09.1');

        expect(result.commit?.id).toBe('head');
        expect(String(fetchImpl.mock.calls[0][0])).toContain('compare?from=rc-2026.08.1&to=rc-2026.09.1');
    });

    it('fails loudly on an API error without echoing the token', async () => {
        const fetchImpl = jest
            .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
            .mockResolvedValue(new Response('unauthorized', { status: 401 }));

        await expect(api(fetchImpl).getMergeRequest(1148)).rejects.toThrow(
            /GitLab API 401 .*merge_requests\/1148/,
        );
        await expect(api(fetchImpl).getMergeRequest(1148)).rejects.not.toThrow(/super-secret-token/);
    });
});
