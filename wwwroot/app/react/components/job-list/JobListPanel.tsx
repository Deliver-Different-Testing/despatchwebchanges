/**
 * Job List Panel
 *
 * Main container for the React dispatch job list.
 * Manages local UI state (filtering, sorting, density, selection, context menu)
 * while receiving job data from AngularJS via props/callbacks.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Progress} from '@mantine/core';
import {useDebouncedValue, useDisclosure, useHotkeys, useLocalStorage} from '@mantine/hooks';
import dayjs from 'dayjs';
import type {
    CourierData,
    DensityMode,
    DispatchJob,
    JobCategory,
    JobListPanelProps,
    JobListSort,
} from '../../interfaces/dispatchJob';
import {JobListStatsHeader} from './JobListStatsHeader';
import {JobListToolbar} from './JobListToolbar';
import {JobListViewOptions} from './JobListViewOptions';
import {JobListColumnEditor} from './JobListColumnEditor';
import {availableColumns, DEFAULT_COLUMN_WIDTHS, orderColumns} from './jobListColumns';
import {HeaderSlotPortal} from '../common/header-slot/HeaderSlotPortal';
import {JobListTable} from './JobListTable';
import {JobListContextMenu} from './JobListContextMenu';
import {JobListFooter} from './JobListFooter';
import type {AddressViewModel} from '../../interfaces/address';
import {
    addRestoreEvent,
    allocateJobs,
    bulkUpdateReadStatus,
    restoreJobs,
    getRestorePodImpact,
    updateJobReadStatus,
    getActivePartnerOptions,
    getPartnerRateForJob,
} from '../../services/jobListApi';
import {useJobListData} from '../../hooks/useJobListData';
import {useMultiSelect} from '../../hooks/useMultiSelect';
import {isDelivered, isInTransit, isUrgent, JOB_STATUS, needsDispatch} from './jobListHelpers';
import {jobListStorageKey, loadJobListCategory, persistJobListCategory, toStatusFilter} from './jobListPreferences';
import {queryClient, queryKeys} from '../../query/queryClient';
import {getNoteTypes} from '../../services/notesApi';
import {DispatchDialog} from '../dialogs/dispatch-dialog';
import {RestoreConfirmationDialog} from '../dialogs/restore-confirmation-dialog';
import type {RestorePodImpactSummary} from '../dialogs/restore-confirmation-dialog';
import {needsRestoreConfirmation, summarisePodImpact} from '../../services/restorePodImpact';

// ── Constants ────────────────────────────────────────────────────────


const DEFAULT_STORAGE_PREFIX = 'jobListReact';

// ── Filter / Sort Helpers ────────────────────────────────────────────

function hasIssues(job: DispatchJob): boolean {
    return [JOB_STATUS.Rejected, JOB_STATUS.LatePickup, JOB_STATUS.Warning, JOB_STATUS.LateDelivery, JOB_STATUS.Undeliverable].includes(
        job.statusId as any,
    );
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

// Hoisted helpers to avoid closure allocation per matchesSearch call
function safeIncludes(value: unknown, q: string): boolean {
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(q);
}

function searchAddress(address: AddressViewModel | undefined, q: string): boolean {
    if (!address) return false;
    return (
        safeIncludes(address.addressLine1, q) ||
        safeIncludes(address.addressLine2, q) ||
        safeIncludes(address.addressLine3, q) ||
        safeIncludes(address.addressLine4, q) ||
        safeIncludes(address.addressLine5, q) ||
        safeIncludes(address.addressLine6, q) ||
        safeIncludes(address.addressLine7, q) ||
        safeIncludes(address.addressLine8, q) ||
        safeIncludes(address.fullAddress, q)
    );
}

function matchesSearch(job: DispatchJob, query: string): boolean {
    if (!query) return true;
    // query is already lowercased and trimmed by the caller
    return (
        safeIncludes(job.jobNo, query) ||
        safeIncludes(job.client, query) ||
        safeIncludes(job.statusName, query) ||
        safeIncludes(job.assignedCourier?.text, query) ||
        safeIncludes(job.pickupContact, query) ||
        safeIncludes(job.deliveryContact, query) ||
        searchAddress(job.pickupAddress, query) ||
        searchAddress(job.deliveryAddress, query) ||
        safeIncludes(job.speed, query) ||
        safeIncludes(job.notify, query) ||
        safeIncludes(job.conNote, query) ||
        safeIncludes(job.assignedAgent?.agentName, query) ||
        safeIncludes(job.assignedFlight?.flightNumber, query)
    );
}

function formatAddressOrFallback(
    address: AddressViewModel | undefined,
    pickLines: (a: AddressViewModel) => Array<string | undefined>,
    fallback: string | undefined,
): string {
    if (address) {
        return pickLines(address).filter((l): l is string => Boolean(l && l.trim())).join(', ');
    }
    return (fallback || '').split(',').map((l) => l.trim()).join(', ');
}

function getPickupAddressStr(job: DispatchJob): string {
    return formatAddressOrFallback(
        job.pickupAddress,
        (a) => [a.addressLine2, a.addressLine3, a.addressLine4, a.addressLine5, a.addressLine6, a.addressLine7, a.addressLine8],
        job.from,
    );
}

function getDeliveryAddressStr(job: DispatchJob): string {
    return formatAddressOrFallback(
        job.deliveryAddress,
        (a) => [a.addressLine2, a.addressLine3, a.addressLine4, a.addressLine5, a.addressLine8],
        job.toAddress,
    );
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
            if (isInTransit(job)) return 3;
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

    // Pre-compute sort values once (O(n)) instead of recomputing in every comparison (O(n log n))
    const col = sortState.column!;
    const sortCache = new Map<number, string | number>();
    for (const job of sorted) {
        sortCache.set(job.id, getSortValue(job, col, isUsCustomer));
    }

    return sorted.sort((a, b) => {
        const aValue = sortCache.get(a.id)!;
        const bValue = sortCache.get(b.id)!;

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
                                                              onJobsLoaded,
                                                              defaultCategory,
                                                              storagePrefix = DEFAULT_STORAGE_PREFIX,
                                                              fetchConfig,
                                                              hideLoggedInSwitch,
                                                              columnEditMode,
                                                              onExitColumnEditMode,
                                                              headerSlot,
                                                              topSlot,
                                                              setJobsCallback,
                                                              setRefreshCallback,
                                                              setSelectJobCallback,
                                                              setUpdateSearchParamsCallback,
                                                          }) => {
    const getStorageKey = useCallback(
        (suffix: string): string => jobListStorageKey(storagePrefix, suffix),
        [storagePrefix],
    );

    // ── Prefetch note types (cached forever, removes waterfall from job detail) ──
    useEffect(() => {
        void queryClient.prefetchQuery({
            queryKey: queryKeys.notes.types,
            queryFn: ({signal}) => getNoteTypes({signal}),
            staleTime: Infinity,
        });
    }, []);

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

    // ── Notify parent when jobs are loaded (for map sync) ────────────
    useEffect(() => {
        if (onJobsLoaded && fetchConfig && jobs.length > 0) {
            onJobsLoaded(jobs);
        }
    }, [jobs, onJobsLoaded, fetchConfig]);

    // ── UI State ─────────────────────────────────────────────────────
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<JobCategory>(
        () => loadJobListCategory(storagePrefix) ?? defaultCategory ?? 'all',
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedRawQuery] = useDebouncedValue(searchQuery, 200);
    // Clearing the box filters immediately; only typing pays the debounce.
    const debouncedSearchQuery = searchQuery ? debouncedRawQuery : '';
    /*
     * Persisted panel preferences. `getInitialValueInEffect: false` throughout —
     * the default defers the read to an effect, which would paint one frame of
     * default widths/order before the saved layout lands. The two non-JSON keys
     * keep their original encodings so preferences saved before this hook
     * arrived still load.
     */
    const [sortState, setSortState] = useLocalStorage<JobListSort>({
        key: getStorageKey('sortState'),
        defaultValue: {column: null, direction: null},
        getInitialValueInEffect: false,
    });
    const [densityMode, setDensityMode] = useLocalStorage<DensityMode>({
        key: getStorageKey('densityMode'),
        defaultValue: 'dense',
        serialize: (value) => value,
        deserialize: (value) => (value as DensityMode) || 'dense',
        getInitialValueInEffect: false,
    });
    const [columnWidths, setColumnWidths] = useLocalStorage<Record<string, number>>({
        key: getStorageKey('columnWidths'),
        defaultValue: {...DEFAULT_COLUMN_WIDTHS},
        // A saved width map only covers the columns the user actually resized,
        // so it layers over the defaults rather than replacing them.
        deserialize: (value) => {
            try {
                return value ? {...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(value)} : {...DEFAULT_COLUMN_WIDTHS};
            } catch {
                return {...DEFAULT_COLUMN_WIDTHS};
            }
        },
        getInitialValueInEffect: false,
    });
    const [columnOrder, setColumnOrder] = useLocalStorage<string[]>({
        key: getStorageKey('columnOrder'),
        defaultValue: [],
        getInitialValueInEffect: false,
    });
    const [hiddenColumns, setHiddenColumns] = useLocalStorage<string[]>({
        key: getStorageKey('hiddenColumns'),
        defaultValue: [],
        getInitialValueInEffect: false,
    });
    const [loggedInCouriersOnly, setLoggedInCouriersOnly] = useLocalStorage<boolean>({
        key: getStorageKey('loggedInCouriersOnly'),
        defaultValue: false,
        serialize: (value) => String(value),
        deserialize: (value) => value === 'true',
        getInitialValueInEffect: false,
    });
    const [lastUpdated, setLastUpdated] = useState(() => `Last updated: ${dayjs().format('h:mm A')}`);

    // Context menu state
    const [contextMenuJob, setContextMenuJob] = useState<DispatchJob | null>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ mouseX: number; mouseY: number } | null>(null);

    const isJobSearchPage = appPage === 3; // AppPage.JobSearch
    // Live-dispatching affordance: the dispatch job list only, not job search.
    const showLoggedInSwitch = appPage === 1 && !hideLoggedInSwitch; // AppPage.Dispatch
    // Forced off where the switch is hidden, so a stored `true` can't keep
    // filtering the courier search with no UI to clear it.
    const loggedInCouriersOnlyEffective = showLoggedInSwitch && loggedInCouriersOnly;

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

    // Update category when defaultCategory prop changes. Only an actual change counts —
    // on mount the stored category has already won in the initialiser above, and this
    // effect would otherwise clobber it every time the panel is remounted.
    const previousDefaultCategoryRef = useRef(defaultCategory);
    useEffect(() => {
        if (defaultCategory && defaultCategory !== previousDefaultCategoryRef.current) {
            setSelectedCategory(defaultCategory);
        }
        previousDefaultCategoryRef.current = defaultCategory;
    }, [defaultCategory]);

    // Update lastUpdated when hook data changes (fetchConfig mode)
    useEffect(() => {
        if (hookData && !hookData.isLoading && !hookData.isFetching) {
            setLastUpdated(`Last updated: ${dayjs().format('h:mm A')}`);
        }
    }, [hookData?.isLoading, hookData?.isFetching]);

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
        if (debouncedSearchQuery && !fetchConfig) {
            filtered = filtered.filter((job) => matchesSearch(job, debouncedSearchQuery));
        }

        // Sort
        filtered = sortJobs(filtered, sortState, isUsCustomer);

        // Stats from full (unfiltered) jobs — single pass
        const statsResult = {total: jobs.length, active: 0, transit: 0, done: 0};
        for (const j of jobs) {
            if (needsDispatch(j)) statsResult.active++;
            if (isInTransit(j)) statsResult.transit++;
            if (isDelivered(j)) statsResult.done++;
        }

        return {filteredJobs: filtered, stats: statsResult};
    }, [jobs, selectedCategory, debouncedSearchQuery, sortState, isUsCustomer, fetchConfig]);

    // ── Related job highlighting ────────────────────────────────────
    const relatedJobIds = useMemo(() => {
        if (!selectedJobId) return new Set<number>();
        const selectedJob = jobs.find((j) => j.id === selectedJobId);
        if (!selectedJob?.relatedJobs?.length) return new Set<number>();
        return new Set(selectedJob.relatedJobs.map((r) => r.id));
    }, [jobs, selectedJobId]);

    // ── Visible jobs (backend controls ordering) ───────────────────
    const visibleJobs = filteredJobs;

    const visibleJobIds = useMemo(() => visibleJobs.map(j => j.id), [visibleJobs]);
    const multiSelect = useMultiSelect(visibleJobIds);

    // Clear multi-select when category or search changes
    useEffect(() => {
        multiSelect.clear();
    }, [selectedCategory, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape key clears multi-select. The empty tags-to-ignore list keeps the
    // previous document-level reach — Escape works from inside the search box
    // too, which useHotkeys would otherwise skip.
    useHotkeys([['Escape', () => {
        if (multiSelect.selectCount > 0) multiSelect.clear();
    }]], []);

    // ── Handlers ─────────────────────────────────────────────────────

    const handleJobClick = useCallback(
        (job: DispatchJob, event: React.MouseEvent) => {
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            const isShift = event.shiftKey;

            if (isCtrlOrCmd || isShift) {
                // If starting multi-select from a plain-clicked job, include it
                if (selectedJobId !== null && multiSelect.selectCount === 0) {
                    multiSelect.toggle(selectedJobId, {
                        ctrlKey: true,
                        metaKey: false,
                        shiftKey: false
                    } as React.MouseEvent);
                }
                // Modifier click → multi-select, don't change detail panel
                multiSelect.toggle(job.id, event);
            } else {
                // Plain click → set detail panel selection
                setSelectedJobId(job.id);
                if (onJobSelect) onJobSelect(job);
                if (!job.hasBeenRead) {
                    updateJobReadStatus(job.id, true).then(() => {
                        if (fetchConfig) hookDataRef.current.refresh();
                        else if (onRefresh) onRefresh();
                    });
                }
            }
        },
        [onJobSelect, multiSelect, fetchConfig, onRefresh, selectedJobId],
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
        [multiSelect, multiSelect.selectedIds],
    );

    const handleCloseContextMenu = useCallback(() => {
        setContextMenuJob(null);
        setContextMenuPos(null);
    }, []);

    const handleCategoryChange = useCallback(
        (category: JobCategory) => {
            setSelectedCategory(category);
            persistJobListCategory(storagePrefix, category);
            if (fetchConfig) {
                hookDataRef.current.updateParams({statusFilter: toStatusFilter(category)});
            }
            if (onCategoryChange) onCategoryChange(category);
        },
        [onCategoryChange, fetchConfig, storagePrefix],
    );

    const handleSearchChange = useCallback(
        (query: string) => {
            setSearchQuery(query.toLowerCase());
            if (fetchConfig) {
                hookDataRef.current.updateParams({searchText: query || undefined});
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
        [setSortState],
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
    }, [setLoggedInCouriersOnly]);

    const handleDensityModeChange = useCallback((mode: DensityMode) => {
        setDensityMode(mode);
    }, [setDensityMode]);

    const handleColumnWidthsChange = useCallback((widths: Record<string, number>) => {
        setColumnWidths(widths);
    }, [setColumnWidths]);

    const handleResetColumns = useCallback(() => {
        setColumnWidths({...DEFAULT_COLUMN_WIDTHS});
        setColumnOrder([]);
        setHiddenColumns([]);
    }, [setColumnWidths, setColumnOrder, setHiddenColumns]);

    // Every configurable column for this tenant/page, in the user's order —
    // what the editor lists. The table then drops the hidden ones.
    const editorColumns = useMemo(
        () => orderColumns(availableColumns(isUsCustomer, isJobSearchPage), columnOrder),
        [isUsCustomer, isJobSearchPage, columnOrder],
    );
    const tableColumns = useMemo(
        () => editorColumns.filter(col => col.locked || !hiddenColumns.includes(col.key)),
        [editorColumns, hiddenColumns],
    );

    const handleRefresh = useCallback(() => {
        if (fetchConfig) {
            hookDataRef.current.refresh();
        } else if (onRefresh) {
            onRefresh();
        }
    }, [fetchConfig, onRefresh]);

    // ── Bulk action handlers ───────────────────────────────────────────

    const [bulkRestoreConfirm, setBulkRestoreConfirm] = useState<RestorePodImpactSummary | null>(null);
    const [bulkRestoreChecking, setBulkRestoreChecking] = useState(false);

    const performBulkRestore = useCallback(async (removeCapturedImages = false) => {
        // Archived jobs live only in the archive tables; restore operates on live (tucJob)
        // rows, so restoring an archived job silently no-ops — exclude them.
        const ids = [...multiSelect.selectedIds].filter(
            id => !jobs.find(j => j.id === id)?.isArchived,
        );
        if (ids.length === 0) {
            showToast('Archived jobs can’t be restored', 'warning');
            return;
        }
        try {
            await Promise.all(ids.map(id => addRestoreEvent(id)));
            await restoreJobs(ids, removeCapturedImages);
            showToast(`${ids.length} job(s) restored`, 'success');
            multiSelect.clear();
            // Invalidate job detail (and related/photos) so an open detail panel reflects the
            // reset status, then refresh the list.
            await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch {
            showToast('Failed to restore jobs', 'error');
        }
    }, [multiSelect, jobs, showToast, fetchConfig, onRefresh]);

    const handleBulkRestore = useCallback(async () => {
        // Exclude archived jobs — restore only operates on live rows.
        const restorableIds = [...multiSelect.selectedIds].filter(
            id => !jobs.find(j => j.id === id)?.isArchived,
        );
        if (restorableIds.length === 0) {
            showToast('Archived jobs can’t be restored', 'warning');
            return;
        }
        if (bulkRestoreChecking) return;

        // Restoring re-opens a completed job and always clears the POD name, so find out what it
        // would cost before doing it. A failed check falls back to confirming completed jobs only.
        setBulkRestoreChecking(true);
        let summary: RestorePodImpactSummary = {jobsWithPodName: 0, imageCount: 0};
        try {
            summary = summarisePodImpact(await getRestorePodImpact(restorableIds));
        } catch {
            // Never block a restore on the pre-check.
        } finally {
            setBulkRestoreChecking(false);
        }

        const anyCompleted = restorableIds.some(id => jobs.find(j => j.id === id)?.done);
        if (needsRestoreConfirmation(anyCompleted, summary)) {
            setBulkRestoreConfirm(summary);
            return;
        }
        void performBulkRestore();
    }, [multiSelect, jobs, performBulkRestore, showToast, bulkRestoreChecking]);

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

    // Bulk dispatch dialog state. The universal DispatchDialog is rendered at the
    // panel level so the toolbar's "Dispatch" button just toggles open=true.
    const [bulkDispatchOpen, {open: openBulkDispatch, close: closeBulkDispatch}] = useDisclosure(false);
    const handleBulkDispatchClick = useCallback(() => {
        if (multiSelect.selectCount > 0) openBulkDispatch();
    }, [multiSelect.selectCount, openBulkDispatch]);

    const handleBulkDispatchCourier = useCallback(async (
        type: 'Courier' | 'Agent' | 'NP',
        destination: { id: number; text: string },
    ) => {
        if (type !== 'Courier') {
            // Bulk Agent / NP allocation isn't wired server-side. The dialog still
            // allows the radio (it's a single dialog for all modes) but submission
            // surfaces an error rather than silently failing.
            throw new Error(`${type} dispatch is not yet supported for bulk selections.`);
        }
        const ids = [...multiSelect.selectedIds];
        try {
            await allocateJobs(destination.id, ids);
            showToast(`${ids.length} job(s) dispatched to ${destination.text}`, 'success');
            closeBulkDispatch();
            multiSelect.clear();
            await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
            if (fetchConfig) {
                hookDataRef.current.refresh();
            } else if (onRefresh) {
                onRefresh();
            }
        } catch (err) {
            // Re-throw so the dialog surfaces the error inline.
            const message = err instanceof Error ? err.message : 'Failed to dispatch jobs';
            throw new Error(message, {cause: err});
        }
    }, [multiSelect, showToast, fetchConfig, onRefresh, closeBulkDispatch]);

    // Bulk DFRNT Partner is disabled in the dialog (per-job rates required),
    // so this should never fire — but the dialog still needs the prop.
    const handleBulkSendToPartner = useCallback(async () => {
        throw new Error('DFRNT Partner is not available for bulk dispatch.');
    }, []);

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
            // Refresh data — invalidate job detail so the detail panel updates too
            await queryClient.invalidateQueries({queryKey: queryKeys.jobs.all});
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
        <Box
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'var(--dd-surface-container)',
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {fetchConfig && hookData.isFetching && (
                <Progress.Root
                    size="xs"

                    style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1}}
                >
                    <Progress.Section value={100} animated aria-label="Loading jobs"/>
                </Progress.Root>
            )}
            {topSlot}
            <JobListStatsHeader stats={stats}/>
            {headerSlot && (
                <HeaderSlotPortal slot={headerSlot}>
                    <JobListViewOptions
                        densityMode={densityMode}
                        onDensityModeChange={handleDensityModeChange}
                        onResetColumns={handleResetColumns}
                        loggedInCouriersOnly={loggedInCouriersOnly}
                        onLoggedInCouriersOnlyChange={handleLoggedInCouriersOnlyChange}
                        showLoggedInSwitch={showLoggedInSwitch}
                        headerVariant
                    />
                </HeaderSlotPortal>
            )}
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
                onBulkDispatchClick={handleBulkDispatchClick}
                onBulkRestore={handleBulkRestore}
                onBulkMarkRead={handleBulkMarkRead}
                onBulkMarkUnread={handleBulkMarkUnread}
                showLoggedInSwitch={showLoggedInSwitch}
                renderViewOptions={!headerSlot}
            />
            {columnEditMode && (
                <JobListColumnEditor
                    columns={editorColumns}
                    hiddenColumns={hiddenColumns}
                    columnWidths={columnWidths}
                    onOrderChange={setColumnOrder}
                    onHiddenChange={setHiddenColumns}
                    onColumnWidthsChange={setColumnWidths}
                    onReset={handleResetColumns}
                    onDone={onExitColumnEditMode ?? (() => undefined)}
                />
            )}
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
                columns={tableColumns}
                isUsCustomer={isUsCustomer}
                appPage={appPage}
                isJobSearchPage={isJobSearchPage}
                loggedInCouriersOnly={loggedInCouriersOnlyEffective}
                onLoadMore={fetchConfig ? hookData.fetchNextPage : undefined}
                hasMore={fetchConfig ? hookData.hasMore : false}
                isFetchingMore={fetchConfig ? hookData.isFetchingNextPage : false}
            />
            <JobListFooter
                displayedCount={visibleJobs.length}
                totalCount={totalCount}
                lastUpdated={lastUpdated}
                isLoadingMore={fetchConfig ? hookData.isFetchingNextPage : false}
                allJobsLoaded={fetchConfig ? !hookData.hasMore && totalCount > 0 : totalCount > 0 && jobs.length >= totalCount}
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
            {/* Bulk dispatch dialog — opened by the toolbar's "Dispatch" button. */}
            <DispatchDialog
                open={bulkDispatchOpen}
                mode={{
                    kind: 'bulk',
                    jobs: visibleJobs
                        .filter(j => multiSelect.selectedIds.has(j.id))
                        .map(j => ({id: j.id, jobNo: j.jobNo})),
                }}
                initialType="Courier"
                onClose={closeBulkDispatch}
                onDispatchCourier={handleBulkDispatchCourier}
                onSendToPartner={handleBulkSendToPartner}
                fetchRate={getPartnerRateForJob}
                getPartnerOptions={getActivePartnerOptions}
            />
            {/* Confirm before a restore that reopens a completed job or destroys proof of delivery. */}
            <RestoreConfirmationDialog
                open={bulkRestoreConfirm !== null}
                count={[...multiSelect.selectedIds].filter(id => {
                    const j = jobs.find(x => x.id === id);
                    return j && !j.isArchived && j.done;
                }).length}
                podImpact={bulkRestoreConfirm ?? undefined}
                onClose={() => setBulkRestoreConfirm(null)}
                onConfirm={async (removeCapturedImages) => {
                    setBulkRestoreConfirm(null);
                    await performBulkRestore(removeCapturedImages);
                }}
            />
        </Box>
    );
};