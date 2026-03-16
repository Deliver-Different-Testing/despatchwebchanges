import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import CarIcon from '@mui/icons-material/DirectionsCar';
import DownloadIcon from '@mui/icons-material/Download';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import {useTodayActiveDrivers} from '../../../hooks';
import {FleetOption, PaginatedRequest, TodayActiveDriver, TodayActiveDriverFilter} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, toolbarIconButtonSx, getFleetChipSx} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';

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
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Chip label={row.code} size="small" color="primary" variant="outlined" />},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'fleet', label: 'Fleet', sortable: true, render: (row) => <Chip label={row.fleet} size="small" variant="outlined" sx={getFleetChipSx(row.fleet)} />},
    {key: 'loginTime', label: 'Login Time', sortable: true, width: '110px', render: (row) => row.loginTime ? dayjs(row.loginTime).format('HH:mm') : ''},
    {key: 'logoutTime', label: 'Logout Time', sortable: true, width: '110px', render: (row) => row.logoutTime ? dayjs(row.logoutTime).format('HH:mm') : ''},
    {key: 'duration', label: 'Duration', sortable: true, width: '100px', render: (row) => row.duration},
    {key: 'deliveries', label: 'Deliveries', sortable: true, width: '100px', render: (row) => row.deliveries},
    {key: 'status', label: 'Status', sortable: true, width: '100px', render: (row) => <Chip label={row.status} size="small" color={row.status === 'Active' ? 'success' : 'default'} />},
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

    const handleExport = async () => {
        try {
            await driverManagementApi.exportTodayActiveDriversCsv(query, filters);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Stats */}
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <StatCard value={stats.totalActiveDrivers} label="Currently Online" color="success.main" icon={<WifiTetheringIcon />} />
                <StatCard value={stats.onBreak} label="On Break" color="warning.main" icon={<PauseCircleIcon />} />
                <StatCard value={stats.totalDriversActiveToday} label="Total Today" color="info.main" icon={<PeopleAltIcon />} />
                <StatCard value={stats.averageSession} label="Average Session" color="primary.main" icon={<ScheduleIcon />} />
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
                <TextField select label="Status" size="small" sx={{minWidth: 150}} value={filters.status}
                    onChange={(e) => { setFilters(f => ({...f, status: e.target.value})); setQuery(q => ({...q, page: 1})); }}>
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="expired">Expired</MenuItem>
                    <MenuItem value="expiring">Expiring Soon</MenuItem>
                    <MenuItem value="valid">Valid</MenuItem>
                </TextField>
                <TextField select label="Fleet" size="small" sx={{minWidth: 150}} value={filters.fleet}
                    onChange={(e) => { setFilters(f => ({...f, fleet: Number(e.target.value)})); setQuery(q => ({...q, page: 1})); }}>
                    <MenuItem value={0}>All Fleets</MenuItem>
                    {fleetOptions.map(opt => (
                        <MenuItem key={opt.id} value={opt.id}>{opt.text}</MenuItem>
                    ))}
                </TextField>
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
                page={query.page || 1}
                pageSize={query.pageSize}
                onPageChange={(p) => setQuery(q => ({...q, page: p}))}
                onPageSizeChange={(ps) => setQuery(q => ({...q, pageSize: ps, page: 1}))}
                emptyIcon={<CarIcon />}
                emptyTitle="No Active Drivers"
                emptyMessage="No active drivers match your criteria."
            />
        </Box>
    );
};
