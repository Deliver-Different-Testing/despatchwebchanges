import React from 'react';
import {waitFor} from '@testing-library/react';
import {clearSessionContext, setSessionContext, type SessionContextDto} from '../../api/session';
import {NZ_MAP_CENTER} from '../../components/common/here-map/HereMap.types';
import {createTestQueryClient, renderWithMantine} from '../../test/utils';
import {CourierMapScreen} from './CourierMapScreen';

const courierMapPageProps = vi.fn();

vi.mock('./CourierMapPage', () => ({
    CourierMapPage: (props: unknown) => {
        courierMapPageProps(props);
        return null;
    },
}));

vi.mock('../../components/layout/PageFrame', () => ({
    PageFrame: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

vi.mock('../../api/configApi', () => ({
    getHereMapsKey: vi.fn().mockResolvedValue('here-key'),
}));

const AUCKLAND = {lat: -36.8485, lng: 174.7633};

const nzSession: SessionContextDto = {
    contactId: 5, staffId: 7, firstName: 'Jane', fullName: 'Jane Doe', email: 'j@t.com',
    dispatcher: null, timeZone: 'Pacific/Auckland', countryCode: 'NZ', isUsTenant: false,
    currencyCode: 'NZD', clientInternal: false, isNetworkPartner: false,
    visibleFeatures: null, npMapCenter: null, hubUrl: null, tenantMapCenter: null,
};

async function openedCentre(context: SessionContextDto) {
    setSessionContext(context);
    renderWithMantine(<CourierMapScreen />, {queryClient: createTestQueryClient()});
    await waitFor(() => expect(courierMapPageProps).toHaveBeenCalled());
    return courierMapPageProps.mock.lastCall![0].mapCenter;
}

describe('CourierMapScreen opening centre', () => {
    afterEach(() => {
        clearSessionContext();
        courierMapPageProps.mockClear();
    });

    it('opens an NZ tenant on Auckland, not the shared Wellington default', async () => {
        const centre = await openedCentre(nzSession);
        expect(centre).toEqual(AUCKLAND);
        expect(centre).not.toEqual(NZ_MAP_CENTER);
    });

    it('opens an AU tenant on its own centre, else Sydney', async () => {
        expect(await openedCentre({...nzSession, countryCode: 'AU', tenantMapCenter: {lat: -37.81, lng: 144.96}}))
            .toEqual({lat: -37.81, lng: 144.96});
        courierMapPageProps.mockClear();
        expect(await openedCentre({...nzSession, countryCode: 'AU'})).toEqual({lat: -33.8688, lng: 151.2093});
    });

    it('opens a US tenant on the US centre', async () => {
        expect(await openedCentre({...nzSession, countryCode: 'US', isUsTenant: true}))
            .toEqual({lat: 39.8097343, lng: -98.5556199});
    });

    it('opens a network partner on their own address', async () => {
        expect(await openedCentre({...nzSession, isNetworkPartner: true, npMapCenter: {lat: -43.53, lng: 172.63}}))
            .toEqual({lat: -43.53, lng: 172.63});
    });
});
