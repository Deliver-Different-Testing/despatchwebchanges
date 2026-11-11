const STORAGE_KEY = 'cardCollapseStates';

export function loadCollapseState(cardName: string): boolean {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const states = JSON.parse(saved);
            return states[cardName] || false;
        }
    } catch { /* localStorage may be unavailable */ }
    return false;
}

export function saveCollapseState(cardName: string, isCollapsed: boolean): void {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const states = saved ? JSON.parse(saved) : {};
        states[cardName] = isCollapsed;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch { /* localStorage may be unavailable */ }
}
