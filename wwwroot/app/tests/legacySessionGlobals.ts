/**
 * Test-only bridge: lets specs keep seeding the session with `window.ContactID = 7`-style
 * assignments (the pre-SPA Razor globals) while production code reads only getSession().
 * resets everything to the defaults and runs before every test.
 */
import type {SessionContextDto} from '../react/session';

const DEFAULTS: SessionContextDto = {
    contactId: 0, staffId: null, firstName: 'Test', fullName: null, email: null, dispatcher: null,
    timeZone: 'Europe/London', countryCode: null,
    // The server's answer is unknown by default, matching a missing serverConfig global.
    isUsTenant: undefined as unknown as boolean,
    currencyCode: '', clientInternal: false, isNetworkPartner: false, visibleFeatures: null,
    npMapCenter: null, hubUrl: null,
};

type Field = {
    get: (c: SessionContextDto) => unknown;
    set: (c: SessionContextDto, v: any) => SessionContextDto;
};

const field = <K extends keyof SessionContextDto>(key: K, normalise: (v: any) => SessionContextDto[K] = v => v): Field => ({
    get: c => c[key],
    set: (c, v) => ({...c, [key]: normalise(v)}),
});

const FIELDS: Record<string, Field> = {
    ContactID: field('contactId', v => Number(v) || 0),
    FirstName: field('firstName', v => v ?? null),
    FullName: field('fullName', v => v ?? null),
    Dispatcher: field('dispatcher', v => v ?? null),
    TimeZone: field('timeZone', v => v ?? null),
    IsNetworkPartner: field('isNetworkPartner', v => v === true),
    ClientInternal: field('clientInternal', v => v ?? false),
    VisibleFeatures: field('visibleFeatures', v => (Array.isArray(v) ? v : null)),
    CurrencyCode: field('currencyCode', v => v || ''),
    serverConfig: {
        get: c => ({isUSCustomer: c.isUsTenant, npMapCenter: c.npMapCenter}),
        set: (c, v) => ({...c, isUsTenant: v?.isUSCustomer, npMapCenter: v?.npMapCenter ?? null}),
    },
};

export function installLegacySessionGlobals(): void {
    if (typeof window === 'undefined') return;
    let context = {...DEFAULTS};
    const publish = () => require('../react/session').setSessionContext?.(context);
    publish();
    for (const [name, f] of Object.entries(FIELDS)) {
        Object.defineProperty(window, name, {
            configurable: true,
            get: () => f.get(context),
            set: value => {
                context = f.set(context, value);
                publish();
            },
        });
    }
}
