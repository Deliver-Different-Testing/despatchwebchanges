import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {CourierMapPage} from './CourierMapPage';
import {queryKeys} from '../../api';
import {getHereMapsKey} from '../../api/configApi';
import {getSession} from '../../api/session';
import {getDefaultMapCenter} from '../../components/common/here-map/HereMap.types';

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
    const mapCenter = React.useMemo(getDefaultMapCenter, []);
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
