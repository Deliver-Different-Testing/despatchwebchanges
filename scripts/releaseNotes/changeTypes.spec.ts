/** @jest-environment node */
import { CHANGE_GROUPS, classifyChange, type ChangeType } from './changeTypes';

const classify = (sourceBranch: string, labels: string[] = []): ChangeType =>
    classifyChange({ sourceBranch, labels });

describe('classifyChange', () => {
    it('reads the type from the source branch prefix', () => {
        expect(classify('feat/mantine-phase7-dialogs')).toBe('new');
        expect(classify('feature/np-dashboard-visibility')).toBe('new');
        expect(classify('fix/pod-images-on-scheduled-jobs')).toBe('fixed');
        expect(classify('hotfix/tenant-connection-cache')).toBe('fixed');
        expect(classify('perf/precompressed-dist')).toBe('improved');
        expect(classify('chore/bump-nuget')).toBe('internal');
        expect(classify('refactor/job-search-dedupe')).toBe('internal');
    });

    it('ignores case and accepts a bare prefix with no branch path', () => {
        expect(classify('FIX/Void-Job-Status')).toBe('fixed');
        expect(classify('feat')).toBe('new');
    });

    it('falls back to "other" for an unprefixed or missing branch', () => {
        expect(classify('PackagesFixesForOTG')).toBe('other');
        expect(classify('')).toBe('other');
        expect(classifyChange({})).toBe('other');
    });

    it('lets a type:: label override the branch prefix', () => {
        expect(classify('chore/tidy-up', ['type::feature'])).toBe('new');
        expect(classify('feat/wait-rerate', ['backend', 'type::fix'])).toBe('fixed');
    });

    it('keeps the branch prefix when the labels say nothing about type', () => {
        expect(classify('fix/void-job-status', ['backend', 'priority::high'])).toBe('fixed');
        expect(classify('fix/void-job-status', ['type::nonsense'])).toBe('fixed');
    });
});

describe('CHANGE_GROUPS', () => {
    it('orders the user-visible groups and leaves internal work out of them', () => {
        expect(CHANGE_GROUPS.map((group) => group.type)).toEqual(['new', 'improved', 'fixed', 'other']);
        expect(CHANGE_GROUPS.map((group) => group.heading)).toEqual([
            '✨ New',
            '⚡ Improved',
            '🛠 Fixed',
            '📋 Other changes',
        ]);
    });
});
