/**
 * React Toast Service
 *
 * A fully independent React toast notification service using MUI Snackbar.
 * Works both within React component trees (via ToastProvider/useToast) and
 * standalone (via toastService singleton for use outside React).
 */

import React, {createContext, useContext, useState, useCallback, ReactNode} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import type {AlertColor} from '@mui/material/Alert';
import {getTheme} from '../theme/muiTheme';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

/** Optional action button rendered on the right side of a toast. */
export interface ToastAction {
    label: string;
    onClick: () => void;
}

/** Shared callback type for showing a toast notification */
export type ShowToastFn = (message: string, type: ToastType, action?: ToastAction) => void;

/** Minimal toast service interface used by dialog modules */
export interface ToastService {
    showToast: ShowToastFn;
}

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    action?: ToastAction;
}

interface ToastContextValue {
    showToast: (message: string, type: ToastType, action?: ToastAction) => void;
    showSuccessToast: (message: string, action?: ToastAction) => void;
    showWarningToast: (message: string, action?: ToastAction) => void;
    showErrorToast: (message: string, action?: ToastAction) => void;
    showInfoToast: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

interface ToastProviderProps {
    children: ReactNode;
    autoHideDuration?: number;
}

/**
 * Toast container component that renders the actual snackbars
 */
const ToastContainer: React.FC<{
    toasts: Toast[];
    autoHideDuration: number;
    onClose: (id: number) => void;
}> = ({toasts, autoHideDuration, onClose}) => {
    const mapTypeToSeverity = (type: ToastType): AlertColor => {
        switch (type) {
            case 'success':
                return 'success';
            case 'warning':
                return 'warning';
            case 'error':
                return 'error';
            case 'info':
            default:
                return 'info';
        }
    };

    return (
        <>
            {toasts.map((toast, index) => (
                <Snackbar
                    key={toast.id}
                    open={true}
                    autoHideDuration={autoHideDuration}
                    onClose={() => onClose(toast.id)}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    sx={{
                        mt: index * 8, // Stack toasts vertically
                    }}
                >
                    <Alert
                        onClose={() => onClose(toast.id)}
                        severity={mapTypeToSeverity(toast.type)}
                        variant="filled"
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
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType, action?: ToastAction) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, {id, message, type, action}]);
    }, []);

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
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider
            value={{
                showToast,
                showSuccessToast,
                showWarningToast,
                showErrorToast,
                showInfoToast,
            }}
        >
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
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.render();
    }

    showToast(message: string, type: ToastType, action?: ToastAction): void {
        this.initialize();

        const id = ++toastIdCounter;
        this.toasts = [...this.toasts, {id, message, type, action}];
        this.render();

        // Auto-remove after duration
        setTimeout(() => {
            this.handleClose(id);
        }, 5000);

        // Also log to console for debugging
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
}

// Singleton instance for standalone use
export const toastService = new StandaloneToastService();

export default toastService;
