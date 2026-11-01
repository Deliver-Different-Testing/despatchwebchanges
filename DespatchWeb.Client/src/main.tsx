// Mantine global stylesheets. The `.layer.css` variants scope Mantine's rules to
// `@layer mantine`, so unlayered app CSS always outranks them. There is no companion reset:
// nothing else in the document sets element-level p/button styles. Re-check that before adding
// any unlayered stylesheet.
import '@mantine/core/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
// Shared Liquid Glass classes (.dfrnt-glass*): global, unlayered, used by the dropdown/map/dialog glass.
import '@deliver-different/glass/glass.css';
// High-contrast and forced-colours rules keyed on <html data-dd-contrast>; unlayered so they outrank Mantine.
import './theme/highContrast.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './utils/dayjsSetup';
import {applyLegacyHashRedirect} from './utils/legacyHash';
import {fetchSessionContext} from './hooks/useSessionContext';
import type {SessionContextDto} from './api/session';

applyLegacyHashRedirect();

/**
 * The session is fetched before App is imported: the theme and a number of storage keys are
 * built at module-evaluation time from the tenant, and a dynamic import() only evaluates its
 * module once it runs. Keep App out of this file's static imports.
 * On failure the SPA still mounts so SessionGate can redirect (401) or offer a retry.
 */
async function boot(): Promise<void> {
    let context: SessionContextDto | undefined;
    try {
        context = await fetchSessionContext();
    } catch {
        context = undefined;
    }
    const {mountSpa} = await import('./App');
    mountSpa(document.getElementById('root')!, context);
}

void boot();
