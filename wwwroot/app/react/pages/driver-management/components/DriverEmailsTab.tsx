import {ActionIcon, Badge, Button, Checkbox, Stack, Tooltip} from '@mantine/core';
import React, {useState} from 'react';
import {Download, Mail} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {FILTER_CONTROL_HEIGHT} from '../../../components/common/filter-fields';
import {useDriverEmails, useSendEmailToCouriers} from '../../../hooks/useDriverManagementApi';
import {DriverEmail, GroupEmailData, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {
    DataTable,
    DataTableColumn,
    FilterToolbar,
    getFleetChipStyle,
    SearchField,
    SortState,
} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import {dataTablePagingProps} from './dataTablePaging';

interface DriverEmailsTabProps {
    showToast: ShowToastFn;
}

const columns: DataTableColumn<DriverEmail>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Badge size="sm" tt="none">{row.code}</Badge>},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'email', label: 'Email', sortable: true, render: (row) => row.email},
    {key: 'phone', label: 'Phone', sortable: true, render: (row) => row.phone},
    {key: 'fleet', label: 'Fleet', sortable: true, render: (row) => <Badge size="sm" tt="none" variant="outline" style={getFleetChipStyle(row.fleet)}>{row.fleet}</Badge>},
    {key: 'actions', label: 'Actions', width: '80px', align: 'center', render: () => null},
];

export const DriverEmailsTab: React.FC<DriverEmailsTabProps> = ({showToast}) => {
    const [query, setQuery] = useState<PaginatedRequest>({
        orderBy: 'code', pageSize: 100, page: 1, searchTerm: '', sortDescending: false,
    });
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [sort, setSort] = useState<SortState>({column: 'code', direction: 'asc'});

    const {data, isLoading} = useDriverEmails(query);
    const sendEmail = useSendEmailToCouriers();

    const items = data?.items ?? [];

    const allSelected = items.length > 0 && items.every(e => selectedIds.has(e.courierId));
    const someSelected = items.some(e => selectedIds.has(e.courierId));

    const toggleSelect = (courierId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(courierId)) next.delete(courierId);
            else next.add(courierId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(e => e.courierId)));
        }
    };

    const handleSortChange = (newSort: SortState) => {
        setSort(newSort);
        setQuery(q => ({...q, orderBy: newSort.column, sortDescending: newSort.direction === 'desc', page: 1}));
    };

    const openComposeDialog = async (recipients: DriverEmail[]) => {
        try {
            const result = await (window as unknown as Record<string, { open: (recipients: DriverEmail[]) => Promise<GroupEmailData | null> }>).ReactComposeEmailDialog?.open(recipients);
            if (!result) return;

            await sendEmail.mutateAsync(result);
            showToast(`Email${recipients.length > 1 ? 's' : ''} sent successfully`, 'success');
        } catch {
            showToast('Failed to send email', 'error');
        }
    };

    const handleComposeEmail = async () => {
        const selected = items.filter(e => selectedIds.has(e.courierId));
        if (selected.length === 0) { showToast('No recipients selected', 'warning'); return; }
        await openComposeDialog(selected);
    };

    const handleSingleEmail = async (driver: DriverEmail) => {
        await openComposeDialog([driver]);
    };

    const handleExport = async () => {
        try {
            await driverManagementApi.exportDriverEmailsCsv(query);
        } catch {
            showToast('Failed to export data', 'error');
        }
    };

    // Override actions column render
    const columnsWithActions: DataTableColumn<DriverEmail>[] = columns.map(col =>
        col.key === 'actions'
            ? {...col, render: (row: DriverEmail) => (
                <Tooltip label="Send email">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Send email"
                        onClick={async (e) => {
                            e.stopPropagation();
                            await handleSingleEmail(row);
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
            {/* Filters */}
            <FilterToolbar
                actions={
                    <>
                        <Button
                            size="compact-sm"
                            h={FILTER_CONTROL_HEIGHT}
                            leftSection={<Icon lucide={Mail} size={16}/>}
                            onClick={handleComposeEmail}
                        >
                            Compose email {selectedIds.size > 0 && `(${selectedIds.size})`}
                        </Button>
                        <HeaderActionIcon label="Export CSV" onClick={handleExport}>
                            <Icon lucide={Download} size={PANEL_CONTROL_GLYPH_SIZE}/>
                        </HeaderActionIcon>
                    </>
                }
            >
                <SearchField
                    value={query.searchTerm ?? ''}
                    onChange={(value) => setQuery(q => ({...q, searchTerm: value, page: 1}))}
                    placeholder="Search emails..."
                />
            </FilterToolbar>

            {/* Table */}
            <DataTable<DriverEmail>
                totalCount={data?.total ?? 0}
                rows={items}
                columns={columnsWithActions}
                rowKey={(row) => row.courierId}
                isLoading={isLoading}
                sort={sort}
                onSortChange={handleSortChange}
                {...dataTablePagingProps(query, setQuery)}
                checkboxSelection
                allSelected={allSelected}
                someSelected={someSelected}
                onSelectAll={toggleSelectAll}
                renderCheckbox={(row) => (
                    <Checkbox
                        size="xs"
                        checked={selectedIds.has(row.courierId)}
                        onChange={() => toggleSelect(row.courierId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${row.name}`}
                    />
                )}
                isRowSelected={(row) => selectedIds.has(row.courierId)}
                emptyIcon={<Icon lucide={Mail} size={40}/>}
                emptyTitle="No Driver Emails"
                emptyMessage="No driver emails match your criteria."
            />
        </Stack>
    );
};
