import {getSession} from './session';

const GLOBALS = [
    'ContactID', 'FirstName', 'FullName', 'Dispatcher', 'TimeZone', 'IsNetworkPartner',
    'ClientInternal', 'VisibleFeatures', 'CurrencyCode', 'serverConfig',
] as const;

const win = window as unknown as Record<string, unknown>;

describe('getSession', () => {
    beforeEach(() => GLOBALS.forEach(g => delete win[g]));
    afterAll(() => GLOBALS.forEach(g => delete win[g]));

    it('returns safe defaults when no globals are injected', () => {
        expect(getSession()).toEqual({
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
        });
    });

    it('reads injected values', () => {
        Object.assign(win, {
            ContactID: '42', FirstName: 'Ann', FullName: 'Ann Lee', Dispatcher: 'Bob',
            TimeZone: 'UTC', IsNetworkPartner: true, ClientInternal: true, CurrencyCode: 'USD',
            serverConfig: {isProduction: false, isUSCustomer: true, npMapCenter: {lat: 1, lng: 2}},
        });
        expect(getSession()).toMatchObject({
            contactId: '42', firstName: 'Ann', fullName: 'Ann Lee', dispatcher: 'Bob',
            timeZone: 'UTC', isNetworkPartner: true, clientInternal: true, currencyCode: 'USD',
            isUsCustomer: true, npMapCenter: {lat: 1, lng: 2},
        });
    });

    it.each([
        [null, null],
        [undefined, null],
        [['dw-dispatch'], ['dw-dispatch']],
        [[], []],
        ['dw-dispatch', null],
        [{a: 1}, null],
    ])('normalises VisibleFeatures %j to %j', (raw, expected) => {
        win.VisibleFeatures = raw;
        expect(getSession().visibleFeatures).toEqual(expected);
    });

    it('does not treat non-boolean IsNetworkPartner as true', () => {
        win.IsNetworkPartner = 'False';
        expect(getSession().isNetworkPartner).toBe(false);
    });

    it('reads at call time and does not cache', () => {
        win.TimeZone = 'A';
        expect(getSession().timeZone).toBe('A');
        win.TimeZone = 'B';
        expect(getSession().timeZone).toBe('B');
    });
});
