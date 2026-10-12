import {useEffect, useState} from 'react';
import {
    isPanelHideButtonEnabled,
    loadPanelHideButtonSettingFromServer,
} from '../../../../functions/panelHideButtonSettings';

/**
 * Whether the per-panel hide button should show on a custom layout. Paints
 * instantly from localStorage (the current device's last-known value), then
 * reconciles once the server round-trip resolves — same read-through-cache
 * pattern as Auto-mate's Settings toggle.
 */
export function usePanelHideButtonSetting(): boolean {
    const [enabled, setEnabled] = useState<boolean>(isPanelHideButtonEnabled);

    useEffect(() => {
        let cancelled = false;
        void loadPanelHideButtonSettingFromServer().then(() => {
            if (!cancelled) {
                setEnabled(isPanelHideButtonEnabled());
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return enabled;
}
