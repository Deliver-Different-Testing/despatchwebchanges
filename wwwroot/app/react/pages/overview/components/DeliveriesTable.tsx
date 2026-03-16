import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import type {OverviewTableParentJob, TableSort} from '../OverviewPage.interfaces';

interface DeliveriesTableProps {
    deliveries: OverviewTableParentJob[];
    isLoading: boolean;
    sort: TableSort;
    onSort: (sort: TableSort) => void;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    onShowMap: (delivery: OverviewTableParentJob) => void;
    onOpenJobDetail: (delivery: OverviewTableParentJob) => void;
    onToggleExpand: (jobId: number) => void;
}

const COLUMNS = [
    {key: 'expand', label: '', sortable: false, width: '48px'},
    {key: 'jobName', label: 'Job Number', sortable: true},
    {key: 'status', label: 'Status', sortable: true},
    {key: 'completion', label: 'Completion', sortable: true},
    {key: 'pickup', label: 'Pickup', sortable: true},
    {key: 'delivery', label: 'Delivery', sortable: true},
    {key: 'driver', label: 'Driver', sortable: true},
    {key: 'region', label: 'Region', sortable: true},
    {key: 'actions', label: 'Actions', sortable: false},
];

const STATUS_COLORS: Record<string, {bg: string; color?: string}> = {
    NEW: {bg: '#BFDBFE'},
    PREASSIGNED: {bg: '#BFDBFE'},
    DESPATCHED: {bg: '#BBF7D0'},
    ACCEPTED: {bg: '#BBF7D0'},
    PICKED_UP: {bg: '#86EFAC'},
    IN_TRANSIT: {bg: '#86EFAC'},
    OUT_FOR_DELIVERY: {bg: '#86EFAC'},
    REJECTED: {bg: '#FCA5A5'},
    LATE_PICKUP: {bg: '#FCA5A5'},
    LATE_DELIVERY: {bg: '#FCA5A5'},
    WARNING: {bg: '#FCA5A5'},
    UNDELIVERABLE: {bg: '#DC2626', color: '#fff'},
    COMPLETED: {bg: '#9CA3AF', color: '#fff'},
    AWAITING_POD: {bg: '#9CA3AF', color: '#fff'},
    ASSUMING_COMPLETED: {bg: '#9CA3AF', color: '#fff'},
};

function getStatusChipStyle(status: string) {
    const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
    return STATUS_COLORS[normalized] ?? {bg: '#E5E7EB'};
}

function getProgressColor(completion: number): string {
    if (completion < 30) return '#4CAF50';
    if (completion < 70) return '#86EFAC';
    return '#9CA3AF';
}

function transformStatus(status: string): string {
    return status.toUpperCase().replace(/[\s-]/g, '_');
}

const StatusChip: React.FC<{status: string}> = ({status}) => {
    const display = transformStatus(status);
    const style = getStatusChipStyle(display);
    return (
        <Chip
            label={display}
            size="small"
            sx={{
                bgcolor: style.bg,
                color: style.color ?? 'rgba(0,0,0,0.87)',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 24,
            }}
        />
    );
};

const ProgressBar: React.FC<{value: number}> = ({value}) => (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, minWidth: 100}}>
        <LinearProgress
            variant="determinate"
            value={value}
            sx={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {bgcolor: getProgressColor(value)},
            }}
        />
        <Typography variant="caption" sx={{minWidth: 32, textAlign: 'right'}}>
            {value}%
        </Typography>
    </Box>
);

export const DeliveriesTable: React.FC<DeliveriesTableProps> = ({
    deliveries,
    isLoading,
    sort,
    onSort,
    page,
    limit,
    total,
    onPageChange,
    onLimitChange,
    onShowMap,
    onOpenJobDetail,
    onToggleExpand,
}) => {
    const handleSort = (columnKey: string) => {
        const newDirection = sort.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc';
        onSort({column: columnKey, direction: newDirection});
    };

    const getSortIcon = (columnKey: string): string => {
        if (sort.column !== columnKey) return 'unfold_more';
        return sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
    };

    return (
        <Box sx={{position: 'relative'}}>
            {/* Loading overlay */}
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(255,255,255,0.7)',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <CircularProgress size={40} />
                </Box>
            )}

            {/* Table */}
            <Box sx={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            {COLUMNS.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        fontWeight: 500,
                                        fontSize: '0.75rem',
                                        color: 'rgba(0,0,0,0.54)',
                                        borderBottom: '1px solid rgba(0,0,0,0.12)',
                                        cursor: col.sortable ? 'pointer' : 'default',
                                        width: col.width,
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                        }}
                                    >
                                        {col.label}
                                        {col.sortable && (
                                            <span
                                                className="material-symbols-outlined"
                                                style={{
                                                    fontSize: 16,
                                                    opacity: sort.column === col.key ? 1 : 0.4,
                                                }}
                                            >
                                                {getSortIcon(col.key)}
                                            </span>
                                        )}
                                    </Box>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {deliveries.map((delivery) => (
                            <React.Fragment key={delivery.jobId}>
                                {/* Parent row */}
                                <tr
                                    style={{
                                        height: 48,
                                        borderBottom: '1px solid rgba(0,0,0,0.12)',
                                    }}
                                >
                                    <td style={{padding: '8px 16px', verticalAlign: 'middle'}}>
                                        {delivery.childJobs?.length > 0 && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onToggleExpand(delivery.jobId)}
                                            >
                                                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                    {delivery.expanded ? 'expand_more' : 'chevron_right'}
                                                </span>
                                            </IconButton>
                                        )}
                                    </td>
                                    <td style={{padding: '8px 16px', fontSize: '0.8125rem', verticalAlign: 'middle'}}>
                                        {delivery.jobName}
                                    </td>
                                    <td style={{padding: '8px 16px', verticalAlign: 'middle'}}>
                                        <StatusChip status={delivery.status} />
                                    </td>
                                    <td style={{padding: '8px 16px', verticalAlign: 'middle'}}>
                                        <ProgressBar value={delivery.completion} />
                                    </td>
                                    <td style={{padding: '8px 16px', fontSize: '0.8125rem', verticalAlign: 'middle'}}>
                                        {delivery.pickup}
                                    </td>
                                    <td style={{padding: '8px 16px', fontSize: '0.8125rem', verticalAlign: 'middle'}}>
                                        {delivery.delivery}
                                    </td>
                                    <td style={{padding: '8px 16px', fontSize: '0.8125rem', verticalAlign: 'middle'}}>
                                        {delivery.driver}
                                    </td>
                                    <td style={{padding: '8px 16px', fontSize: '0.8125rem', verticalAlign: 'middle'}}>
                                        {delivery.region}
                                    </td>
                                    <td style={{padding: '8px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle'}}>
                                        <Tooltip title="Open Map">
                                            <IconButton
                                                size="small"
                                                onClick={() => onShowMap(delivery)}
                                            >
                                                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                    map
                                                </span>
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="View Job Details">
                                            <IconButton
                                                size="small"
                                                onClick={() => onOpenJobDetail(delivery)}
                                            >
                                                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                    visibility
                                                </span>
                                            </IconButton>
                                        </Tooltip>
                                    </td>
                                </tr>

                                {/* Child rows */}
                                {delivery.expanded &&
                                    delivery.childJobs?.map((child) => (
                                        <tr
                                            key={child.jobId}
                                            style={{
                                                borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                backgroundColor: 'rgba(0,0,0,0.02)',
                                            }}
                                        >
                                            <td style={{padding: '10px 16px', verticalAlign: 'middle'}} />
                                            <td style={{padding: '10px 16px', fontSize: '0.875rem', verticalAlign: 'middle'}}>
                                                {child.jobName}
                                            </td>
                                            <td style={{padding: '10px 16px', verticalAlign: 'middle'}}>
                                                <StatusChip status={child.status} />
                                            </td>
                                            <td style={{padding: '10px 16px', verticalAlign: 'middle'}}>
                                                <ProgressBar value={child.completion} />
                                            </td>
                                            <td style={{padding: '10px 16px', fontSize: '0.875rem', verticalAlign: 'middle'}}>
                                                {child.pickup}
                                            </td>
                                            <td style={{padding: '10px 16px', fontSize: '0.875rem', verticalAlign: 'middle'}}>
                                                {child.delivery}
                                            </td>
                                            <td style={{padding: '10px 16px', fontSize: '0.875rem', verticalAlign: 'middle'}}>
                                                {child.driver}
                                            </td>
                                            <td style={{padding: '10px 16px', fontSize: '0.875rem', verticalAlign: 'middle'}}>
                                                {child.region}
                                            </td>
                                            <td style={{padding: '10px 16px', verticalAlign: 'middle'}} />
                                        </tr>
                                    ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </Box>

            {/* Empty state */}
            {deliveries.length === 0 && !isLoading && (
                <Box sx={{textAlign: 'center', py: 6}}>
                    <span
                        className="material-symbols-outlined"
                        style={{fontSize: 48, color: 'rgba(0,0,0,0.26)', display: 'block'}}
                    >
                        local_shipping
                    </span>
                    <Typography variant="body1" color="text.secondary" sx={{mt: 1}}>
                        No deliveries found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Try adjusting your filters or date range.
                    </Typography>
                </Box>
            )}

            {/* Pagination */}
            {total > 0 && (
                <TablePagination
                    component="div"
                    size="small"
                    count={total}
                    page={page - 1}
                    onPageChange={(_e, newPage) => onPageChange(newPage + 1)}
                    rowsPerPage={limit}
                    onRowsPerPageChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
                    rowsPerPageOptions={[10, 20, 30, 50]}
                    sx={{
                        borderTop: '1px solid rgba(0,0,0,0.12)',
                        '& .MuiTablePagination-toolbar': {
                            minHeight: 40,
                            px: 1,
                            alignItems: 'center',
                        },
                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                            fontSize: '0.8125rem',
                            m: 0,
                        },
                        '& .MuiTablePagination-select': {
                            fontSize: '0.8125rem',
                        },
                        '& .MuiTablePagination-input': {
                            m: 0,
                            mr: 2,
                        },
                    }}
                />
            )}
        </Box>
    );
};

export default DeliveriesTable;
