import {pluralise} from '../../../utils/pluralise';
import React, {useMemo, useState} from 'react';
import {useComplianceList, useComplianceReminderPreview, useSendComplianceReminders} from '../../../hooks/useDriverManagementApi';
import {
    ComplianceFilter,
    ComplianceReminderChannel,
    ComplianceReminderResult,
    CourierCompliance,
    FleetOption,
    PaginatedRequest,
} from '../../../types';
import {driverManagementApi} from '../../../api/driverManagementApi';
import {summarizeCompliance} from '../../../api/aiAssistantApi';
import {AiSummaryCard} from '../../../components/common/ai-summary-card/AiSummaryCard';
import {isAiEnabled} from '../../../utils/aiSettings';
import {
    DataTable,
    DataTableColumn,
    FilterToolbar,
    getComplianceTypeColor,
    ListEmptyState,
    SortState,
    StatCard,
} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';
import {ExportCsvAction, filterUpdater, FilterSelect, FleetFilter, QuerySearchField} from './DriverFilterControls';
import {dataTablePagingProps} from './dataTablePaging';
import {ActionIcon, Alert, Badge, Button, Group, Loader, SegmentedControl, Stack, Text, Tooltip} from '@mantine/core';
import {CircleAlert, CircleCheck, CircleHelp, Mail, Send, ShieldCheck, TriangleAlert} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {FILTER_CONTROL_HEIGHT} from '../../../components/common/filter-fields';
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

const DEFAULT_FILTERS: ComplianceFilter = {type: '', status: 'attention', fleet: 0};

/** Mantine palette keys — see chipColors for why these are not the tenant brand. */
const STATUS_COLORS: Record<CourierCompliance['status'], string> = {
    'Expired': 'red',
    'Expiring soon': 'yellow',
    'Valid': 'green',
    'Not set': 'gray',
};

function formatDaysUntil(days: number | null): string {
    if (days === null) return '—';
    if (days === 0) return 'Today';
    if (days < 0) return `${Math.abs(days)} ${pluralise(Math.abs(days), 'day')} overdue`;
    return `${days} ${pluralise(days, 'day')}`;
}

const MAX_FAILURE_NAMES = 3;

function describeFailures({failed, failures}: ComplianceReminderResult): string {
    const named = failures.slice(0, MAX_FAILURE_NAMES).map(f => `${f.name} (${f.reason})`).join(', ');
    const more = failures.length - MAX_FAILURE_NAMES;
    return `${failed} couldn't be sent: ${named}${more > 0 ? ` and ${more} more` : ''}`;
}

type ReminderTarget = {kind: 'row'; row: CourierCompliance} | {kind: 'bulk'};

const columns: DataTableColumn<CourierCompliance>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none">{row.code}</Badge>},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'complianceType', label: 'Type', sortable: true, render: (row) => <Badge size="sm" tt="none" color={getComplianceTypeColor(row.complianceType)}>{row.complianceType}</Badge>},
    {key: 'expiryDate', label: 'Expiry date', sortable: true, width: '120px', render: (row) => row.expiryDate ? dayjs(row.expiryDate).format('MMM D, YYYY') : ''},
    {key: 'status', label: 'Status', sortable: true, width: '120px', render: (row) => <Badge size="sm" tt="none" color={STATUS_COLORS[row.status] ?? 'gray'}>{row.status}</Badge>},
    {key: 'daysUntilExpiry', label: 'Days until expiry', sortable: true, width: '140px', render: (row) => <Badge size="sm" tt="none" color={STATUS_COLORS[row.status] ?? 'gray'}>{formatDaysUntil(row.daysUntilExpiry)}</Badge>},
    {key: 'actions', label: 'Actions', width: '80px', align: 'center', render: () => null},
];

export const DriverComplianceTab: React.FC<DriverComplianceTabProps> = ({showToast, fleetOptions}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: '', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [filters, setFilters] = useState<ComplianceFilter>(DEFAULT_FILTERS);
    const updateFilters = filterUpdater(setFilters, setQuery);
    const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
    const [channel, setChannel] = useState<ComplianceReminderChannel>(1);
    const [sort, setSort] = useState<SortState>({column: '', direction: 'asc'});

    const {data, isLoading, isError, refetch} = useComplianceList(query, filters);
    const sendReminders = useSendComplianceReminders();

    const items = isError ? [] : data?.items ?? [];
    const stats = {
        expired: data?.totalExpired ?? 0,
        expiring: data?.totalExpiringSoon ?? 0,
        notSet: data?.totalNotSet ?? 0,
        valid: data?.totalValid ?? 0,
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const openReminderDialog = (target: ReminderTarget) => {
        setChannel(1);
        setReminderTarget(target);
    };

    const previewTarget = useMemo(() => {
        if (!reminderTarget) return null;
        return reminderTarget.kind === 'row'
            ? {courierIds: [reminderTarget.row.courierId]}
            : {filter: {searchTerm: query.searchTerm ?? '', fleet: filters.fleet, type: filters.type, status: filters.status}};
    }, [reminderTarget, query.searchTerm, filters.fleet, filters.type, filters.status]);
    const preview = useComplianceReminderPreview(previewTarget);
    const previewResult = preview.data;
    const overLimit = !!previewResult && previewResult.recipients > previewResult.maxRecipients;
    const canSend = !!previewResult && previewResult.recipients > 0 && !overLimit;

    const handleConfirmReminders = async () => {
        if (!previewTarget || !canSend || sendReminders.isPending) return;
        try {
            const result = await sendReminders.mutateAsync({...previewTarget, channel});
            setReminderTarget(null);
            showToast(`Reminders sent to ${result.sent} ${pluralise(result.sent, 'driver')}`, 'success');
            if (result.failed > 0) showToast(describeFailures(result), 'warning');
        } catch (error) {
            const apiError = error as {status?: number; message?: string};
            showToast(
                apiError.status === 400 && apiError.message
                    ? apiError.message
                    : "Couldn't send the reminders. Check your connection and try again.",
                'error'
            );
        }
    };

    const activeFilterCount =
        (filters.type !== DEFAULT_FILTERS.type ? 1 : 0)
        + (filters.status !== DEFAULT_FILTERS.status ? 1 : 0)
        + (filters.fleet ? 1 : 0);
    const isFiltered = activeFilterCount > 0 || !!query.searchTerm;

    const handleClearFilters = () => {
        setFilters(DEFAULT_FILTERS);
        setQuery(q => ({...q, searchTerm: '', page: 1}));
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportComplianceCsv(query, filters);
        } catch {
            showToast("Couldn't export the data. Try again.", 'error');
        }
    };

    // Override the actions column render to include the reminder button with closure access
    const columnsWithActions: DataTableColumn<CourierCompliance>[] = columns.map(col =>
        col.key === 'actions'
            ? {...col, render: (row: CourierCompliance) => (
                <Tooltip label={row.status === 'Valid' ? 'Nothing due' : 'Send reminder'}>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Send reminder"
                        disabled={row.status === 'Valid'}
                        onClick={(e) => {
                            e.stopPropagation();
                            openReminderDialog({kind: 'row', row});
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
                <StatCard value={stats.expiring} label="Expiring soon" color="var(--mantine-color-yellow-6)" icon={<Icon lucide={TriangleAlert} size={28} color="var(--mantine-color-yellow-6)"/>} />
                <StatCard value={stats.notSet} label="Not set" color="var(--mantine-color-gray-6)" icon={<Icon lucide={CircleHelp} size={28} color="var(--mantine-color-gray-6)"/>} />
                <StatCard value={stats.valid} label="Valid" color="var(--mantine-color-green-6)" icon={<Icon lucide={CircleCheck} size={28} color="var(--mantine-color-green-6)"/>} />
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
                            onClick={() => openReminderDialog({kind: 'bulk'})}
                        >
                            Send reminders
                        </Button>
                        <ExportCsvAction onClick={handleExport}/>
                    </>
                }
            >
                <FilterSelect
                    label="Type"
                    selected={filters.type !== DEFAULT_FILTERS.type}
                    value={filters.type}
                    onChange={(value) => updateFilters({type: (value ?? '') as ComplianceFilter['type']})}
                    data={[
                        {value: '', label: 'All types'},
                        {value: 'drivers_license', label: 'Driver licence'},
                        {value: 'dg_endorsement', label: 'DG endorsement'},
                        {value: 'wof', label: 'WOF'},
                        {value: 'registration', label: 'Registration'},
                    ]}
                />
                <FilterSelect
                    label="Status"
                    selected={filters.status !== DEFAULT_FILTERS.status}
                    value={filters.status}
                    onChange={(value) => updateFilters({status: (value ?? '') as ComplianceFilter['status']})}
                    data={[
                        {value: 'attention', label: 'Needs attention'},
                        {value: 'expired', label: 'Expired'},
                        {value: 'expiring', label: 'Expiring soon'},
                        {value: 'not_set', label: 'Not set'},
                        {value: 'valid', label: 'Valid'},
                        {value: '', label: 'All statuses'},
                    ]}
                />
                <FleetFilter
                    fleet={filters.fleet}
                    fleetOptions={fleetOptions}
                    onChange={(fleet) => updateFilters({fleet})}
                />
                <QuerySearchField query={query} setQuery={setQuery} placeholder="Search compliance…"/>
            </FilterToolbar>

            {/* Table */}
            <DataTable<CourierCompliance>
                totalCount={isError ? 0 : data?.total ?? 0}
                rows={items}
                columns={columnsWithActions}
                rowKey={(row) => `${row.courierId}-${row.complianceTypeKey}`}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                emptyContent={
                    <ListEmptyState
                        noun="compliance items"
                        isError={isError}
                        onRetry={() => refetch()}
                        isFiltered={isFiltered}
                        onClearFilters={handleClearFilters}
                        emptyIcon={<Icon lucide={ShieldCheck} size={40}/>}
                        emptyTitle="Nothing needs attention"
                        emptyMessage="No expired, expiring or missing compliance items."
                    />
                }
            />

            <DialogShell
                opened={reminderTarget !== null}
                onClose={() => { if (!sendReminders.isPending) setReminderTarget(null); }}
                size={dialogSize.sm}
                label="Send compliance reminders"
            >
                <DialogHeader
                    icon={<Icon lucide={Send}/>}
                    title="Send compliance reminders"
                    subtitle="Remind drivers to update their compliance items"
                    onClose={() => setReminderTarget(null)}
                />
                <Stack p={24} gap={16} bg={dialogContentBg}>
                    {preview.isLoading && <Loader size="sm" aria-label="Checking who will get a reminder"/>}
                    {preview.isError && (
                        <Group gap={8}>
                            <Text fz="sm" c="red">Couldn&apos;t check who will get a reminder.</Text>
                            <Button size="compact-sm" variant="subtle" onClick={() => preview.refetch()}>Try again</Button>
                        </Group>
                    )}
                    {previewResult && !overLimit && (
                        <Text>
                            {previewResult.recipients === 0
                                ? 'No one in these filters needs a reminder.'
                                : reminderTarget?.kind === 'row'
                                    ? <><strong>{reminderTarget.row.name}</strong> will get a reminder about everything that needs renewing.</>
                                    : `${previewResult.recipients} ${pluralise(previewResult.recipients, 'driver')} will get a reminder about the items you've filtered to.`}
                        </Text>
                    )}
                    {previewResult && overLimit && (
                        <Alert color="yellow" icon={<Icon lucide={TriangleAlert}/>}>
                            That&apos;s {previewResult.recipients} drivers. Narrow the filters to {previewResult.maxRecipients} or fewer.
                        </Alert>
                    )}
                    <Stack gap={4}>
                        <Text fz="sm" fw={500}>Send via</Text>
                        <SegmentedControl
                            aria-label="Reminder channel"
                            value={String(channel)}
                            onChange={(value) => setChannel(Number(value) as ComplianceReminderChannel)}
                            disabled={sendReminders.isPending}
                            data={[
                                {value: '1', label: 'Driver app'},
                                {value: '2', label: 'SMS'},
                            ]}
                        />
                    </Stack>
                </Stack>
                <DialogFooter
                    onCancel={() => setReminderTarget(null)}
                    onConfirm={handleConfirmReminders}
                    confirmDisabled={!canSend}
                    submitting={sendReminders.isPending}
                    confirmLabel="Send reminders"
                    confirmIcon={<Icon lucide={Send}/>}
                />
            </DialogShell>
        </Stack>
    );
};
