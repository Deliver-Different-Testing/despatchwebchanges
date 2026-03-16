import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SendIcon from '@mui/icons-material/Send';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {useComplianceList, useSendComplianceReminder, useSendBulkComplianceReminders} from '../../../hooks';
import {ComplianceFilter, CourierCompliance, FleetOption, PaginatedRequest} from '../../../interfaces';
import {driverManagementApi} from '../../../services/driverManagementApi';
import {summarizeCompliance} from '../../../services/aiAssistantApi';
import {AiSummaryPanel} from '../../../components/common/ai-summary-panel/AiSummaryPanel';
import {isAiEnabled} from '../../../../functions/aiSettings';
import {DataTable, DataTableColumn, FilterToolbar, SearchField, SortState, StatCard, toolbarButtonSx, toolbarIconButtonSx, getComplianceTypeColor} from './shared';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';

interface DriverComplianceTabProps {
    showToast: ShowToastFn;
    fleetOptions: FleetOption[];
}

function getComplianceStatus(expiryDate?: string): { status: string; color: 'error' | 'warning' | 'success' | 'default'; daysUntil: number } {
    if (!expiryDate) return {status: 'Not Set', color: 'default', daysUntil: -999};
    const today = dayjs();
    const daysUntil = dayjs(expiryDate).diff(today, 'day');
    if (daysUntil < 0) return {status: 'Expired', color: 'error', daysUntil};
    if (daysUntil <= 30) return {status: 'Expiring Soon', color: 'warning', daysUntil};
    return {status: 'Valid', color: 'success', daysUntil};
}

function formatDaysUntil(daysUntil: number): string {
    if (daysUntil === -999) return '\u2014';
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    return `${daysUntil} days`;
}


const columns: DataTableColumn<CourierCompliance>[] = [
    {key: 'code', label: 'Code', sortable: true, width: '100px', render: (row) => <Chip label={row.code} size="small" color="primary" variant="outlined" />},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'complianceType', label: 'Type', sortable: true, render: (row) => <Chip label={row.complianceType} size="small" color={getComplianceTypeColor(row.complianceType)} variant="outlined" />},
    {key: 'itemNumber', label: 'Item/Number', sortable: true, render: (row) => row.itemNumber},
    {key: 'expiryDate', label: 'Expiry Date', sortable: true, width: '120px', render: (row) => row.expiryDate ? dayjs(row.expiryDate).format('MMM D, YYYY') : ''},
    {key: 'status', label: 'Status', sortable: true, sortKey: 'expiryDate', width: '120px', render: (row) => {
        const cs = getComplianceStatus(row.expiryDate);
        return <Chip label={cs.status} size="small" color={cs.color} />;
    }},
    {key: 'daysUntil', label: 'Days Until Expiry', sortable: true, sortKey: 'expiryDate', width: '140px', render: (row) => {
        const cs = getComplianceStatus(row.expiryDate);
        return <Chip label={formatDaysUntil(cs.daysUntil)} size="small" color={cs.color} variant="outlined" />;
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
                <Tooltip title="Send Reminder">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleSendReminder(row); }}>
                        <EmailIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
            : col
    );

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Stats */}
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <StatCard value={stats.expired} label="Expired" color="error.main" icon={<ErrorOutlineIcon />} />
                <StatCard value={stats.expiring} label="Expiring Soon" color="warning.main" icon={<WarningAmberIcon />} />
                <StatCard value={stats.valid} label="Valid" color="success.main" icon={<CheckCircleIcon />} />
                <StatCard value={stats.totalDrivers} label="Total Drivers" color="info.main" icon={<PeopleAltIcon />} />
            </Box>

            {/* AI Compliance Risk Summary */}
            {isAiEnabled() && (
                <AiSummaryPanel
                    title="AI Compliance Risk Summary"
                    fetchSummary={summarizeCompliance}
                    accentColor="#e53935"
                />
            )}

            {/* Filters */}
            <FilterToolbar
                actions={
                    <>
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<SendIcon />}
                            onClick={handleOpenBulkDialog}
                            sx={toolbarButtonSx}
                        >
                            Send Reminders
                        </Button>
                        <Tooltip title="Export CSV">
                            <IconButton size="small" sx={toolbarIconButtonSx} onClick={handleExport}>
                                <DownloadIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </>
                }
            >
                <TextField select label="Type" size="small" sx={{minWidth: 150}} value={filters.type}
                    onChange={(e) => { setFilters(f => ({...f, type: e.target.value})); setQuery(q => ({...q, page: 1})); }}>
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="drivers_license">Driver's License</MenuItem>
                    <MenuItem value="dg_endorsement">DG Endorsement</MenuItem>
                    <MenuItem value="insurance">Insurance</MenuItem>
                    <MenuItem value="vehicle_wof">Vehicle WOF</MenuItem>
                    <MenuItem value="vehicle_rego">Vehicle Registration</MenuItem>
                </TextField>
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
                page={query.page || 1}
                pageSize={query.pageSize}
                onPageChange={(p) => setQuery(q => ({...q, page: p}))}
                onPageSizeChange={(ps) => setQuery(q => ({...q, pageSize: ps, page: 1}))}
                emptyIcon={<VerifiedIcon />}
                emptyTitle="No Compliance Records"
                emptyMessage="No compliance records match your criteria."
            />

            {/* Bulk Reminders Confirmation Dialog */}
            <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)}>
                <DialogTitle>Send Bulk Reminders</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Send reminder emails to {remindableItems.length} driver(s) with expiring or expired compliance items?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleBulkReminders} variant="contained" color="primary">Send</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
