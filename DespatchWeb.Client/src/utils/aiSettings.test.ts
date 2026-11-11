import type {MockedFunction} from 'vitest';
import {
    isAiEnabled,
    setAiEnabled,
    isAiAutoOpenEnabled,
    isAiChatEnabled,
    setAiChatEnabled,
    AI_CHAT_CHANGED_EVENT,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from './aiSettings';
import {getPreference, savePreference} from '../api/preferencesApi';

vi.mock('../api/preferencesApi', () => ({
    getPreference: vi.fn(),
    savePreference: vi.fn(),
}));

const mockGetPreference = getPreference as MockedFunction<typeof getPreference>;
const mockSavePreference = savePreference as MockedFunction<typeof savePreference>;

describe('aiSettings', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mockSavePreference.mockResolvedValue(undefined);
    });

    describe('setAiEnabled', () => {
        it('persists locally and syncs the combined payload to the server', () => {
            setAiEnabled(true);

            expect(isAiEnabled()).toBe(true);
            expect(mockSavePreference).toHaveBeenCalledWith(
                'AutoMate',
                JSON.stringify({aiEnabled: true, aiAutoOpen: false, chatEnabled: true}),
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
                JSON.stringify({aiEnabled: true, aiAutoOpen: true, chatEnabled: true}),
            );
        });
    });

    describe('setAiChatEnabled', () => {
        it('defaults to true, persists locally, notifies listeners and syncs chatEnabled to the server', () => {
            const listener = vi.fn();
            window.addEventListener(AI_CHAT_CHANGED_EVENT, listener);
            expect(isAiChatEnabled()).toBe(true);

            setAiChatEnabled(false);

            window.removeEventListener(AI_CHAT_CHANGED_EVENT, listener);
            expect(isAiChatEnabled()).toBe(false);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(mockSavePreference).toHaveBeenCalledWith(
                'AutoMate',
                JSON.stringify({aiEnabled: false, aiAutoOpen: false, chatEnabled: false}),
            );
        });

        it('is read back from the server payload, and absent means on', async () => {
            mockGetPreference.mockResolvedValue(JSON.stringify({aiEnabled: false, aiAutoOpen: false, chatEnabled: false}));
            await loadAutoMateFromServer();
            expect(isAiChatEnabled()).toBe(false);

            mockGetPreference.mockResolvedValue(JSON.stringify({aiEnabled: false, aiAutoOpen: false}));
            await loadAutoMateFromServer();
            expect(isAiChatEnabled()).toBe(true);
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
                JSON.stringify({aiEnabled: true, aiAutoOpen: false, chatEnabled: true}),
            );
        });

        it('logs and keeps local values when the server payload is malformed', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
