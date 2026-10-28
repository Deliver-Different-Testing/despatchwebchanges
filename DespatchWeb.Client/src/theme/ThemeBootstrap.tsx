import React, {useMemo} from 'react';
import dayjs from 'dayjs';
import {getSession} from '../api/session';

/** Sets the dayjs locale from the tenant country. Colours are never country-driven; see DfrntMantineProvider. */
export function applyTenantLocale(isUs: boolean): void {
    // The en-nz locale is registered by dayjsSetup.ts.
    dayjs.locale(isUs ? 'en' : 'en-nz');
}

/** Applies the tenant locale during the first render so children never format dates in the wrong locale. */
export const ThemeBootstrap: React.FC<{children: React.ReactNode}> = ({children}) => {
    const isUs = getSession().isUsCustomer ?? true;
    useMemo(() => applyTenantLocale(isUs), [isUs]);
    return <>{children}</>;
};
