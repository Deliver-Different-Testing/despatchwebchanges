/**
 * Recurring Jobs Table Component
 *
 * Data table with sorting, pagination, and row selection for recurring jobs.
 */

import React, {useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import {AddressViewModel, PrebookListModel, RecurringJobColumn, RecurringJobSort,} from '../../../interfaces';

export interface RecurringJobsTableProps {
    jobs: PrebookListModel[];
    isLoading: boolean;
    totalCount: number;
    page: number;
    pageSize: number;
    sort: RecurringJobSort;
    selectedJobId: number | null;
    isUsCustomer: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onSortChange: (sort: RecurringJobSort) => void;
    onRowClick: (job: PrebookListModel) => void;
    onDeleteClick: (job: PrebookListModel) => void;
    onContextMenu: (event: React.MouseEvent, job: PrebookListModel) => void;
}

const columns: RecurringJobColumn[] = [
    {key: 'booked', label: 'Booked', sortable: true, width: '110px'},
    {key: 'speed', label: 'Speed', sortable: true, width: '80px'},
    {key: 'customJobName', label: 'Job Name', sortable: true},
    {key: 'client', label: 'Client', sortable: true},
    {key: 'from', label: 'From', sortable: true},
    {key: 'to', label: 'To', sortable: true},
    {key: 'nextDueTime', label: 'Next Due', sortable: true, sortKey: 'nextDueTime', width: '110px'},
    {key: 'courier', label: 'Courier', sortable: true, width: '100px'},
    {key: 'actions', label: '', sortable: false, width: '60px', align: 'center'},
];

const pageSizeOptions = [25, 50, 100, 250];

function formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
    });
}

function formatTime(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getAddressPrimary(address: AddressViewModel | undefined): string {
    if (!address) return '';
    return address.addressLine1 || address.fullAddress?.substring(0, 30) || '';
}

function getAddressSecondary(address: AddressViewModel | undefined, isUsCustomer: boolean): string {
    if (!address) return '';
    if (isUsCustomer) {
        const parts = [address.addressLine5, address.addressLine6].filter(Boolean);
        return parts.join(', ');
    }
    return address.addressLine2 || address.addressLine3 || '';
}

function getAddressTooltip(address: AddressViewModel | undefined): string {
    if (!address) return '';
    const lines = [
        address.addressLine1,
        address.addressLine2,
        address.addressLine3,
        address.addressLine4,
        address.addressLine5,
        address.addressLine6,
        address.addressLine7,
        address.addressLine8,
    ].filter(Boolean);

    if (lines.length === 0 && address.fullAddress) {
        return address.fullAddress;
    }
    return lines.join('\n');
}

export const RecurringJobsTable: React.FC<RecurringJobsTableProps> = ({
                                                                          jobs,
                                                                          isLoading,
                                                                          totalCount,
                                                                          page,
                                                                          pageSize,
                                                                          sort,
                                                                          selectedJobId,
                                                                          isUsCustomer,
                                                                          onPageChange,
                                                                          onPageSizeChange,
                                                                          onSortChange,
                                                                          onRowClick,
                                                                          onDeleteClick,
                                                                          onContextMenu,
                                                                      }) => {
    const handleSortClick = useCallback(
        (column: string) => {
            const isAsc = sort.column === column && sort.direction === 'asc';
            onSortChange({
                column,
                direction: isAsc ? 'desc' : 'asc',
            });
        },
        [sort, onSortChange]
    );

    const handlePageChange = useCallback(
        (_event: unknown, newPage: number) => {
            onPageChange(newPage + 1); // MUI pagination is 0-indexed
        },
        [onPageChange]
    );

    const handleRowsPerPageChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onPageSizeChange(parseInt(event.target.value, 10));
        },
        [onPageSizeChange]
    );

    const renderCellContent = (job: PrebookListModel, column: RecurringJobColumn) => {
        switch (column.key) {
            case 'booked':
                return (
                    <Box>
                        <Typography variant="body2" noWrap>
                            {formatDate(job.booked)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {formatTime(job.booked)}
                        </Typography>
                    </Box>
                );
            case 'speed':
                return (
                    <Typography variant="body2" noWrap>
                        {job.speed}
                    </Typography>
                );
            case 'customJobName':
                return (
                    <Tooltip title={job.customJobName || ''} placement="top">
                        <Typography variant="body2" noWrap sx={{maxWidth: 150}}>
                            {job.customJobName || '-'}
                        </Typography>
                    </Tooltip>
                );
            case 'client':
                return (
                    <Typography variant="body2" noWrap>
                        {job.client}
                    </Typography>
                );
            case 'from':
                return (
                    <Tooltip title={getAddressTooltip(job.pickupAddress)} placement="top">
                        <Box>
                            <Typography variant="body2" noWrap sx={{maxWidth: 150}}>
                                {getAddressPrimary(job.pickupAddress)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{maxWidth: 150}}>
                                {getAddressSecondary(job.pickupAddress, isUsCustomer)}
                            </Typography>
                        </Box>
                    </Tooltip>
                );
            case 'to':
                return (
                    <Tooltip title={getAddressTooltip(job.deliveryAddress)} placement="top">
                        <Box>
                            <Typography variant="body2" noWrap sx={{maxWidth: 150}}>
                                {getAddressPrimary(job.deliveryAddress)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{maxWidth: 150}}>
                                {getAddressSecondary(job.deliveryAddress, isUsCustomer)}
                            </Typography>
                        </Box>
                    </Tooltip>
                );
            case 'nextDueTime':
                return (
                    <Box>
                        <Typography variant="body2" noWrap>
                            {formatDate(job.nextDueTime)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {formatTime(job.nextDueTime)}
                        </Typography>
                    </Box>
                );
            case 'courier':
                return (
                    <Typography variant="body2" noWrap>
                        {job.courier || '-'}
                    </Typography>
                );
            case 'actions':
                return (
                    <Tooltip title="Inactivate job">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(job);
                            }}
                            sx={{
                                color: 'text.secondary',
                                '&:hover': {color: 'error.main'},
                            }}
                        >
                            <DeleteIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                );
            default:
                return null;
        }
    };

    return (
        <Paper elevation={0} sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            <TableContainer sx={{flex: 1, overflow: 'auto'}}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.key}
                                    align={column.align || 'left'}
                                    sx={{
                                        width: column.width,
                                        fontWeight: 600,
                                        bgcolor: 'grey.100',
                                        borderBottom: 2,
                                        borderColor: 'grey.300',
                                    }}
                                >
                                    {column.sortable ? (
                                        <TableSortLabel
                                            active={sort.column === column.key}
                                            direction={sort.column === column.key ? sort.direction : 'asc'}
                                            onClick={() => handleSortClick(column.sortKey || column.key)}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    ) : (
                                        column.label
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center" sx={{py: 8}}>
                                    <CircularProgress size={32}/>
                                    <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
                                        Loading recurring jobs...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : jobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center" sx={{py: 8}}>
                                    <EventRepeatIcon sx={{fontSize: 48, color: 'text.disabled', mb: 1}}/>
                                    <Typography variant="body1" color="text.secondary">
                                        No recurring jobs available
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            jobs.map((job) => (
                                <TableRow
                                    key={job.id}
                                    hover
                                    selected={selectedJobId === job.id}
                                    onClick={() => onRowClick(job)}
                                    onContextMenu={(e) => onContextMenu(e, job)}
                                    sx={(theme) => ({
                                        cursor: 'pointer',
                                        '&.Mui-selected': {
                                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        },
                                        '&.Mui-selected:hover': {
                                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                                        },
                                    })}
                                >
                                    {columns.map((column) => (
                                        <TableCell
                                            key={column.key}
                                            align={column.align || 'left'}
                                            sx={{py: 1}}
                                        >
                                            {renderCellContent(job, column)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={totalCount}
                page={page - 1} // MUI pagination is 0-indexed
                rowsPerPage={pageSize}
                rowsPerPageOptions={pageSizeOptions}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                sx={{
                    borderTop: 1,
                    borderColor: 'divider',
                    '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                        mb: 0,
                    },
                }}
            />
        </Paper>
    );
};

export default RecurringJobsTable;
