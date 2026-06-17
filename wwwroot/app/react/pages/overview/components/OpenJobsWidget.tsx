import React, {useCallback, useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import {formatMins} from '../../../utils/dateUtils';
import {PanelHeader} from '../../../components/common/panel-header';
import type {DriverViewModel, IOpenJobResponse, TableSort, ViewJob,} from '../OverviewPage.interfaces';
import {ContactID} from "../../../../contants";

const OPEN_JOBS_VIEW_MODE_KEY = `openJobsViewMode_${ContactID}`;
const OPEN_JOBS_LIMIT_KEY = `openJobsTableViewLimit${ContactID}`;

interface OpenJobsWidgetProps {
    openJobs: IOpenJobResponse[];
    isLoading: boolean;
}

const TABLE_COLUMNS = [
    {key: 'reference', label: 'Job Number', sortable: true},
    {key: 'driverName', label: 'Driver', sortable: true},
    {key: 'status', label: 'Status', sortable: true},
    {key: 'pickup', label: 'Pickup', sortable: true},
    {key: 'pickupAddress', label: 'Pickup Location', sortable: true},
    {key: 'delivery', label: 'Delivery', sortable: true},
    {key: 'deliveryAddress', label: 'Delivery Location', sortable: true},
    {key: 'package', label: 'Package', sortable: false},
    {key: 'mileage', label: 'Mileage', sortable: true},
];

function loadCollapseState(cardName: string): boolean {
    try {
        const saved = localStorage.getItem('cardCollapseStates');
        if (saved) {
            const states = JSON.parse(saved);
            return states[cardName] || false;
        }
    } catch { /* localStorage may be unavailable */ }
    return false;
}

function saveCollapseState(cardName: string, isCollapsed: boolean): void {
    try {
        const saved = localStorage.getItem('cardCollapseStates');
        const states = saved ? JSON.parse(saved) : {};
        states[cardName] = isCollapsed;
        localStorage.setItem('cardCollapseStates', JSON.stringify(states));
    } catch { /* localStorage may be unavailable */ }
}

function getTimeSinceLastCompleted(lastCompletedTime: string): number {
    if (lastCompletedTime === 'N/A') return 0;
    const lastCompleted = dayjs(lastCompletedTime, 'HH:mm');
    const now = dayjs();
    return Math.round(now.diff(lastCompleted, 'minute'));
}

export const OpenJobsWidget: React.FC<OpenJobsWidgetProps> = ({openJobs, isLoading}) => {
    const [isCollapsed, setIsCollapsed] = useState(() => loadCollapseState('openJobs'));
    const [isTableView, setIsTableView] = useState(
        () => localStorage.getItem(OPEN_JOBS_VIEW_MODE_KEY) === 'table',
    );
    const [tableSort, setTableSort] = useState<TableSort>({column: 'reference', direction: 'asc'});
    const [tablePage, setTablePage] = useState(1);
    const [tableLimit, setTableLimit] = useState(() => {
        const saved = localStorage.getItem(OPEN_JOBS_LIMIT_KEY);
        return saved ? parseInt(saved, 10) : 5;
    });

    const toggleCollapse = useCallback(() => {
        setIsCollapsed((prev) => {
            saveCollapseState('openJobs', !prev);
            return !prev;
        });
    }, []);

    const toggleViewMode = useCallback(() => {
        setIsTableView((prev) => {
            localStorage.setItem(OPEN_JOBS_VIEW_MODE_KEY, !prev ? 'table' : 'card');
            return !prev;
        });
    }, []);

    // Transform open jobs into ViewJob format
    const viewJobs: ViewJob[] = useMemo(() => {
        return openJobs.map((job) => ({
            jobId: job.jobId,
            reference: job.reference,
            status: job.status,
            pickup: {
                time: job.pickupTime,
                timeString: job._pickUpTimeStr,
                name: job.pickupName,
                address: job.pickupAddress,
            },
            delivery: {
                time: job.deliveryTime,
                timeString: job._deliveryTimeStr,
                name: job.deliveryName,
                address: job.deliveryAddress,
            },
            quantity: job.quantity,
            packageType: job.packageType,
            mileage: job.mileage,
            driverName: job.driverName,
        }));
    }, [openJobs]);

    // Group by driver for card view
    const drivers: DriverViewModel[] = useMemo(() => {
        const grouped: Record<string, DriverViewModel> = {};

        openJobs.forEach((job) => {
            if (!grouped[job.driverName]) {
                grouped[job.driverName] = {
                    name: job.driverName,
                    jobs: [],
                    completedToday: job.completedToday,
                    lastCompleted: job.lastCompleted ? formatMins(job.lastCompleted) : 'N/A',
                    expanded: false,
                };
            }

            grouped[job.driverName].jobs.push({
                jobId: job.jobId,
                reference: job.reference,
                status: job.status,
                pickup: {
                    time: job.pickupTime,
                    timeString: job._pickUpTimeStr,
                    name: job.pickupName,
                    address: job.pickupAddress,
                },
                delivery: {
                    time: job.deliveryTime,
                    timeString: job._deliveryTimeStr,
                    name: job.deliveryName,
                    address: job.deliveryAddress,
                },
                quantity: job.quantity,
                packageType: job.packageType,
                mileage: job.mileage,
                driverName: job.driverName,
            });
        });

        return Object.values(grouped);
    }, [openJobs]);

    // Sorted table jobs
    const sortedTableJobs = useMemo(() => {
        const sorted = [...viewJobs];
        const {column, direction} = tableSort;
        const dir = direction === 'asc' ? 1 : -1;

        sorted.sort((a: ViewJob, b: ViewJob) => {
            let valA: string | number | undefined | Record<string, unknown> = a[column as keyof ViewJob] as string | number | undefined | Record<string, unknown>;
            let valB: string | number | undefined | Record<string, unknown> = b[column as keyof ViewJob] as string | number | undefined | Record<string, unknown>;

            if (column === 'pickup' || column === 'delivery') {
                valA = a[column]?.timeString || '';
                valB = b[column]?.timeString || '';
            } else if (column === 'pickupAddress') {
                valA = a.pickup?.address || '';
                valB = b.pickup?.address || '';
            } else if (column === 'deliveryAddress') {
                valA = a.delivery?.address || '';
                valB = b.delivery?.address || '';
            }

            if (valA == null) return 1;
            if (valB == null) return -1;
            if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * dir;
            if (typeof valA === 'number' && typeof valB === 'number') return (valA < valB ? -1 : 1) * dir;
            return String(valA).localeCompare(String(valB)) * dir;
        });

        return sorted;
    }, [viewJobs, tableSort]);

    const paginatedTableJobs = useMemo(() => {
        const start = (tablePage - 1) * tableLimit;
        return sortedTableJobs.slice(start, start + tableLimit);
    }, [sortedTableJobs, tablePage, tableLimit]);

    const handleSort = (columnKey: string) => {
        setTableSort((prev) => ({
            column: columnKey,
            direction: prev.column === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    return (
        <Card variant="outlined" sx={{mt: 2}}>
            <PanelHeader
                icon={<span className="material-symbols-outlined">inventory_2</span>}
                title="Open Jobs"
                action={
                    <>
                        <Tooltip title={isTableView ? 'Card View' : 'Table View'}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <span className="material-symbols-outlined" style={{fontSize: 18, marginRight: 0.5}}>
                                    {isTableView ? 'dashboard' : 'view_list'}
                                </span>
                                <Switch
                                    checked={isTableView}
                                    onChange={toggleViewMode}
                                    size="small"
                                />
                            </Box>
                        </Tooltip>

                        <IconButton size="small" onClick={toggleCollapse} sx={{color: 'inherit'}}>
                            <span className="material-symbols-outlined">
                                {isCollapsed ? 'expand_more' : 'expand_less'}
                            </span>
                        </IconButton>
                    </>
                }
            />
            <Collapse in={!isCollapsed}>
                <Box sx={{p: 2}}>
                    {/* Empty state */}
                    {viewJobs.length === 0 && !isLoading && (
                        <Box sx={{textAlign: 'center', py: 4, color: 'text.disabled'}}>
                            <span
                                className="material-symbols-outlined"
                                style={{fontSize: 48, display: 'block'}}
                            >
                                inventory_2
                            </span>
                            <Typography
                                variant="body1"
                                sx={{
                                    color: "text.secondary",
                                    mt: 1
                                }}>
                                No open jobs match your current filter criteria
                            </Typography>
                        </Box>
                    )}

                    {/* Table View */}
                    {isTableView && viewJobs.length > 0 && (
                        <Box sx={{overflowX: 'auto'}}>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {TABLE_COLUMNS.map((col) => (
                                                <TableCell
                                                    key={col.key}
                                                    align={col.key === 'mileage' ? 'right' : 'left'}
                                                    sx={{
                                                        fontWeight: 600,
                                                        bgcolor: 'grey.100',
                                                        borderBottom: 2,
                                                        borderColor: 'grey.300',
                                                        whiteSpace: 'nowrap',
                                                        cursor: col.sortable ? 'pointer' : 'default',
                                                    }}
                                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                                >
                                                    {col.sortable ? (
                                                        <TableSortLabel
                                                            active={tableSort.column === col.key}
                                                            direction={tableSort.column === col.key ? tableSort.direction : 'asc'}
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
                                        {paginatedTableJobs.map((job) => (
                                            <TableRow key={job.reference} hover>
                                                <TableCell sx={{py: 1}}>{job.reference}</TableCell>
                                                <TableCell sx={{py: 1}}>{job.driverName || 'Unassigned'}</TableCell>
                                                <TableCell sx={{py: 1}}>
                                                    <Chip
                                                        label={job.status}
                                                        size="small"
                                                        sx={{fontSize: '0.75rem', height: 24}}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{py: 1}}>{job.pickup.timeString}</TableCell>
                                                <TableCell sx={{py: 1, maxWidth: 180}}>
                                                    <Box sx={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        <Typography variant="body2" noWrap>
                                                            {job.pickup.name}
                                                        </Typography>
                                                        <Typography variant="caption" noWrap sx={{
                                                            color: "text.secondary"
                                                        }}>
                                                            {job.pickup.address}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{py: 1}}>{job.delivery.timeString}</TableCell>
                                                <TableCell sx={{py: 1, maxWidth: 180}}>
                                                    <Box sx={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        <Typography variant="body2" noWrap>
                                                            {job.delivery.name}
                                                        </Typography>
                                                        <Typography variant="caption" noWrap sx={{
                                                            color: "text.secondary"
                                                        }}>
                                                            {job.delivery.address}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{py: 1}}>
                                                    {job.quantity} {job.packageType}
                                                </TableCell>
                                                <TableCell align="right" sx={{py: 1}}>
                                                    {job.mileage}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                size="small"
                                count={sortedTableJobs.length}
                                page={tablePage - 1}
                                onPageChange={(_e, newPage) => setTablePage(newPage + 1)}
                                rowsPerPage={tableLimit}
                                onRowsPerPageChange={(e) => {
                                    const newLimit = parseInt(e.target.value, 10);
                                    setTableLimit(newLimit);
                                    localStorage.setItem(OPEN_JOBS_LIMIT_KEY, `${newLimit}`);
                                    setTablePage(1);
                                }}
                                rowsPerPageOptions={[5, 10, 15, 20]}
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
                        </Box>
                    )}

                    {/* Card View (driver grouped) */}
                    {!isTableView && drivers.length > 0 && (
                        <Box>
                            {drivers.map((driver) => (
                                <DriverCard key={driver.name} driver={driver} />
                            ))}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};

// ── Driver Card (card view subcomponent) ──

const DriverCard: React.FC<{driver: DriverViewModel}> = React.memo(({driver: initialDriver}) => {
    const [expanded, setExpanded] = useState(false);
    // Avoid running dayjs() per render — only recompute when the timestamp changes.
    // For a 60-driver list each render previously triggered 60 dayjs() + diff() calls.
    const minsSinceLastCompleted = useMemo(() => {
        if (initialDriver.lastCompleted === 'N/A') return null;
        return getTimeSinceLastCompleted(initialDriver.lastCompleted);
    }, [initialDriver.lastCompleted]);

    return (
        <Card variant="outlined" sx={{mb: 1}}>
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    minHeight: 44,
                }}
            >
                <span className="material-symbols-outlined" style={{fontSize: 20}}>
                    {expanded ? 'expand_less' : 'expand_more'}
                </span>
                <Typography variant="subtitle2" sx={{ml: 1, fontWeight: 600}}>
                    {initialDriver.name || 'Unassigned'}
                </Typography>
                <Divider orientation="vertical" flexItem sx={{mx: 1, borderColor: 'divider'}} />
                <Typography variant="caption">({initialDriver.jobs.length} open jobs)</Typography>

                <Box sx={{flex: 1}} />

                <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, color: initialDriver.completedToday > 0 ? 'success.main' : 'error.main'}}>
                        <span
                            className="material-symbols-outlined"
                            style={{
                                fontSize: 18,
                            }}
                        >
                            check_circle
                        </span>
                        <Typography variant="caption">{initialDriver.completedToday} completed today</Typography>
                    </Box>

                    <Divider orientation="vertical" flexItem sx={{borderColor: 'divider'}} />

                    <Box>
                        <Typography variant="caption">
                            Last completed:{' '}
                            {initialDriver.lastCompleted === 'N/A' ? (
                                <Typography component="span" variant="caption" sx={{
                                    color: "warning.main"
                                }}>N/A</Typography>
                            ) : (
                                initialDriver.lastCompleted
                            )}
                        </Typography>
                        {minsSinceLastCompleted !== null && (
                            <Typography
                                variant="caption"
                                sx={{
                                    display: "block",
                                    fontSize: '0.625rem'
                                }}>
                                {minsSinceLastCompleted} mins ago
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
            <Collapse in={expanded}>
                <Box sx={{p: 2, display: 'flex', flexWrap: 'wrap', gap: 2}}>
                    {initialDriver.jobs.map((job) => (
                        <JobCard key={job.jobId} job={job} />
                    ))}
                </Box>
            </Collapse>
        </Card>
    );
});
DriverCard.displayName = 'DriverCard';

const JobCard: React.FC<{job: ViewJob}> = React.memo(({job}) => (
    <Card variant="outlined" sx={{width: 'calc(50% - 8px)', minWidth: 300}}>
        <Box sx={{p: 2}}>
            {/* Header */}
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                <Box>
                    <Typography variant="caption" sx={{
                        color: "text.secondary"
                    }}>
                        Reference
                    </Typography>
                    <Typography variant="body2">{job.reference}</Typography>
                </Box>
                <Chip
                    icon={
                        <span className="material-symbols-outlined" style={{fontSize: 16}}>
                            package_2
                        </span>
                    }
                    label={job.status}
                    size="small"
                    sx={{fontSize: '0.75rem'}}
                />
            </Box>

            <Divider sx={{my: 1}} />

            {/* Pickup / Delivery */}
            <Box sx={{display: 'flex', gap: 2}}>
                <Box sx={{flex: 1}}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: 'primary.main'}}>
                        <span className="material-symbols-outlined" style={{fontSize: 16}}>
                            pin_drop
                        </span>
                        <Typography variant="body2" sx={{fontWeight: 500, color: 'text.primary'}}>
                            Pickup: {job.pickup.timeString}
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{pl: 3}}>
                        {job.pickup.name}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            pl: 3
                        }}>
                        {job.pickup.address}
                    </Typography>
                </Box>
                <Box sx={{flex: 1}}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: 'primary.main'}}>
                        <span className="material-symbols-outlined" style={{fontSize: 16}}>
                            pin_drop
                        </span>
                        <Typography variant="body2" sx={{fontWeight: 500, color: 'text.primary'}}>
                            Delivery: {job.delivery.timeString}
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{pl: 3}}>
                        {job.delivery.name}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            pl: 3
                        }}>
                        {job.delivery.address}
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{my: 1}} />

            {/* Footer */}
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>
                        directions_car
                    </span>
                    <Typography variant="caption">Mileage: {job.mileage}</Typography>
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>
                        inventory_2
                    </span>
                    <Typography variant="caption">
                        {job.quantity} {job.packageType}
                    </Typography>
                </Box>
            </Box>
        </Box>
    </Card>
));
JobCard.displayName = 'JobCard';

export default OpenJobsWidget;
