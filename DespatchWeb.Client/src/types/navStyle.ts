/**
 * Navigation style: today's top bar plus right-hand drawer (`dispatch`), or the DFRNT left sidebar
 * (`dfrnt`). A tenant default (Configurator -> Dispatch settings, tblSetting.DespatchNavStyle) with a
 * per-user override (StaffPreference key `NavStyle`) - see `services/navStylePreference.ts`.
 */
export type NavStyle = 'dispatch' | 'dfrnt';

export const DEFAULT_NAV_STYLE: NavStyle = 'dispatch';

export function isNavStyle(value: unknown): value is NavStyle {
    return value === 'dispatch' || value === 'dfrnt';
}
