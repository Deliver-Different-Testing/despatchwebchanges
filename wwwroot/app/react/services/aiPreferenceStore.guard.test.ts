/**
 * Guards the single way to ask "is this AI feature on?".
 *
 * Gating used to be done three different ways, so each new AI surface had to
 * remember to opt in to being switchable — and two of them very nearly did not.
 * These tests fail the build if that starts happening again, in the spirit of
 * `iconMap.spec.tsx`.
 */

import {execFileSync} from 'child_process';
import path from 'path';

const REACT_ROOT = path.resolve(__dirname, '..');

/** Files allowed to read the raw preference state rather than the hook. */
const STORE_INTERNALS = [
    'services/aiPreferenceStore.ts',
    'services/aiPreferenceSync.ts',
    'hooks/useAiFeature.ts',
    '__testUtils__/aiPreferences.ts',
];

function grep(pattern: string): string[] {
    try {
        const out = execFileSync(
            'git',
            ['grep', '-l', '--', pattern, ':(glob)wwwroot/app/**'],
            {cwd: path.resolve(REACT_ROOT, '../../..'), encoding: 'utf8'},
        );
        return out.split('\n').filter(Boolean);
    } catch {
        // git grep exits non-zero when nothing matches, which is the passing case.
        return [];
    }
}

const isTestFile = (file: string) => /\.(test|spec)\.tsx?$/.test(file);

describe('AI gating has one owner', () => {
    it('nothing reads the legacy aiEnabled localStorage key directly', () => {
        // The pre-2026-09 flag is migration input, not a gate. Reading it to decide
        // whether to show a feature would quietly re-introduce the opt-in default.
        const offenders = grep('aiEnabled_')
            .filter(f => !f.endsWith('functions/aiSettings.ts'))
            .filter(f => !f.includes('aiPreferenceStore'))
            .filter(f => !isTestFile(f));

        expect(offenders).toEqual([]);
    });

    it('only the store, its sync and the hook touch the preference state directly', () => {
        const offenders = grep('getAiPreferences\\|setAiPreferences\\|isAiFeatureEnabled')
            .filter(f => !isTestFile(f))
            .filter(f => !STORE_INTERNALS.some(allowed => f.endsWith(allowed)))
            // Components legitimately *set* preferences from their controls.
            .filter(f => !f.endsWith('side-nav/SideNavAiControls.tsx'))
            .filter(f => !f.endsWith('ai-settings-dialog/AiSettingsDialog.tsx'))
            .filter(f => !f.endsWith('ai-rollout-notice/AiRolloutNotice.tsx'))
            // The inbox triage hook runs outside render, so it reads the store.
            .filter(f => !f.endsWith('hooks/useInboxTriage.ts'));

        expect(offenders).toEqual([]);
    });
});
