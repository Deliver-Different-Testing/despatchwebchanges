import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Collapse from '@mui/material/Collapse';
import {useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../query';
import {
    useOverviewJobs,
    useOverviewRegions,
    useOverviewSpeeds,
    useOverviewStats,
    useOverviewOpenJobs,
} from '../../hooks/useOverviewApi';
import {isAiEnabled} from '../../../functions/aiSettings';
import {FilterPanel} from './components/FilterPanel';
import {StatsTabs} from './components/StatsTabs';
import {DeliveriesTable} from './components/DeliveriesTable';
import {OpenJobsWidget} from './components/OpenJobsWidget';
import {MapDialog} from './components/MapDialog';
import type {
    OverviewPageProps,
    OverviewQueryParams,
    OverviewTableParentJob,
    ISuggestion,
    DateRange,
    TableSort,
} from './OverviewPage.interfaces';

// Window.ReactAiAssistant type is declared in wwwroot/types/global.d.ts

const OVERVIEW_LIMIT_KEY = `overviewJobLimitDisplay-${ContactID}`;

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

function transformStatus(status: string): string {
    return status.toUpperCase().replace(/[\s-]/g, '_');
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
                                                              onOpenJobDetail,
                                                              setRefreshCallback,
                                                          }) => {
    const queryClient = useQueryClient();
    const aiContainerRef = useRef<HTMLDivElement>(null);

    // ── State ──
    const [activeTab, setActiveTab] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>({});
    const [selectedRegionIds, setSelectedRegionIds] = useState<Set<number>>(new Set());
    const [selectedSpeedIds, setSelectedSpeedIds] = useState<Set<number>>(new Set());
    const [selectedCouriers, setSelectedCouriers] = useState<ISuggestion[]>([]);
    const [sort, setSort] = useState<TableSort>({column: 'jobName', direction: 'asc'});
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(() => {
        const saved = localStorage.getItem(OVERVIEW_LIMIT_KEY);
        return saved ? parseInt(saved, 10) : 20;
    });
    const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(() =>
        loadCollapseState('overview'),
    );

    // Map dialog state
    const [mapDialogOpen, setMapDialogOpen] = useState(false);
    const [mapDelivery, setMapDelivery] = useState<OverviewTableParentJob | null>(null);

    // Expandable rows state
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // ── Query params ──
    const queryParams: OverviewQueryParams = useMemo(
        () => ({
            statusGroup: activeTab + 1,
            page,
            limit,
            search: debouncedSearch || undefined,
            startDate: dateRange.start,
            endDate: dateRange.end,
            orderBy: sort.column,
            orderDirection: sort.direction,
            regions: selectedRegionIds.size > 0 ? Array.from(selectedRegionIds) : undefined,
            speeds: selectedSpeedIds.size > 0 ? Array.from(selectedSpeedIds) : undefined,
            couriers:
                selectedCouriers.length > 0
                    ? selectedCouriers.map((c) => c.id)
                    : undefined,
        }),
        [activeTab, page, limit, debouncedSearch, dateRange, sort, selectedRegionIds, selectedSpeedIds, selectedCouriers],
    );

    const openJobsParams = useMemo(
        () => ({
            startDate: dateRange.start,
            endDate: dateRange.end,
            regions: selectedRegionIds.size > 0 ? Array.from(selectedRegionIds) : undefined,
            speeds: selectedSpeedIds.size > 0 ? Array.from(selectedSpeedIds) : undefined,
            couriers:
                selectedCouriers.length > 0
                    ? selectedCouriers.map((c) => c.id)
                    : undefined,
        }),
        [dateRange, selectedRegionIds, selectedSpeedIds, selectedCouriers],
    );

    // ── Queries ──
    const {data: jobsData, isLoading: jobsLoading} = useOverviewJobs(queryParams);
    const {data: regions = [], isLoading: regionsLoading} = useOverviewRegions();
    const {data: speeds = [], isLoading: speedsLoading} = useOverviewSpeeds();
    const {data: statsData} = useOverviewStats();
    const {data: openJobsData = [], isLoading: openJobsLoading} = useOverviewOpenJobs(openJobsParams, 60000);

    const statistics = statsData ?? {active: 0, inactive: 0, completed: 0};

    // Transform deliveries — apply status normalization
    const deliveries: OverviewTableParentJob[] = useMemo(() => {
        if (!jobsData?.items) return [];
        return jobsData.items.map((d) => ({
            ...d,
            status: transformStatus(d.status),
            expanded: expandedRows.has(d.jobId),
            childJobs: (d.childJobs ?? []).map((c) => ({
                ...c,
                status: transformStatus(c.status),
            })),
        }));
    }, [jobsData, expandedRows]);

    const total = jobsData?.total ?? 0;

    // ── Refresh callback (exposed to AngularJS) ──
    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({queryKey: queryKeys.overview.all});
    }, [queryClient]);

    useEffect(() => {
        setRefreshCallback(handleRefresh);
    }, [setRefreshCallback, handleRefresh]);

    // ── AI Insights panel ──
    useEffect(() => {
        const container = aiContainerRef.current;
        if (isAiEnabled() && container && window.ReactAiAssistant) {
            window.ReactAiAssistant.renderOperationsInsightsPanel(container);
            return () => {
                if (container && window.ReactAiAssistant) {
                    window.ReactAiAssistant.unmountSummaryPanel(container);
                }
            };
        }
    }, []);

    // ── Filter handlers ──
    const allRegionsSelected = regions.length > 0 && selectedRegionIds.size === regions.length;
    const allSpeedsSelected = speeds.length > 0 && selectedSpeedIds.size === speeds.length;

    const handleToggleRegion = useCallback(
        (regionId: number) => {
            setSelectedRegionIds((prev) => {
                const next = new Set(prev);
                if (next.has(regionId)) next.delete(regionId);
                else next.add(regionId);
                return next;
            });
            setPage(1);
        },
        [],
    );

    const handleToggleAllRegions = useCallback(() => {
        if (allRegionsSelected) {
            setSelectedRegionIds(new Set());
        } else {
            setSelectedRegionIds(new Set(regions.map((r) => r.id)));
        }
        setPage(1);
    }, [allRegionsSelected, regions]);

    const handleToggleSpeed = useCallback(
        (speedId: number) => {
            setSelectedSpeedIds((prev) => {
                const next = new Set(prev);
                if (next.has(speedId)) next.delete(speedId);
                else next.add(speedId);
                return next;
            });
            setPage(1);
        },
        [],
    );

    const handleToggleAllSpeeds = useCallback(() => {
        if (allSpeedsSelected) {
            setSelectedSpeedIds(new Set());
        } else {
            setSelectedSpeedIds(new Set(speeds.map((s) => s.id)));
        }
        setPage(1);
    }, [allSpeedsSelected, speeds]);

    const handleAddCourier = useCallback((courier: ISuggestion) => {
        setSelectedCouriers((prev) => {
            if (prev.some((c) => c.id === courier.id)) return prev;
            return [...prev, courier];
        });
        setPage(1);
    }, []);

    const handleRemoveCourier = useCallback((courierId: number) => {
        setSelectedCouriers((prev) => prev.filter((c) => c.id !== courierId));
        setPage(1);
    }, []);

    const handleDateRangeChange = useCallback((range: DateRange) => {
        setDateRange(range);
        setPage(1);
    }, []);

    // ── Tab / Sort / Pagination ──
    const handleTabChange = useCallback((tab: number) => {
        setActiveTab(tab);
        setPage(1);
    }, []);

    const handleSort = useCallback((newSort: TableSort) => {
        setSort(newSort);
        setPage(1);
    }, []);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
    }, []);

    const handleLimitChange = useCallback((newLimit: number) => {
        setLimit(newLimit);
        localStorage.setItem(OVERVIEW_LIMIT_KEY, `${newLimit}`);
        setPage(1);
    }, []);

    const handleToggleExpand = useCallback((jobId: number) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return next;
        });
    }, []);

    // ── Map dialog ──
    const handleShowMap = useCallback((delivery: OverviewTableParentJob) => {
        setMapDelivery(delivery);
        setMapDialogOpen(true);
    }, []);

    const handleOpenJobDetail = useCallback(
        (delivery: OverviewTableParentJob) => {
            if (delivery?.jobId) {
                onOpenJobDetail(delivery.jobId);
            }
        },
        [onOpenJobDetail],
    );

    const handleToggleOverviewCard = useCallback(() => {
        setIsOverviewCollapsed((prev) => {
            saveCollapseState('overview', !prev);
            return !prev;
        });
    }, []);
    
    return (
        <Box
            sx={{
                p: 2,
                display: 'flex',
                flexDirection: {xs: 'column', md: 'row'},
                gap: 2,
            }}
        >
            {/* Left Panel — Filters */}
            <Box sx={{flex: '0 0 20%', minWidth: 250}}>
                <FilterPanel
                    regions={regions}
                    regionsLoading={regionsLoading}
                    selectedRegionIds={selectedRegionIds}
                    allRegionsSelected={allRegionsSelected}
                    onToggleRegion={handleToggleRegion}
                    onToggleAllRegions={handleToggleAllRegions}
                    speeds={speeds}
                    speedsLoading={speedsLoading}
                    selectedSpeedIds={selectedSpeedIds}
                    allSpeedsSelected={allSpeedsSelected}
                    onToggleSpeed={handleToggleSpeed}
                    onToggleAllSpeeds={handleToggleAllSpeeds}
                    selectedCouriers={selectedCouriers}
                    onAddCourier={handleAddCourier}
                    onRemoveCourier={handleRemoveCourier}
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                />
            </Box>

            {/* Right Panel — Overview + Open Jobs */}
            <Box sx={{flex: 1, minWidth: 0}}>
                <Card>
                    {/* Card Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            px: 2,
                            py: 1,
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            minHeight: 44,
                        }}
                    >
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>
                            overview
                        </span>
                        <Typography variant="subtitle1" sx={{ml: 1, flex: 1, fontWeight: 500}}>
                            Overview
                        </Typography>
                        <IconButton size="small" onClick={handleToggleOverviewCard} sx={{color: 'inherit'}}>
                            <span className="material-symbols-outlined">
                                {isOverviewCollapsed ? 'expand_more' : 'expand_less'}
                            </span>
                        </IconButton>
                    </Box>

                    <Collapse in={!isOverviewCollapsed}>
                        <Box sx={{p: 2}}>
                            {/* Search */}
                            <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 2}}>
                                <TextField
                                    size="small"
                                    placeholder="Search deliveries..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                                        search
                                                    </span>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    sx={{flex: 1}}
                                />
                            </Box>

                            {/* Stats Tabs */}
                            <StatsTabs
                                statistics={statistics}
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />

                            {/* AI Operations Insights */}
                            {isAiEnabled() && <Box ref={aiContainerRef} sx={{mb: 2}}/>}

                            {/* Deliveries Table */}
                            <DeliveriesTable
                                deliveries={deliveries}
                                isLoading={jobsLoading}
                                sort={sort}
                                onSort={handleSort}
                                page={page}
                                limit={limit}
                                total={total}
                                onPageChange={handlePageChange}
                                onLimitChange={handleLimitChange}
                                onShowMap={handleShowMap}
                                onOpenJobDetail={handleOpenJobDetail}
                                onToggleExpand={handleToggleExpand}
                            />
                        </Box>
                    </Collapse>
                </Card>

                {/* Open Jobs Widget */}
                <OpenJobsWidget openJobs={openJobsData} isLoading={openJobsLoading}/>
            </Box>

            {/* Map Dialog */}
            <MapDialog
                open={mapDialogOpen}
                onClose={() => setMapDialogOpen(false)}
                delivery={mapDelivery}
            />
        </Box>
    );
};

export default OverviewPage;
