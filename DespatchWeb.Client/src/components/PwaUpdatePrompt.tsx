import {useEffect} from 'react';
import {CircleFadingArrowUp} from 'lucide-react';
import {useRegisterSW} from 'virtual:pwa-register/react';
import {toastService} from '../services/toastService';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Registers the service worker and offers an update once a new build has been downloaded. */
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
            'A new version of DespatchWeb is ready. Updating reloads the page, so save any changes first.',
            {label: 'Update now', busyLabel: 'Updating…', onClick: () => void updateServiceWorker(true)},
            {title: 'Update available', icon: <CircleFadingArrowUp size={18} strokeWidth={2} aria-hidden/>},
        );
    }, [needRefresh, updateServiceWorker]);

    return null;
}
