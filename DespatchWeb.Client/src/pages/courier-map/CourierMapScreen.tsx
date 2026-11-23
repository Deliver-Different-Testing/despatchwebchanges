import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {CourierMapPage} from './CourierMapPage';
import {queryKeys} from '../../api';
import {getHereMapsKey} from '../../api/configApi';
import {getSession} from '../../api/session';
import {getDefaultMapCenter} from '../../components/common/here-map/HereMap.types';

/** Auckland, where the courier map opened before it shared the Wellington country default. Keep it separate. */
const COURIER_MAP_NZ_CENTER = {lat: -36.8485, lng: 174.7633};

/**
 * Resolves to a null key on failure, as the route resolve did, so the map shows its own missing-key state.
 * The failure stays a query error rather than a cached null: the key is shared with every other HERE map,
 * and a cached null would never be refetched.
 */
export function useHereMapsApiKey(): {apiKey: string | null; isPending: boolean} {
    const {data, isPending} = useQuery({
        queryKey: queryKeys.hereMaps.apiKey,
        queryFn: getHereMapsKey,
        staleTime: Infinity,
        gcTime: Infinity,
    });
    return {apiKey: data || null, isPending};
}

export const CourierMapScreen: React.FC = () => {
    const isUsCustomer = getSession().isUsCustomer ?? false;
    const mapCenter = React.useMemo(() => getDefaultMapCenter(COURIER_MAP_NZ_CENTER), []);
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
