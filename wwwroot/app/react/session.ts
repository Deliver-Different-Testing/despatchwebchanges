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

/** Shape returned by GET /api/context. */
export interface SessionContextDto {
    contactId: number;
    staffId: number | null;
    firstName: string | null;
    fullName: string | null;
    email: string | null;
    dispatcher: string | null;
    timeZone: string | null;
    countryCode: string | null;
    isUsTenant: boolean;
    currencyCode: string;
    clientInternal: boolean;
    isNetworkPartner: boolean;
    visibleFeatures: string[] | null;
    npMapCenter: {lat: number; lng: number} | null;
    hubUrl: string | null;
}

let fetchedContext: SessionContextDto | null = null;

export const setSessionContext = (context: SessionContextDto): void => {
    fetchedContext = context;
};

export const clearSessionContext = (): void => {
    fetchedContext = null;
};

const fromContext = (c: SessionContextDto): Session => ({
    contactId: c.contactId,
    firstName: c.firstName ?? '',
    fullName: c.fullName ?? '',
    dispatcher: c.dispatcher ?? '',
    timeZone: c.timeZone ?? '',
    isNetworkPartner: c.isNetworkPartner,
    clientInternal: c.clientInternal,
    visibleFeatures: c.visibleFeatures ?? null,
    isUsCustomer: c.isUsTenant,
    currencyCode: c.currencyCode,
    npMapCenter: c.npMapCenter ?? null,
});

/**
 * The single reader of session data: the fetched /api/context store first, then the Razor-injected
 * globals. Reads at call time (never cached) so values can be set after import.
 */
export function getSession(): Session {
    // Until the Angular shell is cut over, islands it hosts still rely on the Razor globals.
    if (fetchedContext) return fromContext(fetchedContext);
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
