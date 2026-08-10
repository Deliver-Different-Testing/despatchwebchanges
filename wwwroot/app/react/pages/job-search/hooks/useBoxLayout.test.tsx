import {act, renderHook, waitFor} from '@testing-library/react';

// Control the remote sync so the mount effect's promise can settle on demand.
jest.mock('../lib/layoutSync', () => ({
    loadRemoteIntoLocal: jest.fn(),
    queueRemotePush: jest.fn(),
    readLocalRows: jest.fn(() => []),
}));

import * as layoutSync from '../lib/layoutSync';
import {useBoxLayout} from './useBoxLayout';
import {ILayout} from '../../../../interfaces/layout.interfaces';
import {IBox} from '../../../../interfaces/layout.interfaces';
import {
    loadBoxVisibility,
    loadLayouts,
    saveBoxVisibility,
} from '../lib/layoutPersistence';

const mockLoadRemoteIntoLocal = layoutSync.loadRemoteIntoLocal as jest.Mock;
const mockReadLocalRows = layoutSync.readLocalRows as jest.Mock;

const storageKeys = {
    layoutsKey: 'testLayouts',
    lastActiveLayoutKey: 'testLastActive',
    boxVisibilityKeyBase: 'testBoxVisibility',
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

describe('useBoxLayout remote sync', () => {
    beforeEach(() => {
        localStorage.clear();
        mockLoadRemoteIntoLocal.mockReset();
        mockReadLocalRows.mockReset().mockReturnValue([]);
    });

    it('does not log after the component unmounts before the remote load settles', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const remote = deferred<boolean>();
        mockLoadRemoteIntoLocal.mockReturnValue(remote.promise);

        const {unmount} = renderHook(() => useBoxLayout({storageKeys, page: 'JobSearch'}));

        unmount();

        await act(async () => {
            remote.reject(new Error('Network Error'));
            await Promise.resolve();
        });

        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('does not bump layoutVersion when the remote sync brings no local changes', async () => {
        // readLocalRows reports the same rows before and after the remote pull, so
        // the sync is a no-op and must not force a remount (a layoutVersion bump
        // changes the PanelGroup key and re-initialises the HERE map).
        mockReadLocalRows.mockReturnValue([]);
        mockLoadRemoteIntoLocal.mockResolvedValue(true);

        const {result} = renderHook(() => useBoxLayout({storageKeys, page: 'JobSearch'}));
        const initialVersion = result.current.layoutVersion;

        await waitFor(() => expect(mockLoadRemoteIntoLocal).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.layoutVersion).toBe(initialVersion);
    });

    it('bumps layoutVersion when the remote sync changes the local layouts', async () => {
        // The pre-pull snapshot is empty; after the remote pull readLocalRows reports
        // a layout, so the local store genuinely changed and a remount is warranted.
        mockReadLocalRows.mockReturnValueOnce([]);
        mockReadLocalRows.mockReturnValue([
            {name: 'Remote', layoutJson: '{"layout":{"columns":[]},"boxVisibility":{}}', isActive: true},
        ]);
        mockLoadRemoteIntoLocal.mockResolvedValue(true);

        const {result} = renderHook(() => useBoxLayout({storageKeys, page: 'JobSearch'}));
        const initialVersion = result.current.layoutVersion;

        await waitFor(() => expect(result.current.layoutVersion).toBe(initialVersion + 1));
    });

    it('logs the failure while the component is still mounted', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const remote = deferred<boolean>();
        mockLoadRemoteIntoLocal.mockReturnValue(remote.promise);

        renderHook(() => useBoxLayout({storageKeys, page: 'JobSearch'}));

        await act(async () => {
            remote.reject(new Error('Network Error'));
            await Promise.resolve();
        });

        await waitFor(() =>
            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to load dispatch layouts from server:',
                expect.any(Error),
            ),
        );
        errorSpy.mockRestore();
    });
});

describe('useBoxLayout layout editing', () => {
    const createDefaultLayout = (): ILayout => ({
        name: 'Default',
        layout: {
            columns: [
                {id: 'col1', width: '60%', boxes: [{name: 'a', height: '50%'}, {name: 'b', height: '50%'}]},
                {id: 'col2', width: '40%', boxes: [{name: 'c', height: '100%'}]},
            ],
        },
    });
    const createBoxes = (): Record<string, IBox> => ({
        a: {name: 'a', title: 'A', visible: true, collapsed: false},
        b: {name: 'b', title: 'B', visible: true, collapsed: false},
        c: {name: 'c', title: 'C', visible: true, collapsed: false},
    });

    const render = () => renderHook(() => useBoxLayout({storageKeys, createBoxes, createDefaultLayout}));
    const storedLayout = (name: string) =>
        loadLayouts(storageKeys, createDefaultLayout()).find(l => l.name === name)!;

    beforeEach(() => {
        localStorage.clear();
        mockLoadRemoteIntoLocal.mockReset();
        mockReadLocalRows.mockReset().mockReturnValue([]);
    });

    it('refuses to resize the read-only Default layout', () => {
        const {result} = render();
        expect(result.current.isDefaultLayout).toBe(true);

        act(() => result.current.setColumnSizes([70, 30]));

        // Nothing persisted, and the in-memory layout still matches the code default.
        expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
        expect(result.current.layout.layout).toEqual(createDefaultLayout().layout);
    });

    it('refuses to write box heights or panel visibility on the Default layout', () => {
        const {result} = render();

        act(() => result.current.setBoxHeights('col1', [30, 70], ['a', 'b']));
        act(() => result.current.setBoxVisibility('b', false));

        expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
        expect(loadBoxVisibility(storageKeys, 'Default')).toBeNull();
        expect(result.current.boxes.b.visible).not.toBe(false);
    });

    it('ignores a write that changes nothing, leaving the default untouched', () => {
        const {result} = render();

        act(() => result.current.setColumnSizes([60, 40]));

        expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
    });

    it('resizes and persists a layout of the user\'s own', () => {
        const {result} = render();
        act(() => result.current.addLayout('Wide'));

        act(() => result.current.setColumnSizes([70, 30]));

        expect(storedLayout('Wide').layout.columns.map(c => c.width)).toEqual(['70.00%', '30.00%']);
    });

    it('removeColumn keeps every box when merging columns on a user layout', () => {
        const {result} = render();
        act(() => result.current.addLayout('Wide'));

        act(() => result.current.removeColumn());

        const names = result.current.layout.layout.columns.flatMap(c => c.boxes.map(b => b.name));
        expect(names.sort()).toEqual(['a', 'b', 'c']);
    });

    it('resetCurrentLayout restores a user layout and clears its panel state', () => {
        const {result} = render();
        act(() => result.current.addLayout('Wide'));
        act(() => result.current.setColumnSizes([80, 20]));
        saveBoxVisibility(storageKeys, 'Wide', {a: {name: 'a', visible: false}});

        act(() => result.current.resetCurrentLayout());

        expect(result.current.currentLayoutName).toBe('Wide');
        expect(result.current.layout.layout).toEqual(createDefaultLayout().layout);
        expect(loadBoxVisibility(storageKeys, 'Wide')).toBeNull();
    });

    it('resetCurrentLayout is a no-op on the Default layout', () => {
        const {result} = render();

        act(() => result.current.resetCurrentLayout());

        expect(localStorage.getItem(storageKeys.layoutsKey)).toBeNull();
    });
});
