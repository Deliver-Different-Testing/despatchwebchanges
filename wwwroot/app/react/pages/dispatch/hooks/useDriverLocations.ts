/**
 * useDriverLocations Hook
 *
 * Fetches and manages driver locations data for the dispatch dashboard.
 */

import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {getDriverLocations} from '../../../services/dispatchApi';
import type {IClearListViewModelWithColumns} from '../../../components/common/driver-locations/DriverLocations.types';
import type {TruckMode} from '../../../components/common/driver-locations/DriverLocations.types';

export interface UseDriverLocationsReturn {
    driverLocations: IClearListViewModelWithColumns | undefined;
    loading: boolean;
    truckMode: TruckMode;
    setTruckMode: (mode: TruckMode) => void;
    activeAreaId: number | undefined;
    setActiveAreaId: (id: number | undefined) => void;
    refetch: () => void;
}

export function useDriverLocations(
    despatchViewIds: (string | number)[],
    startDate?: string,
    endDate?: string,
    refetchInterval: number | false = 60_000,
): UseDriverLocationsReturn {
    const [truckMode, setTruckMode] = useState<TruckMode>('On');
    const [activeAreaId, setActiveAreaId] = useState<number | undefined>();

    const {data, isLoading, refetch} = useQuery({
        queryKey: ['dispatch', 'driverLocations', despatchViewIds, startDate, endDate],
        queryFn: () => getDriverLocations(despatchViewIds, startDate, endDate),
        enabled: despatchViewIds.length > 0,
        refetchInterval,
    });

    return {
        driverLocations: data as IClearListViewModelWithColumns | undefined,
        loading: isLoading,
        truckMode,
        setTruckMode,
        activeAreaId,
        setActiveAreaId,
        refetch: () => { refetch(); },
    };
}
