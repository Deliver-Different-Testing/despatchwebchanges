import type {Mock, MockedFunction} from 'vitest';
import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import {renderWithMantine} from '../../test/utils';
import {setupUser} from '../../test/utils/setupUser';
import {SettingsPage} from './SettingsPage';
import {
    isAiEnabled,
    isAiAutoOpenEnabled,
    setAiEnabled,
    setAiAutoOpenEnabled,
    isAiChatEnabled,
    setAiChatEnabled,
    loadAutoMateFromServer,
} from '../../utils/aiSettings';
import {
    isPanelHideButtonEnabled,
    setPanelHideButtonEnabled,
    loadPanelHideButtonSettingFromServer,
} from '../../utils/panelHideButtonSettings';
import {deletePreference, getPreference, savePreference} from '../../api/preferencesApi';
import {
    getTenantAddressFormatDefault,
    getTenantCourierFlagLastDeliveryDefault,
    getTenantNavStyleDefault,
} from '../../api/tenantSettingsApi';
import {StaffPreferenceKey} from '../../types/enums/staff-preference-key.enum';
import {useColorMode} from '../../hooks/useColorMode';
import {resetNavStyleStore} from '../../hooks/useNavStyle';
import {toastService} from '../../services/toastService';
import {isLiquidGlassSupported} from '../../hooks/glassSupport';

vi.mock('../../hooks/glassSupport', async () => ({
    ...(await vi.importActual<typeof import('../../hooks/glassSupport')>('../../hooks/glassSupport')),
    isLiquidGlassSupported: vi.fn(),
}));

vi.mock('../../hooks/useColorMode', () => ({
    useColorMode: vi.fn(),
}));

vi.mock('../../utils/aiSettings', () => ({
    isAiEnabled: vi.fn(),
    setAiEnabled: vi.fn(),
    isAiAutoOpenEnabled: vi.fn(),
    setAiAutoOpenEnabled: vi.fn(),
    isAiChatEnabled: vi.fn(),
    setAiChatEnabled: vi.fn(),
    loadAutoMateFromServer: vi.fn(),
}));

vi.mock('../../utils/panelHideButtonSettings', () => ({
    isPanelHideButtonEnabled: vi.fn(),
    setPanelHideButtonEnabled: vi.fn(),
    loadPanelHideButtonSettingFromServer: vi.fn(),
}));

vi.mock('../../api/preferencesApi', () => ({
    getPreference: vi.fn(),
    savePreference: vi.fn(),
    deletePreference: vi.fn(),
}));

vi.mock('../../api/tenantSettingsApi', () => ({
    getTenantAddressFormatDefault: vi.fn(),
    getTenantCourierFlagLastDeliveryDefault: vi.fn(),
    getTenantNavStyleDefault: vi.fn(),
    getTenantAppearanceDefault: vi.fn(),
}));

vi.mock('../../api/session', async () => ({
    ...(await vi.importActual<typeof import('../../api/session')>('../../api/session')),
    getSession: () => ({isUsCustomer: true}),
}));

vi.mock('../../services/toastService', () => ({
    toastService: {showSuccessToast: vi.fn(), showErrorToast: vi.fn()},
}));

const mockIsAiEnabled = isAiEnabled as MockedFunction<typeof isAiEnabled>;
const mockIsAiAutoOpenEnabled = isAiAutoOpenEnabled as MockedFunction<typeof isAiAutoOpenEnabled>;
const mockIsAiChatEnabled = isAiChatEnabled as MockedFunction<typeof isAiChatEnabled>;
const mockSetAiChatEnabled = setAiChatEnabled as MockedFunction<typeof setAiChatEnabled>;
const mockSetAiEnabled = setAiEnabled as MockedFunction<typeof setAiEnabled>;
const mockSetAiAutoOpenEnabled = setAiAutoOpenEnabled as MockedFunction<typeof setAiAutoOpenEnabled>;
const mockLoadAutoMateFromServer = loadAutoMateFromServer as MockedFunction<typeof loadAutoMateFromServer>;
const mockIsPanelHideButtonEnabled = isPanelHideButtonEnabled as MockedFunction<typeof isPanelHideButtonEnabled>;
const mockSetPanelHideButtonEnabled = setPanelHideButtonEnabled as MockedFunction<typeof setPanelHideButtonEnabled>;
const mockLoadPanelHideButtonSettingFromServer =
    loadPanelHideButtonSettingFromServer as MockedFunction<typeof loadPanelHideButtonSettingFromServer>;
const mockGetPreference = getPreference as Mock;
const mockSavePreference = savePreference as Mock;
const mockDeletePreference = deletePreference as Mock;
const mockGetTenantAddressFormatDefault = getTenantAddressFormatDefault as Mock;
const mockGetTenantCourierFlagLastDeliveryDefault = getTenantCourierFlagLastDeliveryDefault as Mock;
const mockGetTenantNavStyleDefault = getTenantNavStyleDefault as Mock;
const mockUseColorMode = useColorMode as Mock;
const mockSetColorPreference = vi.fn();

/** Pickup renders first, delivery second — both sides render an identically-labelled control per field. */
function radioFor(side: 'pickup' | 'delivery', fieldLabel: string, lineLabel: 'Hidden' | 'Line 1' | 'Line 2') {
    const groups = screen.getAllByRole('radiogroup', {name: `${fieldLabel} line`});
    return within(groups[side === 'pickup' ? 0 : 1]).getByRole('radio', {name: lineLabel});
}

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        resetNavStyleStore();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockIsAiEnabled.mockReturnValue(false);
        mockIsAiAutoOpenEnabled.mockReturnValue(false);
        mockIsAiChatEnabled.mockReturnValue(false);
        mockLoadAutoMateFromServer.mockResolvedValue(undefined);
        mockIsPanelHideButtonEnabled.mockReturnValue(true);
        mockLoadPanelHideButtonSettingFromServer.mockResolvedValue(undefined);
        mockGetPreference.mockResolvedValue(null);
        mockSavePreference.mockResolvedValue(undefined);
        mockDeletePreference.mockResolvedValue(undefined);
        mockGetTenantAddressFormatDefault.mockResolvedValue(null);
        mockGetTenantCourierFlagLastDeliveryDefault.mockResolvedValue(null);
        mockGetTenantNavStyleDefault.mockResolvedValue(null);
        mockUseColorMode.mockReturnValue({mode: 'light', preference: 'system', setPreference: mockSetColorPreference});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders a page heading and the Auto-mate section', () => {
        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('heading', {name: 'Settings'})).toBeInTheDocument();
        expect(screen.getByText('Auto-mate')).toBeInTheDocument();
        expect(screen.getByText('Show Auto-mate briefings')).toBeInTheDocument();
        expect(screen.getByText('Expand briefings automatically')).toBeInTheDocument();
    });

    it('offers Light / Dark / System appearance, reflects the current pick and applies a change', async () => {
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Match device'})).toBeChecked();

        await user.click(screen.getByRole('radio', {name: 'Dark'}));

        expect(mockSetColorPreference).toHaveBeenCalledWith('dark');
    });

    describe('Navigation style', () => {
        const navRadio = (name: string) =>
            within(screen.getByRole('radiogroup', {name: /Navigation style/})).getByRole('radio', {name});

        it('follows the company default, saves an override immediately, and clears it again', async () => {
            const user = setupUser();
            mockGetTenantNavStyleDefault.mockResolvedValue('dfrnt');
            renderWithMantine(<SettingsPage />);

            const companyDefault = navRadio('Company default');
            expect(companyDefault).toBeChecked();

            await user.click(navRadio('DFRNT sidebar'));
            await waitFor(() => expect(mockSavePreference)
                .toHaveBeenCalledWith(StaffPreferenceKey.NavStyle, '"dfrnt"'));
            await waitFor(() => expect(navRadio('DFRNT sidebar')).toBeChecked());

            await user.click(navRadio('Company default'));
            await waitFor(() => expect(mockDeletePreference).toHaveBeenCalledWith(StaffPreferenceKey.NavStyle));
            await waitFor(() => expect(navRadio('Company default')).toBeChecked());
        });

        it('shows the saved override and, when the save fails, an error toast and the unchanged choice', async () => {
            const user = setupUser();
            mockGetPreference.mockImplementation((key: string) =>
                Promise.resolve(key === StaffPreferenceKey.NavStyle ? '"dispatch"' : null));
            mockSavePreference.mockRejectedValue(new Error('offline'));
            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(navRadio('Dispatch')).toBeChecked());

            await user.click(navRadio('DFRNT sidebar'));

            await waitFor(() => expect(toastService.showErrorToast).toHaveBeenCalled());
            expect(navRadio('Dispatch')).toBeChecked();
        });
    });

    describe('Driver flags', () => {
        it('follows the company default until the user picks an override, which saves immediately', async () => {
            const user = setupUser();
            mockGetTenantCourierFlagLastDeliveryDefault.mockResolvedValue('region');
            renderWithMantine(<SettingsPage />);

            const companyDefault = await screen.findByRole('radio', {name: 'Company default (State)'});
            expect(companyDefault).toBeChecked();

            await user.click(screen.getByRole('radio', {name: 'Township or city'}));

            expect(mockSavePreference).toHaveBeenCalledWith(StaffPreferenceKey.CourierFlagLastDelivery, '"locality"');
        });

        it('shows a saved override and clears it when the company default is picked again', async () => {
            const user = setupUser();
            mockGetPreference.mockImplementation((key: string) =>
                Promise.resolve(key === StaffPreferenceKey.CourierFlagLastDelivery ? '"off"' : null));
            renderWithMantine(<SettingsPage />);

            const lastDelivery = screen.getByRole('radiogroup', {name: /Last delivery/});
            await waitFor(() => expect(within(lastDelivery).getByRole('radio', {name: "Don't show"})).toBeChecked());

            await user.click(screen.getByRole('radio', {name: 'Company default (Township or city)'}));

            expect(mockDeletePreference).toHaveBeenCalledWith(StaffPreferenceKey.CourierFlagLastDelivery);
        });
    });

    it('seeds both Auto-mate toggles from the stored preferences', () => {
        mockIsAiEnabled.mockReturnValue(true);
        mockIsAiAutoOpenEnabled.mockReturnValue(true);

        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('switch', {name: 'Show Auto-mate briefings'})).toBeChecked();
        expect(screen.getByRole('switch', {name: 'Expand briefings automatically'})).toBeChecked();
    });

    it('disables "Open automatically" while briefings are off', () => {
        mockIsAiEnabled.mockReturnValue(false);

        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('switch', {name: 'Expand briefings automatically'})).toBeDisabled();
    });

    it('persists an Auto-mate toggle immediately, with no separate save step', async () => {
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        await user.click(screen.getByRole('switch', {name: 'Show Auto-mate briefings'}));

        expect(mockSetAiEnabled).toHaveBeenCalledWith(true);
    });

    it('shows the chat assistant switch off by default and persists turning it on', async () => {
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        const toggle = screen.getByRole('switch', {name: 'Auto-mate chat assistant'});
        expect(toggle).not.toBeChecked();

        await user.click(toggle);

        expect(mockSetAiChatEnabled).toHaveBeenCalledWith(true);
    });

    describe('Liquid Glass', () => {
        beforeEach(() => (isLiquidGlassSupported as Mock).mockReturnValue(true));

        it('is off by default, tagged BETA, and names the browsers it works in', () => {
            renderWithMantine(<SettingsPage />);

            expect(screen.getByRole('switch', {name: 'Liquid Glass'})).not.toBeChecked();
            expect(screen.getByText(/Works in Chromium browsers/)).toBeInTheDocument();
            expect(screen.getByText(/Chrome, Edge, Brave and Opera/)).toBeInTheDocument();
        });

        it('turns on and persists when toggled', async () => {
            const user = setupUser();
            renderWithMantine(<SettingsPage />);

            await user.click(screen.getByRole('switch', {name: 'Liquid Glass'}));

            expect(screen.getByRole('switch', {name: 'Liquid Glass'})).toBeChecked();
            expect(localStorage.getItem('dd-liquid-glass')).toBe('on');
            expect(savePreference).toHaveBeenCalledWith('LiquidGlass', 'on');
        });

        it('is disabled and explains why in an unsupported browser', async () => {
            (isLiquidGlassSupported as Mock).mockReturnValue(false);
            localStorage.removeItem('dd-liquid-glass');
            const user = setupUser();
            renderWithMantine(<SettingsPage />);

            const toggle = screen.getByRole('switch', {name: 'Liquid Glass'});
            expect(toggle).toBeDisabled();
            expect(screen.getByText(/Your browser doesn't support Liquid Glass/)).toBeInTheDocument();
            await user.click(toggle);
            expect(toggle).not.toBeChecked();
            expect(localStorage.getItem('dd-liquid-glass')).toBeNull();
        });
    });

    describe('Dashboard settings', () => {
        it('renders the per-panel hide button toggle, checked by default', () => {
            renderWithMantine(<SettingsPage />);

            expect(screen.getByText('Show hide button on each panel')).toBeInTheDocument();
            expect(screen.getByRole('switch', {name: 'Show hide button on each panel'})).toBeChecked();
        });

        it('reflects an existing opt-out', () => {
            mockIsPanelHideButtonEnabled.mockReturnValue(false);

            renderWithMantine(<SettingsPage />);

            expect(screen.getByRole('switch', {name: 'Show hide button on each panel'})).not.toBeChecked();
        });

        it('persists a toggle immediately, with no separate save step', async () => {
            const user = setupUser();
            renderWithMantine(<SettingsPage />);

            await user.click(screen.getByRole('switch', {name: 'Show hide button on each panel'}));

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
            expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
        });

        it('loads the user\'s own override in preference to the tenant default, per side', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":["postcode"],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockResolvedValue(
                '{"pickup":{"line1":["country"],"line2":[]},"delivery":{"line1":["country"],"line2":[]}}',
            );

            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());
            expect(radioFor('delivery', 'Postcode', 'Line 1')).toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeEnabled();
        });

        it('does not save while editing — only stages the draft, and enables Save', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());

            expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));

            expect(mockSavePreference).not.toHaveBeenCalled();
            expect(screen.getByRole('button', {name: 'Save changes'})).toBeEnabled();
        });

        it('saves both sides only once Save is clicked', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());

            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save changes'}));

            // Delivery was never touched and still matches the (empty) tenant
            // default, so it's saved as `null` rather than a snapshot.
            expect(mockSavePreference).toHaveBeenCalledWith(
                'DispatchAddressFormat',
                JSON.stringify({
                    pickup: {line1: ['streetName', 'postcode'], line2: []},
                    delivery: null,
                }),
            );
            await waitFor(() => expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled());
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
            await user.click(radioFor('delivery', 'Street name', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save changes'}));

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
            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());

            await user.click(radioFor('pickup', 'Street name', 'Hidden'));
            await user.click(radioFor('pickup', 'Postcode', 'Line 1'));
            await user.click(screen.getByRole('button', {name: 'Save changes'}));

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
            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());

            await user.click(screen.getByRole('button', {name: 'Copy to delivery'}));

            expect(radioFor('delivery', 'Street name', 'Line 1')).toBeChecked();
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
            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());

            await user.click(screen.getByRole('button', {name: 'Reset to default'}));

            expect(mockDeletePreference).toHaveBeenCalledWith('DispatchAddressFormat');
            await waitFor(() => expect(radioFor('pickup', 'Postcode', 'Line 1')).toBeChecked());
            expect(radioFor('pickup', 'Street name', 'Hidden')).toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled();
        });

        it('keeps a working user override even when the tenant default fetch fails', async () => {
            mockGetPreference.mockResolvedValue(
                '{"pickup":{"line1":["streetName"],"line2":[]},"delivery":{"line1":[],"line2":[]}}',
            );
            mockGetTenantAddressFormatDefault.mockRejectedValue(new Error('500'));

            renderWithMantine(<SettingsPage />);

            await waitFor(() => expect(radioFor('pickup', 'Street name', 'Line 1')).toBeChecked());
            expect(screen.getByText(/Couldn.t load your organisation.s default format/)).toBeInTheDocument();
        });
    });
});
