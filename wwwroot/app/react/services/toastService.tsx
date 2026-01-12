/**
 * React Toast Service
 *
 * A React-native toast notification service using MUI Snackbar.
 * Can be used independently of AngularJS toastr service.
 */

import React, {createContext, useContext, useState, useCallback, ReactNode} from 'react';
import {Snackbar, Alert, AlertColor} from '@mui/material';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type: ToastType) => void;
    showSuccessToast: (message: string) => void;
    showWarningToast: (message: string) => void;
    showErrorToast: (message: string) => void;
    showInfoToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

interface ToastProviderProps {
    children: ReactNode;
    autoHideDuration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    autoHideDuration = 5000,
}) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, {id, message, type}]);
    }, []);

    const showSuccessToast = useCallback((message: string) => {
        showToast(message, 'success');
    }, [showToast]);

    const showWarningToast = useCallback((message: string) => {
        showToast(message, 'warning');
    }, [showToast]);

    const showErrorToast = useCallback((message: string) => {
        showToast(message, 'error');
    }, [showToast]);

    const showInfoToast = useCallback((message: string) => {
        showToast(message, 'info');
    }, [showToast]);

    const handleClose = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

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
            {toasts.map((toast, index) => (
                <Snackbar
                    key={toast.id}
                    open={true}
                    autoHideDuration={autoHideDuration}
                    onClose={() => handleClose(toast.id)}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    sx={{
                        mt: index * 8, // Stack toasts vertically
                    }}
                >
                    <Alert
                        onClose={() => handleClose(toast.id)}
                        severity={mapTypeToSeverity(toast.type)}
                        variant="filled"
                        sx={{width: '100%'}}
                    >
                        {toast.message}
                    </Alert>
                </Snackbar>
            ))}
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
 * Standalone toast service for use outside React component tree
 * Provides a bridge to AngularJS toastr or falls back to console
 */
class StandaloneToastService {
    private angularToastr: any = null;

    /**
     * Set the AngularJS toastr service reference
     */
    setAngularToastr(toastr: any): void {
        this.angularToastr = toastr;
    }

    showToast(message: string, type: ToastType): void {
        if (this.angularToastr) {
            switch (type) {
                case 'success':
                    this.angularToastr.showSuccessToast(message);
                    break;
                case 'warning':
                    this.angularToastr.showWarningToast(message);
                    break;
                case 'error':
                    this.angularToastr.showErrorToast(message);
                    break;
                case 'info':
                default:
                    this.angularToastr.showInfoToast?.(message) ??
                        this.angularToastr.showSuccessToast(message);
                    break;
            }
        } else {
            // Fallback to console logging
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
    }

    showSuccessToast(message: string): void {
        this.showToast(message, 'success');
    }

    showWarningToast(message: string): void {
        this.showToast(message, 'warning');
    }

    showErrorToast(message: string): void {
        this.showToast(message, 'error');
    }

    showInfoToast(message: string): void {
        this.showToast(message, 'info');
    }
}

// Singleton instance for standalone use
export const toastService = new StandaloneToastService();

export default toastService;
