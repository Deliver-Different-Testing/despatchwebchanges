import {render} from '@testing-library/react';
import {PwaUpdatePrompt} from './PwaUpdatePrompt';
import {toastService} from '../services/toastService';

const sw = {needRefresh: false, update: jest.fn(), registration: undefined as unknown};

jest.mock('virtual:pwa-register/react', () => ({
    useRegisterSW: (options?: { onRegisteredSW?: (url: string, registration: unknown) => void }) => {
        options?.onRegisteredSW?.('/dist/sw.js', sw.registration);
        return {
            needRefresh: [sw.needRefresh, jest.fn()],
            offlineReady: [false, jest.fn()],
            updateServiceWorker: sw.update,
        };
    },
}));

jest.mock('../services/toastService', () => ({
    toastService: {showPersistentToast: jest.fn()},
}));

const showPersistentToast = toastService.showPersistentToast as jest.Mock;

describe('PwaUpdatePrompt', () => {
    beforeEach(() => {
        sw.needRefresh = false;
        sw.registration = undefined;
        showPersistentToast.mockReset();
    });

    it('shows nothing until a new version is waiting', () => {
        render(<PwaUpdatePrompt/>);
        expect(showPersistentToast).not.toHaveBeenCalled();
    });

    it('offers a reload that activates the waiting service worker, and withdraws the offer on unmount', () => {
        const dismiss = jest.fn();
        showPersistentToast.mockReturnValue(dismiss);
        sw.needRefresh = true;

        const {unmount} = render(<PwaUpdatePrompt/>);

        const [message, action] = showPersistentToast.mock.calls[0];
        expect(message).toContain('new version of DespatchWeb');
        expect(action.label).toBe('Reload');
        action.onClick();
        expect(sw.update).toHaveBeenCalledWith(true);

        unmount();
        expect(dismiss).toHaveBeenCalled();
    });

    it('re-checks for a new build hourly', () => {
        jest.useFakeTimers();
        try {
            const update = jest.fn();
            sw.registration = {update};

            render(<PwaUpdatePrompt/>);
            expect(update).not.toHaveBeenCalled();

            jest.advanceTimersByTime(60 * 60 * 1000);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
