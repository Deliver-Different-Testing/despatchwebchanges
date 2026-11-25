import React, {useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Box, Button, Group, Text} from '@mantine/core';
import type {Dayjs} from 'dayjs';
import {DriverLocations} from '../../../components/common/driver-locations';
import type {
    IAreaClearList,
    IClearListViewModelWithColumns,
    TruckMode,
} from '../../../components/common/driver-locations/DriverLocations.types';
import {fetchDriverLocations} from '../../../api/courierApi';
import {queryKeys} from '../../../api/queryClient';
import {isBehind, minutesUntilMinimumEnds, useTenantNowMs} from '../../../components/common/driver-locations/driverTopUp';
import type {DriverAlertFilter} from '../../../components/common/driver-locations/driverTopUp';

export interface DriverLocationsBoxProps {
    isUsCustomer: boolean;
    /** Selected dispatch view ids; driver locations are scoped to these. */
    despatchViewIds: number[];
    startDate: Dayjs;
    endDate: Dayjs;
    /** Time range: the end is an exact instant rather than the whole end day. */
    useTime?: boolean;
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
 * "Driver locations" panel for the React dispatch page. Fetches the clear-list
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
    useTime = false,
    refetchIntervalMs = false,
    activeAreaId,
    onAreaSelect,
    onClearArea,
    truckMode,
}) => {
    const viewIds = despatchViewIds;

    const {data, isLoading, isError} = useQuery({
        queryKey: queryKeys.dispatch.driverLocations(viewIds, startDate.toISOString(), endDate.toISOString(), useTime),
        queryFn: ({signal}) => fetchDriverLocations({despatchViewIds: viewIds, startDate, endDate, useTime}, {signal}),
        enabled: viewIds.length > 0,
        refetchInterval: refetchIntervalMs,
    });

    const hasAreas = !!data?.areas?.length;

    // Minimum hourly top-up alerts: drivers behind for the pay period, and drivers whose daily minimum is about to
    // end. The strip only appears when the server sent that data (dw-driver-earnings-status + the tenant alert).
    const nowMs = useTenantNowMs();
    const [alertFilter, setAlertFilter] = useState<DriverAlertFilter>(null);
    const alertCounts = useMemo(() => {
        const behind = new Set<number>();
        const minimum = new Set<number>();
        for (const area of data?.areas ?? []) {
            for (const section of [...(area.top ?? []), ...(area.middle ?? []), ...(area.bottom ?? [])]) {
                const id = section.courierData?.courierId;
                if (id == null) continue;
                if (isBehind(section.courierData)) behind.add(id);
                if (minutesUntilMinimumEnds(section.courierData, nowMs) !== null) minimum.add(id);
            }
        }
        return {behind: behind.size, minimum: minimum.size};
    }, [data, nowMs]);
    const showAlertStrip = alertCounts.behind > 0 || alertCounts.minimum > 0;
    const toggleFilter = (filter: Exclude<DriverAlertFilter, null>) =>
        setAlertFilter(prev => (prev === filter ? null : filter));

    // A failed fetch with nothing cached must not read as "no drivers"; stale areas stay on show.
    if (isError && !hasAreas) {
        return (
            <Text role="alert" size="sm" c="red" p="sm">
                Couldn't load driver locations. Refresh to try again.
            </Text>
        );
    }

    // Truck-mode filtering (On / Off / Only) is driven from the panel header menu;
    // here it's just forwarded to the presentational component (shouldShowCourier).
    return (
        <Box style={{height: '100%', minHeight: 0, overflow: 'auto'}}>
            {showAlertStrip && (
                <Group gap={8} p={6} role="group" aria-label="Driver earnings alerts">
                    {alertCounts.behind > 0 && (
                        <Button
                            size="compact-xs"
                            color="red"
                            variant={alertFilter === 'behind' ? 'filled' : 'light'}
                            onClick={() => toggleFilter('behind')}
                        >
                            {alertCounts.behind} behind on earnings
                        </Button>
                    )}
                    {alertCounts.minimum > 0 && (
                        <Button
                            size="compact-xs"
                            color="orange"
                            variant={alertFilter === 'minimum' ? 'filled' : 'light'}
                            onClick={() => toggleFilter('minimum')}
                        >
                            {alertCounts.minimum} minimum ending soon
                        </Button>
                    )}
                </Group>
            )}
            <DriverLocations
                driverLocations={data as IClearListViewModelWithColumns | undefined}
                loading={isLoading}
                showNoData={!isLoading && !hasAreas}
                showData={!isLoading && hasAreas}
                truckMode={truckMode}
                alertFilter={alertFilter}
                isUsCustomer={isUsCustomer}
                activeAreaId={activeAreaId}
                onAreaClick={(area: IAreaClearList) => onAreaSelect?.(area.id)}
                onClearFilter={onClearArea}
            />
        </Box>
    );
};
