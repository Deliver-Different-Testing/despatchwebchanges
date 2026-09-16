import React, {useCallback, useMemo, useState} from 'react';
import {Box, Group, Stack, Text, TextInput} from '@mantine/core';
import {useDebouncedValue, useLocalStorage, useSessionStorage} from '@mantine/hooks';
import type {Dayjs} from 'dayjs';
import {DeliveriesTable, transformStatus} from '../../../components/common/deliveries-table';
import type {OverviewTableParentJob} from '../../../components/common/deliveries-table';
import type {SortState} from '../../../components/common/data-table';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import {PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {SegmentedToggle} from '../../../components/common/segmented-toggle';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import {useOverviewJobs} from '../../../hooks/useOverviewApi';
import {ContactID} from '../../../../contants';
import {MAX_OVERVIEW_PANEL_DAYS, clampOverviewPanelRange} from '../lib/overviewPanelRange';

/*
 * BoxShell remounts every panel when the layout version bumps — which it does on
 * the async layout sync, a beat after mount — so anything an operator would
 * notice losing is persisted. Dispatch-specific keys throughout: the Overview
 * page's own preferences were set at a completely different width.
 */
const STATUS_KEY = `dispatchOverviewStatus-${ContactID}`;
const SORT_KEY = `dispatchOverviewSort-${ContactID}`;
const LIMIT_KEY = `dispatchOverviewLimit-${ContactID}`;
const SEARCH_KEY = `dispatchOverviewSearch-${ContactID}`;

/** The three status groups the `/overview` endpoint buckets jobs into. */
type StatusGroup = 'active' | 'inactive' | 'completed';

const STATUS_GROUPS: StatusGroup[] = ['active', 'inactive', 'completed'];

export interface OverviewDeliveriesBoxProps {
    /** Selected dispatch view ids; jobs are scoped to these, matching the main Jobs List. */
    despatchViewIds: number[];
    startDate: Dayjs;
    endDate: Dayjs;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Select the job into the board's Job Detail panel. */
    onSelectJob: (jobId: number) => void;
    /** Card header DOM node; the status toggle portals into it. */
    headerSlot?: HTMLElement | null;
}

/**
 * The Overview page's deliveries list as a dispatch panel: parent jobs with their
 * child legs and completion, scoped to the toolbar's date range.
 *
 * The status choice is a compact toggle in the panel header rather than the
 * Overview page's counted tab strip. Beside its own list it is a filter, not the
 * headline read — and the only counts available are global and unfiltered, so
 * they would contradict this panel's date range.
 *
 * Row selection drives the board's Job Detail panel (and through it the Map
 * panel), so there is no confirmation step and no per-row map action.
 */
export const OverviewDeliveriesBox: React.FC<OverviewDeliveriesBoxProps> = ({
    despatchViewIds,
    startDate,
    endDate,
    refetchIntervalMs = false,
    onSelectJob,
    headerSlot,
}) => {
    const [statusGroup, setStatusGroup] = useLocalStorage<StatusGroup>({
        key: STATUS_KEY,
        defaultValue: 'active',
        getInitialValueInEffect: false,
    });
    const [sort, setSort] = useLocalStorage<SortState>({
        key: SORT_KEY,
        defaultValue: {column: 'jobName', direction: 'asc'},
        getInitialValueInEffect: false,
    });
    const [limit, setLimit] = useLocalStorage<number>({
        key: LIMIT_KEY,
        defaultValue: 20,
        getInitialValueInEffect: false,
    });
    const [search, setSearch] = useSessionStorage<string>({
        key: SEARCH_KEY,
        defaultValue: '',
        getInitialValueInEffect: false,
    });
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const [page, setPage] = useState(1);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const range = useMemo(
        () => clampOverviewPanelRange(startDate, endDate),
        [startDate, endDate],
    );

    const {data, isLoading} = useOverviewJobs(
        {
            statusGroup: STATUS_GROUPS.indexOf(statusGroup) + 1,
            page,
            limit,
            search: debouncedSearch || undefined,
            startDate: range.startDate,
            endDate: range.endDate,
            orderBy: sort.column,
            orderDirection: sort.direction,
            despatchViewIds,
        },
        refetchIntervalMs || undefined,
    );

    const deliveries: OverviewTableParentJob[] = useMemo(() => {
        if (!data?.items) return [];
        return data.items.map((d) => ({
            ...d,
            status: transformStatus(d.status),
            expanded: expandedRows.has(d.jobId),
            childJobs: (d.childJobs ?? []).map((c) => ({...c, status: transformStatus(c.status)})),
        }));
    }, [data, expandedRows]);

    // Every filter change invalidates the current page number, so reset alongside.
    const changeStatusGroup = useCallback((next: StatusGroup) => {
        setStatusGroup(next);
        setPage(1);
    }, [setStatusGroup]);

    const changeSearch = useCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, [setSearch]);

    const changeSort = useCallback((next: SortState) => {
        setSort(next);
        setPage(1);
    }, [setSort]);

    const changeLimit = useCallback((next: number) => {
        setLimit(next);
        setPage(1);
    }, [setLimit]);

    const toggleExpand = useCallback((jobId: number) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return next;
        });
    }, []);

    return (
        <Stack h="100%" gap={0} style={{minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                <Group gap={4} wrap="nowrap">
                    <SegmentedToggle<StatusGroup>
                        aria-label="Delivery status"
                        value={statusGroup}
                        onChange={changeStatusGroup}
                        data={[
                            {value: 'active', label: 'Active'},
                            {value: 'inactive', label: 'Inactive'},
                            {value: 'completed', label: 'Completed'},
                        ]}
                    />
                </Group>
            </HeaderSlotPortal>

            <Box px="xs" pt={4} style={{flexShrink: 0}}>
                <TextInput
                    size="xs"
                    placeholder="Search deliveries"
                    aria-label="Search deliveries"
                    value={search}
                    onChange={(e) => changeSearch(e.currentTarget.value)}
                    leftSection={<SymbolIcon name="search" size={PANEL_CONTROL_GLYPH_SIZE}/>}
                />
                {range.clamped && (
                    <Text fz="xs" c="dimmed" mt={4}>
                        Showing the last {MAX_OVERVIEW_PANEL_DAYS} days of the selected range.
                    </Text>
                )}
            </Box>

            <Box style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                <DeliveriesTable
                    deliveries={deliveries}
                    isLoading={isLoading}
                    sort={sort}
                    onSort={changeSort}
                    page={page}
                    limit={limit}
                    total={data?.total ?? 0}
                    onPageChange={setPage}
                    onLimitChange={changeLimit}
                    onOpenJobDetail={(delivery) => onSelectJob(delivery.jobId)}
                    onToggleExpand={toggleExpand}
                />
            </Box>
        </Stack>
    );
};

export default OverviewDeliveriesBox;
