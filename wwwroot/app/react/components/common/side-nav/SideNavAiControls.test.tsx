/**
 * SideNavAiControls tests.
 *
 * This is the control that has to be reachable from every page, so what matters is
 * that the master switch works from here and the way in to the category toggles is
 * obvious — and shut off once there is nothing to choose between.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {SideNavAiControls} from './SideNavAiControls';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {disableAiCategory, disableAutoMate, resetAiPreferences} from '../../../__testUtils__/aiPreferences';
import {getAiPreferences} from '../../../services/aiPreferenceStore';

describe('SideNavAiControls', () => {
    beforeEach(() => {
        resetAiPreferences();
    });

    it('shows Auto-mate on by default', () => {
        renderWithMantine(<SideNavAiControls onOpenSettings={jest.fn()}/>);

        expect(screen.getByRole('switch', {name: 'Auto-mate'})).toBeChecked();
    });

    it('turns Auto-mate off from the menu', async () => {
        renderWithMantine(<SideNavAiControls onOpenSettings={jest.fn()}/>);
        const user = setupUser();

        await user.click(screen.getByRole('switch', {name: 'Auto-mate'}));

        expect(getAiPreferences().enabled).toBe(false);
        expect(screen.getByRole('switch', {name: 'Auto-mate'})).not.toBeChecked();
    });

    it('opens the category settings', async () => {
        const onOpenSettings = jest.fn();
        renderWithMantine(<SideNavAiControls onOpenSettings={onOpenSettings}/>);
        const user = setupUser();

        await user.click(screen.getByText('Choose what it does'));

        expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('counts the categories that are switched off, so the state is visible from the menu', () => {
        disableAiCategory('pricing');
        renderWithMantine(<SideNavAiControls onOpenSettings={jest.fn()}/>);

        expect(screen.getByText('Choose what it does — 1 off')).toBeInTheDocument();
    });

    it('closes the way in to the categories once Auto-mate is off', async () => {
        disableAutoMate();
        const onOpenSettings = jest.fn();
        renderWithMantine(<SideNavAiControls onOpenSettings={onOpenSettings}/>);

        expect(screen.getByText('AI features are off')).toBeInTheDocument();
        await setupUser().click(screen.getByText('AI features are off'));
        expect(onOpenSettings).not.toHaveBeenCalled();
    });
});
