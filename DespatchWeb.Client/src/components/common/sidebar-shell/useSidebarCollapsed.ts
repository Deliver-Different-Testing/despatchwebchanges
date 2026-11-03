import {useCallback, useState} from 'react';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'dd-sidebar-collapsed';

function readStored(): boolean {
    try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function persist(collapsed: boolean): void {
    try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
        // localStorage unavailable: the choice just won't outlive the page.
    }
}

/** Full / rail state for the desktop sidebar, remembered per browser. */
export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState<boolean>(readStored);

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            persist(next);
            return next;
        });
    }, []);

    return {collapsed, toggle};
}
