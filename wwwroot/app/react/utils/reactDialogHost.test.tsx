/**
 * reactDialogHost tests
 *
 * Every AngularJS-facing dialog bridge used to carry its own copy of this lifecycle:
 * make a container, create a root, render, resolve a promise on close. The copies had
 * already drifted (different toast fallbacks, different dismissal values), so the
 * lifecycle lives here and is proved here.
 */

import React from 'react';
import {act} from '@testing-library/react';
import type {ShowToastFn} from '../services/toastTypes';
import {createDialogHost} from './reactDialogHost';

interface Payload {
    label: string;
}

function renderProbe(spy: jest.Mock) {
    return (ctx: {open: boolean; payload: Payload; close: (result: string) => void; showToast: ShowToastFn}) => {
        spy(ctx);
        return <div data-testid="probe">{ctx.open ? ctx.payload.label : 'closed'}</div>;
    };
}

describe('createDialogHost', () => {
    let host: ReturnType<typeof createDialogHost<Payload, string>>;
    let renderSpy: jest.Mock;

    beforeEach(() => {
        renderSpy = jest.fn();
        host = createDialogHost<Payload, string>({
            containerId: 'react-probe-dialog-root',
            render: renderProbe(renderSpy),
        });
    });

    afterEach(() => {
        act(() => host.destroy());
    });

    it('mounts a single container under the body and renders the payload', async () => {
        await act(async () => {
            void host.open({label: 'Hello'});
        });

        const container = document.getElementById('react-probe-dialog-root');
        expect(container).toBeInTheDocument();
        expect(container).toHaveTextContent('Hello');
        expect(document.querySelectorAll('#react-probe-dialog-root')).toHaveLength(1);
    });

    it('resolves the open promise with the value the dialog closes on, and re-renders shut', async () => {
        let result: string | undefined;
        await act(async () => {
            host.open({label: 'Hello'}).then(value => {
                result = value;
            });
        });

        await act(async () => {
            renderSpy.mock.calls.at(-1)[0].close('saved');
        });

        expect(result).toBe('saved');
        expect(document.getElementById('react-probe-dialog-root')).toHaveTextContent('closed');
    });

    it('settles the open promise without closing the dialog', async () => {
        let result: string | undefined;
        await act(async () => {
            host.open({label: 'Hello'}).then(value => {
                result = value;
            });
        });

        await act(async () => {
            renderSpy.mock.calls.at(-1)[0].settle('saved');
        });

        expect(result).toBe('saved');
        expect(document.getElementById('react-probe-dialog-root')).toHaveTextContent('Hello');
    });

    it('reuses the container across opens and does not resolve a closed dialog twice', async () => {
        const resolved: string[] = [];
        await act(async () => {
            host.open({label: 'First'}).then(v => resolved.push(v));
        });
        await act(async () => {
            renderSpy.mock.calls.at(-1)[0].close('one');
            renderSpy.mock.calls.at(-1)[0].close('again');
        });
        await act(async () => {
            host.open({label: 'Second'}).then(v => resolved.push(v));
        });

        expect(document.querySelectorAll('#react-probe-dialog-root')).toHaveLength(1);
        expect(document.getElementById('react-probe-dialog-root')).toHaveTextContent('Second');
        expect(resolved).toEqual(['one']);
    });

    it('sends toasts to the service supplied at open time', async () => {
        const showToast = jest.fn();
        await act(async () => {
            void host.open({label: 'Hello'}, {showToast});
        });

        renderSpy.mock.calls.at(-1)[0].showToast('Saved', 'success');
        expect(showToast).toHaveBeenCalledWith('Saved', 'success', undefined);
    });

    it('falls back to the console when no toast service was supplied', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        await act(async () => {
            void host.open({label: 'Hello'});
        });

        renderSpy.mock.calls.at(-1)[0].showToast('Saved', 'success');
        expect(log).toHaveBeenCalledWith('[Toast success]: Saved');
        log.mockRestore();
    });

    it('re-renders the open dialog with a new payload', async () => {
        await act(async () => {
            void host.open({label: 'Loading'});
        });

        await act(async () => {
            host.update({label: 'Loaded'});
        });

        expect(document.getElementById('react-probe-dialog-root')).toHaveTextContent('Loaded');
    });

    it('removes the container on destroy', async () => {
        await act(async () => {
            void host.open({label: 'Hello'});
        });

        act(() => host.destroy());

        expect(document.getElementById('react-probe-dialog-root')).not.toBeInTheDocument();
    });
});
