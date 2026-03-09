import React, {useState} from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    MenuItem,
    TextField,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    DirectionsCar as CarIcon,
    Download as DownloadIcon,
    Edit as EditIcon,
    EventNote as EventNoteIcon,
    NightsStay as NightsStayIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import {useAfterHoursSchedule, useCreateAfterHoursSchedule, useUpdateAfterHoursSchedule, useDeleteAfterHoursSchedule} from '../../../hooks';
import {AfterHoursCourierScheduleItem, AfterHoursFilter, PaginatedRequest} from '../../../interfaces';
import {AfterHoursCourierSchedule} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, toolbarButtonSx, toolbarIconButtonSx, getDayChipColor} from './shared';
import dayjs from 'dayjs';

interface AfterHoursTabProps {
    showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
    isUsCustomer?: boolean;
}

const formatTime = (time?: string): string => {
    if (!time) return '';
    return dayjs(time).format('HH:mm');
};

const toHHmm = (time?: string): string | undefined => {
    if (!time) return undefined;
    return dayjs(time).format('HH:mm');
};

const fromHHmm = (hhmm?: string): string | undefined => {
    if (!hhmm) return undefined;
    const [h, m] = hhmm.split(':').map(Number);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `2000-01-01T${hh}:${mm}:00`;
};

const columns: DataTableColumn<AfterHoursCourierScheduleItem>[] = [
    {key: 'courierName', label: 'Driver Name', sortable: true, render: (row) => row.courierName},
    {key: 'courierCode', label: 'Driver Code', sortable: true, width: '120px', render: (row) => row.courierCode},
    {key: 'days', label: 'Days', sortable: true, render: (row) => (
        <Box sx={{display: 'flex', gap: 0.5, flexWrap: 'wrap'}}>
            {row.days.map(day => (
                <Chip key={day} label={day.slice(0, 3)} size="small" color={getDayChipColor(day)} variant="outlined" />
            ))}
        </Box>
    )},
    {key: 'startTime', label: 'Start Time', sortable: true, width: '110px', render: (row) => formatTime(row.startTime)},
    {key: 'endTime', label: 'End Time', sortable: true, width: '110px', render: (row) => formatTime(row.endTime)},
    {key: 'duration', label: 'Duration', sortable: true, width: '100px', render: (row) => row.duration},
    {key: 'actions', label: 'Actions', width: '100px', align: 'center', render: () => null},
];

export const AfterHoursTab: React.FC<AfterHoursTabProps> = ({showToast, isUsCustomer}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'name', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [filters, setFilters] = useState<AfterHoursFilter>({day: 'all'});
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<AfterHoursCourierScheduleItem | null>(null);
    const [sort, setSort] = useState<SortState>({column: 'name', direction: 'asc'});

    const {data, isLoading, refetch} = useAfterHoursSchedule(query, filters);
    const createMutation = useCreateAfterHoursSchedule();
    const updateMutation = useUpdateAfterHoursSchedule();
    const deleteMutation = useDeleteAfterHoursSchedule();

    const items = data?.items ?? [];
    const stats = {
        totalAssignments: data?.total ?? 0,
        activeDrivers: data?.totalActiveDrivers ?? 0,
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const handleCreateSchedule = async () => {
        try {
            const newSchedule: AfterHoursCourierSchedule = {
                afterHoursScheduleId: 0,
                courierId: 0,
                courierName: '',
                courierCode: '',
                days: [dayjs().format('dddd')],
                startTime: '17:00',
                endTime: '21:00',
                duration: '4 hours',
            };

            const result = await (window as any).ReactEditAfterhoursDialog?.open(
                newSchedule,
                isUsCustomer ?? false,
                {showToast: (msg: string, type: string) => showToast(msg, type as any)}
            );
            if (!result) return;

            await createMutation.mutateAsync({
                ...result,
                startTime: fromHHmm(result.startTime),
                endTime: fromHHmm(result.endTime),
            } as AfterHoursCourierScheduleItem);
            showToast('Schedule created successfully', 'success');
        } catch {
            showToast('Failed to create schedule', 'error');
        }
    };

    const handleEditSchedule = async (schedule: AfterHoursCourierScheduleItem) => {
        try {
            const scheduleForDialog: AfterHoursCourierSchedule = {
                afterHoursScheduleId: schedule.afterHoursScheduleId,
                courierId: schedule.courierId,
                courierName: schedule.courierName,
                courierCode: schedule.courierCode,
                days: schedule.days,
                startTime: toHHmm(schedule.startTime),
                endTime: toHHmm(schedule.endTime),
                timezone: schedule.timezone,
                duration: schedule.duration,
            };

            const result = await (window as any).ReactEditAfterhoursDialog?.open(
                scheduleForDialog,
                isUsCustomer ?? false,
                {showToast: (msg: string, type: string) => showToast(msg, type as any)}
            );
            if (!result) return;

            await updateMutation.mutateAsync({
                ...result,
                startTime: fromHHmm(result.startTime),
                endTime: fromHHmm(result.endTime),
            } as AfterHoursCourierScheduleItem);
            showToast('Schedule updated successfully', 'success');
        } catch {
            showToast('Failed to edit schedule', 'error');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!scheduleToDelete) return;
        setDeleteDialogOpen(false);
        try {
            await deleteMutation.mutateAsync(scheduleToDelete.afterHoursScheduleId);
            showToast('Schedule deleted successfully', 'success');
        } catch {
            showToast('Failed to delete schedule', 'error');
        }
        setScheduleToDelete(null);
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportAfterHoursScheduleCsv(query, filters);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    // Override actions column render with closure access to handlers
    const columnsWithActions: DataTableColumn<AfterHoursCourierScheduleItem>[] = columns.map(col =>
        col.key === 'actions'
            ? {...col, render: (row: AfterHoursCourierScheduleItem) => (
                <>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditSchedule(row); }}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setScheduleToDelete(row); setDeleteDialogOpen(true); }}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </>
            )}
            : col
    );

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Stats */}
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <StatCard value={stats.totalAssignments} label="Total Assignments" color="primary.main" icon={<EventNoteIcon />} />
                <StatCard value={stats.activeDrivers} label="Active Drivers" color="success.main" icon={<CarIcon />} />
            </Box>

            {/* Filters */}
            <FilterToolbar
                actions={
                    <>
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={handleCreateSchedule}
                            sx={toolbarButtonSx}
                        >
                            Add Schedule
                        </Button>
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
                    placeholder="Search schedules..."
                />
                <TextField select label="Day" size="small" sx={{minWidth: 150}} value={filters.day}
                    onChange={(e) => { setFilters({day: e.target.value}); setQuery(q => ({...q, page: 1})); }}>
                    <MenuItem value="all">All Days</MenuItem>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                        <MenuItem key={d} value={d.toLowerCase()}>{d}</MenuItem>
                    ))}
                </TextField>
            </FilterToolbar>

            {/* Table */}
            <DataTable<AfterHoursCourierScheduleItem>
                totalCount={data?.total ?? 0}
                rows={items}
                columns={columnsWithActions}
                rowKey={(row) => row.afterHoursScheduleId}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                page={query.page || 1}
                pageSize={query.pageSize}
                onPageChange={(p) => setQuery(q => ({...q, page: p}))}
                onPageSizeChange={(ps) => setQuery(q => ({...q, pageSize: ps, page: 1}))}
                emptyIcon={<NightsStayIcon />}
                emptyTitle="No After Hours Schedules"
                emptyMessage="No after hours schedules match your criteria."
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Schedule</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this schedule for {scheduleToDelete?.courierName}?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} variant="contained" color="error">Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
