import type { RangeCommit } from './collectRelease';

/**
 * Minimal GitLab v4 client for the release-note job. `CI_JOB_TOKEN` cannot read
 * merge requests, so this always runs on a project access token with `read_api`
 * (CI variable `NOTES_API_TOKEN`) — never logged, including on failure.
 */
export interface GitLabApiConfig {
    apiUrl: string;
    projectId: string;
    token: string;
    fetchImpl?: typeof fetch;
}

export interface GitLabMergeRequest {
    iid: number;
    title: string;
    web_url: string;
    description: string | null;
    author?: { name?: string };
}

export interface GitLabCompare {
    commit?: { id: string } | null;
    commits: RangeCommit[];
}

export class GitLabApi {
    private readonly apiUrl: string;
    private readonly projectId: string;
    private readonly token: string;
    private readonly fetchImpl: typeof fetch;

    constructor({ apiUrl, projectId, token, fetchImpl = fetch }: GitLabApiConfig) {
        this.apiUrl = apiUrl.replace(/\/$/, '');
        this.projectId = encodeURIComponent(projectId);
        this.token = token;
        this.fetchImpl = fetchImpl;
    }

    private async request(path: string, params: Record<string, string> = {}): Promise<Response> {
        const query = new URLSearchParams(params).toString();
        const url = `${this.apiUrl}/projects/${this.projectId}/${path}${query ? `?${query}` : ''}`;
        const response = await this.fetchImpl(url, { headers: { 'PRIVATE-TOKEN': this.token } });

        if (!response.ok) {
            throw new Error(`GitLab API ${response.status} for ${path}`);
        }

        return response;
    }

    async listTagNames(): Promise<string[]> {
        const names: string[] = [];

        for (let page = 1; page > 0; ) {
            const response = await this.request('repository/tags', {
                per_page: '100',
                page: String(page),
            });
            const tags = (await response.json()) as { name: string }[];
            names.push(...tags.map((tag) => tag.name));

            const next = response.headers.get('x-next-page');
            page = next ? Number(next) : 0;
        }

        return names;
    }

    async compare(from: string, to: string): Promise<GitLabCompare> {
        const response = await this.request('repository/compare', { from, to });
        return (await response.json()) as GitLabCompare;
    }

    /** Commits on a ref, used only when there is no previous RC tag to compare against. */
    async listCommits(ref: string, limit = 100): Promise<RangeCommit[]> {
        const response = await this.request('repository/commits', {
            ref_name: ref,
            per_page: String(Math.min(limit, 100)),
        });
        return (await response.json()) as RangeCommit[];
    }

    async getMergeRequest(iid: number): Promise<GitLabMergeRequest> {
        const response = await this.request(`merge_requests/${iid}`);
        return (await response.json()) as GitLabMergeRequest;
    }
}
