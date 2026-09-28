/**
 * A deploy stage is a set of GitLab environments that receive the same commit
 * independently — every tenant's staging, or every tenant's production. Tenant
 * deploys are manual and one job per tenant, so "the stage is done" is not
 * something the pipeline graph can express: a `needs:` on a manual job nobody
 * pressed hangs forever. Each tenant instead runs the notifier and these
 * functions decide, from the deployments API alone, whether it is the one to post.
 */
export interface Deployment {
    id: number;
    sha: string;
    created_at: string;
}

export interface EnvironmentDeployments {
    environment: string;
    deployments: readonly Deployment[];
}

const STAGE_LABELS: Record<string, string> = {
    staging: 'Staging',
    'tenants-staging': 'Tenant staging',
    'tenants-production': 'Production',
};

export function environmentLabel(stage: string): string {
    const mapped = STAGE_LABELS[stage];
    if (mapped) {
        return mapped;
    }

    const words = stage.replace(/[-_]/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : stage;
}

function newestDeploymentOf(environment: EnvironmentDeployments, sha: string): Deployment | null {
    const matches = environment.deployments.filter((deployment) => deployment.sha === sha);
    return matches.length ? matches.reduce((a, b) => (b.created_at > a.created_at ? b : a)) : null;
}

export function isStageComplete(environments: readonly EnvironmentDeployments[], sha: string): boolean {
    return environments.length > 0 && environments.every((environment) => newestDeploymentOf(environment, sha) !== null);
}

/**
 * The environment that received the commit last. Ties break on name so two jobs
 * finishing in the same second still elect one winner rather than posting twice.
 */
export function postingEnvironment(environments: readonly EnvironmentDeployments[], sha: string): string | null {
    if (!isStageComplete(environments, sha)) {
        return null;
    }

    const ranked = environments
        .map((environment) => ({
            environment: environment.environment,
            at: newestDeploymentOf(environment, sha)!.created_at,
        }))
        .sort((a, b) => a.at.localeCompare(b.at) || a.environment.localeCompare(b.environment));

    return ranked[ranked.length - 1].environment;
}

/**
 * What the stage was on before this commit, taken from whichever environment is
 * furthest behind — a note covering too much is recoverable, one that silently
 * omits a tenant's changes is not. Null when any environment has no earlier
 * deployment, because there is then no range that covers the whole stage.
 */
export function previousShaForStage(environments: readonly EnvironmentDeployments[], sha: string): string | null {
    const previous: Deployment[] = [];

    for (const environment of environments) {
        const earlier = environment.deployments.filter((deployment) => deployment.sha !== sha);
        if (!earlier.length) {
            return null;
        }
        previous.push(earlier.reduce((a, b) => (b.created_at > a.created_at ? b : a)));
    }

    if (!previous.length) {
        return null;
    }

    return previous.reduce((a, b) => (b.created_at < a.created_at ? b : a)).sha;
}

const STAGE_EMOJI: Record<string, string> = {
    staging: '🧪',
    'tenants-staging': '🧪',
    'tenants-production': '🚀',
};

export function environmentEmoji(stage: string): string {
    return STAGE_EMOJI[stage] ?? '📦';
}

/**
 * When the stage finished — the last environment to receive the commit. Rendered as
 * a Slack date token so every reader sees it in their own timezone; tenants span NZ
 * and the US and a bare local time is ambiguous to half the channel.
 */
export function stageDeployedAt(environments: readonly EnvironmentDeployments[], sha: string): string | null {
    const times = environments
        .map((environment) => newestDeploymentOf(environment, sha)?.created_at)
        .filter((at): at is string => Boolean(at));

    return times.length ? times.reduce((a, b) => (b > a ? b : a)) : null;
}
