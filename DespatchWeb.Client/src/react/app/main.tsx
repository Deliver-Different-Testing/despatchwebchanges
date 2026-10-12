// Mantine global stylesheets. The `.layer.css` variants scope Mantine's rules to
// `@layer mantine`, so unlayered app CSS always outranks them. There is no companion reset:
// nothing else in the document sets element-level p/button styles. Re-check that before adding
// any unlayered stylesheet.
import '@mantine/core/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
// Shared Liquid Glass classes (.dfrnt-glass*): global, unlayered, used by the dropdown/map/dialog glass.
import '@deliver-different/glass/glass.css';
import '../../dayjsSetup';
import {applyLegacyHashRedirect} from '../utils/legacyHash';
import {fetchSessionContext} from '../hooks/useSessionContext';
import type {SessionContextDto} from '../session';
import {hideAppLoader} from './appLoader';

applyLegacyHashRedirect();

/**
 * The session is fetched before spaRoot is imported: the theme and a number of storage keys are
 * built at module-evaluation time from the tenant, and a dynamic import() only evaluates its
 * module once it runs. Keep spaRoot out of this file's static imports.
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
