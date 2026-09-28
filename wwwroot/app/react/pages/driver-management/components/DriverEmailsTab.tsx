import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import {useDriverEmails, useSendEmailToCouriers} from '../../../hooks/useDriverManagementApi';
import {DriverEmail, GroupEmailData, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {
    DataTable,
    DataTableColumn,
    FilterToolbar,
    getFleetChipSx,
    SearchField,
    SortState,
    toolbarButtonSx,
    toolbarIconButtonSx
} from './shared';
import type {ShowToastFn} from '../../../services/toastService';

interface DriverEmailsTabProps {
    showToast: ShowToastFn;
}

const columns: DataTableColumn<DriverEmail>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Chip label={row.code} size="small" color="primary" variant="outlined" />},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'email', label: 'Email', sortable: true, render: (row) => row.email},
    {key: 'phone', label: 'Phone', sortable: true, render: (row) => row.phone},
    {key: 'fleet', label: 'Fleet', sortable: true, render: (row) => <Chip label={row.fleet} size="small" variant="outlined" sx={getFleetChipSx(row.fleet)} />},
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
                <Tooltip title="Send Email">
                    <IconButton size="small" onClick={async (e) => {
                        e.stopPropagation();
                        await handleSingleEmail(row);
                    }}>
                        <EmailIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
            : col
    );

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Filters */}
            <FilterToolbar
                actions={
                    <>
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<EmailIcon />}
                            onClick={handleComposeEmail}
                            sx={toolbarButtonSx}
                        >
                            Compose Email {selectedIds.size > 0 && `(${selectedIds.size})`}
                        </Button>
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
                page={query.page || 1}
                pageSize={query.pageSize}
                onPageChange={(p) => setQuery(q => ({...q, page: p}))}
                onPageSizeChange={(ps) => setQuery(q => ({...q, pageSize: ps, page: 1}))}
                checkboxSelection
                allSelected={allSelected}
                someSelected={someSelected}
                onSelectAll={toggleSelectAll}
                renderCheckbox={(row) => (
                    <Checkbox
                        checked={selectedIds.has(row.courierId)}
                        onChange={() => toggleSelect(row.courierId)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
                isRowSelected={(row) => selectedIds.has(row.courierId)}
                emptyIcon={<ContactMailIcon />}
                emptyTitle="No Driver Emails"
                emptyMessage="No driver emails match your criteria."
            />
        </Box>
    );
};
