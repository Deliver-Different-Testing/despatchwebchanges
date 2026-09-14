/**
 * AiRolloutNotice tests.
 *
 * It has to appear once and never again, and it must not tell someone who already
 * turned Auto-mate off that Auto-mate is now on.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {AiRolloutNotice} from './AiRolloutNotice';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {disableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';
import {getAiPreferences, setAiPreferences} from '../../../services/aiPreferenceStore';

describe('AiRolloutNotice', () => {
    beforeEach(() => {
        resetAiPreferences();
    });

    it('announces the change to someone who has not seen it', () => {
        renderWithMantine(<AiRolloutNotice onOpenSettings={jest.fn()}/>);

        expect(screen.getByText('Auto-mate is now on')).toBeInTheDocument();
        expect(screen.getByText(/never sends, creates or changes anything/i)).toBeInTheDocument();
    });

    it('stays away once dismissed, and records that on the account', async () => {
        renderWithMantine(<AiRolloutNotice onOpenSettings={jest.fn()}/>);

        await setupUser().click(screen.getByRole('button', {name: /got it/i}));

        expect(getAiPreferences().noticeSeen).toBe(true);
        expect(screen.queryByText('Auto-mate is now on')).not.toBeInTheDocument();
    });

    it('does not show again on a later load', () => {
        setAiPreferences({noticeSeen: true});

        renderWithMantine(<AiRolloutNotice onOpenSettings={jest.fn()}/>);

        expect(screen.queryByText('Auto-mate is now on')).not.toBeInTheDocument();
    });

    it('says nothing to someone who has already turned Auto-mate off', () => {
        disableAutoMate();

        renderWithMantine(<AiRolloutNotice onOpenSettings={jest.fn()}/>);

        expect(screen.queryByText('Auto-mate is now on')).not.toBeInTheDocument();
    });

    it('opens the settings and dismisses itself in one go', async () => {
        const onOpenSettings = jest.fn();
        renderWithMantine(<AiRolloutNotice onOpenSettings={onOpenSettings}/>);

        await setupUser().click(screen.getByRole('button', {name: /choose what it does/i}));

        expect(onOpenSettings).toHaveBeenCalledTimes(1);
        expect(getAiPreferences().noticeSeen).toBe(true);
    });
});
