import React, {useMemo} from 'react';
import dayjs from 'dayjs';
import {getSession} from '../api/session';

const BRAND_PRIMARY = {
    us: {hex: '#3bc7f4', rgb: '59, 199, 244'},
    nz: {hex: '#f4c430', rgb: '244, 196, 48'},
};

/** Publishes the tenant brand as CSS variables, the body theme class and the dayjs locale. Idempotent. */
export function applyTenantTheme(isUs: boolean): void {
    const root = document.documentElement;
    const primary = isUs ? BRAND_PRIMARY.us : BRAND_PRIMARY.nz;
    root.style.setProperty('--theme-primary', primary.hex);
    root.style.setProperty('--theme-primary-light', `rgba(${primary.rgb}, 0.15)`);
    root.style.setProperty('--theme-primary-medium', `rgba(${primary.rgb}, 0.3)`);
    root.style.setProperty('--theme-primary-strong', `rgba(${primary.rgb}, 0.5)`);
    document.body.classList.remove(isUs ? 'theme-nz' : 'theme-us');
    document.body.classList.add(isUs ? 'theme-us' : 'theme-nz');
    // The en-nz locale is registered by dayjsSetup.ts.
    dayjs.locale(isUs ? 'en' : 'en-nz');
}

/** Applies the tenant theme during the first render so children never format dates in the wrong locale. */
export const ThemeBootstrap: React.FC<{children: React.ReactNode}> = ({children}) => {
    const isUs = getSession().isUsCustomer ?? true;
    useMemo(() => applyTenantTheme(isUs), [isUs]);
    return <>{children}</>;
};
