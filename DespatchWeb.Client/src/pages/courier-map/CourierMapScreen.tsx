import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {CourierMapPage} from './CourierMapPage';
import {queryKeys} from '../../api';
import {getHereMapsKey} from '../../api/configApi';
import {getSession} from '../../api/session';

// Same fallbacks the AngularJS APP_CONFIG supplied.
const US_MAP_CENTER = {lat: 39.8283, lng: -98.5795};
const NZ_MAP_CENTER = {lat: -36.8485, lng: 174.7633};
const AU_MAP_CENTER = {lat: -33.8688, lng: 151.2093}; // Sydney

/**
 * Where the courier map opens. Couriers are fetched for the visible area only, so opening an AU tenant on
 * Auckland (the old non-US default) showed an empty map until the user panned to Australia (Crisis, 12 Nov
 * 2026). The tenant's own centre (SignUpPageSettings, AU sessions only, see SessionContextService) wins;
 * then a country default.
 */
export function getCourierMapCenter(): {lat: number; lng: number} {
    const session = getSession();
    if (session.tenantMapCenter) return session.tenantMapCenter;
    if (session.isUsCustomer) return US_MAP_CENTER;
    return (session.countryCode ?? '').toUpperCase() === 'AU' ? AU_MAP_CENTER : NZ_MAP_CENTER;
}

/** Resolves to a null key on failure, as the route resolve did, so the map shows its own missing-key state. */
export function useHereMapsApiKey(): {apiKey: string | null; isPending: boolean} {
    const {data, isPending} = useQuery({
        queryKey: queryKeys.hereMaps.apiKey,
        queryFn: () => getHereMapsKey().catch((error) => {
            console.error('[CourierMapScreen] Failed to get HERE Maps API key:', error);
            return null;
        }),
        staleTime: Infinity,
        gcTime: Infinity,
    });
    return {apiKey: data ?? null, isPending};
}

export const CourierMapScreen: React.FC = () => {
    const isUsCustomer = getSession().isUsCustomer ?? false;
    const mapCenter = React.useMemo(getCourierMapCenter, []);
    const {apiKey, isPending} = useHereMapsApiKey();

    return (
        <PageFrame section="Operations" title="Courier map">
            <ErrorBoundary>
                {!isPending && (
                    <CourierMapPage
                        isUsCustomer={isUsCustomer}
                        mapCenter={mapCenter}
                        apiKey={apiKey}
                    />
                )}
            </ErrorBoundary>
        </PageFrame>
    );
};
