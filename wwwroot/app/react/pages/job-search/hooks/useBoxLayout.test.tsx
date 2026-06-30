import {act, renderHook, waitFor} from '@testing-library/react';

// Control the remote sync so the mount effect's promise can settle on demand.
jest.mock('../lib/layoutSync', () => ({
    loadRemoteIntoLocal: jest.fn(),
    queueRemotePush: jest.fn(),
    readLocalRows: jest.fn(() => []),
}));

import * as layoutSync from '../lib/layoutSync';
import {useBoxLayout} from './useBoxLayout';

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
