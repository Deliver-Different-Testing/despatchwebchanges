import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {Box, Card, Collapse, Flex, Group, TextInput} from '@mantine/core';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../components/common/panel-controls';
import {useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../query';
import {
    useOverviewJobs,
    useOverviewRegions,
    useOverviewSpeeds,
    useOverviewStats,
    useOverviewOpenJobs,
} from '../../hooks/useOverviewApi';
import {useAiFeature} from '../../hooks/useAiFeature';
import {PanelHeader} from '../../components/common/panel-header';
import {SymbolIcon} from '../../components/common/symbol-icon';
import {FilterPanel} from './components/FilterPanel';
import {StatsTabs} from './components/StatsTabs';
import {DeliveriesTable, transformStatus} from '../../components/common/deliveries-table';
import {OpenJobsWidget} from './components/OpenJobsWidget';
import {MapDialog} from './components/MapDialog';
import {OpenJobConfirmDialog} from '../../components/common/recurring-delivery-journey/OpenJobConfirmDialog';
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

export const OverviewPage: React.FC<OverviewPageProps> = ({
                                                              onOpenJobDetail,
                                                              setRefreshCallback,
                                                          }) => {
    const queryClient = useQueryClient();
    const aiContainerRef = useRef<HTMLDivElement>(null);
    const aiBriefingsEnabled = useAiFeature('briefings');

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

    // Open-job confirmation dialog state
    const [confirmTarget, setConfirmTarget] = useState<{jobId: number; jobNumber: string} | null>(null);

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
        if (aiBriefingsEnabled && container && window.ReactAiAssistant) {
            window.ReactAiAssistant.renderOperationsInsightsPanel(container);
            return () => {
                if (container && window.ReactAiAssistant) {
                    window.ReactAiAssistant.unmountSummaryPanel(container);
                }
            };
        }
        // Re-runs when the user toggles briefings, so the panel appears and
        // disappears without a reload.
    }, [aiBriefingsEnabled]);

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

    /*
     * Resets every criterion at once. It lives here rather than being composed
     * from the per-group props in the panel, because "unselect all" is a toggle:
     * calling it on an empty group would select everything instead of clearing.
     */
    const handleClearAllFilters = useCallback(() => {
        setDateRange({});
        setSelectedRegionIds(new Set());
        setSelectedSpeedIds(new Set());
        setSelectedCouriers([]);
        setPage(1);
    }, []);

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
                setConfirmTarget({jobId: delivery.jobId, jobNumber: delivery.jobName});
            }
        },
        [],
    );

    const handleConfirmOpenJob = useCallback(() => {
        if (confirmTarget) {
            onOpenJobDetail(confirmTarget.jobId);
        }
        setConfirmTarget(null);
    }, [confirmTarget, onOpenJobDetail]);

    const handleCancelOpenJob = useCallback(() => {
        setConfirmTarget(null);
    }, []);

    const handleToggleOverviewCard = useCallback(() => {
        setIsOverviewCollapsed((prev) => {
            saveCollapseState('overview', !prev);
            return !prev;
        });
    }, []);
    
    // Flex takes a responsive direction natively — no media query needed.
    return (
        <Flex p={8} gap={16} direction={{base: 'column', md: 'row'}} bg="var(--mantine-color-body)">
            {/* Left Panel — Filters */}
            <Box miw={250} style={{flex: '0 0 20%'}}>
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
                    onClearAll={handleClearAllFilters}
                />
            </Box>

            {/* Right Panel — Overview + Open Jobs */}
            <Box miw={0} style={{flex: 1}}>
                <Card withBorder p={0}>
                    <PanelHeader
                        icon={<SymbolIcon name="overview" />}
                        title="Overview"
                        action={
                            <HeaderActionIcon
                                label={isOverviewCollapsed ? 'Expand overview' : 'Collapse overview'}
                                onClick={handleToggleOverviewCard}
                                aria-expanded={!isOverviewCollapsed}
                            >
                                <SymbolIcon
                                    name={isOverviewCollapsed ? 'expand_more' : 'expand_less'}
                                    size={PANEL_CONTROL_GLYPH_SIZE}
                                />
                            </HeaderActionIcon>
                        }
                    />

                    <Collapse expanded={!isOverviewCollapsed}>
                        {/*
                          * The panel's controls, on the same 32px band as the header
                          * above them: which status, and free-text within it.
                          */}
                        <Group
                            gap="sm"
                            px="md"
                            py="xs"
                            wrap="nowrap"
                            style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
                        >
                            <div style={{flex: 1}}/>
                            <TextInput
                                size="xs"
                                w={220}
                                placeholder="Search deliveries"
                                aria-label="Search deliveries"
                                value={search}
                                onChange={(e) => setSearch(e.currentTarget.value)}
                                leftSection={<SymbolIcon name="search" size={PANEL_CONTROL_GLYPH_SIZE} />}
                            />
                        </Group>
                        {/* The status tabs lead the list they filter — they are the
                            page's headline read, not a compact control, so they sit at
                            the top of the list rather than on the 32px control band. */}
                        <StatsTabs
                            statistics={statistics}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                        />
                        <Box px={16} pb={16}>
                            {/* AI Operations Insights */}
                            {aiBriefingsEnabled && <Box ref={aiContainerRef} mb={16}/>}

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

            {/* Open-job confirmation */}
            <OpenJobConfirmDialog
                open={confirmTarget != null}
                jobId={confirmTarget?.jobId ?? null}
                jobNumber={confirmTarget?.jobNumber ?? null}
                onCancel={handleCancelOpenJob}
                onConfirm={handleConfirmOpenJob}
            />
        </Flex>
    );
};

export default OverviewPage;
