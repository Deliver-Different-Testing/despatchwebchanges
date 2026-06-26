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
