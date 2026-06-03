/**
 * React Toast Service
 *
 * A fully independent React toast notification service using MUI Snackbar.
 * Works both within React component trees (via ToastProvider/useToast) and
 * standalone (via toastService singleton for use outside React).
 */

import React, {createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import type {AlertColor} from '@mui/material/Alert';
import {getTheme} from '../theme/muiTheme';

/**
 * Types that {@link ShowToastFn} accepts. This is the narrow set the AngularJS
 * bridge and every external caller pass through. 'loading' is intentionally
 * NOT a member here — sticky-progress toasts are only reachable via
 * {@link ToastContextValue.showLoadingToast}, which returns an explicit handle
 * so the caller is forced to resolve/cancel the in-flight indicator.
 */
export type ToastType = 'success' | 'warning' | 'error' | 'info';

/**
 * Full toast type union including the internal 'loading' variant. Used only
 * inside the toast renderer itself, not on public callback signatures.
 */
type InternalToastType = ToastType | 'loading';

/** Optional action button rendered on the right side of a toast. */
export interface ToastAction {
    label: string;
    onClick: () => void;
}

/** Shared callback type for showing a toast notification */
export type ShowToastFn = (message: string, type: ToastType, action?: ToastAction) => void;

/**
 * Handle returned by {@link ToastContextValue.showLoadingToast} (and the
 * standalone equivalent). Lets the caller turn the in-flight toast into a
 * final status toast — typically `success` or `error` — once the underlying
 * async work resolves, or dismiss it outright on cancellation.
 */
export interface ToastHandle {
    /** Replace the loading toast in-place with a new message/type. */
    update: (message: string, type: ToastType, action?: ToastAction) => void;
    /** Remove the toast immediately. */
    dismiss: () => void;
}

/** Minimal toast service interface used by dialog modules */
export interface ToastService {
    showToast: ShowToastFn;
}

interface Toast {
    id: number;
    message: string;
    type: InternalToastType;
    action?: ToastAction;
}

interface ToastContextValue {
    showToast: (message: string, type: ToastType, action?: ToastAction) => void;
    showSuccessToast: (message: string, action?: ToastAction) => void;
    showWarningToast: (message: string, action?: ToastAction) => void;
    showErrorToast: (message: string, action?: ToastAction) => void;
    showInfoToast: (message: string, action?: ToastAction) => void;
    showLoadingToast: (message: string) => ToastHandle;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

interface ToastProviderProps {
    children: ReactNode;
    autoHideDuration?: number;
}

const mapTypeToSeverity = (type: InternalToastType): AlertColor => {
    switch (type) {
        case 'success':
            return 'success';
        case 'warning':
            return 'warning';
        case 'error':
            return 'error';
        case 'loading':
        case 'info':
        default:
            return 'info';
    }
};

/**
 * Toast container component that renders the actual snackbars
 */
const ToastContainer: React.FC<{
    toasts: Toast[];
    autoHideDuration: number;
    onClose: (id: number) => void;
}> = ({toasts, autoHideDuration, onClose}) => {
    return (
        <>
            {toasts.map((toast, index) => (
                <Snackbar
                    key={toast.id}
                    open={true}
                    // 'loading' toasts are sticky — they must persist until the
                    // caller dismisses or updates them via the returned handle.
                    autoHideDuration={toast.type === 'loading' ? null : autoHideDuration}
                    onClose={(_, reason) => {
                        // Ignore clickaway for loading toasts (and any toast) —
                        // the user shouldn't be able to dismiss feedback by
                        // clicking elsewhere on the page.
                        if (reason === 'clickaway') return;
                        onClose(toast.id);
                    }}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    sx={{
                        mt: index * 8, // Stack toasts vertically
                    }}
                >
                    <Alert
                        onClose={toast.type === 'loading' ? undefined : () => onClose(toast.id)}
                        severity={mapTypeToSeverity(toast.type)}
                        variant="filled"
                        icon={toast.type === 'loading'
                            ? <CircularProgress size={18} color="inherit"/>
                            : undefined}
                        sx={{width: '100%'}}
                        action={toast.action ? (
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    toast.action!.onClick();
                                    onClose(toast.id);
                                }}
                                sx={{fontWeight: 600}}
                            >
                                {toast.action.label}
                            </Button>
                        ) : undefined}
                    >
                        {toast.message}
                    </Alert>
                </Snackbar>
            ))}
        </>
    );
};

export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    autoHideDuration = 5000,
}) => {
    // Hold the toast list in a ref alongside state so the handle returned by
    // showLoadingToast can call update/dismiss synchronously without closing
    // over a stale snapshot of the list.
    const toastsRef = useRef<Toast[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const commit = useCallback((next: Toast[]) => {
        toastsRef.current = next;
        setToasts(next);
    }, []);

    const showToast = useCallback((message: string, type: ToastType, action?: ToastAction) => {
        const id = ++toastIdCounter;
        commit([...toastsRef.current, {id, message, type, action}]);
    }, [commit]);

    const showSuccessToast = useCallback((message: string, action?: ToastAction) => {
        showToast(message, 'success', action);
    }, [showToast]);

    const showWarningToast = useCallback((message: string, action?: ToastAction) => {
        showToast(message, 'warning', action);
    }, [showToast]);

    const showErrorToast = useCallback((message: string, action?: ToastAction) => {
        showToast(message, 'error', action);
    }, [showToast]);

    const showInfoToast = useCallback((message: string, action?: ToastAction) => {
        showToast(message, 'info', action);
    }, [showToast]);

    const handleClose = useCallback((id: number) => {
        commit(toastsRef.current.filter(t => t.id !== id));
    }, [commit]);

    const showLoadingToast = useCallback((message: string): ToastHandle => {
        const id = ++toastIdCounter;
        commit([...toastsRef.current, {id, message, type: 'loading'}]);
        return {
            update: (nextMessage, nextType, action) => {
                commit(toastsRef.current.map(t =>
                    t.id === id ? {...t, message: nextMessage, type: nextType, action} : t
                ));
            },
            dismiss: () => {
                commit(toastsRef.current.filter(t => t.id !== id));
            },
        };
    }, [commit]);

    const value = useMemo<ToastContextValue>(() => ({
        showToast,
        showSuccessToast,
        showWarningToast,
        showErrorToast,
        showInfoToast,
        showLoadingToast,
    }), [showToast, showSuccessToast, showWarningToast, showErrorToast, showInfoToast, showLoadingToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer
                toasts={toasts}
                autoHideDuration={autoHideDuration}
                onClose={handleClose}
            />
        </ToastContext.Provider>
    );
};

/**
 * Hook to access toast functions within the ToastProvider
 */
export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

/**
 * Standalone Toast Container Component
 * Used by the standalone toast service to render toasts outside React tree
 */
const StandaloneToastContainer: React.FC<{
    toasts: Toast[];
    onClose: (id: number) => void;
}> = ({toasts, onClose}) => {
    const theme = getTheme();

    return (
        <ThemeProvider theme={theme}>
            <ToastContainer
                toasts={toasts}
                autoHideDuration={5000}
                onClose={onClose}
            />
        </ThemeProvider>
    );
};

/**
 * Standalone toast service for use outside React component tree
 * Renders its own toast container using a portal to document.body
 */
class StandaloneToastService {
    private root: Root | null = null;
    private container: HTMLDivElement | null = null;
    private toasts: Toast[] = [];
    private initialized = false;
    private autoHideTimers = new Map<number, ReturnType<typeof setTimeout>>();

    private initialize(): void {
        if (this.initialized) return;

        // Create container element
        this.container = document.createElement('div');
        this.container.id = 'react-toast-container';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.right = '0';
        this.container.style.zIndex = '9999';
        this.container.style.pointerEvents = 'none';
        document.body.appendChild(this.container);

        // Create React root
        this.root = createRoot(this.container);
        this.initialized = true;

        // Initial render
        this.render();
    }

    private render(): void {
        if (!this.root) return;

        this.root.render(
            <StandaloneToastContainer
                toasts={this.toasts}
                onClose={(id) => this.handleClose(id)}
            />
        );
    }

    private handleClose(id: number): void {
        const timer = this.autoHideTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.autoHideTimers.delete(id);
        }
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.render();
    }

    private scheduleAutoHide(id: number): void {
        const timer = setTimeout(() => this.handleClose(id), 5000);
        this.autoHideTimers.set(id, timer);
    }

    private logToConsole(type: InternalToastType, message: string): void {
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

    showToast(message: string, type: ToastType, action?: ToastAction): void {
        this.initialize();

        const id = ++toastIdCounter;
        this.toasts = [...this.toasts, {id, message, type, action}];
        this.render();
        this.scheduleAutoHide(id);
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
        this.initialize();

        const id = ++toastIdCounter;
        this.toasts = [...this.toasts, {id, message, type: 'loading'}];
        this.render();
        this.logToConsole('loading', message);

        return {
            update: (nextMessage, nextType, action) => {
                this.toasts = this.toasts.map(t =>
                    t.id === id ? {...t, message: nextMessage, type: nextType, action} : t
                );
                this.render();
                this.logToConsole(nextType, nextMessage);
                this.scheduleAutoHide(id);
            },
            dismiss: () => this.handleClose(id),
        };
    }
}

// Singleton instance for standalone use
export const toastService = new StandaloneToastService();

export default toastService;
