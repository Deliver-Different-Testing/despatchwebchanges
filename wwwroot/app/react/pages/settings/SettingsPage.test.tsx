import React from 'react';
import {screen, waitFor} from '@testing-library/react';
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
import {deletePreference, getPreference, savePreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';

jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn(),
    setAiEnabled: jest.fn(),
    isAiAutoOpenEnabled: jest.fn(),
    setAiAutoOpenEnabled: jest.fn(),
    loadAutoMateFromServer: jest.fn(),
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
const mockGetPreference = getPreference as jest.Mock;
const mockSavePreference = savePreference as jest.Mock;
const mockDeletePreference = deletePreference as jest.Mock;
const mockGetTenantAddressFormatDefault = getTenantAddressFormatDefault as jest.Mock;

describe('SettingsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsAiEnabled.mockReturnValue(false);
        mockIsAiAutoOpenEnabled.mockReturnValue(false);
        mockLoadAutoMateFromServer.mockResolvedValue(undefined);
        mockGetPreference.mockResolvedValue(null);
        mockSavePreference.mockResolvedValue(undefined);
        mockDeletePreference.mockResolvedValue(undefined);
        mockGetTenantAddressFormatDefault.mockResolvedValue(null);
    });

    it('renders a page heading and the Auto-mate section', () => {
        renderWithMantine(<SettingsPage />);

        expect(screen.getByRole('heading', {name: 'Settings'})).toBeInTheDocument();
        expect(screen.getByText('Auto-mate Settings')).toBeInTheDocument();
        expect(screen.getByText('Show Auto-mate briefings')).toBeInTheDocument();
        expect(screen.getByText('Open automatically')).toBeInTheDocument();
    });

    it('has no Save or Cancel button — toggles apply instantly', () => {
        renderWithMantine(<SettingsPage />);

        expect(screen.queryByRole('button', {name: /save/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /cancel/i})).not.toBeInTheDocument();
    });

    it('seeds both toggles from the stored preferences', () => {
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

    it('persists a toggle immediately, with no separate save step', async () => {
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        await user.click(screen.getByRole('switch', {name: 'Show Auto-mate briefings'}));

        expect(mockSetAiEnabled).toHaveBeenCalledWith(true);
    });

    it('enables and persists "Open automatically" once briefings are on', async () => {
        mockIsAiEnabled.mockReturnValue(true);
        const user = setupUser();
        renderWithMantine(<SettingsPage />);

        const autoOpenSwitch = screen.getByRole('switch', {name: 'Open automatically'});
        expect(autoOpenSwitch).toBeEnabled();

        await user.click(autoOpenSwitch);

        expect(mockSetAiAutoOpenEnabled).toHaveBeenCalledWith(true);
    });

    describe('server hydration', () => {
        it('pulls Auto-mate settings from the server on mount', () => {
            renderWithMantine(<SettingsPage />);

            expect(mockLoadAutoMateFromServer).toHaveBeenCalledTimes(1);
        });

        it('re-reads local storage once the server hydrate resolves', async () => {
            mockIsAiEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);

            renderWithMantine(<SettingsPage />);

            expect(screen.getByRole('switch', {name: 'Show Auto-mate briefings'})).not.toBeChecked();
            await waitFor(() => {
                expect(screen.getByRole('switch', {name: 'Show Auto-mate briefings'})).toBeChecked();
            });
        });
    });

    describe('Address format', () => {
        it('pre-fills the editor from the tenant default when the user has no override', async () => {
            mockGetPreference.mockResolvedValue(null);
            mockGetTenantAddressFormatDefault.mockResolvedValue('{"fields":["postcode"]}');

            renderWithMantine(<SettingsPage />);

            await waitFor(() => {
                expect(screen.getByLabelText('Show Postcode')).toBeChecked();
            });
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled();
        });

        it('loads the user\'s own override in preference to the tenant default', async () => {
            mockGetPreference.mockResolvedValue('{"fields":["streetName"]}');
            mockGetTenantAddressFormatDefault.mockResolvedValue('{"fields":["postcode"]}');

            renderWithMantine(<SettingsPage />);

            await waitFor(() => {
                expect(screen.getByLabelText('Show Street Name')).toBeChecked();
            });
            expect(screen.getByLabelText('Show Postcode')).not.toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeEnabled();
        });

        it('saves immediately when a field is toggled', async () => {
            mockGetPreference.mockResolvedValue('{"fields":["streetName"]}');
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(screen.getByLabelText('Show Street Name')).toBeChecked());

            await user.click(screen.getByLabelText('Show Postcode'));

            expect(mockSavePreference).toHaveBeenCalledWith(
                'DispatchAddressFormat', '{"fields":["streetName","postcode"]}',
            );
        });

        it('resets to the tenant default and clears the stored override', async () => {
            mockGetPreference.mockResolvedValue('{"fields":["streetName"]}');
            mockGetTenantAddressFormatDefault.mockResolvedValue('{"fields":["postcode"]}');
            const user = setupUser();
            renderWithMantine(<SettingsPage />);
            await waitFor(() => expect(screen.getByLabelText('Show Street Name')).toBeChecked());

            await user.click(screen.getByRole('button', {name: 'Reset to default'}));

            expect(mockDeletePreference).toHaveBeenCalledWith('DispatchAddressFormat');
            await waitFor(() => {
                expect(screen.getByLabelText('Show Postcode')).toBeChecked();
            });
            expect(screen.getByLabelText('Show Street Name')).not.toBeChecked();
            expect(screen.getByRole('button', {name: 'Reset to default'})).toBeDisabled();
        });
    });
});
