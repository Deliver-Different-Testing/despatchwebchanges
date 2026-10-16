export function normalizeLegacyHash(hash: string): string | null {
    if (!hash.startsWith('#!')) return null;
    const rest = hash.slice(2);
    return `#${rest.startsWith('/') ? rest : `/${rest}`}`;
}

export function applyLegacyHashRedirect(): void {
    const normalized = normalizeLegacyHash(window.location.hash);
    if (normalized === null) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${normalized}`);
}
