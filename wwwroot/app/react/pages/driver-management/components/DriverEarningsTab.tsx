import {Group, Stack} from '@mantine/core';
import React, {useState} from 'react';
import {useDriverEarnings} from '../../../hooks/useDriverManagementApi';
import {CourierDailyEarnings, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {DollarSign, Download, RefreshCw, TrendingUp, Truck, Users} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import {formatCurrency} from '../../../utils/currencyUtils';
import {dataTablePagingProps} from './dataTablePaging';

interface DriverEarningsTabProps {
    showToast: ShowToastFn;
}

const columns: DataTableColumn<CourierDailyEarnings>[] = [
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'hoursLogged', label: 'Hours Logged', sortable: true, width: '120px', render: (row) => `${row.hoursLogged.toFixed(1)}h`},
    {key: 'deliveries', label: 'Deliveries', sortable: true, width: '110px', render: (row) => row.deliveries},
    {key: 'earnings', label: 'Earnings', sortable: true, width: '110px', render: (row) => formatCurrency(row.earnings)},
    {key: 'hourlyRate', label: 'Hourly Rate', sortable: true, width: '110px', render: (row) => `${formatCurrency(row.hourlyRate)}/h`},
];

export const DriverEarningsTab: React.FC<DriverEarningsTabProps> = ({showToast}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'name', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [sort, setSort] = useState<SortState>({column: 'name', direction: 'asc'});

    const {data, isLoading, refetch} = useDriverEarnings(query);
    const items = data?.items ?? [];
    const stats = {
        totalEarningsToday: data?.totalEarningsToday ?? 0,
        averageHourlyRate: data?.averageHourlyRate ?? 0,
        totalActiveDrivers: data?.totalActiveDrivers ?? 0,
        totalDeliveriesToday: data?.totalDeliveriesToday ?? 0,
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportDriverEarningsCsv(query);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    return (
        <Stack gap={16}>
            {/* Stats */}
            <Group gap={16}>
                <StatCard value={formatCurrency(stats.totalEarningsToday)} label="Total Earnings Today" color="var(--mantine-color-green-6)" icon={<Icon lucide={DollarSign}/>} />
                <StatCard value={formatCurrency(stats.averageHourlyRate)} label="Average Hourly Rate" color="var(--mantine-color-yellow-6)" icon={<Icon lucide={TrendingUp}/>} />
                <StatCard value={stats.totalActiveDrivers} label="Active Drivers" color="var(--mantine-color-cyan-6)" icon={<Icon lucide={Users}/>} />
                <StatCard value={stats.totalDeliveriesToday} label="Total Deliveries" color="var(--mantine-primary-color-filled)" icon={<Icon lucide={Truck}/>} />
            </Group>

            {/* Filters */}
            <FilterToolbar
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
                <SearchField
                    value={query.searchTerm ?? ''}
                    onChange={(value) => setQuery(q => ({...q, searchTerm: value, page: 1}))}
                    placeholder="Search earnings..."
                />
            </FilterToolbar>

            {/* Table */}
            <DataTable<CourierDailyEarnings>
                totalCount={data?.total ?? 0}
                rows={items}
                columns={columns}
                rowKey={(_, idx) => idx}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                emptyIcon={<Icon lucide={DollarSign}/>}
                emptyTitle="No Earnings Data"
                emptyMessage="No earnings data matches your criteria."
            />
        </Stack>
    );
};
