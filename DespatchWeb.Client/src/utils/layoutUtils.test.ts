import {
    LayoutNameBridge,
    promptDeleteLayout,
    promptRenameLayout,
    promptSaveLayout,
    reloadLayoutsFromStorage,
    setCurrentLayoutName,
} from './layoutUtils';

const createBridge = (): LayoutNameBridge => ({
    setCurrentLayoutName: jest.fn(),
    reloadFromStorage: jest.fn(),
    promptSaveLayout: jest.fn().mockResolvedValue('Wide'),
    promptDeleteLayout: jest.fn().mockResolvedValue(true),
    promptRenameLayout: jest.fn().mockResolvedValue('Renamed'),
});

describe('layoutUtils', () => {
    describe('with a bridge', () => {
        it('setCurrentLayoutName forwards to the bridge', () => {
            const bridge = createBridge();
            setCurrentLayoutName(bridge, 'Wide');
            expect(bridge.setCurrentLayoutName).toHaveBeenCalledWith('Wide');
        });

        it('reloadLayoutsFromStorage forwards to the bridge', () => {
            const bridge = createBridge();
            reloadLayoutsFromStorage(bridge);
            expect(bridge.reloadFromStorage).toHaveBeenCalledTimes(1);
        });

        it('promptSaveLayout resolves with the bridge result', async () => {
            const bridge = createBridge();
            await expect(promptSaveLayout(bridge)).resolves.toBe('Wide');
        });

        it('promptDeleteLayout forwards the layout name and resolves with the bridge result', async () => {
            const bridge = createBridge();
            await expect(promptDeleteLayout(bridge, 'Wide')).resolves.toBe(true);
            expect(bridge.promptDeleteLayout).toHaveBeenCalledWith('Wide');
        });

        it('promptRenameLayout forwards the layout name and resolves with the bridge result', async () => {
            const bridge = createBridge();
            await expect(promptRenameLayout(bridge, 'Wide')).resolves.toBe('Renamed');
            expect(bridge.promptRenameLayout).toHaveBeenCalledWith('Wide');
        });
    });

    describe('with no bridge (page not mounted yet)', () => {
        it('setCurrentLayoutName and reloadLayoutsFromStorage no-op', () => {
            expect(() => setCurrentLayoutName(null, 'Wide')).not.toThrow();
            expect(() => reloadLayoutsFromStorage(null)).not.toThrow();
        });

        it('promptSaveLayout resolves null', async () => {
            await expect(promptSaveLayout(null)).resolves.toBeNull();
        });

        it('promptDeleteLayout resolves false', async () => {
            await expect(promptDeleteLayout(null, 'Wide')).resolves.toBe(false);
        });

        it('promptRenameLayout resolves null', async () => {
            await expect(promptRenameLayout(null, 'Wide')).resolves.toBeNull();
        });
    });
});
