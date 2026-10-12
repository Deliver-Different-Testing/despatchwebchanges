import {applyLegacyHashRedirect} from '../utils/legacyHash';
import {fetchSessionContext} from '../hooks/useSessionContext';
import type {SessionContextDto} from '../session';
import {hideAppLoader} from './appLoader';

applyLegacyHashRedirect();

/**
 * The session is fetched before spaRoot is imported: the theme and a number of storage keys are
 * built at module-evaluation time from the tenant, and esbuild only evaluates modules reachable
 * solely through import() when it runs. Keep spaRoot out of this file's static imports.
 * On failure the SPA still mounts so SessionGate can redirect (401) or offer a retry.
 */
async function boot(): Promise<void> {
    let context: SessionContextDto | undefined;
    try {
        context = await fetchSessionContext();
    } catch {
        context = undefined;
    }
    const {mountSpa} = await import('./spaRoot');
    mountSpa(document.getElementById('root')!, context);
    hideAppLoader();
}

void boot();
