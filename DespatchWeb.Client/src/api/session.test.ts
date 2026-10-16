import {clearSessionContext, getSession, setSessionContext, SessionContextDto} from './session';

const dto: SessionContextDto = {
    contactId: 5, staffId: 7, firstName: 'Jane', fullName: 'Jane Doe', email: 'j@t.com',
    dispatcher: null, timeZone: 'Pacific/Auckland', countryCode: 'US', isUsTenant: true,
    currencyCode: 'USD', clientInternal: true, isNetworkPartner: true,
    visibleFeatures: ['dw-dispatch'], npMapCenter: {lat: 1, lng: 2}, hubUrl: 'https://hub/',
};

describe('getSession', () => {
    beforeEach(() => clearSessionContext());

    it('returns safe defaults before the context is set, and again once cleared', () => {
        const defaults = {
            contactId: 0, firstName: '', fullName: '', dispatcher: '', timeZone: '',
            isNetworkPartner: false, clientInternal: false, visibleFeatures: null,
            isUsCustomer: undefined, currencyCode: '', npMapCenter: null,
        };
        expect(getSession()).toEqual(defaults);
        setSessionContext(dto);
        clearSessionContext();
        expect(getSession()).toEqual(defaults);
    });

    it('maps the DTO to a Session, normalising nulls', () => {
        setSessionContext(dto);
        expect(getSession()).toEqual({
            contactId: 5, firstName: 'Jane', fullName: 'Jane Doe', dispatcher: '',
            timeZone: 'Pacific/Auckland', isNetworkPartner: true, clientInternal: true,
            visibleFeatures: ['dw-dispatch'], isUsCustomer: true, currencyCode: 'USD',
            npMapCenter: {lat: 1, lng: 2},
        });
        setSessionContext({...dto, visibleFeatures: null, npMapCenter: null});
        expect(getSession()).toMatchObject({visibleFeatures: null, npMapCenter: null});
    });
});
