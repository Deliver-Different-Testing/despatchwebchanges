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
    const {apiKey, isPending} = useHereMapsApiKey();

    return (
        <PageFrame section="Operations" title="Courier map">
            <ErrorBoundary>
                {!isPending && (
                    <CourierMapPage
                        isUsCustomer={isUsCustomer}
                        mapCenter={isUsCustomer ? US_MAP_CENTER : NZ_MAP_CENTER}
                        apiKey={apiKey}
                    />
                )}
            </ErrorBoundary>
        </PageFrame>
    );
};
