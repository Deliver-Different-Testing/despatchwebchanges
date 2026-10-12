import {
    isPanelHideButtonEnabled,
    setPanelHideButtonEnabled,
    loadPanelHideButtonSettingFromServer,
} from './panelHideButtonSettings';
import {getPreference, savePreference} from '../react/services/preferencesApi';

jest.mock('../react/services/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockGetPreference = getPreference as jest.MockedFunction<typeof getPreference>;
const mockSavePreference = savePreference as jest.MockedFunction<typeof savePreference>;

describe('panelHideButtonSettings', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockSavePreference.mockResolvedValue(undefined);
    });

    describe('isPanelHideButtonEnabled', () => {
        it('defaults to true when nothing is stored yet', () => {
            expect(isPanelHideButtonEnabled()).toBe(true);
        });
    });

    describe('setPanelHideButtonEnabled', () => {
        it('persists locally and syncs the value to the server', () => {
            setPanelHideButtonEnabled(false);

            expect(isPanelHideButtonEnabled()).toBe(false);
            expect(mockSavePreference).toHaveBeenCalledWith('ShowPanelHideButton', 'false');
        });

        it('can be turned back on', () => {
            setPanelHideButtonEnabled(false);
            mockSavePreference.mockClear();

            setPanelHideButtonEnabled(true);

            expect(isPanelHideButtonEnabled()).toBe(true);
            expect(mockSavePreference).toHaveBeenCalledWith('ShowPanelHideButton', 'true');
        });
    });

    describe('loadPanelHideButtonSettingFromServer', () => {
        it('applies the server value into localStorage when one exists', async () => {
            mockGetPreference.mockResolvedValue('false');

            await loadPanelHideButtonSettingFromServer();

            expect(isPanelHideButtonEnabled()).toBe(false);
        });

        it('seeds the server from the local (default) value when nothing is saved yet', async () => {
            mockGetPreference.mockResolvedValue(null);

            await loadPanelHideButtonSettingFromServer();

            expect(mockSavePreference).toHaveBeenCalledWith('ShowPanelHideButton', 'true');
        });
    });
});
