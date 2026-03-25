/**
 * Job List Panel
 *
 * Main container for the React dispatch job list.
 * Manages local UI state (filtering, sorting, density, selection, context menu)
 * while receiving job data from AngularJS via props/callbacks.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import dayjs from 'dayjs';
import type {
    DensityMode,
    DispatchJob,
    JobCategory,
    JobListPanelProps,
    JobListSort,
} from '../../interfaces/dispatchJob';
import {JobListStatsHeader} from './JobListStatsHeader';
import {JobListToolbar} from './JobListToolbar';
import {JobListTable} from './JobListTable';
import {JobListContextMenu} from './JobListContextMenu';
import {JobListFooter} from './JobListFooter';
import type {AddressViewModel} from '../../interfaces/address';
import type {CourierData} from '../../interfaces/dispatchJob';
import {allocateJobs, bulkUpdateReadStatus, restoreJobs} from '../../services/jobListApi';
import {useJobListData} from '../../hooks/useJobListData';
import {useMultiSelect} from '../../hooks/useMultiSelect';

// ── Constants ────────────────────────────────────────────────────────

const JOB_STATUS = {
    New: 0,
    Dispatched: 1,
    Accepted: 2,
    Rejected: 3,
    LatePickup: 4,
    PickedUp: 5,
    Completed: 6,
    Warning: 7,
    LateDelivery: 8,
    Undeliverable: 10,
    InTransit: 11,
} as const;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
    priority: 50,
    date: 80,
    time: 80,
    speed: 80,
    isArchived: 80,
    vehicle: 100,
    jobNo: 130,
    client: 85,
    pickup: 120,
    delivery: 380,
    courier: 150,
    remaining: 110,
    status: 100,
};

const DEFAULT_STORAGE_PREFIX = 'jobListReact';

// ── Filter / Sort Helpers ────────────────────────────────────────────

// Cached "now" timestamp — refreshed at most once per second to avoid
// creating a new dayjs instance for every job in every helper call.
let _cachedNow: dayjs.Dayjs | null = null;
let _cachedNowTs = 0;
function getNow(): dayjs.Dayjs {
    const ts = Date.now();
    if (!_cachedNow || ts - _cachedNowTs > 1000) {
        _cachedNow = dayjs();
        _cachedNowTs = ts;
    }
    return _cachedNow;
}

function isUrgent(job: DispatchJob): boolean {
    const now = getNow();
    const deliveryTime = dayjs(job.time);
    const minutesUntilDelivery = deliveryTime.diff(now, 'minutes');
    return minutesUntilDelivery <= 30 && minutesUntilDelivery > 0;
}

function isDelivered(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.Completed;
}

function isActive(job: DispatchJob): boolean {
    if (needsDispatch(job)) return false;
    const activeStatuses = [JOB_STATUS.Dispatched, JOB_STATUS.Accepted, JOB_STATUS.PickedUp, JOB_STATUS.InTransit];
    return activeStatuses.includes(job.statusId as any) || isUrgent(job) || hasIssues(job);
}

function isInTransit(job: DispatchJob): boolean {
    return job.statusId === JOB_STATUS.InTransit;
}

function needsDispatch(job: DispatchJob): boolean {
    if (job.assignedCourier) return false;
    if (isDelivered(job)) return false;
    const activeStatuses = [JOB_STATUS.Dispatched, JOB_STATUS.Accepted, JOB_STATUS.PickedUp, JOB_STATUS.InTransit];
    return !activeStatuses.includes(job.statusId as any);

}

function isOverdue(job: DispatchJob): boolean {
    const now = getNow();
    const deliveryTime = dayjs(job.time || job.booked);
    return deliveryTime.isBefore(now);
}

function isProactivelyLate(job: DispatchJob): boolean {
    if (!job.time) return false; // No delivery time (ASAP job) — matches server-side guard
    // Late for pickup: not yet picked up and overdue
    const prePickupStatuses = [JOB_STATUS.New, JOB_STATUS.Dispatched, JOB_STATUS.Accepted];
    if (prePickupStatuses.includes(job.statusId as any) && isOverdue(job)) {
        if (job.alertLatePickup == null || job.alertLatePickup >= 0) return true;
    }
    // Late for delivery: picked up but delivery overdue
    const inTransitStatuses = [JOB_STATUS.PickedUp, JOB_STATUS.InTransit];
    if (inTransitStatuses.includes(job.statusId as any) && isOverdue(job)) {
        if (job.alertLateDelivery == null || job.alertLateDelivery >= 0) return true;
    }
    return false;
}

function hasIssues(job: DispatchJob): boolean {
    if ([JOB_STATUS.Rejected, JOB_STATUS.LatePickup, JOB_STATUS.Warning, JOB_STATUS.LateDelivery, JOB_STATUS.Undeliverable].includes(
        job.statusId as any,
    )) return true;
    return isProactivelyLate(job);
}

function matchesCategory(job: DispatchJob, category: JobCategory): boolean {
    switch (category) {
        case 'needs-dispatch':
            return needsDispatch(job);
        case 'in-progress':
            return !isDelivered(job);
        case 'delivered':
            return isDelivered(job);
        default:
            return true;
    }
}

function matchesSearch(job: DispatchJob, query: string): boolean {
    if (!query || query.trim() === '') return true;
    const q = query.toLowerCase().trim();

    const safeIncludes = (value: unknown): boolean => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(q);
    };

    const searchAddress = (address?: AddressViewModel): boolean => {
        if (!address) return false;
        return (
            safeIncludes(address.addressLine1) ||
            safeIncludes(address.addressLine2) ||
            safeIncludes(address.addressLine3) ||
            safeIncludes(address.addressLine4) ||
            safeIncludes(address.addressLine5) ||
            safeIncludes(address.addressLine6) ||
            safeIncludes(address.addressLine7) ||
            safeIncludes(address.addressLine8) ||
            safeIncludes(address.fullAddress)
        );
    };

    return (
        safeIncludes(job.jobNo) ||
        safeIncludes(job.client) ||
        safeIncludes(job.statusName) ||
        safeIncludes(job.assignedCourier?.text) ||
        safeIncludes(job.pickupContact) ||
        safeIncludes(job.deliveryContact) ||
        searchAddress(job.pickupAddress) ||
        searchAddress(job.deliveryAddress) ||
        safeIncludes(job.speed) ||
        safeIncludes(job.notify) ||
        safeIncludes(job.conNote) ||
        safeIncludes(job.assignedAgent?.agentName) ||
        safeIncludes(job.assignedFlight?.flightNumber)
    );
}

function getPickupAddressStr(job: DispatchJob): string {
    if (job.pickupAddress) {
        const addr = job.pickupAddress;
        return [addr.addressLine2, addr.addressLine3, addr.addressLine4, addr.addressLine5, addr.addressLine6, addr.addressLine7, addr.addressLine8]
            .filter((l) => l && l.trim())
            .join(', ');
    }
    return (job.from || '').split(',').map((l) => l.trim()).join(', ');
}

function getDeliveryAddressStr(job: DispatchJob): string {
    if (job.deliveryAddress) {
        const addr = job.deliveryAddress;
        return [addr.addressLine2, addr.addressLine3, addr.addressLine4, addr.addressLine5, addr.addressLine8]
            .filter((l) => l && l.trim())
            .join(', ');
    }
    return (job.toAddress || '').split(',').map((l) => l.trim()).join(', ');
}

function getSortValue(job: DispatchJob, column: string, isUsCustomer?: boolean): string | number {
    switch (column) {
        case 'date':
            return job.booked ? dayjs(job.booked).startOf('day').valueOf() : 0;
        case 'time': {
            if (job.booked && job.time) {
                const bookedDate = dayjs(job.booked);
                const timeOnly = dayjs(job.time);
                return bookedDate.hour(timeOnly.hour()).minute(timeOnly.minute()).second(timeOnly.second()).valueOf();
            }
            return job.time ? dayjs(job.time).valueOf() : (job.booked ? dayjs(job.booked).valueOf() : 0);
        }
        case 'speed':
            return job.speed || '';
        case 'vehicle':
            return job.vehicle?.text || '';
        case 'jobNo':
            return job.jobNo || '';
        case 'client':
            return job.client || '';
        case 'pickup':
            return getPickupAddressStr(job);
        case 'delivery':
            return getDeliveryAddressStr(job);
        case 'courier':
            return isUsCustomer
                ? (job.courierData?.courierName || job.assignedCourier?.text || '')
                : String(job.courierData?.courierNumber || job.assignedCourier?.id || '');
        case 'remaining': {
            const hasNoCourier = !job.assignedCourier && !job.courier;
            const remainValue = job.remain !== undefined && job.remain !== null ? job.remain : Number.MAX_SAFE_INTEGER;
            return hasNoCourier ? remainValue - 1000000 : remainValue;
        }
        case 'status':
            return job.status || job.statusName || '';
        case 'isArchived':
            return job.isArchived ? 1 : 0;
        case 'priority':
            if (isUrgent(job)) return 0;
            if (hasIssues(job)) return 1;
            if (needsDispatch(job)) return 2;
            if (isActive(job)) return 3;
            if (isDelivered(job)) return 4;
            return 5;
        default:
            return '';
    }
}

function sortJobs(jobs: DispatchJob[], sortState: JobListSort, isUsCustomer?: boolean): DispatchJob[] {
    const sorted = [...jobs];

    if (!sortState.column || !sortState.direction) {
        // Default: urgent first, then by delivery time
        // Pre-compute valueOf for each job to avoid repeated dayjs construction during sort
        const timeCache = new Map<number, number>();
        for (const job of sorted) {
            timeCache.set(job.id, job.time ? dayjs(job.time).valueOf() : (job.booked ? dayjs(job.booked).valueOf() : 0));
        }
        return sorted.sort((a, b) => {
            const aUrgent = isUrgent(a);
            const bUrgent = isUrgent(b);
            if (aUrgent && !bUrgent) return -1;
            if (!aUrgent && bUrgent) return 1;
            return (timeCache.get(a.id) ?? 0) - (timeCache.get(b.id) ?? 0);
        });
    }

    return sorted.sort((a, b) => {
        const aValue = getSortValue(a, sortState.column!, isUsCustomer);
        const bValue = getSortValue(b, sortState.column!, isUsCustomer);

        let comparison: number;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortState.direction === 'desc' ? -comparison : comparison;
    });
}

// ── Main Component ───────────────────────────────────────────────────

export const JobListPanel: React.FC<JobListPanelProps> = ({
                                                              showToast,
                                                              isUsCustomer,
                                                              appPage,
                                                              onJobSelect,
                                                              onRefresh,
                                                              onSearchChange,
                                                              onCategoryChange,
                                                              onBackendFilter,
                                                              onAddStop,
                                                              defaultCategory,
                                                              storagePrefix = DEFAULT_STORAGE_PREFIX,
                                                              fetchConfig,
                                                              setJobsCallback,
                                                              setRefreshCallback,
                                                              setSelectJobCallback,
                                                              setUpdateSearchParamsCallback,
                                                          }) => {
    const getStorageKey = useCallback((suffix: string): string => {
        const contactId = window.ContactID ?? 0;
        return `${storagePrefix}_${suffix}_${contactId}`;
    }, [storagePrefix]);

    // ── React Query data fetching (when fetchConfig is provided) ─────
    const hookData = useJobListData(fetchConfig);
    const hookDataRef = useRef(hookData);
    hookDataRef.current = hookData;

    // ── Job data (pushed from AngularJS when no fetchConfig) ─────────
    const [pushedJobs, setPushedJobs] = useState<DispatchJob[]>([]);
    const [pushedTotalCount, setPushedTotalCount] = useState(0);

    // Use hook data when available, otherwise fall back to pushed data
    const jobs = fetchConfig ? hookData.jobs : pushedJobs;
    const totalCount = fetchConfig ? hookData.totalCount : pushedTotalCount;
    // ── UI State ─────────────────────────────────────────────────────
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<JobCategory>(defaultCategory || 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortState, setSortState] = useState<JobListSort>(() => {
        try {
            const saved = localStorage.getItem(getStorageKey('sortState'));
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */
        }
        return {column: null, direction: null};
    });
    const [densityMode, setDensityMode] = useState<DensityMode>(() => {
        try {
            const saved = localStorage.getItem(getStorageKey('densityMode'));
            if (saved) return saved as DensityMode;
        } catch { /* ignore */
        }
        return 'dense';
    });
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem(getStorageKey('columnWidths'));
            if (saved) return {...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved)};
        } catch { /* ignore */
        }
        return {...DEFAULT_COLUMN_WIDTHS};
    });
    const [loggedInCouriersOnly, setLoggedInCouriersOnly] = useState(() => {
        try {
            return localStorage.getItem(getStorageKey('loggedInCouriersOnly')) === 'true';
        } catch { /* ignore */ }
        return false;
    });
    const [lastUpdated, setLastUpdated] = useState(() => `Last updated: ${dayjs().format('h:mm A')}`);

    // Context menu state
    const [contextMenuJob, setContextMenuJob] = useState<DispatchJob | null>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ mouseX: number; mouseY: number } | null>(null);

    const isJobSearchPage = appPage === 3; // AppPage.JobSearch

    // ── Register callbacks for AngularJS bridge (legacy mode) ────────
    const updateJobsRef = useRef<((jobs: DispatchJob[], total: number) => void) | null>(null);
    updateJobsRef.current = (newJobs: DispatchJob[], total: number) => {
        setPushedJobs(newJobs);
        setPushedTotalCount(total);
        setLastUpdated(`Last updated: ${dayjs().format('h:mm A')}`);
    };

    useEffect(() => {
        if (!fetchConfig && setJobsCallback) {
            setJobsCallback((newJobs, total) => {
                if (updateJobsRef.current) updateJobsRef.current(newJobs, total);
            });
        }
    }, [fetchConfig, setJobsCallback]);

    useEffect(() => {
        if (setRefreshCallback) {
            setRefreshCallback(() => {
                if (fetchConfig) {
                    hookDataRef.current.refresh();
                } else if (onRefresh) {
                    onRefresh();
                }
            });
        }
    }, [setRefreshCallback, onRefresh, fetchConfig]);

    useEffect(() => {
        if (setSelectJobCallback) {
            setSelectJobCallback((jobId) => setSelectedJobId(jobId));
        }
    }, [setSelectJobCallback]);

    // Register updateSearchParams callback for AngularJS to update fetch params
    useEffect(() => {
        if (fetchConfig && setUpdateSearchParamsCallback) {
            setUpdateSearchParamsCallback((newParams) => {
                hookDataRef.current.updateParams(newParams);
            });
        }
    }, [fetchConfig, setUpdateSearchParamsCallback]);

    // Update category when defaultCategory prop changes
    useEffect(() => {
        if (defaultCategory) setSelectedCategory(defaultCategory);
    }, [defaultCategory]);

    // Update lastUpdated when hook data changes (fetchConfig mode)
    useEffect(() => {
        if (hookData && !hookData.isLoading && !hookData.isFetching) {
            setLastUpdated(`Last updated: ${dayjs().format('h:mm A')}`);
        }
    }, [hookData?.isLoading, hookData?.isFetching]);

    // ── Persist preferences ──────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem(getStorageKey('sortState'), JSON.stringify(sortState));
    }, [sortState, getStorageKey]);

    useEffect(() => {
        localStorage.setItem(getStorageKey('densityMode'), densityMode);
    }, [densityMode, getStorageKey]);

    useEffect(() => {
        localStorage.setItem(getStorageKey('columnWidths'), JSON.stringify(columnWidths));
    }, [columnWidths, getStorageKey]);

    useEffect(() => {
        localStorage.setItem(getStorageKey('loggedInCouriersOnly'), String(loggedInCouriersOnly));
    }, [loggedInCouriersOnly, getStorageKey]);

    // ── Computed: filtered & sorted jobs ─────────────────────────────
    const {filteredJobs, stats} = useMemo(() => {
        let filtered = jobs;

        // Category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter((job) => {
                if (matchesCategory(job, selectedCategory)) return true;
                // Include multipart parents if any children match
                if (job.isParentOrSingle && job._groupChildren?.length) {
                    return job._groupChildren.some((child) => matchesCategory(child, selectedCategory));
                }
                return false;
            });
        }

        // Search filter (skip when backend handles it via fetchConfig)
        if (searchQuery && !fetchConfig) {
            filtered = filtered.filter((job) => matchesSearch(job, searchQuery));
        }

        // Sort
        filtered = sortJobs(filtered, sortState, isUsCustomer);

        // Stats from full (unfiltered) jobs — single pass
        const statsResult = {total: jobs.length, active: 0, transit: 0, done: 0};
        for (const j of jobs) {
            if (isActive(j)) statsResult.active++;
            if (isInTransit(j)) statsResult.transit++;
            if (isDelivered(j)) statsResult.done++;
        }

        return {filteredJobs: filtered, stats: statsResult};
    }, [jobs, selectedCategory, searchQuery, sortState, isUsCustomer, fetchConfig]);

    // ── Related job highlighting ────────────────────────────────────
    const relatedJobIds = useMemo(() => {
        if (!selectedJobId) return new Set<number>();
        const selectedJob = jobs.find((j) => j.id === selectedJobId);
        if (!selectedJob?.relatedJobs?.length) return new Set<number>();
        return new Set(selectedJob.relatedJobs.map((r) => r.id));
    }, [selectedJobId, jobs]);

    // ── Visible jobs (backend controls ordering) ───────────────────
    const visibleJobs = filteredJobs;

    const visibleJobIds = useMemo(() => visibleJobs.map(j => j.id), [visibleJobs]);
    const multiSelect = useMultiSelect(visibleJobIds);

    // Clear multi-select when category or search changes
    useEffect(() => {
        multiSelect.clear();
    }, [selectedCategory, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape key clears multi-select
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && multiSelect.selectCount > 0) {
                multiSelect.clear();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [multiSelect.selectCount]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ─────────────────────────────────────────────────────

    const handleJobClick = useCallback(
        (job: DispatchJob, event: React.MouseEvent) => {
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            const isShift = event.shiftKey;

            if (isCtrlOrCmd || isShift) {
                // Modifier click → multi-select, don't change detail panel
                multiSelect.toggle(job.id, event);
            } else {
                // Plain click → set detail panel selection
                setSelectedJobId(job.id);
                if (onJobSelect) onJobSelect(job);
            }
        },
        [onJobSelect, multiSelect],
    );

    const handleContextMenu = useCallback(
        (job: DispatchJob, event: React.MouseEvent) => {
            event.preventDefault();
            // If right-clicking an unselected job while multi-select is active (2+), clear multi-select
            if (multiSelect.selectCount >= 2 && !multiSelect.selectedIds.has(job.id)) {
                multiSelect.clear();
            }
            setContextMenuJob(job);
            setContextMenuPos({mouseX: event.clientX, mouseY: event.clientY});
        },
        [multiSelect],
    );

    const handleCloseContextMenu = useCallback(() => {
        setContextMenuJob(null);
        setContextMenuPos(null);
    }, []);

    const handleCategoryChange = useCallback(
        (category: JobCategory) => {
            setSelectedCategory(category);
            if (fetchConfig) {
                hookDataRef.current.updateParams({statusFilter: category === 'all' ? undefined : category});
            }
            if (onCategoryChange) onCategoryChange(category);
        },
        [onCategoryChange, fetchConfig],
    );

    const handleSearchChange = useCallback(
        (query: string) => {
            setSearchQuery(query.toLowerCase());
            if (fetchConfig) {
                hookDataRef.current.updateParams({ searchText: query || undefined });
            }
            if (onSearchChange) onSearchChange(query);
        },
        [onSearchChange, fetchConfig],
    );

    const handleSortChange = useCallback(
        (column: string) => {
            setSortState((prev) => {
                const newDirection: 'asc' | 'desc' = prev.column === column
                    ? (prev.direction === 'asc' ? 'desc' : 'asc')
                    : 'asc';
                return {column, direction: newDirection};
            });
        },
        [],
    );

    // When sort changes: update hook params (fetchConfig mode) or notify AngularJS (legacy mode)
    const sortChangeInitRef = useRef(true);
    useEffect(() => {
        if (sortChangeInitRef.current) {
            sortChangeInitRef.current = false;
            return;
        }
        if (sortState.column && sortState.direction) {
            if (fetchConfig) {
                hookDataRef.current.updateSort(sortState.column, sortState.direction);
            } else if (onBackendFilter) {
                onBackendFilter(sortState.column, sortState.direction);
            }
        }
    }, [sortState.column, sortState.direction, fetchConfig, onBackendFilter]);

    const handleLoggedInCouriersOnlyChange = useCallback((checked: boolean) => {
        setLoggedInCouriersOnly(checked);
    }, []);

    const handleDensityModeChange = useCallback((mode: DensityMode) => {
        setDensityMode(mode);
    }, []);

    const handleColumnWidthsChange = useCallback((widths: Record<string, number>) => {
        setColumnWidths(widths);
    }, []);

    const handleResetColumns = useCallback(() => {
        setColumnWidths({...DEFAULT_COLUMN_WIDTHS});
    }, []);

    const handleRefresh = useCallback(() => {
        if (fetchConfig) {
            hookDataRef.current.refresh();
        } else if (onRefresh) {
            onRefresh();
        }
    }, [fetchConfig, onRefresh]);

    // ── Bulk action handlers ───────────────────────────────────────────

    const handleBulkRestore = useCallback(async () => {
        const ids = [...multiSelect.selectedIds];
        try {
            await restoreJobs(ids);
            showToast(`${ids.length} job(s) restored`, 'success');
            multiSelect.clear();
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            showToast('Failed to restore jobs', 'error');
        }
    }, [multiSelect, showToast, fetchConfig, onRefresh]);

    const handleBulkMarkRead = useCallback(async () => {
        const ids = [...multiSelect.selectedIds];
        try {
            await bulkUpdateReadStatus(ids, true);
            showToast(`${ids.length} job(s) marked as read`, 'success');
            multiSelect.clear();
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            showToast('Failed to mark jobs as read', 'error');
        }
    }, [multiSelect, showToast, fetchConfig, onRefresh]);

    const handleBulkMarkUnread = useCallback(async () => {
        const ids = [...multiSelect.selectedIds];
        try {
            await bulkUpdateReadStatus(ids, false);
            showToast(`${ids.length} job(s) marked as unread`, 'success');
            multiSelect.clear();
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            showToast('Failed to mark jobs as unread', 'error');
        }
    }, [multiSelect, showToast, fetchConfig, onRefresh]);

    const handleBulkDispatch = useCallback(async (courierId: number, courierName: string) => {
        const ids = [...multiSelect.selectedIds];
        try {
            await allocateJobs(courierId, ids);
            showToast(`${ids.length} job(s) dispatched to ${courierName}`, 'success');
            multiSelect.clear();
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            showToast('Failed to dispatch jobs', 'error');
        }
    }, [multiSelect, showToast, fetchConfig, onRefresh]);

    const handleJobDispatch = useCallback(async (
        job: DispatchJob,
        courierId: number,
        courierName: string,
    ) => {
        // Parse courier code and name from "101 - John Smith" format
        const parts = courierName.split(' - ');
        const courierCode = parts[0]?.trim() || '';
        const courierDisplayName = parts.slice(1).join(' - ').trim() || courierName;

        // Optimistic update — immediately show courier in the list
        setPushedJobs(prev => prev.map(j => {
            if (j.id !== job.id) return j;
            return {
                ...j,
                assignedCourier: {id: courierId, text: courierName},
                courierData: {
                    ...j.courierData,
                    courier: courierCode,
                    courierName: courierDisplayName,
                    courierNumber: String(courierId),
                } as CourierData,
                statusId: JOB_STATUS.Dispatched,
                status: 'Dispatched',
                statusName: 'Dispatched',
            };
        }));

        try {
            await allocateJobs(courierId, [job.id]);
            showToast(`Dispatched to ${courierName}`, 'success');
            // Refresh data
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            // Rollback — restore original job
            setPushedJobs(prev => prev.map(j => j.id === job.id ? job : j));
            showToast('Failed to dispatch job', 'error');
        }
    }, [showToast, fetchConfig, onRefresh]);

    // ── Render ───────────────────────────────────────────────────────

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
        }}>
            <JobListStatsHeader stats={stats}/>
            <JobListToolbar
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                loggedInCouriersOnly={loggedInCouriersOnly}
                onLoggedInCouriersOnlyChange={handleLoggedInCouriersOnlyChange}
                densityMode={densityMode}
                onDensityModeChange={handleDensityModeChange}
                onResetColumns={handleResetColumns}
                appPage={appPage}
                selectedCount={multiSelect.selectCount}
                onClearSelection={multiSelect.clear}
                onBulkDispatch={handleBulkDispatch}
                onBulkRestore={handleBulkRestore}
                onBulkMarkRead={handleBulkMarkRead}
                onBulkMarkUnread={handleBulkMarkUnread}
            />
            <JobListTable
                jobs={visibleJobs}
                selectedJobId={selectedJobId}
                relatedJobIds={relatedJobIds}
                multiSelectedIds={multiSelect.selectedIds}
                onJobClick={handleJobClick}
                onContextMenu={handleContextMenu}
                onJobDispatch={handleJobDispatch}
                sortState={sortState}
                onSortChange={handleSortChange}
                densityMode={densityMode}
                columnWidths={columnWidths}
                onColumnWidthsChange={handleColumnWidthsChange}
                isUsCustomer={isUsCustomer}
                appPage={appPage}
                isJobSearchPage={isJobSearchPage}
                loggedInCouriersOnly={loggedInCouriersOnly}
            />
            <JobListFooter
                displayedCount={visibleJobs.length}
                totalCount={totalCount}
                lastUpdated={lastUpdated}
                allJobsLoaded={totalCount > 0 && jobs.length >= totalCount}
            />
            <JobListContextMenu
                job={contextMenuJob}
                position={contextMenuPos}
                onClose={handleCloseContextMenu}
                appPage={appPage}
                showToast={showToast}
                onRefresh={handleRefresh}
                onAddStop={onAddStop}
                isUsCustomer={isUsCustomer}
            />
        </Box>
    );
};
