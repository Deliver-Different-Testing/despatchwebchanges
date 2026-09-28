import React, {useState} from 'react';
import {useAfterHoursSchedule, useCreateAfterHoursSchedule, useUpdateAfterHoursSchedule, useDeleteAfterHoursSchedule} from '../../../hooks/useDriverManagementApi';
import {AfterHoursCourierScheduleItem, AfterHoursFilter, PaginatedRequest} from '../../../interfaces';
import {AfterHoursCourierSchedule} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {CalendarDays, Car, Download, Moon, Pencil, Plus, RefreshCw, Trash2} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {ActionIcon, Badge, Box, Button, Group, Select, Stack, Text, Tooltip} from '@mantine/core';
import {
    CRITERION_LABEL_GAP,
    FILTER_CONTROL_HEIGHT,
    GroupLabel,
} from '../../../components/common/filter-fields';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
} from '../../../components/dialogs/shared/mantine';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, getDayChipColor} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';
import {dataTablePagingProps} from './dataTablePaging';

interface WindowWithAfterhoursDialog {
    ReactEditAfterhoursDialog?: {
        open: (
            schedule: AfterHoursCourierSchedule,
            isUsTenant: boolean,
            toastService: { showToast: ShowToastFn }
        ) => Promise<AfterHoursCourierSchedule | null>;
    };
}

interface AfterHoursTabProps {
    showToast: ShowToastFn;
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
        <Group gap={4}>
            {row.days.map(day => (
                <Badge key={day} size="sm" tt="none" color={getDayChipColor(day)}>{day.slice(0, 3)}</Badge>
            ))}
        </Group>
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

            const result = await (window as unknown as WindowWithAfterhoursDialog).ReactEditAfterhoursDialog?.open(
                newSchedule,
                isUsCustomer ?? false,
                {showToast}
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

            const result = await (window as unknown as WindowWithAfterhoursDialog).ReactEditAfterhoursDialog?.open(
                scheduleForDialog,
                isUsCustomer ?? false,
                {showToast}
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

    const activeFilterCount = filters.day !== 'all' ? 1 : 0;

    const handleClearFilters = () => {
        setFilters({day: 'all'});
        setQuery(q => ({...q, page: 1}));
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
                    <Tooltip label="Edit">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            aria-label="Edit schedule"
                            onClick={(e) => { e.stopPropagation(); handleEditSchedule(row); }}
                        >
                            <Icon lucide={Pencil} size={16}/>
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            aria-label="Delete schedule"
                            onClick={(e) => { e.stopPropagation(); setScheduleToDelete(row); setDeleteDialogOpen(true); }}
                        >
                            <Icon lucide={Trash2} size={16}/>
                        </ActionIcon>
                    </Tooltip>
                </>
            )}
            : col
    );

    return (
        <Stack gap={16}>
            {/* Stats */}
            <Group gap={16}>
                <StatCard value={stats.totalAssignments} label="Total Assignments" color="var(--mantine-primary-color-filled)" icon={<Icon lucide={CalendarDays}/>} />
                <StatCard value={stats.activeDrivers} label="Active Drivers" color="var(--mantine-color-green-6)" icon={<Icon lucide={Car}/>} />
            </Group>

            {/* Filters */}
            <FilterToolbar
                activeFilterCount={activeFilterCount}
                onClearAll={handleClearFilters}
                actions={
                    <>
                        <Button
                            size="compact-sm"
                            h={FILTER_CONTROL_HEIGHT}
                            leftSection={<Icon lucide={Plus} size={16}/>}
                            onClick={handleCreateSchedule}
                        >
                            Add schedule
                        </Button>
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
                    placeholder="Search schedules..."
                />
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.day !== 'all' ? 1 : 0}>Day</GroupLabel>
                    <Select
                        size="xs"
                        aria-label="Day"
                        miw={150}
                        allowDeselect={false}
                        styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                        value={filters.day}
                        onChange={(value) => {
                            setFilters({day: value ?? 'all'});
                            setQuery(q => ({...q, page: 1}));
                        }}
                        data={[
                            {value: 'all', label: 'All days'},
                            ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                                .map(d => ({value: d.toLowerCase(), label: d})),
                        ]}
                    />
                </Stack>
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
                {...dataTablePagingProps(query, setQuery)}
                emptyIcon={<Icon lucide={Moon}/>}
                emptyTitle="No After Hours Schedules"
                emptyMessage="No after hours schedules match your criteria."
            />

            {/* Delete Confirmation Dialog */}
            {/* A raw MUI <Dialog> before; composed from the shared Mantine
                primitives per CLAUDE.md, which is where the destructive variant,
                the confirm/cancel shape and the accessible name come from. */}
            <DialogShell
                opened={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                size={dialogSize.sm}
                label="Delete schedule"
            >
                <DialogHeader
                    icon={<Icon lucide={Trash2}/>}
                    title="Delete schedule"
                    onClose={() => setDeleteDialogOpen(false)}
                    variant="error"
                />
                <Box p={24} bg={dialogContentBg}>
                    <Text>
                        Delete this schedule for <strong>{scheduleToDelete?.courierName}</strong>? This cannot be undone.
                    </Text>
                </Box>
                <DialogFooter
                    onCancel={() => setDeleteDialogOpen(false)}
                    onConfirm={handleDeleteConfirm}
                    confirmLabel="Delete schedule"
                    confirmColor="red"
                    confirmIcon={<Icon lucide={Trash2}/>}
                />
            </DialogShell>
        </Stack>
    );
};
