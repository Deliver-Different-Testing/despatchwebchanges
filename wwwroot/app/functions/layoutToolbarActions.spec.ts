import {createLayoutToolbarActions, LayoutToolbarHost} from './layoutToolbarActions';
import type {ImportLayoutsResult, LayoutStorageKeys} from '../react/components/common/box-shell/layoutPersistence';
import type {ILayout} from '../interfaces/layout.interfaces';

const storageKeys: LayoutStorageKeys = {
    layoutsKey: 'layoutsTest-1',
    lastActiveLayoutKey: 'lastActiveLayoutTest-1',
    boxVisibilityKeyBase: 'boxVisibilityTest-1',
};

const defaultLayout: ILayout = {
    name: 'Default',
    layout: {columns: [{id: 'col-1', width: '100', boxes: [{name: 'jobList', height: '100'}]}]},
};

function makeBridge() {
    return {
        setCurrentLayoutName: jest.fn(),
        reloadLayoutsFromStorage: jest.fn(),
        promptSaveLayout: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
        promptDeleteLayout: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(false),
        promptRenameLayout: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
        importLegacyLayouts: jest.fn<ImportLayoutsResult, []>().mockReturnValue({imported: [], skipped: []}),
    };
}

function makeToastr() {
    return {
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
    };
}

function setup(bridge: ReturnType<typeof makeBridge> | undefined = makeBridge()) {
    const host: LayoutToolbarHost = {layouts: [], currentLayoutName: undefined};
    const toastr = makeToastr();
    const actions = createLayoutToolbarActions({
        getBridge: () => bridge,
        host,
        storageKeys,
        defaultLayout,
        toastr,
    });
    return {actions, host, toastr, bridge};
}

const readPersisted = (): ILayout[] => JSON.parse(localStorage.getItem(storageKeys.layoutsKey) ?? '[]');

beforeEach(() => localStorage.clear());

describe('createLayoutToolbarActions', () => {
    describe('initialize', () => {
        it('seeds the host with Default at index 0 when storage is empty', () => {
            const {actions, host} = setup();

            actions.initialize();

            expect(host.layouts.map(l => l.name)).toEqual(['Default']);
            expect(host.currentLayoutName).toBe('Default');
        });

        it('restores the last active layout name from storage', () => {
            localStorage.setItem(storageKeys.lastActiveLayoutKey, 'Morning');
            const {actions, host} = setup();

            actions.initialize();

            expect(host.currentLayoutName).toBe('Morning');
        });
    });

    describe('saveLayout', () => {
        it('does nothing when the prompt is cancelled', async () => {
            const {actions, host, bridge, toastr} = setup();

            await actions.saveLayout();

            expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
            expect(host.layouts).toEqual([]);
            expect(bridge!.setCurrentLayoutName).not.toHaveBeenCalled();
            expect(toastr.showSuccessToast).not.toHaveBeenCalled();
        });

        it('appends the new layout after Default, selects it and notifies the bridge', async () => {
            const {actions, host, bridge, toastr} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');

            await actions.saveLayout();

            expect(readPersisted().map(l => l.name)).toEqual(['Default', 'Morning']);
            expect(host.layouts.map(l => l.name)).toEqual(['Default', 'Morning']);
            expect(host.currentLayoutName).toBe('Morning');
            expect(localStorage.getItem(storageKeys.lastActiveLayoutKey)).toBe('Morning');
            expect(bridge!.setCurrentLayoutName).toHaveBeenCalledWith('Morning');
            expect(bridge!.reloadLayoutsFromStorage).toHaveBeenCalled();
            expect(toastr.showSuccessToast).toHaveBeenCalledWith('Layout saved successfully');
        });

        it('deep-copies the current layout so later edits do not leak into the saved copy', async () => {
            const {actions, host, bridge} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            actions.initialize();

            await actions.saveLayout();

            const saved = readPersisted()[1];
            expect(saved.layout).toEqual(defaultLayout.layout);
            expect(saved.layout).not.toBe(defaultLayout.layout);
            expect(host.layouts[1].layout.columns[0].boxes[0].name).toBe('jobList');
        });
    });

    describe('loadLayout', () => {
        it('selects the layout at the given index and persists it as last active', async () => {
            const {actions, host, bridge} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();
            bridge!.setCurrentLayoutName.mockClear();

            actions.loadLayout(0);

            expect(host.currentLayoutName).toBe('Default');
            expect(localStorage.getItem(storageKeys.lastActiveLayoutKey)).toBe('Default');
            expect(bridge!.setCurrentLayoutName).toHaveBeenCalledWith('Default');
        });

        it('ignores an out-of-range index', () => {
            const {actions, host, bridge} = setup();

            actions.loadLayout(7);

            expect(host.currentLayoutName).toBeUndefined();
            expect(bridge!.setCurrentLayoutName).not.toHaveBeenCalled();
        });
    });

    describe('deleteLayout', () => {
        it('never deletes Default and never prompts for it', async () => {
            const {actions, bridge} = setup();

            await actions.deleteLayout(0);

            expect(bridge!.promptDeleteLayout).not.toHaveBeenCalled();
            expect(bridge!.reloadLayoutsFromStorage).not.toHaveBeenCalled();
        });

        it('keeps the layout when the confirmation is declined', async () => {
            const {actions, bridge} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();

            await actions.deleteLayout(1);

            expect(bridge!.promptDeleteLayout).toHaveBeenCalledWith('Morning');
            expect(readPersisted().map(l => l.name)).toEqual(['Default', 'Morning']);
        });

        it('removes the confirmed layout and falls back to Default', async () => {
            const {actions, host, bridge, toastr} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();
            bridge!.promptDeleteLayout.mockResolvedValue(true);

            await actions.deleteLayout(1);

            expect(readPersisted().map(l => l.name)).toEqual(['Default']);
            expect(host.layouts.map(l => l.name)).toEqual(['Default']);
            expect(host.currentLayoutName).toBe('Default');
            expect(localStorage.getItem(storageKeys.lastActiveLayoutKey)).toBe('Default');
            expect(bridge!.setCurrentLayoutName).toHaveBeenCalledWith('Default');
            expect(toastr.showSuccessToast).toHaveBeenCalledWith('Layout deleted successfully');
        });
    });

    describe('importLayouts', () => {
        it('reports the imported count, pluralised, and refreshes the host list', () => {
            const {actions, host, bridge, toastr} = setup();
            bridge!.importLegacyLayouts.mockReturnValue({imported: ['Morning', 'Night'], skipped: []});

            actions.importLayouts();

            expect(toastr.showSuccessToast).toHaveBeenCalledWith('Imported 2 V1 layouts');
            expect(host.layouts.map(l => l.name)).toEqual(['Default']);
        });

        it('uses the singular form for a single imported layout', () => {
            const {actions, bridge, toastr} = setup();
            bridge!.importLegacyLayouts.mockReturnValue({imported: ['Morning'], skipped: []});

            actions.importLayouts();

            expect(toastr.showSuccessToast).toHaveBeenCalledWith('Imported 1 V1 layout');
        });

        it('reports nothing to import as info, not success', () => {
            const {actions, toastr} = setup();

            actions.importLayouts();

            expect(toastr.showInfoToast).toHaveBeenCalledWith('No V1 layouts to import');
            expect(toastr.showSuccessToast).not.toHaveBeenCalled();
        });
    });

    describe('renameLayout', () => {
        it('never renames Default and never prompts for it', async () => {
            const {actions, bridge} = setup();

            await actions.renameLayout(0);

            expect(bridge!.promptRenameLayout).not.toHaveBeenCalled();
        });

        it('does nothing when the prompt is cancelled or the name is unchanged', async () => {
            const {actions, bridge} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();
            bridge!.reloadLayoutsFromStorage.mockClear();

            bridge!.promptRenameLayout.mockResolvedValue(null);
            await actions.renameLayout(1);
            bridge!.promptRenameLayout.mockResolvedValue('Morning');
            await actions.renameLayout(1);

            expect(readPersisted().map(l => l.name)).toEqual(['Default', 'Morning']);
            expect(bridge!.reloadLayoutsFromStorage).not.toHaveBeenCalled();
        });

        it('renames the layout, re-reads the selection and notifies the bridge', async () => {
            const {actions, host, bridge, toastr} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();
            bridge!.promptRenameLayout.mockResolvedValue('Evening');

            await actions.renameLayout(1);

            expect(readPersisted().map(l => l.name)).toEqual(['Default', 'Evening']);
            expect(host.layouts.map(l => l.name)).toEqual(['Default', 'Evening']);
            expect(host.currentLayoutName).toBe('Evening');
            expect(bridge!.setCurrentLayoutName).toHaveBeenCalledWith('Evening');
            expect(bridge!.reloadLayoutsFromStorage).toHaveBeenCalled();
            expect(toastr.showSuccessToast).toHaveBeenCalledWith('Layout renamed successfully');
        });

        it('surfaces a rejected rename (name collision) as an error and leaves storage alone', async () => {
            const {actions, bridge, toastr} = setup();
            bridge!.promptSaveLayout.mockResolvedValue('Morning');
            await actions.saveLayout();
            bridge!.promptSaveLayout.mockResolvedValue('Evening');
            await actions.saveLayout();
            bridge!.reloadLayoutsFromStorage.mockClear();
            bridge!.promptRenameLayout.mockResolvedValue('Evening');

            await actions.renameLayout(1);

            expect(toastr.showErrorToast).toHaveBeenCalledWith('Could not rename layout');
            expect(readPersisted().map(l => l.name)).toEqual(['Default', 'Morning', 'Evening']);
            expect(bridge!.reloadLayoutsFromStorage).not.toHaveBeenCalled();
        });
    });

    it('stays inert when the React bridge has not mounted yet', async () => {
        const {actions, host, toastr} = setup(undefined);

        await actions.saveLayout();
        await actions.deleteLayout(1);
        await actions.renameLayout(1);
        actions.importLayouts();

        expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
        expect(host.currentLayoutName).toBeUndefined();
        expect(toastr.showErrorToast).not.toHaveBeenCalled();
    });
});
