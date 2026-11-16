import {clearSessionContext, setSessionContext, SessionContextDto} from '../../api/session';
import {getCourierMapCenter} from './CourierMapScreen';

const base: SessionContextDto = {
    contactId: 5, staffId: 7, firstName: 'Jane', fullName: 'Jane Doe', email: 'j@t.com',
    dispatcher: null, timeZone: 'Australia/Sydney', countryCode: 'AU', isUsTenant: false,
    currencyCode: 'AUD', clientInternal: false, isNetworkPartner: false,
    visibleFeatures: null, npMapCenter: null, hubUrl: null, tenantMapCenter: null,
};

describe('getCourierMapCenter', () => {
    afterEach(() => clearSessionContext());

    it('uses the tenant centre when the tenant has one', () => {
        setSessionContext({...base, tenantMapCenter: {lat: -37.81, lng: 144.96}});
        expect(getCourierMapCenter()).toEqual({lat: -37.81, lng: 144.96});
    });

    it('opens an AU tenant with no centre on Sydney, not Auckland', () => {
        setSessionContext(base);
        expect(getCourierMapCenter()).toEqual({lat: -33.8688, lng: 151.2093});
    });

    it('keeps the US and NZ defaults', () => {
        setSessionContext({...base, countryCode: 'US', isUsTenant: true});
        expect(getCourierMapCenter()).toEqual({lat: 39.8283, lng: -98.5795});
        setSessionContext({...base, countryCode: 'NZ'});
        expect(getCourierMapCenter()).toEqual({lat: -36.8485, lng: 174.7633});
    });
});
