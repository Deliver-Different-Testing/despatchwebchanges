import React, {useState} from 'react';
import {Badge, Group, Stack} from '@mantine/core';
import {Car, CircleDot, Clock, Users} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {useTodayActiveDrivers} from '../../../hooks/useDriverManagementApi';
import {FleetOption, PaginatedRequest, TodayActiveDriver, TodayActiveDriverFilter} from '../../../types';
import {driverManagementApi} from '../../../api/driverManagementApi';
import {DataTable, DataTableColumn, FilterToolbar, ListEmptyState, SortState, StatCard, formatMinutes, getFleetChipStyle} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';
import {filterUpdater, FilterSelect, FleetFilter, QuerySearchField, RefreshExportActions} from './DriverFilterControls';
import {dataTablePagingProps} from './dataTablePaging';

interface TodayActiveTabProps {
    showToast: ShowToastFn;
    fleetOptions: FleetOption[];
}

const columns: DataTableColumn<TodayActiveDriver>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none">{row.code}</Badge>},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'fleet', label: 'Fleet', sortable: true, render: (row) => <Badge size="sm" tt="none" variant="outline" style={getFleetChipStyle(row.fleet)}>{row.fleet}</Badge>},
    {key: 'loginTime', label: 'Login time', sortable: true, width: '110px', render: (row) => row.loginTime ? dayjs(row.loginTime).format('HH:mm') : ''},
    {key: 'logoutTime', label: 'Logout time', sortable: true, width: '110px', render: (row) => row.logoutTime ? dayjs(row.logoutTime).format('HH:mm') : ''},
    {key: 'duration', label: 'Duration', sortable: true, width: '100px', render: (row) => row.duration},
    {key: 'deliveries', label: 'Deliveries', sortable: true, width: '100px', render: (row) => row.deliveries},
    {key: 'status', label: 'Status', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none" color={row.status === 'Active' ? 'green' : 'gray'}>{row.status}</Badge>},
];

export const TodayActiveTab: React.FC<TodayActiveTabProps> = ({showToast, fleetOptions}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'name', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [filters, setFilters] = useState<TodayActiveDriverFilter>({
        status: 'all', fleet: 0,
    });
    const updateFilters = filterUpdater(setFilters, setQuery);
    const [sort, setSort] = useState<SortState>({column: 'name', direction: 'asc'});

    const {data, isLoading, isError, refetch} = useTodayActiveDrivers(query, filters);
    const items = isError ? [] : data?.items ?? [];
    const stats = {
        totalActiveDrivers: data?.totalActiveDrivers ?? 0,
        totalDriversActiveToday: data?.totalDriversActiveToday ?? 0,
        averageSession: formatMinutes(data?.averageSessionTime ?? 0),
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const activeFilterCount =
        (filters.status !== 'all' ? 1 : 0)
        + (filters.fleet ? 1 : 0);

    const handleClearFilters = () => {
        setFilters(f => ({...f, status: 'all', fleet: 0}));
        setQuery(q => ({...q, searchTerm: '', page: 1}));
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportTodayActiveDriversCsv(query, filters);
        } catch {
            showToast("Couldn't export the data. Try again.", 'error');
        }
    };

    return (
        <Stack gap={16}>
            {/* Stats */}
            <Group gap={16}>
                <StatCard value={stats.totalActiveDrivers} label="Currently online" color="var(--mantine-color-green-6)" icon={<Icon lucide={CircleDot} size={28} color="var(--mantine-color-green-6)"/>} />
                <StatCard value={stats.totalDriversActiveToday} label="Total today" color="var(--mantine-color-cyan-6)" icon={<Icon lucide={Users} size={28} color="var(--mantine-color-cyan-6)"/>} />
                <StatCard value={stats.averageSession} label="Average session" color="var(--mantine-primary-color-filled)" icon={<Icon lucide={Clock} size={28} color="var(--mantine-primary-color-filled)"/>} />
            </Group>

            {/* Filters */}
            <FilterToolbar
                activeFilterCount={activeFilterCount}
                onClearAll={handleClearFilters}
                actions={<RefreshExportActions onRefresh={() => refetch()} onExport={handleExport}/>}
            >
                <FilterSelect
                    label="Status"
                    selected={filters.status !== 'all'}
                    value={filters.status}
                    onChange={(value) => updateFilters({status: (value ?? 'all') as TodayActiveDriverFilter['status']})}
                    data={[
                        {value: 'all', label: 'All statuses'},
                        {value: 'active', label: 'Active'},
                        {value: 'inactive', label: 'Inactive'},
                    ]}
                />
                <FleetFilter
                    fleet={filters.fleet}
                    fleetOptions={fleetOptions}
                    onChange={(fleet) => updateFilters({fleet})}
                />
                <QuerySearchField query={query} setQuery={setQuery} placeholder="Search drivers…"/>
            </FilterToolbar>

            {/* Table */}
            <DataTable<TodayActiveDriver>
                totalCount={isError ? 0 : data?.total ?? 0}
                rows={items}
                columns={columns}
                rowKey={(row) => row.courierId}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                emptyContent={
                    <ListEmptyState
                        noun="drivers"
                        isError={isError}
                        onRetry={() => refetch()}
                        isFiltered={activeFilterCount > 0 || !!query.searchTerm}
                        onClearFilters={handleClearFilters}
                        emptyIcon={<Icon lucide={Car} size={40}/>}
                        emptyTitle="No drivers logged in today"
                        emptyMessage="Drivers appear here once they log in."
                    />
                }
            />
        </Stack>
    );
};
