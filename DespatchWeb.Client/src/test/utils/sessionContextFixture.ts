import type {SessionContextDto} from '../../api/session';

export function sessionContextFixture(overrides: Partial<SessionContextDto> = {}): SessionContextDto {
    return {
        contactId: 1, staffId: 1, firstName: 'A', fullName: 'A B', email: null, dispatcher: null,
        timeZone: 'Pacific/Auckland', countryCode: 'NZ', isUsTenant: false, currencyCode: 'NZD',
        clientInternal: true, isNetworkPartner: false, visibleFeatures: null, npMapCenter: null, hubUrl: null,
        ...overrides,
    };
}
