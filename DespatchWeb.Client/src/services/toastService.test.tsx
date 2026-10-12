/**
 * Toast Service Tests
 *
 * The service is standalone — it mounts its own React root and Mantine provider
 * into `document.body` on first use — so these tests drive the singleton
 * directly rather than rendering a component tree.
 */

import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {notifications} from '@mantine/notifications';
import {toastService, toastColor} from './toastService';
import {dfrntTheme} from '../theme/dfrntMantineTheme';

/** The service renders into its own root, so every call needs a flush. */
const show = async (fn: () => void) => {
    await act(async () => {
        fn();
    });
};

describe('toastColor', () => {
    it('maps each toast type onto its DFRNT semantic ramp', () => {
        expect(toastColor('success')).toBe('green');
        expect(toastColor('warning')).toBe('orange');
        expect(toastColor('error')).toBe('red');
        expect(toastColor('info')).toBe('brand');
    });

    it('only returns colours the theme actually defines', () => {
        const themeColors = Object.keys(dfrntTheme.colors ?? {});
        for (const type of ['success', 'warning', 'error', 'info'] as const) {
            expect(themeColors).toContain(toastColor(type));
        }
    });
});

describe('toastService', () => {
    afterEach(async () => {
        await act(async () => {
            notifications.clean();
        });
    });

    describe('mounting', () => {
        it('lazily mounts a single notifications root and reuses it', async () => {
            await show(() => toastService.showToast('First', 'info'));
            await show(() => toastService.showErrorToast('Second'));

            expect(document.querySelectorAll('#mantine-notifications-root')).toHaveLength(1);
        });
    });

    describe('showToast', () => {
        it('displays the message for each type', async () => {
            await show(() => toastService.showSuccessToast('Success message'));
            expect(await screen.findByText('Success message')).toBeInTheDocument();

            await show(() => toastService.showWarningToast('Warning message'));
            expect(await screen.findByText('Warning message')).toBeInTheDocument();

            await show(() => toastService.showErrorToast('Error message'));
            expect(await screen.findByText('Error message')).toBeInTheDocument();

            await show(() => toastService.showInfoToast('Info message'));
            expect(await screen.findByText('Info message')).toBeInTheDocument();
        });

        it('displays a toast shown through the generic type parameter', async () => {
            await show(() => toastService.showToast('Custom message', 'warning'));
            expect(await screen.findByText('Custom message')).toBeInTheDocument();
        });
    });

    describe('action button', () => {
        it('renders the action button, invokes onClick, and dismisses the toast', async () => {
            const onClick = jest.fn();
            await show(() => toastService.showToast('Job sent', 'success', {label: 'Open', onClick}));

            const actionButton = await screen.findByRole('button', {name: 'Open'});

            await act(async () => {
                fireEvent.click(actionButton);
            });

            expect(onClick).toHaveBeenCalledTimes(1);
            await waitFor(() => {
                expect(screen.queryByText('Job sent')).not.toBeInTheDocument();
            });
        });
    });

    describe('toast dismissal', () => {
        it('closes the toast when the close button is clicked', async () => {
            await show(() => toastService.showSuccessToast('Success message'));
            expect(await screen.findByText('Success message')).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /close/i}));
            });

            await waitFor(() => {
                expect(screen.queryByText('Success message')).not.toBeInTheDocument();
            });
        });
    });

    describe('showLoadingToast', () => {
        it('shows a sticky loading toast that morphs into a closable success toast', async () => {
            let handle!: ReturnType<typeof toastService.showLoadingToast>;
            await show(() => {
                handle = toastService.showLoadingToast('Sending…');
            });

            expect(await screen.findByText('Sending…')).toBeInTheDocument();
            // No close button while loading — the user shouldn't be able to
            // dismiss feedback for an in-flight operation.
            expect(screen.queryByRole('button', {name: /close/i})).not.toBeInTheDocument();

            await act(async () => {
                handle.update('All done', 'success');
            });

            expect(await screen.findByText('All done')).toBeInTheDocument();
            expect(screen.queryByText('Sending…')).not.toBeInTheDocument();
            // ...and the close button comes back once the work has resolved.
            expect(screen.getByRole('button', {name: /close/i})).toBeInTheDocument();
        });

        it('morphs into an error toast', async () => {
            let handle!: ReturnType<typeof toastService.showLoadingToast>;
            await show(() => {
                handle = toastService.showLoadingToast('Sending…');
            });

            await act(async () => {
                handle.update('Boom', 'error');
            });

            expect(await screen.findByText('Boom')).toBeInTheDocument();
        });

        it('dismiss() removes the loading toast without showing a result', async () => {
            let handle!: ReturnType<typeof toastService.showLoadingToast>;
            await show(() => {
                handle = toastService.showLoadingToast('Sending…');
            });

            expect(await screen.findByText('Sending…')).toBeInTheDocument();

            await act(async () => {
                handle.dismiss();
            });

            await waitFor(() => {
                expect(screen.queryByText('Sending…')).not.toBeInTheDocument();
            });
        });
    });

    describe('console logging', () => {
        // Toasts are transient, so the console is the only trail of what was shown.
        it('logs each toast type at the matching console level', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await show(() => toastService.showSuccessToast('Test success'));
            expect(logSpy).toHaveBeenCalledWith('[Toast SUCCESS]', 'Test success');

            await show(() => toastService.showWarningToast('Test warning'));
            expect(warnSpy).toHaveBeenCalledWith('[Toast WARNING]', 'Test warning');

            await show(() => toastService.showErrorToast('Test error'));
            expect(errorSpy).toHaveBeenCalledWith('[Toast ERROR]', 'Test error');

            await show(() => toastService.showInfoToast('Test info'));
            expect(logSpy).toHaveBeenCalledWith('[Toast INFO]', 'Test info');

            logSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('routes showToast to the right console level for each type', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await show(() => toastService.showToast('Success', 'success'));
            expect(logSpy).toHaveBeenCalledWith('[Toast SUCCESS]', 'Success');

            await show(() => toastService.showToast('Warning', 'warning'));
            expect(warnSpy).toHaveBeenCalledWith('[Toast WARNING]', 'Warning');

            await show(() => toastService.showToast('Error', 'error'));
            expect(errorSpy).toHaveBeenCalledWith('[Toast ERROR]', 'Error');

            await show(() => toastService.showToast('Info', 'info'));
            expect(logSpy).toHaveBeenCalledWith('[Toast INFO]', 'Info');

            logSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });
});
