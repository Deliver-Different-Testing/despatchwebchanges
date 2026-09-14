/**
 * Every AI surface is gated by its own category — one test per category, so an
 * accidentally ungated surface shows up here rather than in production.
 *
 * `AiDraftButton` carries the gate for the six surfaces that are just a button;
 * the four that own their whole panel gate themselves and are covered in their
 * own suites.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {AiDraftButton} from './AiDraftButton';
import {renderWithMantine} from '../../../../__testUtils__';
import {
    disableAiCategory,
    disableAutoMate,
    resetAiPreferences,
} from '../../../../__testUtils__/aiPreferences';
import {AiFeatureCategory} from '../../../../services/aiPreferenceStore';

const render = (category?: AiFeatureCategory) =>
    renderWithMantine(
        <AiDraftButton category={category} onClick={jest.fn()} isDrafting={false} label="Draft"/>,
    );

describe('AiDraftButton category gating', () => {
    beforeEach(() => {
        resetAiPreferences();
    });

    it.each<AiFeatureCategory>(['writing', 'pricing', 'triage', 'formFilling'])(
        'renders for %s by default',
        category => {
            render(category);
            expect(screen.getByRole('button', {name: /draft/i})).toBeInTheDocument();
        },
    );

    it.each<AiFeatureCategory>(['writing', 'pricing', 'triage', 'formFilling'])(
        'disappears when %s alone is switched off',
        category => {
            disableAiCategory(category);
            render(category);
            expect(screen.queryByRole('button', {name: /draft/i})).not.toBeInTheDocument();
        },
    );

    it('is unaffected by a different category being off', () => {
        disableAiCategory('pricing');
        render('writing');

        expect(screen.getByRole('button', {name: /draft/i})).toBeInTheDocument();
    });

    it('disappears for every category once the master switch is off', () => {
        disableAutoMate();

        for (const category of ['writing', 'pricing', 'triage', 'formFilling'] as AiFeatureCategory[]) {
            const {unmount} = render(category);
            expect(screen.queryByRole('button', {name: /draft/i})).not.toBeInTheDocument();
            unmount();
        }
    });

    it('falls back to the master switch when no category is given', () => {
        // The caller has already gated itself; the button only needs the master.
        disableAiCategory('writing');
        render();
        expect(screen.getByRole('button', {name: /draft/i})).toBeInTheDocument();

        disableAutoMate();
        render();
        expect(screen.queryByRole('button', {name: /draft/i})).not.toBeInTheDocument();
    });
});
