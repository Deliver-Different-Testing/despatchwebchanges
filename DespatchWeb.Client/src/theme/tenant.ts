import {getSession} from '../api/session';
/**
 * Which tenant the theme layer is painting for.
 *
 * the session is fetched in `main.tsx` before the app module is imported
 * so this resolves at module-eval time — which the theme
 * consts need, since both `theme` (MUI) and `dfrntTheme` (Mantine) are built at
 * import time.
 *
 * Kept import-free for the same reason as `palettes.ts`: the date/locale accessor
 * in `utils/dateUtils.ts` reads the same flag, but importing it here would drag
 * dayjs and its plugins into every bundle that touches a colour.
 */
export function isUsTenant(): boolean {
    // The theme modules are also pulled into node-environment tests through the
    // shared test utils, where there is no window at all.
    if (typeof window === 'undefined') return true;
    return getSession().isUsCustomer ?? true;
}
