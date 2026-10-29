import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {renderWithMantine} from '../../test/utils';
import {setupUser} from '../../test/utils/setupUser';
import {AppearanceSettingsSection} from './AppearanceSettingsSection';
import {APPEARANCE_STORAGE_KEY} from '../../hooks/useAppearance';
import {deletePreference, savePreference} from '../../api/preferencesApi';
import {StaffPreferenceKey} from '../../types/enums/staff-preference-key.enum';
import {toastService} from '../../services/toastService';

jest.mock('../../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
    deletePreference: jest.fn(),
}));
jest.mock('../../api/tenantSettingsApi', () => ({getTenantAppearanceDefault: jest.fn()}));
jest.mock('../../hooks/useColorMode', () => ({
    useColorMode: () => ({mode: 'light', preference: 'light', setPreference: jest.fn()}),
}));
jest.mock('../../services/toastService', () => ({
    toastService: {showSuccessToast: jest.fn(), showErrorToast: jest.fn()},
}));

const mockSave = savePreference as jest.Mock;
const mockDelete = deletePreference as jest.Mock;
const win = window as unknown as {__ddAppearanceServerSynced?: boolean};

function seed(state: {user?: object | null; tenant?: object | null}): void {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({user: null, tenant: null, ...state}));
}

describe('AppearanceSettingsSection', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockSave.mockResolvedValue(undefined);
        mockDelete.mockResolvedValue(undefined);
        win.__ddAppearanceServerSynced = true;
    });

    it('labels the company default and saves a chosen contrast level as the ThemeCustomisation preference', async () => {
        seed({tenant: {contrast: 'high', primary: '#132279'}});
        const user = setupUser();
        renderWithMantine(<AppearanceSettingsSection/>);

        expect(screen.getByRole('radio', {name: 'Company default'})).toBeChecked();
        expect(screen.getByText('Currently high.')).toBeInTheDocument();
        expect(screen.getByLabelText('Primary colour')).toHaveAttribute('placeholder', 'Company default, #132279');
        expect(screen.getByRole('button', {name: 'Save colours and contrast'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Reset to company default'})).toBeDisabled();

        await user.click(screen.getByRole('radio', {name: 'Standard'}));
        await user.click(screen.getByRole('button', {name: 'Save colours and contrast'}));

        await waitFor(() => expect(mockSave).toHaveBeenCalledWith(
            StaffPreferenceKey.ThemeCustomisation,
            JSON.stringify({contrast: 'standard'}),
        ));
        expect(toastService.showSuccessToast).toHaveBeenCalledWith('Colours and contrast saved');
    });

    it('blocks saving a text colour below the contrast minimum until the nearest accessible colour is used', async () => {
        const user = setupUser();
        renderWithMantine(<AppearanceSettingsSection/>);

        await user.type(screen.getByLabelText('Text colour in the light theme'), '#f4c430');

        expect(await screen.findByText(/Needs 4\.5:1 or more/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save colours and contrast'})).toBeDisabled();

        await user.click(screen.getByRole('button', {name: /^Use #[0-9a-f]{6} instead$/}));

        expect(screen.queryByText(/Needs 4\.5:1 or more/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save colours and contrast'})).toBeEnabled();
    });

    it('resets to the company default by deleting the preference', async () => {
        seed({user: {primary: '#2a4eff'}});
        const user = setupUser();
        renderWithMantine(<AppearanceSettingsSection/>);

        expect(screen.getByLabelText('Primary colour')).toHaveValue('#2a4eff');
        await user.click(screen.getByRole('button', {name: 'Reset to company default'}));

        await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(StaffPreferenceKey.ThemeCustomisation));
        expect(screen.getByLabelText('Primary colour')).toHaveValue('');
    });

    it('applies a suggested colour and previews the app bar in it, falling back to the company primary', async () => {
        seed({tenant: {primary: '#132279'}});
        const user = setupUser();
        renderWithMantine(<AppearanceSettingsSection/>);

        const preview = screen.getByRole('figure', {name: 'Preview of your colours'});
        const bars = () => Array.from(preview.querySelectorAll<HTMLElement>('[data-mode]'))
            .map(pane => pane.style.getPropertyValue('--pv-bar'));
        expect(bars()).toEqual(['#132279', '#132279']);

        await user.click(screen.getByRole('button', {name: 'Suggested #f4c430'}));

        expect(screen.getByLabelText('Primary colour')).toHaveValue('#f4c430');
        expect(bars()).toEqual(['#f4c430', '#f4c430']);
        expect(screen.getByRole('button', {name: 'Save colours and contrast'})).toBeEnabled();
    });
});
