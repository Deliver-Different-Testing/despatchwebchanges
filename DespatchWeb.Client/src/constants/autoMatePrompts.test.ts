import {getPageContext, getSuggestedPrompts} from './autoMatePrompts';

describe('autoMatePrompts', () => {
    it('describes the page, and the job when one is open on a job page', () => {
        expect(getPageContext('dispatch')).toBe('Dispatch board - live jobs and drivers');
        expect(getPageContext('jobSearch')).toBe('Job search');
        expect(getPageContext('jobSearch', 12345)).toBe('Job details for job 12345');
        expect(getPageContext('settings', 12345)).toBe('Settings');
        expect(getPageContext('unknown')).toBe('Despatch');
    });

    it('suggests per-page prompts, job prompts for a job, and defaults otherwise', () => {
        expect(getSuggestedPrompts('dispatch').map(p => p.label)).toContain('Which jobs look at risk right now?');
        expect(getSuggestedPrompts('dispatch', 7).map(p => p.label)).toContain("What's happening with this job?");
        expect(getSuggestedPrompts('unknown').map(p => p.label)).toEqual(['How do I book a job?', 'What can you help with?']);
        expect(getSuggestedPrompts('dispatch').every(p => p.prompt === p.label)).toBe(true);
    });
});
