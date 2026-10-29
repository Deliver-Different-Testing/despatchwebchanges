import {
    isAiEnabled,
    setAiEnabled,
    isAiAutoOpenEnabled,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from './aiSettings';
import {getPreference, savePreference} from '../api/preferencesApi';

jest.mock('../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockGetPreference = getPreference as jest.MockedFunction<typeof getPreference>;
const mockSavePreference = savePreference as jest.MockedFunction<typeof savePreference>;

describe('aiSettings', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockSavePreference.mockResolvedValue(undefined);
    });

    describe('setAiEnabled', () => {
        it('persists locally and syncs the combined payload to the server', () => {
            setAiEnabled(true);

            expect(isAiEnabled()).toBe(true);
            expect(mockSavePreference).toHaveBeenCalledWith(
                'AutoMate',
                JSON.stringify({aiEnabled: true, aiAutoOpen: false}),
            );
        });
    });

    describe('setAiAutoOpenEnabled', () => {
        it('persists locally and syncs the combined payload to the server', () => {
            setAiEnabled(true);
            mockSavePreference.mockClear();

            setAiAutoOpenEnabled(true);

            expect(isAiAutoOpenEnabled()).toBe(true);
            expect(mockSavePreference).toHaveBeenCalledWith(
                'AutoMate',
                JSON.stringify({aiEnabled: true, aiAutoOpen: true}),
            );
        });
    });

    describe('loadAutoMateFromServer', () => {
        it('applies the server value into localStorage when one exists', async () => {
            mockGetPreference.mockResolvedValue(JSON.stringify({aiEnabled: true, aiAutoOpen: true}));

            await loadAutoMateFromServer();

            expect(isAiEnabled()).toBe(true);
            expect(isAiAutoOpenEnabled()).toBe(true);
        });

        it('writes nothing when neither the server nor this browser has a saved choice', async () => {
            mockGetPreference.mockResolvedValue(null);

            await loadAutoMateFromServer();

            expect(mockSavePreference).not.toHaveBeenCalled();
        });

        it('seeds the server from local values when nothing is saved yet', async () => {
            mockGetPreference.mockResolvedValue(null);
            setAiEnabled(true); // local-only so far
            mockSavePreference.mockClear();

            await loadAutoMateFromServer();

            expect(mockSavePreference).toHaveBeenCalledWith(
                'AutoMate',
                JSON.stringify({aiEnabled: true, aiAutoOpen: false}),
            );
        });

        it('logs and keeps local values when the server payload is malformed', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGetPreference.mockResolvedValue('not-json');
            setAiEnabled(true);
            mockSavePreference.mockClear();

            await loadAutoMateFromServer();

            expect(isAiEnabled()).toBe(true);
            expect(errorSpy).toHaveBeenCalled();
            expect(mockSavePreference).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
