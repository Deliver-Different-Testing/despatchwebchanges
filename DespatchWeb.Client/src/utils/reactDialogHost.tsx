/**
 * React dialog host
 *
 * The AngularJS bridge opens React dialogs by hand: create a container, create a root,
 * render, and resolve a promise when the dialog closes. Every `*-react.module.tsx` used to
 * carry its own copy of that lifecycle. This owns it once; a bridge module supplies the
 * container id and the element to render, and gets an `open()` that returns the result.
 */

import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {ShowToastFn, ToastService} from '../services/toastTypes';

export interface DialogRenderContext<TPayload, TResult> {
    /** False while the dialog animates out — keep rendering so the exit transition runs. */
    open: boolean;
    payload: TPayload;
    /** Closes the dialog and resolves the pending `open()` with `result`. */
    close: (result: TResult) => void;
    /** Resolves the pending `open()` but leaves the dialog on screen to close itself. */
    settle: (result: TResult) => void;
    showToast: ShowToastFn;
}

export interface ReactDialogHost<TPayload, TResult> {
    open(payload: TPayload, toastService?: ToastService | null): Promise<TResult>;
    /** Toast service used when `open()` is not given one. */
    setToastService(service: ToastService | null): void;
    /** Re-renders the open dialog with a new payload — for content that loads after the dialog appears. */
    update(payload: TPayload | ((previous: TPayload) => TPayload)): void;
    close(result: TResult): void;
    /** Unmounts and removes the container — teardown for tests and hot reload. */
    destroy(): void;
}

export function createDialogHost<TPayload, TResult>({containerId, render}: {
    containerId: string;
    render: (context: DialogRenderContext<TPayload, TResult>) => React.ReactNode;
}): ReactDialogHost<TPayload, TResult> {
    let root: Root | null = null;
    let container: HTMLDivElement | null = null;
    let defaultToastService: ToastService | null = null;

    let open = false;
    let payload: TPayload | undefined;
    let hasPayload = false;
    let toastService: ToastService | null = null;
    let resolve: ((result: TResult) => void) | undefined;

    const showToast: ShowToastFn = (message, type, action) => {
        const service = toastService ?? defaultToastService;
        if (!service) {
            console.log(`[Toast ${type}]: ${message}`);
            return;
        }
        service.showToast(message, type, action);
    };

    function settle(result: TResult): void {
        resolve?.(result);
        resolve = undefined;
    }

    function close(result: TResult): void {
        if (!open) return;
        open = false;
        settle(result);
        renderDialog();
    }

    function renderDialog(): void {
        if (!root || !hasPayload) return;
        root.render(render({open, payload: payload as TPayload, close, settle, showToast}));
    }

    function initialize(): void {
        if (root) return;
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
        root = createRoot(container);
    }

    return {
        open(nextPayload, nextToastService) {
            initialize();

            return new Promise<TResult>(nextResolve => {
                open = true;
                payload = nextPayload;
                hasPayload = true;
                toastService = nextToastService ?? null;
                resolve = nextResolve;
                renderDialog();
            });
        },
        setToastService(service) {
            defaultToastService = service;
        },
        update(nextPayload) {
            payload = typeof nextPayload === 'function'
                ? (nextPayload as (previous: TPayload) => TPayload)(payload as TPayload)
                : nextPayload;
            renderDialog();
        },
        close,
        destroy() {
            root?.unmount();
            container?.remove();
            root = null;
            container = null;
            payload = undefined;
            hasPayload = false;
            resolve = undefined;
            open = false;
        },
    };
}
