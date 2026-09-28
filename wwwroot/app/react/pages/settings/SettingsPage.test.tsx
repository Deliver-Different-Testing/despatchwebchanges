import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import {renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
import {SettingsPage} from './SettingsPage';
import {
    isAiEnabled,
    isAiAutoOpenEnabled,
    setAiEnabled,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from '../../../functions/aiSettings';
import {
    isPanelHideButtonEnabled,
    setPanelHideButtonEnabled,
    loadPanelHideButtonSettingFromServer,
} from '../../../functions/panelHideButtonSettings';
import {deletePreference, getPreference, savePreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';

jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn(),
    setAiEnabled: jest.fn(),
    isAiAutoOpenEnabled: jest.fn(),
    setAiAutoOpenEnabled: jest.fn(),
    loadAutoMateFromServer: jest.fn(),
}));

jest.mock('../../../functions/panelHideButtonSettings', () => ({
    isPanelHideButtonEnabled: jest.fn(),
    setPanelHideButtonEnabled: jest.fn(),
    loadPanelHideButtonSettingFromServer: jest.fn(),
}));

jest.mock('../../services/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
    deletePreference: jest.fn(),
}));

jest.mock('../../services/tenantSettingsApi', () => ({
    getTenantAddressFormatDefault: jest.fn(),
}));

const mockIsAiEnabled = isAiEnabled as jest.MockedFunction<typeof isAiEnabled>;
const mockIsAiAutoOpenEnabled = isAiAutoOpenEnabled as jest.MockedFunction<typeof isAiAutoOpenEnabled>;
const mockSetAiEnabled = setAiEnabled as jest.MockedFunction<typeof setAiEnabled>;
const mockSetAiAutoOpenEnabled = setAiAutoOpenEnabled as jest.MockedFunction<typeof setAiAutoOpenEnabled>;
const mockLoadAutoMateFromServer = loadAutoMateFromServer as jest.MockedFunction<typeof loadAutoMateFromServer>;
const mockIsPanelHideButtonEnabled = isPanelHideButtonEnabled as jest.MockedFunction<typeof isPanelHideButtonEnabled>;
const mockSetPanelHideButtonEnabled = setPanelHideButtonEnabled as jest.MockedFunction<typeof setPanelHideButtonEnabled>;
const mockLoadPanelHideButtonSettingFromServer =
    loadPanelHideButtonSettingFromServer as jest.MockedFunction<typeof loadPanelHideButtonSettingFromServer>;
const mockGetPreference = getPreference as jest.Mock;
const mockSavePreference = savePreference as jest.Mock;
const mockDeletePreference = deletePreference as jest.Mock;
const mockGetTenantAddressFormatDefault = getTenantAddressFormatDefault as jest.Mock;

/** Pickup renders first, delivery second — both sides render an identically-labelled control per field. */
function radioFor(side: 'pickup' | 'delivery', fieldLabel: string, lineLabel: 'Off' | 'Line 1' | 'Line 2') {
    const groups = screen.getAllByRole('radiogroup', {name: `${fieldLabel} line`});
    return within(groups[side === 'pickup' ? 0 : 1]).getByRole('radio', {name: lineLabel});
}

describe('SettingsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockIsAiEnabled.mockReturnValue(false);
        mockIsAiAutoOpenEnabled.mockReturnValue(false);
        mockLoadAutoMateFromServer.mockResolvedValue(undefined);
        mockIsPanelHideButtonEnabled.mockReturnValue(true);
        mockLoadPanelHideButtonSettingFromServer.mockResolvedValue(undefined);
        mockGetPreference.mockResolvedValue(null);
        mockSavePreference.mockResolvedValue(undefined);
        mockDeletePreference.mockResolvedValue(undefined);
        mockGetTenantAddressFormatDefault.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders a page heading and the Auto-mate section', () => {
        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('heading', {name: 'Settings'})).toBeInTheDocument();
        expect(screen.getByText('Auto-mate Settings')).toBeInTheDocument();
        expect(screen.getByText('Show Auto-mate briefings')).toBeInTheDocument();
        expect(screen.getByText('Open automatically')).toBeInTheDocument();
    });

    it('seeds both Auto-mate toggles from the stored preferences', () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockIsAiAutoOpenEnabled.mockReturnValue(true);

        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('switch', {name: 'Show Auto-mate briefings'})).toBeChecked();
        expect(screen.getByRole('switch', {name: 'Open automatically'})).toBeChecked();
    });

    it('disables "Open automatically" while briefings are off', () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('switch', {name: 'Open automatically'})).toBeDisabled();
    });

    it('persists an Auto-mate toggle immediately, with no separate save step', async () => {
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        await user.click(screen.getByRole('switch', {name: 'Show Auto-mate briefings'}));

        expect(mockSetAiEnabled).toHaveBeenCalledWith(true);
    });

    describe('Dashboard settings', () => {
        it('renders the per-panel hide button toggle, checked by default', () => {
            renderWithMantine(<SettingsPage />);

            expect(screen.getByText('Show per-panel hide button')).toBeInTheDocument();
            expect(screen.getByRole('switch', {name: 'Show per-panel hide button'})).toBeChecked();
        });

        it('reflects an existing opt-out', () => {
            mockIsPanelHideButtonEnabled.mockReturnValue(false);

            renderWithMantine(<SettingsPage />);

            expect(screen.getByRole('switch', {name: 'Show per-panel hide button'})).not.toBeChecked();
        });

        it('persists a toggle immediately, with no separate save step', async () => {
            const user = setupUser();
            renderWithMantine(<SettingsPage />);

            await user.click(screen.getByRole('switch', {name: 'Show per-panel hide button'}));

            expect(mockSetPanelHideButtonEnabled).toHaveBeenCalledWith(false);
        });
    });

    describe('Address format', () => {
        it('pre-fills both sides from the tenant default when the user has no override', async () => {
            mockGetPreference.mockResolvedValue(null);
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["postcode"],"line2":[]},"delivery":{"line1":["country"],"line2":[]}}',
            );

            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(radioFor('pickup', 'Postcode', 'Line 1')).toBeChecked());
            expect(radioFor('delivery', 'Country', 'Line 1')).toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled();
            expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        });

        it('loads the user\'s own override in preference to the tenant default, per side', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":["postcode"],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["country"],"line2":[]},"delivery":{"line1":["country"],"line2":[]}}',
            );

            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());
            expect(radioFor('delivery', 'Postcode', 'Line 1')).toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeEnabled();
        });

        it('does not save while editing — only stages the draft, and enables Save', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());

            expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));

            expect(mockSavePreference).not.toHaveBeenCalled();
            expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
        });

        it('saves both sides only once Save is clicked', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());

            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save'}));

            // Delivery was never touched and still matches the (empty) tenant
            // default, so it's saved as `null` rather than a snapshot.
            expect(mockSavePreference).toHaveBeenCalledWith(
                'DispatchAddressFormat',
                JSON.stringify({
                    pickup: {line1: ['streetName', 'postcode'], line2: []},
                    delivery: null,
                }),
            );
            await waitFor(() => expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled());
        });

        it('saves an untouched side as null (not a snapshot) so it keeps following the tenant default', async () => {
            mockGetPreference.mockResolvedValue(null);
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["postcode"],"line2":[]},"delivery":{"line1":["country"],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Postcode', 'Line 1')).toBeChecked());

            // Customize delivery only; pickup is left matching the tenant default.
            await user.click(radioFor('delivery', 'Street Name', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(mockSavePreference).toHaveBeenCalledWith(
                'DispatchAddressFormat',
                JSON.stringify({
                    pickup: null,
                    delivery: {line1: ['country', 'streetName'], line2: []},
                }),
            );
        });

        it('deletes the preference instead of saving when both sides are edited back to the tenant default', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["postcode"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());

            await user.click(radioFor('pickup', 'Street Name', 'Off'));
            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(mockSavePreference).not.toHaveBeenCalled();
            expect(mockDeletePreference).toHaveBeenCalledWith('DispatchAddressFormat');
            await waitFor(() => expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled());
        });

        it('copies the pickup draft onto delivery', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());

            await user.click(screen.getByRole('button', {name: 'Copy to delivery'}));

            expect(radioFor('delivery', 'Street Name', 'Line 1')).toBeChecked();
        });

        it('resets both sides to the tenant default and clears the stored override immediately', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["postcode"],"line2":[]},"delivery":{"line1":["postcode"],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());

            await user.click(screen.getByRole('button', {name: 'Reset to default'}));

            expect(mockDeletePreference).toHaveBeenCalledWith('DispatchAddressFormat');
            await waitFor(() => expect(radioFor('pickup', 'Postcode', 'Line 1')).toBeChecked());
            expect(radioFor('pickup', 'Street Name', 'Off')).toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled();
        });

        it('keeps a working user override even when the tenant default fetch fails', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockRejectedValue(new Error('500'));

            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(radioFor('pickup', 'Street Name', 'Line 1')).toBeChecked());
            expect(screen.getByText(/Couldn.t load the tenant address format default/)).toBeInTheDocument();
        });
    });
});
