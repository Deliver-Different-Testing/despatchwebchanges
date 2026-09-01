import React, {useState} from 'react';
import {Badge, Group, Select, Stack} from '@mantine/core';
import {Car, CircleDot, Clock, Download, PauseCircle, RefreshCw, Users} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {
    CRITERION_LABEL_GAP,
    FILTER_CONTROL_HEIGHT,
    GroupLabel,
} from '../../../components/common/filter-fields';
import {useTodayActiveDrivers} from '../../../hooks/useDriverManagementApi';
import {FleetOption, PaginatedRequest, TodayActiveDriver, TodayActiveDriverFilter} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, getFleetChipStyle} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';
import {dataTablePagingProps} from './dataTablePaging';

interface TodayActiveTabProps {
    showToast: ShowToastFn;
    fleetOptions: FleetOption[];
}

const formatSessionTime = (totalMinutes: number): string => {
    if (totalMinutes === 0) return '0h 0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
};

const columns: DataTableColumn<TodayActiveDriver>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none">{row.code}</Badge>},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'fleet', label: 'Fleet', sortable: true, render: (row) => <Badge size="sm" tt="none" variant="outline" style={getFleetChipStyle(row.fleet)}>{row.fleet}</Badge>},
    {key: 'loginTime', label: 'Login Time', sortable: true, width: '110px', render: (row) => row.loginTime ? dayjs(row.loginTime).format('HH:mm') : ''},
    {key: 'logoutTime', label: 'Logout Time', sortable: true, width: '110px', render: (row) => row.logoutTime ? dayjs(row.logoutTime).format('HH:mm') : ''},
    {key: 'duration', label: 'Duration', sortable: true, width: '100px', render: (row) => row.duration},
    {key: 'deliveries', label: 'Deliveries', sortable: true, width: '100px', render: (row) => row.deliveries},
    {key: 'status', label: 'Status', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none" color={row.status === 'Active' ? 'green' : 'gray'}>{row.status}</Badge>},
];

export const TodayActiveTab: React.FC<TodayActiveTabProps> = ({showToast, fleetOptions}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'name', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [filters, setFilters] = useState<TodayActiveDriverFilter>({
        location: 'all', status: 'all', fleet: 0,
    });
    const [sort, setSort] = useState<SortState>({column: 'name', direction: 'asc'});

    const {data, isLoading, refetch} = useTodayActiveDrivers(query, filters);
    const items = data?.items ?? [];
    const stats = {
        totalActiveDrivers: data?.totalActiveDrivers ?? 0,
        totalDriversActiveToday: data?.totalDriversActiveToday ?? 0,
        onBreak: 0,
        averageSession: formatSessionTime(data?.averageSessionTime ?? 0),
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
        setQuery(q => ({...q, page: 1}));
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportTodayActiveDriversCsv(query, filters);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    return (
        <Stack gap={16}>
            {/* Stats */}
            <Group gap={16}>
                <StatCard value={stats.totalActiveDrivers} label="Currently Online" color="var(--mantine-color-green-6)" icon={<Icon lucide={CircleDot} size={28} color="var(--mantine-color-green-6)"/>} />
                <StatCard value={stats.onBreak} label="On Break" color="var(--mantine-color-yellow-6)" icon={<Icon lucide={PauseCircle} size={28} color="var(--mantine-color-yellow-6)"/>} />
                <StatCard value={stats.totalDriversActiveToday} label="Total Today" color="var(--mantine-color-cyan-6)" icon={<Icon lucide={Users} size={28} color="var(--mantine-color-cyan-6)"/>} />
                <StatCard value={stats.averageSession} label="Average Session" color="var(--mantine-primary-color-filled)" icon={<Icon lucide={Clock} size={28} color="var(--mantine-primary-color-filled)"/>} />
            </Group>

            {/* Filters */}
            <FilterToolbar
                activeFilterCount={activeFilterCount}
                onClearAll={handleClearFilters}
                actions={
                    <>
                        <HeaderActionIcon label="Refresh" onClick={() => refetch()}>
                            <Icon lucide={RefreshCw} size={PANEL_CONTROL_GLYPH_SIZE}/>
                        </HeaderActionIcon>
                        <HeaderActionIcon label="Export CSV" onClick={handleExport}>
                            <Icon lucide={Download} size={PANEL_CONTROL_GLYPH_SIZE}/>
                        </HeaderActionIcon>
                    </>
                }
            >
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.status !== 'all' ? 1 : 0}>Status</GroupLabel>
                    <Select
                        size="xs"
                        aria-label="Status"
                        miw={150}
                        allowDeselect={false}
                        styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                        value={filters.status}
                        onChange={(value) => {
                            setFilters(f => ({...f, status: value ?? 'all'}));
                            setQuery(q => ({...q, page: 1}));
                        }}
                        data={[
                            {value: 'all', label: 'All statuses'},
                            {value: 'expired', label: 'Expired'},
                            {value: 'expiring', label: 'Expiring soon'},
                            {value: 'valid', label: 'Valid'},
                        ]}
                    />
                </Stack>
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.fleet ? 1 : 0}>Fleet</GroupLabel>
                    <Select
                        size="xs"
                        aria-label="Fleet"
                        miw={150}
                        allowDeselect={false}
                        styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                        value={String(filters.fleet)}
                        onChange={(value) => {
                            setFilters(f => ({...f, fleet: Number(value ?? 0)}));
                            setQuery(q => ({...q, page: 1}));
                        }}
                        data={[
                            {value: '0', label: 'All fleets'},
                            ...fleetOptions.map(opt => ({value: String(opt.id), label: opt.text})),
                        ]}
                    />
                </Stack>
                <SearchField
                    value={query.searchTerm ?? ''}
                    onChange={(value) => setQuery(q => ({...q, searchTerm: value, page: 1}))}
                    placeholder="Search drivers..."
                />
            </FilterToolbar>

            {/* Table */}
            <DataTable<TodayActiveDriver>
                totalCount={data?.total ?? 0}
                rows={items}
                columns={columns}
                rowKey={(_, idx) => idx}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                emptyIcon={<Icon lucide={Car} size={40}/>}
                emptyTitle="No Active Drivers"
                emptyMessage="No active drivers match your criteria."
            />
        </Stack>
    );
};
