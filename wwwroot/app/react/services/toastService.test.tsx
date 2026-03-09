/**
 * Toast Service Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material';
import {ToastProvider, toastService, useToast} from './toastService';

const theme = createTheme();

// Test component that uses the toast hook
const TestComponent: React.FC<{action: 'success' | 'warning' | 'error' | 'info' | 'custom'}> = ({action}) => {
    const toast = useToast();

    const handleClick = () => {
        switch (action) {
            case 'success':
                toast.showSuccessToast('Success message');
                break;
            case 'warning':
                toast.showWarningToast('Warning message');
                break;
            case 'error':
                toast.showErrorToast('Error message');
                break;
            case 'info':
                toast.showInfoToast('Info message');
                break;
            case 'custom':
                toast.showToast('Custom message', 'success');
                break;
        }
    };

    return <button onClick={handleClick}>Show Toast</button>;
};

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <ToastProvider>
                {ui}
            </ToastProvider>
        </ThemeProvider>
    );
};

describe('ToastProvider', () => {
    describe('useToast hook', () => {
        it('should throw error when used outside ToastProvider', () => {
            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                render(
                    <ThemeProvider theme={theme}>
                        <TestComponent action="success" />
                    </ThemeProvider>
                );
            }).toThrow('useToast must be used within a ToastProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('showSuccessToast', () => {
        it('should display success toast message', async () => {
            renderWithProviders(<TestComponent action="success" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Success message')).toBeInTheDocument();
        });

        it('should display success alert with correct severity', async () => {
            renderWithProviders(<TestComponent action="success" />);

            fireEvent.click(screen.getByText('Show Toast'));

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toHaveClass('MuiAlert-filledSuccess');
            });
        });
    });

    describe('showWarningToast', () => {
        it('should display warning toast message', async () => {
            renderWithProviders(<TestComponent action="warning" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Warning message')).toBeInTheDocument();
        });

        it('should display warning alert with correct severity', async () => {
            renderWithProviders(<TestComponent action="warning" />);

            fireEvent.click(screen.getByText('Show Toast'));

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toHaveClass('MuiAlert-filledWarning');
            });
        });
    });

    describe('showErrorToast', () => {
        it('should display error toast message', async () => {
            renderWithProviders(<TestComponent action="error" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Error message')).toBeInTheDocument();
        });

        it('should display error alert with correct severity', async () => {
            renderWithProviders(<TestComponent action="error" />);

            fireEvent.click(screen.getByText('Show Toast'));

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toHaveClass('MuiAlert-filledError');
            });
        });
    });

    describe('showInfoToast', () => {
        it('should display info toast message', async () => {
            renderWithProviders(<TestComponent action="info" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Info message')).toBeInTheDocument();
        });

        it('should display info alert with correct severity', async () => {
            renderWithProviders(<TestComponent action="info" />);

            fireEvent.click(screen.getByText('Show Toast'));

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toHaveClass('MuiAlert-filledInfo');
            });
        });
    });

    describe('showToast', () => {
        it('should display toast with custom type', async () => {
            renderWithProviders(<TestComponent action="custom" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Custom message')).toBeInTheDocument();
        });
    });

    describe('toast dismissal', () => {
        it('should close toast when close button is clicked', async () => {
            renderWithProviders(<TestComponent action="success" />);

            fireEvent.click(screen.getByText('Show Toast'));

            expect(await screen.findByText('Success message')).toBeInTheDocument();

            // Find and click the close button
            const closeButton = screen.getByRole('button', {name: /close/i});
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByText('Success message')).not.toBeInTheDocument();
            });
        });
    });
});

describe('StandaloneToastService', () => {
    describe('console logging', () => {
        it('should log success message to console', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            toastService.showSuccessToast('Test success');

            expect(consoleSpy).toHaveBeenCalledWith('[Toast SUCCESS]', 'Test success');
            consoleSpy.mockRestore();
        });

        it('should log warning message to console', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            toastService.showWarningToast('Test warning');

            expect(consoleSpy).toHaveBeenCalledWith('[Toast WARNING]', 'Test warning');
            consoleSpy.mockRestore();
        });

        it('should log error message to console', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            toastService.showErrorToast('Test error');

            expect(consoleSpy).toHaveBeenCalledWith('[Toast ERROR]', 'Test error');
            consoleSpy.mockRestore();
        });

        it('should log info message to console', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            toastService.showInfoToast('Test info');

            expect(consoleSpy).toHaveBeenCalledWith('[Toast INFO]', 'Test info');
            consoleSpy.mockRestore();
        });
    });

    describe('showToast with type parameter', () => {
        it('should route to correct method based on type', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            toastService.showToast('Success', 'success');
            expect(consoleSpy).toHaveBeenCalledWith('[Toast SUCCESS]', 'Success');

            toastService.showToast('Warning', 'warning');
            expect(consoleWarnSpy).toHaveBeenCalledWith('[Toast WARNING]', 'Warning');

            toastService.showToast('Error', 'error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Toast ERROR]', 'Error');

            toastService.showToast('Info', 'info');
            expect(consoleSpy).toHaveBeenCalledWith('[Toast INFO]', 'Info');

            consoleSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });
});
