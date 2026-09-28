/**
 * React Toast Service
 *
 * A fully independent toast notification service built on Mantine notifications.
 * It is standalone by design: the first call lazily mounts a single
 * `<Notifications/>` inside its own React root and its own `MantineProvider`, so
 * it can be called from anywhere — including islands that are still MUI and have
 * no Mantine provider of their own.
 *
 * The public type surface lives in `./toastTypes` and is re-exported here, so the
 * ~64 type-only consumers keep importing from this module.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Group, MantineProvider} from '@mantine/core';
import {Notifications, notifications} from '@mantine/notifications';
import {dfrntTheme, dfrntCssVariablesResolver} from '../theme/dfrntMantineTheme';
import {DARK_MODE_ENABLED} from '../theme/DfrntMantineProvider';
import type {ToastAction, ToastHandle, ToastService, ToastType} from './toastTypes';

export type {ShowToastFn, ToastAction, ToastHandle, ToastService, ToastType} from './toastTypes';

/** Maps a toast type onto its Mantine theme colour (the DFRNT semantic ramp). */
export function toastColor(type: ToastType): string {
    switch (type) {
        case 'success': return 'green';
        case 'warning': return 'orange';
        case 'error': return 'red';
        case 'info':
        default: return 'brand';
    }
}

const AUTO_CLOSE_MS = 5000;
const NOTIFICATIONS_ROOT_ID = 'mantine-notifications-root';

/**
 * Toasts sit above everything, including MUI dialogs (1300), Bootstrap modals
 * (1050) and HERE map bubbles (~1001). Mantine's default overlay z-index of 400
 * would put them behind all three, and "save from a dialog → toast" is the
 * commonest path in the app.
 */
const TOAST_Z_INDEX = 9999;

/** Mantine's notification close button ships unlabelled, so name it for screen readers. */
const CLOSE_BUTTON_PROPS = {'aria-label': 'Close notification'};

class ToastServiceImpl implements ToastService {
    private mounted = false;
    private idCounter = 0;

    private ensureMounted(): void {
        if (this.mounted || typeof document === 'undefined') return;
        const el = document.createElement('div');
        el.id = NOTIFICATIONS_ROOT_ID;
        document.body.appendChild(el);
        createRoot(el).render(
            <MantineProvider
                theme={dfrntTheme}
                cssVariablesResolver={dfrntCssVariablesResolver}
                forceColorScheme={DARK_MODE_ENABLED ? undefined : 'light'}
            >
                <Notifications position="top-right" zIndex={TOAST_Z_INDEX}/>
            </MantineProvider>,
        );
        this.mounted = true;
    }

    /** Toasts are transient, so the console is the only trail of what was shown. */
    private logToConsole(type: ToastType | 'loading', message: string): void {
        const prefix = `[Toast ${type.toUpperCase()}]`;
        switch (type) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warning':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }

    /** Wraps the message with an inline action button when one is supplied. */
    private renderMessage(id: string, message: string, action?: ToastAction): React.ReactNode {
        if (!action) return message;
        return (
            <Group component="span" display="inline-flex" gap="xs" wrap="nowrap">
                {message}
                <Button
                    size="compact-xs"
                    variant="white"
                    onClick={() => {
                        action.onClick();
                        notifications.hide(id);
                    }}
                >
                    {action.label}
                </Button>
            </Group>
        );
    }

    showToast(message: string, type: ToastType, action?: ToastAction): void {
        this.ensureMounted();
        const id = `toast-${++this.idCounter}`;
        notifications.show({
            id,
            message: this.renderMessage(id, message, action),
            color: toastColor(type),
            autoClose: AUTO_CLOSE_MS,
            closeButtonProps: CLOSE_BUTTON_PROPS,
        });
        this.logToConsole(type, message);
    }

    showSuccessToast(message: string, action?: ToastAction): void {
        this.showToast(message, 'success', action);
    }

    showWarningToast(message: string, action?: ToastAction): void {
        this.showToast(message, 'warning', action);
    }

    showErrorToast(message: string, action?: ToastAction): void {
        this.showToast(message, 'error', action);
    }

    showInfoToast(message: string, action?: ToastAction): void {
        this.showToast(message, 'info', action);
    }

    showLoadingToast(message: string): ToastHandle {
        this.ensureMounted();
        const id = `toast-${++this.idCounter}`;
        notifications.show({
            id,
            message,
            loading: true,
            autoClose: false,
            withCloseButton: false,
        });
        this.logToConsole('loading', message);
        return {
            update: (nextMessage, nextType, action) => {
                notifications.update({
                    id,
                    message: this.renderMessage(id, nextMessage, action),
                    color: toastColor(nextType),
                    loading: false,
                    autoClose: AUTO_CLOSE_MS,
                    // `update` merges, so the close button suppressed for the
                    // loading state has to be turned back on explicitly.
                    withCloseButton: true,
                    closeButtonProps: CLOSE_BUTTON_PROPS,
                });
                this.logToConsole(nextType, nextMessage);
            },
            dismiss: () => notifications.hide(id),
        };
    }
}

export const toastService = new ToastServiceImpl();

export default toastService;
