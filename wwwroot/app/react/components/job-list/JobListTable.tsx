/**
 * Job List Table
 *
 * MUI Table rendering dispatch jobs with sortable headers, row styling,
 * density modes, and right-click context menu trigger.
 *
 * Follows app design conventions:
 * - gray.100 header background with 2px bottom border
 * - alpha-based selection highlighting
 * - theme-token status chips
 * - @mui/icons-material for all icons (no font Icon component)
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import type {SxProps, Theme} from '@mui/material';

// MUI Icons
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import type {DensityMode, DispatchJob, JobListSort} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import type {CourierSuggestion} from '../../interfaces/afterhours';
import {searchActiveCouriersExtended} from '../../services/courierApi';
import dayjs from 'dayjs';
import {
    formatMins,
    formatShortDate,
    getIanaTimezone,
    getTenantTimezone,
    getTimezoneAbbreviation
} from '../../utils/dateUtils';
import {useColumnResize} from './useColumnResize';
import type {ColumnDef} from './jobListColumns';
import {isDelivered, isInTransit, isUrgent, JOB_STATUS, needsDispatch} from './jobListHelpers';
import {JobListLegendDialog} from './JobListLegendDialog';
import {FLIGHT_INDICATORS, INDICATORS, renderLegendMarker, renderTableIndicator} from './jobListIndicators';
import {NoData} from '../common/no-data/NoData';

// ── Helpers ──────────────────────────────────────────────────────────

// Pickup address — NZ: suburb only; US: full address lines 2-8
function getPickupAddressNz(job: DispatchJob): string {
    return job.pickupAddress?.addressLine5 || '';
}

function getPickupAddressUs(job: DispatchJob): string {
    if (job.pickupAddress) {
        const addr = job.pickupAddress;
        return [addr.addressLine2, addr.addressLine3, addr.addressLine4, addr.addressLine5, addr.addressLine6, addr.addressLine7, addr.addressLine8]
            .filter((l) => l && l.trim())
            .join(', ');
    }
    return (job.from || '').split(',').map((l) => l.trim()).join(', ');
}

function getPickupCityState(job: DispatchJob): string {
    return job.pickupAddress?.addressLine1 || '';
}

// Delivery address — NZ: suburb-first ordering; US: lines 2-5,8
function getDeliveryAddressNz(job: DispatchJob): string {
    if (job.deliveryAddress) {
        const addr = job.deliveryAddress;
        return [addr.addressLine5, addr.addressLine2, addr.addressLine3, addr.addressLine4, addr.addressLine8]
            .filter((l) => l && l.trim())
            .join(', ');
    }
    return (job.toAddress || '').split(',').map((l) => l.trim()).join(', ');
}

function getDeliveryAddressUs(job: DispatchJob): string {
    if (job.deliveryAddress) {
        const addr = job.deliveryAddress;
        return [addr.addressLine2, addr.addressLine3, addr.addressLine4, addr.addressLine5, addr.addressLine8]
            .filter((l) => l && l.trim())
            .join(', ');
    }
    return (job.toAddress || '').split(',').map((l) => l.trim()).join(', ');
}

function getDeliveryCityState(job: DispatchJob): string {
    return job.deliveryAddress?.addressLine1 || '';
}

function getCourierName(job: DispatchJob): string {
    return job.courierData?.courierName || job.assignedCourier?.text || '';
}

function getCourierCode(job: DispatchJob): string {
    return job.courierData?.courier || '';
}

function hasAssignedCourier(job: DispatchJob): boolean {
    return !!(job.assignedCourier || job.courier);
}

// Timezone abbreviation — computed once per render
let _cachedTimezoneShort: string | null = null;

function getTimeZoneShort(): string {
    if (_cachedTimezoneShort === null) {
        const tz = getTenantTimezone();
        const iana = getIanaTimezone(tz);
        _cachedTimezoneShort = getTimezoneAbbreviation(iana);
    }
    return _cachedTimezoneShort;
}

// ── Late Detection (flags computed server-side) ─────────────────────

function isLateForPickup(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.LatePickup;
}

function isLateForDelivery(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.LateDelivery;
}

function isChilledJob(job: DispatchJob): boolean {
    if (!job.vehicle?.text) return false;
    const vehicleName = job.vehicle.text.toLowerCase();
    return vehicleName.includes('chilled') || vehicleName.includes('frozen');
}

function isMultiPartJob(job: DispatchJob): boolean {
    return !!(job.isParentOrSingle && job._groupChildren && job._groupChildren.length > 0);
}

function getFlightIcon(job: DispatchJob): React.ReactNode {
    if (!job.jobNo) return renderTableIndicator(FLIGHT_INDICATORS.unknown);
    switch (job.jobNo.toString().slice(-1)) {
        case '1':
            return renderTableIndicator(FLIGHT_INDICATORS.pickup);
        case '2':
            return renderTableIndicator(FLIGHT_INDICATORS.job);
        case '3':
            return renderTableIndicator(FLIGHT_INDICATORS.delivery);
        default:
            return renderTableIndicator(FLIGHT_INDICATORS.unknown);
    }
}

// Date column: short date only (e.g., "DD/MMM" or "MMM/DD") — matches AngularJS _deliveryDateString
function formatJobDate(booked: dayjs.Dayjs | undefined): string {
    if (!booked) return '';
    // booked is already a Dayjs; formatShortDate detects this and no-ops the clone,
    // so passing it through directly avoids an extra dayjs() wrap per row.
    return formatShortDate(booked);
}

// Time column: HH:mm + timezone — matches AngularJS _deliveryTimeString + timeZoneShort
function formatJobTime(booked: dayjs.Dayjs | undefined): string {
    if (!booked) return '';
    const time = formatMins(booked);
    const tz = getTimeZoneShort();
    return tz ? `${time} ${tz}` : time;
}

// ── Styles ───────────────────────────────────────────────────────────

// Pre-defined keyframes so MUI/emotion doesn't re-hash on every render
const newJobAnimationSx = {
    '@keyframes newJobHighlight': {
        '0%': {backgroundColor: '#bbf7d0'},
        '100%': {backgroundColor: 'transparent'},
    },
    animation: 'newJobHighlight 2s ease-out',
} as const;

const headerCellSx: SxProps<Theme> = {
    fontWeight: 600,
    fontSize: '0.75rem',
    py: 1,
    px: 1,
    whiteSpace: 'nowrap',
    bgcolor: 'grey.100',
    borderBottom: 2,
    borderColor: 'grey.300',
    color: 'text.secondary',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
};

function getRowSx(
    job: DispatchJob,
    isSelected: boolean,
    isRelated: boolean,
    densityMode: DensityMode,
    isMultiSelected: boolean,
): Record<string, any> {
    const basePy = densityMode === 'ultra-dense' ? 0 : densityMode === 'dense' ? 0.25 : 0.75;

    const baseCellSx = {
        py: basePy,
        px: 1,
        fontSize: densityMode === 'ultra-dense' ? '0.75rem' : '0.8125rem',
        borderBottom: '1px solid',
        borderColor: 'divider',
    } satisfies SxProps<Theme>;

    const sx: Record<string, any> = {
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
        '& .MuiTableCell-root': {...baseCellSx},
        '&:hover': {
            bgcolor: '#cbd5e1',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        },
    };

    // Determine highlight flags
    const isDirect = !!job.direct;
    const isChilled = isChilledJob(job);
    const isChildJob = !job.isParentOrSingle && !!job.parentId;
    const isMultiPart = isMultiPartJob(job);
    // Apply highlight in priority order (highest wins for bg/border)
    if (isSelected) {
        sx.bgcolor = '#e9f2ff';
        sx.boxShadow = 'inset 3px 0 0 0 #0c66e4';
        sx.borderLeft = 'none';
        sx['& .MuiTableCell-root'] = {
            ...baseCellSx,
            fontWeight: 600,
        };
        sx['&:hover'] = {
            bgcolor: '#cce0ff',
        };
    } else if (isRelated) {
        sx.bgcolor = '#f1f2f4';
        sx.borderLeft = 'none';
        sx['& .MuiTableCell-root'] = {
            ...baseCellSx,
            color: '#656d76',
        };
        sx['&:hover'] = {
            bgcolor: '#e4e6e9',
        };
    } else if (isDirect && isChilled) {
        // Combined direct + chilled = purple
        sx.bgcolor = 'rgba(128, 0, 128, 0.05)';
        sx.borderLeft = '3px solid #9333ea';
        sx['& .MuiTableCell-root'] = {
            ...baseCellSx,
            color: '#7e22ce',
            fontWeight: 600,
        };
        sx['&:hover'] = {
            bgcolor: 'rgba(128, 0, 128, 0.1)',
        };
    } else if (isDirect) {
        sx.bgcolor = 'rgba(255, 0, 0, 0.05)';
        sx.borderLeft = '3px solid #dc2626';
        sx['& .MuiTableCell-root'] = {
            ...baseCellSx,
            color: '#dc2626',
            fontWeight: 600,
        };
        sx['&:hover'] = {
            bgcolor: 'rgba(255, 0, 0, 0.1)',
        };
    } else if (isChilled) {
        sx.bgcolor = 'rgba(30, 144, 255, 0.05)';
        sx.borderLeft = '3px solid #0ea5e9';
        sx['& .MuiTableCell-root'] = {
            ...baseCellSx,
            color: '#0284c7',
            fontWeight: 600,
        };
        sx['&:hover'] = {
            bgcolor: 'rgba(30, 144, 255, 0.1)',
        };
    } else if (isMultiPart) {
        sx.bgcolor = '#f1f5f9';
        sx.borderLeft = '3px solid #8b5cf6';
        sx['&:hover'] = {
            bgcolor: '#e2e8f0',
        };
    } else if (isChildJob) {
        sx.bgcolor = '#f8fafc';
        sx.borderLeft = '3px solid #64748b';
        sx['&:hover'] = {
            bgcolor: '#cbd5e1',
        };
    }

    // Multi-select is additive — overlays on top of any category color
    if (isMultiSelected) {
        sx.bgcolor = '#d1c4e9';
        sx.borderLeft = '4px solid #651fff';
        sx['&:hover'] = {
            bgcolor: '#b39ddb',
            boxShadow: '0 1px 3px rgba(101, 31, 255, 0.2)',
        };
    }

    // Unread is additive — overrides font-weight to 900 regardless of other highlights
    if (!job.hasBeenRead) {
        sx['& .MuiTableCell-root'] = {
            ...sx['& .MuiTableCell-root'],
            fontWeight: 900,
        };
    }

    return sx;
}

// The branch order below IS the precedence — the first match is the marker shown
// for a row. Job-type/attribute icons win over the status dots. The dots mirror
// the top stats-header categories: red = Urgent, amber = In Transit, green =
// Done, blue = Active. Keep in sync with the legend via ./jobListIndicators.
function getPriorityIndicator(job: DispatchJob): React.ReactNode {
    if (job.toAirportId || job.fromAirportId) {
        return getFlightIcon(job);
    }
    if (isChilledJob(job)) {
        return renderTableIndicator(INDICATORS.chilled);
    }
    if (isMultiPartJob(job)) {
        return renderTableIndicator(INDICATORS.multiPart);
    }
    if (job.isPartnerJob) {
        return renderTableIndicator(INDICATORS.partner);
    }
    if (isLateForPickup(job)) {
        return renderTableIndicator(INDICATORS.latePickup);
    }
    if (isLateForDelivery(job)) {
        return renderTableIndicator(INDICATORS.lateDelivery);
    }
    if (isUrgent(job)) {
        return renderTableIndicator(INDICATORS.urgent);
    }
    if (isInTransit(job)) {
        return renderTableIndicator(INDICATORS.inTransit);
    }
    if (isDelivered(job)) {
        return renderTableIndicator(INDICATORS.done);
    }
    if (needsDispatch(job)) {
        return renderTableIndicator(INDICATORS.active);
    }
    return null;
}

function getStatusChipColor(job: DispatchJob): 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' {
    switch (job.statusId) {
        case JOB_STATUS.Completed:
            return 'success';
        case JOB_STATUS.Warning:
        case JOB_STATUS.LatePickup:
        case JOB_STATUS.LateDelivery:
            return 'warning';
        case JOB_STATUS.Rejected:
        case JOB_STATUS.Missing:
            return 'error';
        case JOB_STATUS.Dispatched:
        case JOB_STATUS.Accepted:
        case JOB_STATUS.PickedUp:
        case JOB_STATUS.InTransit:
            return 'info';
        default:
            return 'default';
    }
}

// ── Component ────────────────────────────────────────────────────────

interface JobListTableProps {
    jobs: DispatchJob[];
    selectedJobId: number | null;
    relatedJobIds: Set<number>;
    multiSelectedIds: Set<number>;
    onJobClick: (job: DispatchJob, event: React.MouseEvent) => void;
    onContextMenu: (job: DispatchJob, event: React.MouseEvent) => void;
    onJobDispatch?: (job: DispatchJob, courierId: number, courierName: string) => void;
    sortState: JobListSort;
    onSortChange: (column: string) => void;
    densityMode: DensityMode;
    columnWidths: Record<string, number>;
    onColumnWidthsChange: (widths: Record<string, number>) => void;
    /** Columns to render, already filtered and ordered by the panel. */
    columns: ColumnDef[];
    isUsCustomer?: boolean;
    appPage?: number;
    isJobSearchPage?: boolean;
    loggedInCouriersOnly?: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isFetchingMore?: boolean;
}

export const JobListTable: React.FC<JobListTableProps> = ({
                                                              jobs,
                                                              selectedJobId,
                                                              relatedJobIds,
                                                              multiSelectedIds,
                                                              onJobClick,
                                                              onContextMenu,
                                                              onJobDispatch,
                                                              sortState,
                                                              onSortChange,
                                                              densityMode,
                                                              columnWidths,
                                                              onColumnWidthsChange,
                                                              columns,
                                                              isUsCustomer,
                                                              appPage,
                                                              isJobSearchPage,
                                                              loggedInCouriersOnly,
                                                              onLoadMore,
                                                              hasMore,
                                                              isFetchingMore,
                                                          }) => {
    // Tick every 60s to keep time-dependent late/overdue checks current.
    // Stored as a ref to avoid re-rendering every row — only rows with
    // time-sensitive status (late/urgent) will pick up changes via the
    // parent's useMemo recomputation on the next data refresh.
    const tickRef = useRef(0);
    useEffect(() => {
        const timer = setInterval(() => {
            tickRef.current++;
        }, 60_000);
        return () => clearInterval(timer);
    }, []);

    const [legendOpen, setLegendOpen] = useState(false);

    const handleSort = useCallback(
        (e: React.MouseEvent<HTMLSpanElement>) => {
            const column = e.currentTarget.dataset.sortColumn;
            if (column) onSortChange(column);
        },
        [onSortChange],
    );

    const tableRef = useRef<HTMLDivElement>(null);
    const {handleResizeStart} = useColumnResize({columnWidths, onColumnWidthsChange, tableRef});

    const lastColumnKey = useMemo(() => columns[columns.length - 1]?.key, [columns]);

    // Row height estimate based on density mode
    const estimatedRowHeight = densityMode === 'ultra-dense' ? 28 : densityMode === 'dense' ? 34 : 44;

    // Track newly-appeared job IDs so we can highlight them briefly.
    // Use a ref for previous IDs and only setState when new jobs actually appear.
    const prevJobIdsRef = useRef<Set<number> | null>(null);
    const [newJobIds, setNewJobIds] = useState<Set<number>>(new Set());
    const emptySet = useMemo(() => new Set<number>(), []);

    useEffect(() => {
        const prevIds = prevJobIdsRef.current;
        // Build current ID set
        const currentIds = new Set(jobs.map(j => j.id));

        if (prevIds !== null && prevIds.size > 0) {
            const appeared = new Set<number>();
            for (const id of currentIds) {
                if (!prevIds.has(id)) appeared.add(id);
            }
            if (appeared.size > 0) {
                setNewJobIds(appeared);
                const timer = setTimeout(() => setNewJobIds(emptySet), 2000);
                prevJobIdsRef.current = currentIds;
                return () => clearTimeout(timer);
            }
        }

        prevJobIdsRef.current = currentIds;
    }, [jobs, emptySet]);

    // Also update ref when newJobIds clears (so next refresh has correct baseline)
    useEffect(() => {
        if (newJobIds.size === 0 && prevJobIdsRef.current === null) {
            prevJobIdsRef.current = new Set(jobs.map(j => j.id));
        }
    }, [newJobIds, jobs]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: jobs.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => estimatedRowHeight,
        overscan: 15,
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Infinite scroll: fetch next page when scrolled near bottom
    useEffect(() => {
        if (!onLoadMore || !hasMore || isFetchingMore) return;
        if (virtualItems.length === 0) return;

        const lastItem = virtualItems[virtualItems.length - 1];
        if (lastItem.index >= jobs.length - 10) {
            onLoadMore();
        }
    }, [virtualItems, jobs.length, onLoadMore, hasMore, isFetchingMore]);

    if (jobs.length === 0) {
        return (
            <NoData
                title="No Jobs"
                message="No jobs to display"
                icon={<WorkOutlineIcon/>}
            />
        );
    }

    return (
        <>
        <TableContainer
            ref={(node: HTMLDivElement | null) => {
                scrollContainerRef.current = node;
                // Also share with column-resize hook
                (tableRef as React.RefObject<HTMLDivElement | null>).current = node;
            }}
            sx={{flex: 1, overflow: 'auto'}}
        >
            <Table stickyHeader size="small" sx={{tableLayout: 'fixed'}}>
                <TableHead>
                    <TableRow>
                        {columns.map((col) => (
                            <TableCell
                                key={col.key}
                                data-column-key={col.key}
                                align={col.align || 'left'}
                                sx={{
                                    ...headerCellSx,
                                    width: columnWidths[col.key] ?? col.width,
                                    position: 'relative',
                                }}
                            >
                                {col.sortable ? (
                                    <TableSortLabel
                                        active={sortState.column === col.key}
                                        direction={sortState.column === col.key ? (sortState.direction ?? 'asc') : 'asc'}
                                        onClick={handleSort}
                                        data-sort-column={col.key}
                                        sx={{
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.025em',
                                        }}
                                    >
                                        {col.label}
                                    </TableSortLabel>
                                ) : col.key === 'priority' ? (
                                    <Tooltip title="What do these icons mean?" arrow>
                                        <IconButton
                                            size="small"
                                            onClick={() => setLegendOpen(true)}
                                            aria-label="Column legend"
                                            sx={{p: 0.25, color: 'text.secondary'}}
                                        >
                                            <InfoOutlinedIcon sx={{fontSize: 16}}/>
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    col.label
                                )}
                                {col.key !== lastColumnKey && (
                                    <Box
                                        data-testid={`resize-handle-${col.key}`}
                                        onMouseDown={(e) => handleResizeStart(col.key, e)}
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            width: 4,
                                            height: '100%',
                                            cursor: 'col-resize',
                                            bgcolor: 'transparent',
                                            zIndex: 1,
                                            '&:hover': {bgcolor: 'primary.main', opacity: 0.3},
                                            '&:active': {bgcolor: 'primary.main', opacity: 0.5},
                                        }}
                                    />
                                )}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {/* Spacer row for virtual scroll offset */}
                    {virtualItems.length > 0 && (
                        <tr style={{height: virtualItems[0].start}}/>
                    )}
                    {virtualItems.map((virtualRow) => {
                        const job = jobs[virtualRow.index];
                        return (
                            <JobRow
                                key={job.id}
                                job={job}
                                isSelected={selectedJobId === job.id}
                                isRelated={relatedJobIds.has(job.id)}
                                isMultiSelected={multiSelectedIds.has(job.id)}
                                isNew={newJobIds.has(job.id)}
                                columns={columns}
                                densityMode={densityMode}
                                isUsCustomer={isUsCustomer}
                                appPage={appPage}
                                onClick={onJobClick}
                                onContextMenu={onContextMenu}
                                onJobDispatch={onJobDispatch}
                                loggedInCouriersOnly={loggedInCouriersOnly}
                            />
                        );
                    })}
                    {/* Spacer row for remaining virtual scroll space */}
                    {virtualItems.length > 0 && (
                        <tr style={{height: virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1].end)}}/>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
        <JobListLegendDialog open={legendOpen} onClose={() => setLegendOpen(false)}/>
        </>
    );
};

// ── Job Row ──────────────────────────────────────────────────────────

interface JobRowProps {
    job: DispatchJob;
    isSelected: boolean;
    isRelated: boolean;
    isMultiSelected: boolean;
    isNew: boolean;
    columns: ColumnDef[];
    densityMode: DensityMode;
    isUsCustomer?: boolean;
    appPage?: number;
    onClick: (job: DispatchJob, event: React.MouseEvent) => void;
    onContextMenu: (job: DispatchJob, event: React.MouseEvent) => void;
    onJobDispatch?: (job: DispatchJob, courierId: number, courierName: string) => void;
    loggedInCouriersOnly?: boolean;
}

const JobRow: React.FC<JobRowProps> = React.memo(({
                                                      job,
                                                      isSelected,
                                                      isRelated,
                                                      isMultiSelected,
                                                      isNew,
                                                      columns,
                                                      densityMode,
                                                      isUsCustomer,
                                                      appPage,
                                                      onClick,
                                                      onContextMenu,
                                                      onJobDispatch,
                                                      loggedInCouriersOnly,
                                                  }) => {
    const handleClick = useCallback(
        (e: React.MouseEvent) => onClick(job, e),
        [job, onClick],
    );
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(job, e);
        },
        [job, onContextMenu],
    );

    const isUltraDense = densityMode === 'ultra-dense';

    const rowSx = useMemo(
        () => {
            const sx = getRowSx(job, isSelected, isRelated, densityMode, isMultiSelected);
            if (isNew) {
                Object.assign(sx, newJobAnimationSx);
            }
            return sx;
        },
        [job.statusId, job.direct, job.vehicle?.text, job.isParentOrSingle, job.parentId, job.hasBeenRead, job.booked, job.assignedCourier?.id, job._groupChildren?.length, isSelected, isRelated, densityMode, isMultiSelected, isNew],
    );

    return (
        <TableRow
            hover
            selected={isSelected}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            sx={rowSx}
        >
            {columns.map((col, colIndex) => (
                <TableCell
                    key={col.key}
                    align={col.align || 'left'}
                    sx={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                >
                    {isRelated && !isSelected && colIndex === 0 ? (
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Tooltip title={INDICATORS.related.label} arrow>
                                <Box component="span" sx={{display: 'inline-flex', flexShrink: 0}}>
                                    {renderLegendMarker(INDICATORS.related.marker)}
                                </Box>
                            </Tooltip>
                            <MemoizedCellContent col={col.key} job={job} isUltraDense={isUltraDense}
                                                 isUsCustomer={isUsCustomer} appPage={appPage}
                                                 onJobDispatch={onJobDispatch}
                                                 loggedInCouriersOnly={loggedInCouriersOnly}/>
                        </Box>
                    ) : (
                        <MemoizedCellContent col={col.key} job={job} isUltraDense={isUltraDense}
                                             isUsCustomer={isUsCustomer} appPage={appPage} onJobDispatch={onJobDispatch}
                                             loggedInCouriersOnly={loggedInCouriersOnly}/>
                    )}
                </TableCell>
            ))}
        </TableRow>
    );
});
JobRow.displayName = 'JobRow';

// ── Courier Cell (Inline Assignment) ─────────────────────────────────

interface CourierOption {
    id: number;
    text: string;
}

interface CourierCellProps {
    job: DispatchJob;
    isUsCustomer?: boolean;
    onDispatch?: (job: DispatchJob, courierId: number, courierName: string) => void;
    allowDispatch: boolean;
    loggedInCouriersOnly?: boolean;
}

const CourierCell: React.FC<CourierCellProps> = React.memo(({
                                                                job,
                                                                isUsCustomer,
                                                                onDispatch,
                                                                allowDispatch,
                                                                loggedInCouriersOnly
                                                            }) => {
    const [showSearch, setShowSearch] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [options, setOptions] = useState<CourierOption[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    const handleAssignClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger row click
        setShowSearch(true);
        setSearchText('');
        setOptions([]);
    }, []);

    const handleSearchChange = useCallback((_event: React.SyntheticEvent, value: string) => {
        setSearchText(value);

        // Clear previous debounce/abort
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        if (!value.trim()) {
            setOptions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const isDg = (job.dgClass ?? 0) > 0;
                const results = await searchActiveCouriersExtended(value, {
                    dgOnly: isDg || undefined,
                    loggedInOnly: loggedInCouriersOnly || undefined,
                    signal: controller.signal,
                });

                // For numeric input, apply exact code-match filtering
                let filtered: CourierSuggestion[] = results;
                if (/^\d+$/.test(value.trim())) {
                    filtered = results.filter((r) => {
                        const code = r.text.split(' - ')[0]?.trim();
                        return code?.startsWith(value.trim());
                    });
                }

                setOptions(filtered.map((r) => ({id: r.id, text: r.text})));
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    setOptions([]);
                }
            } finally {
                setLoading(false);
            }
        }, 300);
    }, [job.dgClass, loggedInCouriersOnly]);

    const handleSelect = useCallback((_event: React.SyntheticEvent, value: CourierOption | null) => {
        if (value && onDispatch) {
            onDispatch(job, value.id, value.text);
        }
        setShowSearch(false);
        setSearchText('');
        setOptions([]);
    }, [job, onDispatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && options.length > 0) {
            // autoHighlight highlights the first option, so Enter selects it
            // MUI handles this natively with autoHighlight — but if the popup
            // hasn't opened yet (e.g. still loading), force-select the first option
            const highlighted = (e.target as HTMLElement)
                .closest('.MuiAutocomplete-root')
                ?.querySelector('.MuiAutocomplete-option[data-focus="true"]');
            if (!highlighted && options.length > 0) {
                e.preventDefault();
                handleSelect(e as any, options[0]);
            }
        }
    }, [options, handleSelect]);

    const handleBlur = useCallback(() => {
        // Short delay to allow selection click to register
        setTimeout(() => {
            setShowSearch(false);
            setSearchText('');
            setOptions([]);
        }, 200);
    }, []);

    // State 1: Courier already assigned → show courier info
    if (hasAssignedCourier(job)) {
        if (isUsCustomer) {
            return (
                <>
                    <Typography variant="body2" sx={{fontSize: 'inherit'}} noWrap>
                        {getCourierName(job)}
                    </Typography>
                    {getCourierCode(job) && (
                        <Typography variant="caption" sx={{display: 'block', color: 'text.secondary', lineHeight: 1.2}}
                                    noWrap>
                            {getCourierCode(job)}
                        </Typography>
                    )}
                </>
            );
        }
        const code = getCourierCode(job);
        const name = getCourierName(job);
        const display = code && name ? `${code} - ${name}` : (name || code);
        return (
            <Typography variant="body2" sx={{fontSize: 'inherit', color: 'text.primary'}} noWrap>
                {display}
            </Typography>
        );
    }

    // Flight/agent assignment → don't show Assign button
    if (job.assignedFlight || job.assignedAgent) return null;

    // Dispatch not allowed → nothing
    if (!allowDispatch) return null;

    // State 2: Search active → Autocomplete
    if (showSearch) {
        return (
            <Autocomplete<CourierOption, false, false, false>
                size="small"
                options={options}
                getOptionLabel={(option) => option.text}
                filterOptions={(x) => x} // Server-side filtering
                autoHighlight
                openOnFocus
                loading={loading}
                inputValue={searchText}
                onInputChange={handleSearchChange}
                onChange={handleSelect}
                onBlur={handleBlur}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0}}>
                            <Tooltip title="Search Result"><PersonSearchIcon
                                sx={{fontSize: 16, color: 'text.secondary', flexShrink: 0}}/></Tooltip>
                            <Typography variant="body2" noWrap sx={{fontSize: '0.8125rem'}}>
                                {option.text}
                            </Typography>
                        </Box>
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        autoFocus
                        placeholder="Search courier..."
                        variant="outlined"
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                        slotProps={{
                            ...params.slotProps,
                            input: {
                                ...params.slotProps.input,
                                sx: {fontSize: '0.8125rem', py: 0},
                                endAdornment: (
                                    <>
                                        {loading && <CircularProgress color="inherit" size={16}/>}
                                        {params.slotProps.input.endAdornment}
                                    </>
                                ),
                            },
                        }}
                    />
                )}
                sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {py: 0, minHeight: 28},
                    '& .MuiAutocomplete-listbox': {maxHeight: 200},
                }}
                slotProps={{
                    popper: {
                        sx: {minWidth: 220},
                        placement: 'bottom-start',
                    },
                }}
            />
        );
    }

    // State 3: No courier → "Assign" button
    return (
        <Button
            size="small"
            variant="text"
            startIcon={<PersonAddIcon sx={{fontSize: 16}}/>}
            onClick={handleAssignClick}
            sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                py: 0,
                px: 0.5,
                minWidth: 0,
                minHeight: 24,
                color: 'primary.main',
                '&:hover': {bgcolor: 'action.hover'},
            }}
        >
            Assign
        </Button>
    );
});
CourierCell.displayName = 'CourierCell';

// ── Cell Content ─────────────────────────────────────────────────────

const CellContent: React.FC<{
    col: string;
    job: DispatchJob;
    isUltraDense: boolean;
    isUsCustomer?: boolean;
    appPage?: number;
    onJobDispatch?: (job: DispatchJob, courierId: number, courierName: string) => void;
    loggedInCouriersOnly?: boolean
}> = React.memo(({
                     col,
                     job,
                     isUltraDense,
                     isUsCustomer,
                     appPage,
                     onJobDispatch,
                     loggedInCouriersOnly,
                 }) => {
    switch (col) {
        case 'priority':
            return <>{getPriorityIndicator(job)}</>;
        case 'date':
            return <>{formatJobDate(job.booked)}</>;
        case 'time':
            return <>{formatJobTime(job.booked)}</>;
        case 'speed':
            return <>{(job.speed || '')}</>;
        case 'isArchived':
            return <>{job.isArchived ? 'Yes' : 'No'}</>;
        case 'vehicle':
            return <>{(job.vehicle?.text || '')}</>;
        case 'jobNo':
            return (
                <>
                    <Typography variant="body2" sx={{
                        fontWeight: 'inherit',
                        fontSize: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        {job.jobNo}
                        {job.direct && (
                            <Tooltip title="Direct"><BoltIcon
                                sx={{fontSize: 14, ml: 0.5, color: 'warning.main'}}/></Tooltip>
                        )}
                    </Typography>
                    {isUsCustomer && job.clientName && (
                        <Typography variant="caption" sx={{display: 'block', color: 'text.secondary', lineHeight: 1.2}}
                                    noWrap>
                            {job.clientName}
                        </Typography>
                    )}
                </>
            );
        case 'client':
            return <>{job.client || ''}</>;
        case 'pickup':
            if (isUsCustomer) {
                return (
                    <>
                        <Typography variant="body2" sx={{fontSize: 'inherit'}}
                                    noWrap>{getPickupAddressUs(job)}</Typography>
                        {getPickupCityState(job) && (
                            <Typography variant="caption"
                                        sx={{display: 'block', color: 'text.secondary', lineHeight: 1.2}} noWrap>
                                {getPickupCityState(job)}
                            </Typography>
                        )}
                    </>
                );
            }
            return <>{getPickupAddressNz(job)}</>;
        case 'delivery':
            if (isUsCustomer) {
                return (
                    <>
                        <Typography variant="body2" sx={{fontSize: 'inherit'}}
                                    noWrap>{getDeliveryAddressUs(job)}</Typography>
                        {getDeliveryCityState(job) && (
                            <Typography variant="caption"
                                        sx={{display: 'block', color: 'text.secondary', lineHeight: 1.2}} noWrap>
                                {getDeliveryCityState(job)}
                            </Typography>
                        )}
                    </>
                );
            }
            return <>{getDeliveryAddressNz(job)}</>;
        case 'courier': {
            // Flight assignment — show flight number, no Assign button
            if (job.assignedFlight) {
                return (
                    <Typography variant="body2" sx={{fontSize: 'inherit', color: 'text.primary'}} noWrap>
                        {job.assignedFlight.flightNumber}
                    </Typography>
                );
            }
            // Sent to DFRNT partner — show partner name, no Assign button
            if (job.sentToPartnerName) {
                return (
                    <Typography variant="body2" sx={{fontSize: 'inherit', color: 'text.primary'}} noWrap>
                        {job.sentToPartnerName}
                    </Typography>
                );
            }
            // Agent assignment — show agent name, no Assign button
            if (job.assignedAgent) {
                return (
                    <Typography variant="body2" sx={{fontSize: 'inherit', color: 'text.primary'}} noWrap>
                        {job.assignedAgent.agentName}
                    </Typography>
                );
            }
            // Courier assignment / inline dispatch
            const allowDispatch = appPage === AppPage.Dispatch || appPage === AppPage.JobSearch;
            return (
                <CourierCell
                    job={job}
                    isUsCustomer={isUsCustomer}
                    onDispatch={onJobDispatch}
                    allowDispatch={allowDispatch}
                    loggedInCouriersOnly={loggedInCouriersOnly}
                />
            );
        }
        case 'remaining': {
            const remain = job.remain;
            if (remain === undefined || remain === null) return <>-</>;
            const lateForPickup = isLateForPickup(job);
            const lateForDelivery = isLateForDelivery(job);
            const overdue = remain < 0;
            const lateLabel = lateForPickup ? 'LP' : lateForDelivery ? 'LD' : null;
            return (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end'}}>
                    <Typography
                        variant="body2"
                        sx={{
                            fontSize: 'inherit',
                            color: overdue ? 'error.main' : 'text.primary',
                            fontWeight: overdue ? 600 : 'inherit',
                        }}
                    >
                        {remain}
                    </Typography>
                    {lateLabel && (
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                color: '#fff',
                                bgcolor: lateForPickup ? '#d32f2f' : '#e65100',
                                borderRadius: '3px',
                                px: 0.5,
                                lineHeight: 1.4,
                            }}
                        >
                            {lateLabel}
                        </Typography>
                    )}
                </Box>
            );
        }
        case 'status': {
            const statusText = job.status || job.statusName || '';
            if (isUltraDense) {
                return <>{statusText.charAt(0).toUpperCase()}</>;
            }
            return (
                <Chip
                    label={statusText}
                    size="small"
                    color={getStatusChipColor(job)}
                    sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                    }}
                />
            );
        }
        default:
            return null;
    }
});
CellContent.displayName = 'CellContent';
const MemoizedCellContent = CellContent;
