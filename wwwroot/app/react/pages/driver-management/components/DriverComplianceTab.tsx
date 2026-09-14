import React, {useState} from 'react';
import {
    useComplianceList,
    useSendBulkComplianceReminders,
    useSendComplianceReminder
} from '../../../hooks/useDriverManagementApi';
import {ComplianceFilter, CourierCompliance, FleetOption, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {summarizeCompliance} from '../../../services/aiAssistantApi';
import {AiSummaryCard} from '../../../components/common/ai-summary-card/AiSummaryCard';
import {isAiEnabled} from '../../../../functions/aiSettings';
import {
    DataTable,
    DataTableColumn,
    FilterToolbar,
    getComplianceTypeColor,
    SearchField,
    SortState,
    StatCard,
} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';
import {dataTablePagingProps} from './dataTablePaging';
import {ActionIcon, Badge, Box, Button, Group, Select, Stack, Text, Tooltip} from '@mantine/core';
import {CircleAlert, CircleCheck, Download, Mail, Send, ShieldCheck, TriangleAlert, Users} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
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

interface DriverComplianceTabProps {
    showToast: ShowToastFn;
    fleetOptions: FleetOption[];
}

/** Mantine palette keys — see chipColors for why these are not the tenant brand. */
function getComplianceStatus(expiryDate?: string): { status: string; color: string; daysUntil: number } {
    if (!expiryDate) return {status: 'Not Set', color: 'gray', daysUntil: -999};
    const today = dayjs();
    const daysUntil = dayjs(expiryDate).diff(today, 'day');
    if (daysUntil < 0) return {status: 'Expired', color: 'red', daysUntil};
    if (daysUntil <= 30) return {status: 'Expiring Soon', color: 'yellow', daysUntil};
    return {status: 'Valid', color: 'green', daysUntil};
}

function formatDaysUntil(daysUntil: number): string {
    if (daysUntil === -999) return '\u2014';
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    return `${daysUntil} days`;
}


const columns: DataTableColumn<CourierCompliance>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none">{row.code}</Badge>},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'complianceType', label: 'Type', sortable: true, render: (row) => <Badge size="sm" tt="none" color={getComplianceTypeColor(row.complianceType)}>{row.complianceType}</Badge>},
    {key: 'itemNumber', label: 'Item/Number', sortable: true, render: (row) => row.itemNumber},
    {key: 'expiryDate', label: 'Expiry Date', sortable: true, width: '120px', render: (row) => row.expiryDate ? dayjs(row.expiryDate).format('MMM D, YYYY') : ''},
    {key: 'status', label: 'Status', sortable: true, sortKey: 'expiryDate', width: '120px', render: (row) => {
        const cs = getComplianceStatus(row.expiryDate);
        return <Badge size="sm" tt="none" color={cs.color}>{cs.status}</Badge>;
    }},
    {key: 'daysUntil', label: 'Days Until Expiry', sortable: true, sortKey: 'expiryDate', width: '140px', render: (row) => {
        const cs = getComplianceStatus(row.expiryDate);
        return <Badge size="sm" tt="none" color={cs.color}>{formatDaysUntil(cs.daysUntil)}</Badge>;
    }},
    {key: 'actions', label: 'Actions', width: '80px', align: 'center', render: () => null},
];

export const DriverComplianceTab: React.FC<DriverComplianceTabProps> = ({showToast, fleetOptions}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'code', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [filters, setFilters] = useState<ComplianceFilter>({type: 'all', status: 'all', fleet: 0});
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [sort, setSort] = useState<SortState>({column: 'code', direction: 'asc'});

    const {data, isLoading} = useComplianceList(query, filters);
    const sendReminder = useSendComplianceReminder();
    const sendBulk = useSendBulkComplianceReminders();

    const items = data?.items ?? [];
    const stats = {
        expired: data?.totalExpired ?? 0,
        expiring: data?.totalExpiringSoon ?? 0,
        valid: data?.totalValid ?? 0,
        totalDrivers: data?.total ?? 0,
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const handleSendReminder = async (item: CourierCompliance) => {
        try {
            await sendReminder.mutateAsync(item);
            showToast(`Reminder sent to ${item.name}`, 'success');
        } catch {
            showToast('Failed to send reminder', 'error');
        }
    };

    const remindableItems = items.filter(item => {
        const {daysUntil} = getComplianceStatus(item.expiryDate);
        return daysUntil <= 30 && daysUntil >= -30;
    });

    const handleOpenBulkDialog = () => {
        if (remindableItems.length === 0) {
            showToast('No drivers need reminders at this time', 'info');
            return;
        }
        setBulkDialogOpen(true);
    };

    const handleBulkReminders = async () => {
        setBulkDialogOpen(false);
        try {
            await sendBulk.mutateAsync(remindableItems);
            showToast(`Reminders sent to ${remindableItems.length} driver(s)`, 'success');
        } catch {
            showToast('Failed to send reminders', 'error');
        }
    };

    const activeFilterCount =
        (filters.type !== 'all' ? 1 : 0)
        + (filters.status !== 'all' ? 1 : 0)
        + (filters.fleet ? 1 : 0);

    const handleClearFilters = () => {
        setFilters(f => ({...f, type: 'all', status: 'all', fleet: 0}));
        setQuery(q => ({...q, page: 1}));
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportComplianceCsv(query, filters);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    // Override the actions column render to include the reminder button with closure access
    const columnsWithActions: DataTableColumn<CourierCompliance>[] = columns.map(col =>
        col.key === 'actions'
            ? {...col, render: (row: CourierCompliance) => (
                <Tooltip label="Send reminder">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Send reminder"
                        onClick={(e) => {
                            e.stopPropagation();
                            return handleSendReminder(row);
                        }}
                    >
                        <Icon lucide={Mail} size={16}/>
                    </ActionIcon>
                </Tooltip>
            )}
            : col
    );

    return (
        <Stack gap={16}>
            {/* Stats */}
            <Group gap={16}>
                <StatCard value={stats.expired} label="Expired" color="var(--mantine-color-red-6)" icon={<Icon lucide={CircleAlert} size={28} color="var(--mantine-color-red-6)"/>} />
                <StatCard value={stats.expiring} label="Expiring Soon" color="var(--mantine-color-yellow-6)" icon={<Icon lucide={TriangleAlert} size={28} color="var(--mantine-color-yellow-6)"/>} />
                <StatCard value={stats.valid} label="Valid" color="var(--mantine-color-green-6)" icon={<Icon lucide={CircleCheck} size={28} color="var(--mantine-color-green-6)"/>} />
                <StatCard value={stats.totalDrivers} label="Total Drivers" color="var(--mantine-color-cyan-6)" icon={<Icon lucide={Users} size={28} color="var(--mantine-color-cyan-6)"/>} />
            </Group>

            {/* AI Compliance Risk Summary */}
            {isAiEnabled() && (
                <AiSummaryCard
                    title="Auto-mate Compliance Risk Summary"
                    fetchSummary={(signal) => summarizeCompliance({signal})}
                />
            )}

            {/* Filters */}
            <FilterToolbar
                activeFilterCount={activeFilterCount}
                onClearAll={handleClearFilters}
                actions={
                    <>
                        <Button
                            size="compact-sm"
                            h={FILTER_CONTROL_HEIGHT}
                            leftSection={<Icon lucide={Send} size={16}/>}
                            onClick={handleOpenBulkDialog}
                        >
                            Send reminders
                        </Button>
                        <HeaderActionIcon label="Export CSV" onClick={handleExport}>
                            <Icon lucide={Download} size={PANEL_CONTROL_GLYPH_SIZE}/>
                        </HeaderActionIcon>
                    </>
                }
            >
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.type !== 'all' ? 1 : 0}>Type</GroupLabel>
                    <Select
                        size="xs"
                        aria-label="Type"
                        miw={150}
                        allowDeselect={false}
                        styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                        value={filters.type}
                        onChange={(value) => {
                            setFilters(f => ({...f, type: value ?? 'all'}));
                            setQuery(q => ({...q, page: 1}));
                        }}
                        data={[
                            {value: 'all', label: 'All types'},
                            {value: 'drivers_license', label: "Driver's licence"},
                            {value: 'dg_endorsement', label: 'DG endorsement'},
                            {value: 'insurance', label: 'Insurance'},
                            {value: 'vehicle_wof', label: 'Vehicle WOF'},
                            {value: 'vehicle_rego', label: 'Vehicle registration'},
                        ]}
                    />
                </Stack>
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
                    placeholder="Search compliance..."
                />
            </FilterToolbar>

            {/* Table */}
            <DataTable<CourierCompliance>
                totalCount={data?.total ?? 0}
                rows={items}
                columns={columnsWithActions}
                rowKey={(_, idx) => idx}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                emptyIcon={<Icon lucide={ShieldCheck} size={40}/>}
                emptyTitle="No Compliance Records"
                emptyMessage="No compliance records match your criteria."
            />

            {/* Bulk Reminders Confirmation Dialog */}
            {/* A raw MUI <Dialog> before; composed from the shared Mantine
                primitives per CLAUDE.md. */}
            <DialogShell
                opened={bulkDialogOpen}
                onClose={() => setBulkDialogOpen(false)}
                size={dialogSize.sm}
                label="Send bulk reminders"
            >
                <DialogHeader
                    icon={<Icon lucide={Send}/>}
                    title="Send bulk reminders"
                    subtitle="Drivers with expiring or expired compliance items"
                    onClose={() => setBulkDialogOpen(false)}
                />
                <Box p={24} bg={dialogContentBg}>
                    <Text>
                        Send a reminder email to <strong>{remindableItems.length}</strong>{' '}
                        {remindableItems.length === 1 ? 'driver' : 'drivers'}?
                    </Text>
                </Box>
                <DialogFooter
                    onCancel={() => setBulkDialogOpen(false)}
                    onConfirm={handleBulkReminders}
                    confirmLabel="Send reminders"
                    confirmIcon={<Icon lucide={Send}/>}
                />
            </DialogShell>
        </Stack>
    );
};
