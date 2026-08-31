/** @jest-environment node */
import {
    environmentLabel,
    isStageComplete,
    postingEnvironment,
    previousShaForStage,
    type EnvironmentDeployments,
} from './deployStage';

const deployment = (id: number, sha: string, createdAt: string) => ({ id, sha, created_at: createdAt });

const stage = (): EnvironmentDeployments[] => [
    {
        environment: 'otgcargo/production',
        deployments: [deployment(30, 'newsha', '2026-08-31T10:00:00Z'), deployment(20, 'oldsha', '2026-08-24T09:00:00Z')],
    },
    {
        environment: 'medical/production',
        deployments: [deployment(31, 'newsha', '2026-08-31T10:05:00Z'), deployment(21, 'oldersha', '2026-08-20T09:00:00Z')],
    },
];

describe('environmentLabel', () => {
    it.each([
        ['staging', 'Staging'],
        ['tenants-staging', 'Tenant staging'],
        ['tenants-production', 'Production'],
    ])('names %s for a tester', (input, expected) => {
        expect(environmentLabel(input)).toBe(expected);
    });

    it('falls back to a readable form for an unmapped stage', () => {
        expect(environmentLabel('tenants-uat')).toBe('Tenants uat');
    });
});

describe('isStageComplete', () => {
    it('is true only once every environment in the stage carries the commit', () => {
        expect(isStageComplete(stage(), 'newsha')).toBe(true);
    });

    it('is false while any environment is still on an older commit', () => {
        const partial = stage();
        partial[1].deployments = [deployment(21, 'oldersha', '2026-08-20T09:00:00Z')];
        expect(isStageComplete(partial, 'newsha')).toBe(false);
    });

    it('is false for a stage with no environments rather than vacuously true', () => {
        expect(isStageComplete([], 'newsha')).toBe(false);
    });
});

describe('postingEnvironment', () => {
    it('elects the environment that received the commit last, so exactly one job posts', () => {
        expect(postingEnvironment(stage(), 'newsha')).toBe('medical/production');
    });

    it('breaks a dead heat on name so the winner is deterministic', () => {
        const tied = stage();
        tied[1].deployments = [deployment(30, 'newsha', '2026-08-31T10:00:00Z'), ...tied[1].deployments.slice(1)];
        expect(postingEnvironment(tied, 'newsha')).toBe('otgcargo/production');
    });

    it('elects nobody while the stage is incomplete', () => {
        const partial = stage();
        partial[0].deployments = [deployment(20, 'oldsha', '2026-08-24T09:00:00Z')];
        expect(postingEnvironment(partial, 'newsha')).toBeNull();
    });
});

describe('previousShaForStage', () => {
    it('takes the laggard environment, so no tenants changes are skipped', () => {
        expect(previousShaForStage(stage(), 'newsha')).toBe('oldersha');
    });

    it('ignores repeat deployments of the commit being announced', () => {
        const redeployed = stage();
        redeployed[0].deployments = [deployment(32, 'newsha', '2026-08-31T11:00:00Z'), ...redeployed[0].deployments];
        expect(previousShaForStage(redeployed, 'newsha')).toBe('oldersha');
    });

    it('reports no range when an environment has never been deployed before', () => {
        const fresh = stage();
        fresh[1].deployments = [deployment(31, 'newsha', '2026-08-31T10:05:00Z')];
        expect(previousShaForStage(fresh, 'newsha')).toBeNull();
    });
});
