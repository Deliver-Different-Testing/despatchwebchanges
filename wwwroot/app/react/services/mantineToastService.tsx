/**
 * Mantine toast service — the @mantine/notifications-backed replacement for the
 * MUI `toastService`. Keeps the same public surface ({@link ToastService},
 * {@link ToastType}, {@link ToastHandle}) so call sites migrate with only an
 * import swap.
 *
 * Standalone-capable: the first call lazily mounts a single `<Notifications/>`
 * (inside its own MantineProvider) so toasts fired from outside any React tree
 * (the AngularJS bridge, imperative dialog services) still render.
 */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Button, MantineProvider} from '@mantine/core';
import {Notifications, notifications} from '@mantine/notifications';
import {dfrntTheme} from '../theme/dfrntMantineTheme';
import type {ToastAction, ToastHandle, ToastService, ToastType} from './toastService';

/** Maps a toast type onto its Mantine theme colour (the DFRNT semantic ramp). */
export function toastColor(type: ToastType): string {
    switch (type) {
        case 'success': return 'green';
        case 'warning': return 'orange';
        case 'error': return 'red';
        case 'info':
        default: return 'cyan';
    }
}

const AUTO_CLOSE_MS = 5000;
const NOTIFICATIONS_ROOT_ID = 'mantine-notifications-root';

class MantineToastService implements ToastService {
    private mounted = false;
    private idCounter = 0;

    private ensureMounted(): void {
        if (this.mounted || typeof document === 'undefined') return;
        const el = document.createElement('div');
        el.id = NOTIFICATIONS_ROOT_ID;
        document.body.appendChild(el);
        createRoot(el).render(
            <MantineProvider theme={dfrntTheme} forceColorScheme="light">
                <Notifications position="top-right"/>
            </MantineProvider>,
        );
        this.mounted = true;
    }

    /** Wraps the message with an inline action button when one is supplied. */
    private renderMessage(id: string, message: string, action?: ToastAction): React.ReactNode {
        if (!action) return message;
        return (
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
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
            </span>
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
        });
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
        return {
            update: (nextMessage, nextType, action) => {
                notifications.update({
                    id,
                    message: this.renderMessage(id, nextMessage, action),
                    color: toastColor(nextType),
                    loading: false,
                    autoClose: AUTO_CLOSE_MS,
                });
            },
            dismiss: () => notifications.hide(id),
        };
    }
}

/** Singleton, mirroring the MUI `toastService` export. */
export const mantineToastService = new MantineToastService();

export default mantineToastService;
