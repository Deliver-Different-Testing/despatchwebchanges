import {renderHook, waitFor} from '@testing-library/react';
import {usePanelHideButtonSetting} from './usePanelHideButtonSetting';
import {getPreference, savePreference} from '../../../services/preferencesApi';

jest.mock('../../../services/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockGetPreference = getPreference as jest.MockedFunction<typeof getPreference>;
const mockSavePreference = savePreference as jest.MockedFunction<typeof savePreference>;

describe('usePanelHideButtonSetting', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockSavePreference.mockResolvedValue(undefined);
    });

    it('starts true (the default) and stays true once the server confirms it', async () => {
        mockGetPreference.mockResolvedValue('true');

        const {result} = renderHook(() => usePanelHideButtonSetting());

        expect(result.current).toBe(true);
        await waitFor(() => expect(mockGetPreference).toHaveBeenCalled());
        expect(result.current).toBe(true);
    });

    it('reconciles to false once the server value loads', async () => {
        mockGetPreference.mockResolvedValue('false');

        const {result} = renderHook(() => usePanelHideButtonSetting());

        await waitFor(() => expect(result.current).toBe(false));
    });
});
