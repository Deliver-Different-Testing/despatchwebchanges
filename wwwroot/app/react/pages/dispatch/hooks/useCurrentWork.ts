/**
 * useCurrentWork Hook
 *
 * Manages the current work panel state - driver overview list and selected driver's jobs.
 * Supports two view modes:
 *   - 'overview': shows all drivers with job counts
 *   - 'selectedDriver': shows the selected driver's job list
 */

import {useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {getDriverWorkOverview, createCurrentWorkFetchFn} from '../../../services/dispatchApi';
import {queryKeys} from '../../../query/queryClient';
import type {IDriverWorkOverview} from '../../../components/common/current-work-all-drivers/CurrentWorkAllDrivers.types';
import type {FetchConfig} from '../../../interfaces/dispatchJob';

export type CurrentWorkViewMode = 'overview' | 'selectedDriver';

export interface UseCurrentWorkReturn {
    /** All drivers overview data */
    drivers: IDriverWorkOverview[];
    /** Loading state for driver overview */
    loading: boolean;
    /** Current view mode */
    viewMode: CurrentWorkViewMode;
    /** Currently selected courier ID */
    selectedCourierId: number | undefined;
    /** Selected driver name */
    selectedDriverName: string;
    /** Subtitle text for current work header */
    currentWorkSelection: string;
    /** FetchConfig for the selected driver's job list (null in overview mode) */
    driverJobsFetchConfig: FetchConfig | null;
    /** Select a driver — switches to selectedDriver view and loads their jobs */
    selectDriver: (driver: IDriverWorkOverview) => void;
    /** Go back to the all-drivers overview */
    backToOverview: () => void;
    /** Clear driver selection (alias for backToOverview) */
    clearDriverSelection: () => void;
    /** Refetch driver overview data */
    refetch: () => void;
}

export function useCurrentWork(isUsCustomer: boolean): UseCurrentWorkReturn {
    // NZ tenants skip the driver overview and go straight to the job list
    const [viewMode, setViewMode] = useState<CurrentWorkViewMode>(
        isUsCustomer ? 'overview' : 'selectedDriver',
    );
    const [selectedCourierId, setSelectedCourierId] = useState<number | undefined>();
    const [selectedDriverName, setSelectedDriverName] = useState('');
    const [currentWorkSelection, setCurrentWorkSelection] = useState('');

    const {data, isLoading, refetch} = useQuery({
        queryKey: ['dispatch', 'driverWorkOverview'],
        queryFn: () => getDriverWorkOverview(),
        refetchInterval: 60000,
        // Only fetch driver overview for US tenants (NZ skips the overview)
        enabled: isUsCustomer,
    });

    const selectDriver = useCallback((driver: IDriverWorkOverview) => {
        setSelectedCourierId(driver.courierId);
        setSelectedDriverName(driver.name);
        setCurrentWorkSelection(` - ${driver.name}`);
        setViewMode('selectedDriver');
    }, []);

    const backToOverview = useCallback(() => {
        // NZ tenants have no overview to go back to — just clear the selection
        if (!isUsCustomer) {
            setSelectedCourierId(undefined);
            setSelectedDriverName('');
            setCurrentWorkSelection('');
            return;
        }
        setViewMode('overview');
        setSelectedCourierId(undefined);
        setSelectedDriverName('');
        setCurrentWorkSelection('');
    }, [isUsCustomer]);

    // Build a FetchConfig for the selected driver's jobs
    const driverJobsFetchConfig = useMemo<FetchConfig | null>(() => {
        if (viewMode !== 'selectedDriver' || !selectedCourierId) return null;

        return {
            fetchFn: createCurrentWorkFetchFn(selectedCourierId),
            queryKeyFn: (params) => queryKeys.dispatch.currentWorkJobs(selectedCourierId, params),
            initialParams: {},
        };
    }, [viewMode, selectedCourierId]);

    return {
        drivers: data ?? [],
        loading: isLoading,
        viewMode,
        selectedCourierId,
        selectedDriverName,
        currentWorkSelection,
        driverJobsFetchConfig,
        selectDriver,
        backToOverview,
        clearDriverSelection: backToOverview,
        refetch: () => { refetch(); },
    };
}
