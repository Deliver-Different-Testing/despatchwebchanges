import type {Mock} from 'vitest';
import {render} from '@testing-library/react';
import {PwaUpdatePrompt} from './PwaUpdatePrompt';
import {toastService} from '../services/toastService';

const sw = {needRefresh: false, update: vi.fn(), registration: undefined as unknown};

vi.mock('virtual:pwa-register/react', () => ({
    useRegisterSW: (options?: { onRegisteredSW?: (url: string, registration: unknown) => void }) => {
        options?.onRegisteredSW?.('/dist/sw.js', sw.registration);
        return {
            needRefresh: [sw.needRefresh, vi.fn()],
            offlineReady: [false, vi.fn()],
            updateServiceWorker: sw.update,
        };
    },
}));

vi.mock('../services/toastService', () => ({
    toastService: {showPersistentToast: vi.fn()},
}));

const showPersistentToast = toastService.showPersistentToast as Mock;

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
        const dismiss = vi.fn();
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
        vi.useFakeTimers();
        try {
            const update = vi.fn();
            sw.registration = {update};

            render(<PwaUpdatePrompt/>);
            expect(update).not.toHaveBeenCalled();

            vi.advanceTimersByTime(60 * 60 * 1000);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
