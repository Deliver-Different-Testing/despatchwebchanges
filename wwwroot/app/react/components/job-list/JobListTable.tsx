/**
 * Job List Table
 *
 * The dispatch job list: sortable headers, resizable columns, density modes,
 * row highlighting and a right-click context-menu trigger.
 *
 * It keeps **raw `<table>` markup** rather than a component tree. The body is
 * virtualised with `@tanstack/react-virtual`, so rows re-render on every scroll
 * frame; all of its styling therefore lives in `JobListTable.module.css` and is
 * selected with `data-*` attributes, with density carried by two CSS custom
 * properties on the table element.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {ActionIcon, Badge, Box, Group, Text, Tooltip} from '@mantine/core';
import {useDisclosure, useInterval} from '@mantine/hooks';
import {Briefcase, ChevronUp, Info, UserPlus, UserSearch, Zap} from 'lucide-react';

import {Icon} from '../common/icon/Icon';
import {ActionButton, ACTION_BUTTON_COMPACT_GLYPH_SIZE, ACTION_BUTTON_COMPACT_HEIGHT} from '../common/action-button';
import {MuiThemeIsland} from '../common/mui-interop/MuiThemeIsland';
import {SearchSelect} from '../common/search-select/SearchSelect';
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
import classes from './JobListTable.module.css';

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

// ── Row appearance ───────────────────────────────────────────────────

type RowVariant = 'selected' | 'related' | 'direct-chilled' | 'direct' | 'chilled' | 'multipart' | 'child' | undefined;

/**
 * The row's category, in precedence order — the first match wins. Multi-select
 * and unread are *additive* and ride on their own attributes, so they can
 * overlay whichever category applies.
 */
function getRowVariant(job: DispatchJob, isSelected: boolean, isRelated: boolean): RowVariant {
    if (isSelected) return 'selected';
    if (isRelated) return 'related';

    const isDirect = !!job.direct;
    const isChilled = isChilledJob(job);
    if (isDirect && isChilled) return 'direct-chilled';
    if (isDirect) return 'direct';
    if (isChilled) return 'chilled';
    if (isMultiPartJob(job)) return 'multipart';
    if (!job.isParentOrSingle && !!job.parentId) return 'child';
    return undefined;
}

/** Cell padding and font size per density mode, as the CSS module's two custom properties. */
function densityVars(densityMode: DensityMode): React.CSSProperties {
    const py = densityMode === 'ultra-dense' ? '0px' : densityMode === 'dense' ? '2px' : '6px';
    const fz = densityMode === 'ultra-dense' ? '0.75rem' : '0.8125rem';
    return {'--jl-cell-py': py, '--jl-cell-fz': fz} as React.CSSProperties;
}

/**
 * The Assign chip fills its cell instead of floating in it: it paints the whole
 * row band — the compact control plus the cell padding above and below — and the
 * whole column, then hands that padding straight back as a negative block margin.
 * So the *painted* box grows with density while the *layout* box stays the
 * compact band, and row height is unchanged in all three modes (the chip is what
 * sets it — see `ACTION_BUTTON_COMPACT_HEIGHT`).
 *
 * Filling is the point rather than a side effect: this button is the empty state
 * of the courier picker, and clicking it swaps a `SearchSelect` into the same
 * cell. Matching that footprint means the swap is a fill, not a jump, and the
 * hit target goes from a 22px chip to the row band the dispatcher is aiming at
 * anyway.
 */
const ASSIGN_FILL_STYLE = {
    '--ab-height': `calc(${ACTION_BUTTON_COMPACT_HEIGHT}px + 2 * var(--jl-cell-py))`,
    marginBlock: 'calc(-1 * var(--jl-cell-py))',
    display: 'block',
    width: '100%',
} as React.CSSProperties;

function alignClass(align: ColumnDef['align'], right: string, center: string): string | undefined {
    if (align === 'right') return right;
    if (align === 'center') return center;
    return undefined;
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

function getStatusBadgeColor(job: DispatchJob): string {
    switch (job.statusId) {
        case JOB_STATUS.Completed:
            return 'green';
        case JOB_STATUS.Warning:
        case JOB_STATUS.LatePickup:
        case JOB_STATUS.LateDelivery:
            return 'orange';
        case JOB_STATUS.Rejected:
        case JOB_STATUS.Missing:
            return 'red';
        case JOB_STATUS.Dispatched:
        case JOB_STATUS.Accepted:
        case JOB_STATUS.PickedUp:
        case JOB_STATUS.InTransit:
            return 'reflex';
        default:
            return 'gray';
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
    useInterval(() => {
        tickRef.current++;
    }, 60_000, {autoInvoke: true});

    const [legendOpen, {open: openLegend, close: closeLegend}] = useDisclosure(false);

    const handleSort = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
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
        // `NoData` is a shared leaf still rendered by unmigrated MUI islands, so
        // it moves in a later phase; until then it needs the MUI theme.
        return (
            <MuiThemeIsland>
                <NoData
                    title="No Jobs"
                    message="No jobs to display"
                    icon={<Icon lucide={Briefcase} size={48}/>}
                />
            </MuiThemeIsland>
        );
    }

    return (
        <>
            <div
                ref={(node: HTMLDivElement | null) => {
                    scrollContainerRef.current = node;
                    // Also share with column-resize hook
                    (tableRef as React.RefObject<HTMLDivElement | null>).current = node;
                }}
                className={classes.container}
            >
                <table className={classes.table} style={densityVars(densityMode)}>
                    <thead>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                data-column-key={col.key}
                                className={[
                                    classes.headerCell,
                                    alignClass(col.align, classes.headerCellRight, classes.headerCellCenter),
                                ].filter(Boolean).join(' ')}
                                style={{width: columnWidths[col.key] ?? col.width, position: 'relative'}}
                            >
                                {col.sortable ? (
                                    <button
                                        type="button"
                                        className={classes.sortButton}
                                        onClick={handleSort}
                                        data-sort-column={col.key}
                                        aria-sort={sortState.column === col.key
                                            ? (sortState.direction === 'desc' ? 'descending' : 'ascending')
                                            : undefined}
                                    >
                                        {col.label}
                                        <span
                                            className={[
                                                classes.sortIcon,
                                                sortState.column === col.key ? classes.sortIconActive : '',
                                                sortState.column === col.key && sortState.direction === 'desc' ? classes.sortIconDesc : '',
                                            ].filter(Boolean).join(' ')}
                                            aria-hidden="true"
                                        >
                                            <Icon lucide={ChevronUp} size={12}/>
                                        </span>
                                    </button>
                                ) : col.key === 'priority' ? (
                                    <Tooltip label="What do these icons mean?" withArrow>
                                        <ActionIcon
                                            size="sm"
                                            variant="subtle"
                                            color="gray"
                                            onClick={openLegend}
                                            aria-label="Column legend"
                                        >
                                            <Icon lucide={Info} size={16}/>
                                        </ActionIcon>
                                    </Tooltip>
                                ) : (
                                    col.label
                                )}
                                {col.key !== lastColumnKey && (
                                    <span
                                        data-testid={`resize-handle-${col.key}`}
                                        onMouseDown={(e) => handleResizeStart(col.key, e)}
                                        className={classes.resizeHandle}
                                    />
                                )}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
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
                    </tbody>
                </table>
            </div>
            <JobListLegendDialog open={legendOpen} onClose={closeLegend}/>
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

    const variant = useMemo(
        () => getRowVariant(job, isSelected, isRelated),
        [isSelected, isRelated, job],
    );

    return (
        <tr
            className={classes.row}
            data-variant={variant}
            data-multiselected={isMultiSelected || undefined}
            data-unread={!job.hasBeenRead || undefined}
            data-new={isNew || undefined}
            aria-selected={isSelected}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            {columns.map((col, colIndex) => (
                <td
                    key={col.key}
                    className={alignClass(col.align, classes.cellRight, classes.cellCenter)}
                >
                    {isRelated && !isSelected && colIndex === 0 ? (
                        <Group gap={4} wrap="nowrap">
                            <Tooltip label={INDICATORS.related.label} withArrow>
                                <Box component="span" style={{display: 'inline-flex', flexShrink: 0}}>
                                    {renderLegendMarker(INDICATORS.related.marker)}
                                </Box>
                            </Tooltip>
                            <MemoizedCellContent col={col.key} job={job} isUltraDense={isUltraDense}
                                                 isUsCustomer={isUsCustomer} appPage={appPage}
                                                 onJobDispatch={onJobDispatch}
                                                 loggedInCouriersOnly={loggedInCouriersOnly}/>
                        </Group>
                    ) : (
                        <MemoizedCellContent col={col.key} job={job} isUltraDense={isUltraDense}
                                             isUsCustomer={isUsCustomer} appPage={appPage} onJobDispatch={onJobDispatch}
                                             loggedInCouriersOnly={loggedInCouriersOnly}/>
                    )}
                </td>
            ))}
        </tr>
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
    const [showSearch, {open: openSearch, close: closeSearch}] = useDisclosure(false);
    const assignRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef(false);

    const handleAssignClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger row click
        openSearch();
    }, [openSearch]);

    // Cancelling with the keyboard has to hand the keyboard back: the button
    // only exists once the picker is gone, so the focus move waits for the swap.
    useEffect(() => {
        if (showSearch || !restoreFocusRef.current) return;
        restoreFocusRef.current = false;
        assignRef.current?.focus();
    }, [showSearch]);

    /**
     * Numeric input is treated as a courier code, so results are narrowed to
     * codes that actually start with what was typed — the server matches the
     * term anywhere in the label, which for a number is almost never what the
     * dispatcher meant.
     */
    const searchCouriers = useCallback(async (term: string, options?: {signal?: AbortSignal}): Promise<CourierOption[]> => {
        const isDg = (job.dgClass ?? 0) > 0;
        const results = await searchActiveCouriersExtended(term, {
            dgOnly: isDg || undefined,
            loggedInOnly: loggedInCouriersOnly || undefined,
            signal: options?.signal,
        });

        let filtered: CourierSuggestion[] = results;
        if (/^\d+$/.test(term.trim())) {
            filtered = results.filter((r) => {
                const code = r.text.split(' - ')[0]?.trim();
                return code?.startsWith(term.trim());
            });
        }
        return filtered.map((r) => ({id: r.id, text: r.text}));
    }, [job.dgClass, loggedInCouriersOnly]);

    /**
     * Abandoning the picker puts the cell back to its Assign button. React's
     * `onBlur` is `focusout`, so it catches a click anywhere else on the page;
     * the containment check keeps focus moves *inside* the cell from closing it.
     * Picking an option does not blur the input — Mantine's Combobox suppresses
     * that so the click can land — so this never races the selection.
     */
    const handleSearchBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        closeSearch();
    }, [closeSearch]);

    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation(); // The row and the page both listen for Escape.
        restoreFocusRef.current = true;
        closeSearch();
    }, [closeSearch]);

    const handleSelect = useCallback((option: CourierOption | null) => {
        if (option && onDispatch) {
            onDispatch(job, option.id, option.text);
            closeSearch();
        }
    }, [job, onDispatch, closeSearch]);

    // State 1: Courier already assigned → show courier info
    if (hasAssignedCourier(job)) {
        if (isUsCustomer) {
            return (
                <>
                    <Text fz="inherit" truncate>
                        {getCourierName(job)}
                    </Text>
                    {getCourierCode(job) && (
                        <Text size="xs" c="dimmed" lh={1.2} truncate>
                            {getCourierCode(job)}
                        </Text>
                    )}
                </>
            );
        }
        const code = getCourierCode(job);
        const name = getCourierName(job);
        const display = code && name ? `${code} - ${name}` : (name || code);
        return (
            <Text fz="inherit" truncate>
                {display}
            </Text>
        );
    }

    // Flight/agent assignment → don't show Assign button
    if (job.assignedFlight || job.assignedAgent) return null;

    // Dispatch not allowed → nothing
    if (!allowDispatch) return null;

    // State 2: Search active → object-valued picker
    if (showSearch) {
        return (
            <Box onClick={(e) => e.stopPropagation()} onBlur={handleSearchBlur} onKeyDown={handleSearchKeyDown}>
                <SearchSelect<CourierOption>
                    aria-label="Search courier"
                    placeholder="Search courier..."
                    autoFocus
                    value={null}
                    onChange={handleSelect}
                    search={searchCouriers}
                    getOptionKey={(option) => option.id}
                    getOptionLabel={(option) => option.text}
                    minSearchLength={1}
                    renderOption={(option) => (
                        <Group gap={4} wrap="nowrap">
                            <Icon lucide={UserSearch} size={16} color="var(--mantine-color-dimmed)"/>
                            <Text size="xs" truncate>{option.text}</Text>
                        </Group>
                    )}
                />
            </Box>
        );
    }

    // State 3: No courier → "Assign" button
    return (
        <ActionButton
            ref={assignRef}
            size="compact"
            justify="start"
            style={ASSIGN_FILL_STYLE}
            leftSection={<Icon lucide={UserPlus} size={ACTION_BUTTON_COMPACT_GLYPH_SIZE}/>}
            onClick={handleAssignClick}
        >
            Assign
        </ActionButton>
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
                    <Text component="span" fw="inherit" fz="inherit" style={{display: 'inline-flex', alignItems: 'center'}}>
                        {job.jobNo}
                        {job.direct && (
                            <Tooltip label="Direct" withArrow>
                                <Box component="span" ml={4} style={{display: 'inline-flex'}}>
                                    <Icon lucide={Zap} size={14} color="var(--mantine-color-orange-5)"/>
                                </Box>
                            </Tooltip>
                        )}
                    </Text>
                    {isUsCustomer && job.clientName && (
                        <Text size="xs" c="dimmed" lh={1.2} truncate>
                            {job.clientName}
                        </Text>
                    )}
                </>
            );
        case 'client':
            return <>{job.client || ''}</>;
        case 'pickup':
            if (isUsCustomer) {
                return (
                    <>
                        <Text fz="inherit" truncate>{getPickupAddressUs(job)}</Text>
                        {getPickupCityState(job) && (
                            <Text size="xs" c="dimmed" lh={1.2} truncate>
                                {getPickupCityState(job)}
                            </Text>
                        )}
                    </>
                );
            }
            return <>{getPickupAddressNz(job)}</>;
        case 'delivery':
            if (isUsCustomer) {
                return (
                    <>
                        <Text fz="inherit" truncate>{getDeliveryAddressUs(job)}</Text>
                        {getDeliveryCityState(job) && (
                            <Text size="xs" c="dimmed" lh={1.2} truncate>
                                {getDeliveryCityState(job)}
                            </Text>
                        )}
                    </>
                );
            }
            return <>{getDeliveryAddressNz(job)}</>;
        case 'courier': {
            // Flight assignment — show flight number, no Assign button
            if (job.assignedFlight) {
                return (
                    <Text fz="inherit" truncate>
                        {job.assignedFlight.flightNumber}
                    </Text>
                );
            }
            // Sent to DFRNT partner — show partner name, no Assign button
            if (job.sentToPartnerName) {
                return (
                    <Text fz="inherit" truncate>
                        {job.sentToPartnerName}
                    </Text>
                );
            }
            // Agent assignment — show agent name, no Assign button
            if (job.assignedAgent) {
                return (
                    <Text fz="inherit" truncate>
                        {job.assignedAgent.agentName}
                    </Text>
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
                <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Text
                        component="span"
                        fz="inherit"
                        c={overdue ? 'var(--mantine-color-red-5)' : undefined}
                        fw={overdue ? 600 : 'inherit'}
                    >
                        {remain}
                    </Text>
                    {lateLabel && (
                        <span
                            className={[
                                classes.lateBadge,
                                lateForPickup ? classes.lateBadgePickup : classes.lateBadgeDelivery,
                            ].join(' ')}
                        >
                            {lateLabel}
                        </span>
                    )}
                </Group>
            );
        }
        case 'status': {
            const statusText = job.status || job.statusName || '';
            if (isUltraDense) {
                return <>{statusText.charAt(0).toUpperCase()}</>;
            }
            return (
                <Badge size="sm" variant="light" color={getStatusBadgeColor(job)}>
                    {statusText}
                </Badge>
            );
        }
        default:
            return null;
    }
});
CellContent.displayName = 'CellContent';
const MemoizedCellContent = CellContent;
