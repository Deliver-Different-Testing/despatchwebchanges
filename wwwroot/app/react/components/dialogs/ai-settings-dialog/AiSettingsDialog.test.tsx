/**
 * AiSettingsDialog tests.
 *
 * The rules worth pinning: the master switch governs the categories, one category
 * can be turned off on its own, and auto-open is a sub-setting of briefings rather
 * than a sixth category.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {AiSettingsDialog} from './AiSettingsDialog';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {disableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';
import {getAiPreferences, isAiFeatureEnabled} from '../../../services/aiPreferenceStore';

const CATEGORY_LABELS = [
    'Briefings and alerts',
    'Writing help',
    'Pricing help',
    'Filling forms from text',
    'Queue triage',
];

const renderDialog = () =>
    renderWithMantine(<AiSettingsDialog opened onClose={jest.fn()}/>);

describe('AiSettingsDialog', () => {
    beforeEach(() => {
        resetAiPreferences();
    });

    it('offers the master switch and one row per category, all on by default', () => {
        renderDialog();

        expect(screen.getByRole('switch', {name: 'Use Auto-mate'})).toBeChecked();
        for (const label of CATEGORY_LABELS) {
            expect(screen.getByRole('switch', {name: label})).toBeChecked();
        }
    });

    it('describes each category by what the operator gets, not by the endpoint', () => {
        renderDialog();

        expect(screen.getByText(/drafts a message, an email, a pod email or a job note/i))
            .toBeInTheDocument();
        expect(screen.getByText(/reads a pasted booking into a new job/i)).toBeInTheDocument();
    });

    it('turns one category off without touching the others', async () => {
        renderDialog();
        const user = setupUser();

        await user.click(screen.getByRole('switch', {name: 'Pricing help'}));

        expect(isAiFeatureEnabled('pricing')).toBe(false);
        expect(isAiFeatureEnabled('briefings')).toBe(true);
        expect(getAiPreferences().enabled).toBe(true);
    });

    it('disables every category row while the master is off', () => {
        disableAutoMate();
        renderDialog();

        expect(screen.getByRole('switch', {name: 'Use Auto-mate'})).not.toBeChecked();
        for (const label of CATEGORY_LABELS) {
            const row = screen.getByRole('switch', {name: label});
            expect(row).toBeDisabled();
            expect(row).not.toBeChecked();
        }
    });

    it('treats auto-open as a sub-setting of briefings, not a sixth category', async () => {
        renderDialog();
        const user = setupUser();

        const autoOpen = screen.getByRole('switch', {name: 'Open briefings automatically'});
        expect(autoOpen).toBeEnabled();

        await user.click(screen.getByRole('switch', {name: 'Briefings and alerts'}));

        expect(screen.getByRole('switch', {name: 'Open briefings automatically'})).toBeDisabled();
    });

    it('says plainly what Auto-mate never does', () => {
        renderDialog();

        expect(screen.getByText(/never sends a message, creates a job or changes a price/i))
            .toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        renderWithMantine(<AiSettingsDialog opened={false} onClose={jest.fn()}/>);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
