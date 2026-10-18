import {useEffect} from 'react';
import {useRegisterSW} from 'virtual:pwa-register/react';
import {toastService} from '../services/toastService';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Registers the service worker and offers a reload once a new build has been downloaded. */
export function PwaUpdatePrompt() {
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
        },
    });

    useEffect(() => {
        if (!needRefresh) return;
        return toastService.showPersistentToast(
            'Update available: a new version of DespatchWeb is ready.',
            {label: 'Reload', onClick: () => void updateServiceWorker(true)},
        );
    }, [needRefresh, updateServiceWorker]);

    return null;
}
