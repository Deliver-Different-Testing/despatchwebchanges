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

const UNSET: Session = {
    contactId: 0,
    firstName: '',
    fullName: '',
    dispatcher: '',
    timeZone: '',
    isNetworkPartner: false,
    clientInternal: false,
    visibleFeatures: null,
    isUsCustomer: undefined,
    currencyCode: '',
    npMapCenter: null,
};

/**
 * The single reader of session data: the fetched /api/context store. Reads at call time (never
 * cached) so values can be set after import; before it is set, returns inert defaults.
 */
export function getSession(): Session {
    return fetchedContext ? fromContext(fetchedContext) : UNSET;
}

export const getContactId = (): number => getSession().contactId;
export const getTimeZone = (): string => getSession().timeZone;
