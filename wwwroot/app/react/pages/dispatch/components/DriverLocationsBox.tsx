import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Box} from '@mantine/core';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';
import type {Dayjs} from 'dayjs';
import {DriverLocations} from '../../../components/common/driver-locations';
import type {
    IAreaClearList,
    IClearListViewModelWithColumns,
    TruckMode,
} from '../../../components/common/driver-locations/DriverLocations.types';
import {fetchDriverLocations} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';

export interface DriverLocationsBoxProps {
    isUsCustomer: boolean;
    /** Selected dispatch view ids; driver locations are scoped to these. */
    despatchViewIds: number[];
    startDate: Dayjs;
    endDate: Dayjs;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** The currently selected area's clear-list id (drives the row highlight + map filter). */
    activeAreaId?: number;
    onAreaSelect?: (clearListId: number) => void;
    onClearArea?: () => void;
    /** Truck-mode display filter (On / Off / Only); driven by the header menu. */
    truckMode: TruckMode;
}

/**
 * "Driver Locations" panel for the React dispatch page. Fetches the clear-list
 * view model for the dispatcher's selected views + date range and renders the
 * existing presentational `DriverLocations` component. Clicking an area reports
 * its clear-list id up so the Map box can filter to that area's couriers
 * (mirrors V1 `selectArea` → `clearListId`). Scoped to the selected views,
 * matching V1's `getDriverLocationsData`, which no-ops when nothing is selected.
 */
export const DriverLocationsBox: React.FC<DriverLocationsBoxProps> = ({
    isUsCustomer,
    despatchViewIds,
    startDate,
    endDate,
    refetchIntervalMs = false,
    activeAreaId,
    onAreaSelect,
    onClearArea,
    truckMode,
}) => {
    const viewIds = despatchViewIds;

    const {data, isLoading} = useQuery({
        queryKey: queryKeys.dispatch.driverLocations(viewIds, startDate.toISOString(), endDate.toISOString()),
        queryFn: ({signal}) => fetchDriverLocations({despatchViewIds: viewIds, startDate, endDate}, {signal}),
        enabled: viewIds.length > 0,
        refetchInterval: refetchIntervalMs,
    });

    const hasAreas = !!data?.areas?.length;

    // Truck-mode filtering (On / Off / Only) is driven from the panel header menu;
    // here it's just forwarded to the presentational component (shouldShowCourier).
    return (
        <Box style={{height: '100%', minHeight: 0, overflow: 'auto'}}>
            {/* DriverLocations is still MUI — it moves with the maps work (Phase 8). */}
            <MuiThemeIsland>
            <DriverLocations
                driverLocations={data as IClearListViewModelWithColumns | undefined}
                loading={isLoading}
                showNoData={!isLoading && !hasAreas}
                showData={!isLoading && hasAreas}
                truckMode={truckMode}
                isUsCustomer={isUsCustomer}
                activeAreaId={activeAreaId}
                onAreaClick={(area: IAreaClearList) => onAreaSelect?.(area.id)}
                onClearFilter={onClearArea}
            />
            </MuiThemeIsland>
        </Box>
    );
};
