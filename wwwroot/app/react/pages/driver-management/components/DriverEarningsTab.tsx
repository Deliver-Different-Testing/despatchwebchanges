import React, {useState} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {useDriverEarnings} from '../../../hooks/useDriverManagementApi';
import {CourierDailyEarnings, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, toolbarIconButtonSx} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import {formatCurrency} from '../../../utils/currencyUtils';

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
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Stats */}
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <StatCard value={formatCurrency(stats.totalEarningsToday)} label="Total Earnings Today" color="success.main" icon={<MoneyIcon />} />
                <StatCard value={formatCurrency(stats.averageHourlyRate)} label="Average Hourly Rate" color="warning.main" icon={<TrendingUpIcon />} />
                <StatCard value={stats.totalActiveDrivers} label="Active Drivers" color="info.main" icon={<PeopleAltIcon />} />
                <StatCard value={stats.totalDeliveriesToday} label="Total Deliveries" color="primary.main" icon={<LocalShippingIcon />} />
            </Box>

            {/* Filters */}
            <FilterToolbar
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <IconButton size="small" sx={toolbarIconButtonSx} onClick={() => refetch()}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Export CSV">
                            <IconButton size="small" sx={toolbarIconButtonSx} onClick={handleExport}>
                                <DownloadIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
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
                page={query.page || 1}
                pageSize={query.pageSize}
                onPageChange={(p) => setQuery(q => ({...q, page: p}))}
                onPageSizeChange={(ps) => setQuery(q => ({...q, pageSize: ps, page: 1}))}
                emptyIcon={<MoneyIcon />}
                emptyTitle="No Earnings Data"
                emptyMessage="No earnings data matches your criteria."
            />
        </Box>
    );
};
