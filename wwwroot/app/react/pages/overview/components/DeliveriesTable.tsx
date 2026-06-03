import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import {alpha, useTheme, type Theme} from '@mui/material/styles';
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

type StatusStyleMap = Record<string, {bg: string; color?: string}>;

// Cache the per-theme status chip palette so we build the lookup map once per
// theme instance, not once per row. Themes are stable across the app lifetime
// (effectively one instance), so this WeakMap holds at most a handful of entries.
const STATUS_STYLE_CACHE = new WeakMap<Theme, StatusStyleMap>();

function getStatusStylesForTheme(theme: Theme): StatusStyleMap {
    const cached = STATUS_STYLE_CACHE.get(theme);
    if (cached) return cached;
    const p = theme.palette;
    const map: StatusStyleMap = {
        NEW: {bg: alpha(p.info.main, 0.25)},
        PREASSIGNED: {bg: alpha(p.info.main, 0.25)},
        DESPATCHED: {bg: alpha(p.success.main, 0.2)},
        ACCEPTED: {bg: alpha(p.success.main, 0.2)},
        PICKED_UP: {bg: alpha(p.success.main, 0.35)},
        IN_TRANSIT: {bg: alpha(p.success.main, 0.35)},
        OUT_FOR_DELIVERY: {bg: alpha(p.success.main, 0.35)},
        REJECTED: {bg: alpha(p.error.main, 0.25)},
        LATE_PICKUP: {bg: alpha(p.error.main, 0.25)},
        LATE_DELIVERY: {bg: alpha(p.error.main, 0.25)},
        WARNING: {bg: alpha(p.error.main, 0.25)},
        UNDELIVERABLE: {bg: p.error.dark, color: p.error.contrastText},
        COMPLETED: {bg: p.grey[500], color: '#fff'},
        AWAITING_POD: {bg: p.grey[500], color: '#fff'},
        ASSUMING_COMPLETED: {bg: p.grey[500], color: '#fff'},
    };
    STATUS_STYLE_CACHE.set(theme, map);
    return map;
}

function getStatusChipStyle(status: string, theme: Theme): {bg: string; color?: string} {
    const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
    return getStatusStylesForTheme(theme)[normalized] ?? {bg: theme.palette.grey[300]};
}

function getProgressColor(completion: number, theme: Theme): string {
    if (completion < 30) return theme.palette.success.main;
    if (completion < 70) return theme.palette.success.light;
    return theme.palette.grey[400];
}

function transformStatus(status: string): string {
    return status.toUpperCase().replace(/[\s-]/g, '_');
}

const StatusChip: React.FC<{status: string; theme: Theme}> = React.memo(({status, theme}) => {
    const display = transformStatus(status);
    const style = getStatusChipStyle(display, theme);
    return (
        <Chip
            label={display}
            size="small"
            sx={{
                bgcolor: style.bg,
                color: style.color ?? 'text.primary',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
            }}
        />
    );
});
StatusChip.displayName = 'StatusChip';

const ProgressBar: React.FC<{value: number; theme: Theme}> = React.memo(({value, theme}) => (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, minWidth: 100}}>
        <LinearProgress
            variant="determinate"
            value={value}
            sx={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {bgcolor: getProgressColor(value, theme)},
            }}
        />
        <Typography variant="caption" sx={{minWidth: 32, textAlign: 'right'}}>
            {value}%
        </Typography>
    </Box>
));
ProgressBar.displayName = 'ProgressBar';

export const DeliveriesTable: React.FC<DeliveriesTableProps> = React.memo(({
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
    const theme = useTheme();

    const handleSort = (columnKey: string) => {
        const newDirection = sort.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc';
        onSort({column: columnKey, direction: newDirection});
    };

    return (
        <Box sx={{position: 'relative'}}>
            {/* Loading overlay */}
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: alpha(theme.palette.background.paper, 0.7),
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
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {COLUMNS.map((col) => (
                                <TableCell
                                    key={col.key}
                                    sx={{
                                        fontWeight: 600,
                                        bgcolor: 'grey.100',
                                        borderBottom: 2,
                                        borderColor: 'grey.300',
                                        width: col.width,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {col.sortable ? (
                                        <TableSortLabel
                                            active={sort.column === col.key}
                                            direction={sort.column === col.key ? sort.direction : 'asc'}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            {col.label}
                                        </TableSortLabel>
                                    ) : (
                                        col.label
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {deliveries.map((delivery) => (
                            <React.Fragment key={delivery.jobId}>
                                <TableRow hover sx={{height: 48}}>
                                    <TableCell sx={{py: 1}}>
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
                                    </TableCell>
                                    <TableCell sx={{py: 1}}>{delivery.jobName}</TableCell>
                                    <TableCell sx={{py: 1}}>
                                        <StatusChip status={delivery.status} theme={theme} />
                                    </TableCell>
                                    <TableCell sx={{py: 1}}>
                                        <ProgressBar value={delivery.completion} theme={theme} />
                                    </TableCell>
                                    <TableCell sx={{py: 1}}>{delivery.pickup}</TableCell>
                                    <TableCell sx={{py: 1}}>{delivery.delivery}</TableCell>
                                    <TableCell sx={{py: 1}}>{delivery.driver}</TableCell>
                                    <TableCell sx={{py: 1}}>{delivery.region}</TableCell>
                                    <TableCell sx={{py: 1, whiteSpace: 'nowrap'}}>
                                        <Tooltip title="Open Map">
                                            <IconButton size="small" onClick={() => onShowMap(delivery)}>
                                                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                    map
                                                </span>
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="View Job Details">
                                            <IconButton size="small" onClick={() => onOpenJobDetail(delivery)}>
                                                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                    visibility
                                                </span>
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>

                                {/* Child rows */}
                                {delivery.expanded &&
                                    delivery.childJobs?.map((child) => (
                                        <TableRow key={child.jobId} sx={{bgcolor: 'grey.50'}}>
                                            <TableCell sx={{py: 1}} />
                                            <TableCell sx={{py: 1}}>{child.jobName}</TableCell>
                                            <TableCell sx={{py: 1}}>
                                                <StatusChip status={child.status} theme={theme} />
                                            </TableCell>
                                            <TableCell sx={{py: 1}}>
                                                <ProgressBar value={child.completion} theme={theme} />
                                            </TableCell>
                                            <TableCell sx={{py: 1}}>{child.pickup}</TableCell>
                                            <TableCell sx={{py: 1}}>{child.delivery}</TableCell>
                                            <TableCell sx={{py: 1}}>{child.driver}</TableCell>
                                            <TableCell sx={{py: 1}}>{child.region}</TableCell>
                                            <TableCell sx={{py: 1}} />
                                        </TableRow>
                                    ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {/* Empty state */}
            {deliveries.length === 0 && !isLoading && (
                <Box sx={{textAlign: 'center', py: 6, color: 'text.disabled'}}>
                    <span
                        className="material-symbols-outlined"
                        style={{fontSize: 48, display: 'block'}}
                    >
                        local_shipping
                    </span>
                    <Typography
                        variant="body1"
                        sx={{
                            color: "text.secondary",
                            mt: 1
                        }}>
                        No deliveries found
                    </Typography>
                    <Typography variant="body2" sx={{
                        color: "text.secondary"
                    }}>
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
                        borderTop: 1,
                        borderColor: 'divider',
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
});
DeliveriesTable.displayName = 'DeliveriesTable';

export default DeliveriesTable;
