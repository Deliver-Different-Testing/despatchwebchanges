export interface Session {
    contactId: number;
    firstName: string;
    fullName: string;
    dispatcher: string;
    timeZone: string;
    isNetworkPartner: boolean;
    clientInternal: boolean;
    /** Granted dashboard keys, or null when the session is ungated. */
    visibleFeatures: string[] | null;
    /** undefined when the server did not say; callers pick their own fallback. */
    isUsCustomer: boolean | undefined;
    currencyCode: string;
    npMapCenter: {lat: number; lng: number} | null;
}

/**
 * The single reader of Razor-injected session globals. Reads at call time (never
 * cached) so tests and a future /api/context bootstrap can set values after import.
 */
export function getSession(): Session {
    // Theme modules are also imported by node-environment tests with no window.
    const w: Window | undefined = typeof window === 'undefined' ? undefined : window;
    const granted = w?.VisibleFeatures;
    return {
        contactId: w?.ContactID || 0,
        firstName: w?.FirstName || '',
        fullName: w?.FullName || '',
        dispatcher: w?.Dispatcher || '',
        timeZone: w?.TimeZone || '',
        isNetworkPartner: w?.IsNetworkPartner === true,
        clientInternal: w?.ClientInternal ?? false,
        // A non-array value can only mean the global was mis-emitted; failing open
        // keeps a serialization bug from taking the nav away from everyone.
        visibleFeatures: Array.isArray(granted) ? granted : null,
        isUsCustomer: w?.serverConfig?.isUSCustomer,
        currencyCode: w?.CurrencyCode || '',
        npMapCenter: w?.serverConfig?.npMapCenter ?? null,
    };
}

export const getContactId = (): number => getSession().contactId;
export const getTimeZone = (): string => getSession().timeZone;
