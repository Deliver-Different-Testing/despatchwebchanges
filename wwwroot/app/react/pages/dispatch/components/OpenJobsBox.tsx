import React, {useCallback, useMemo, useState} from 'react';
import {Box, Group, Stack, Text} from '@mantine/core';
import {useLocalStorage} from '@mantine/hooks';
import type {Dayjs} from 'dayjs';
import type {SortState} from '../../../components/common/data-table';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import {OpenJobsList} from '../../../components/common/open-jobs-list';
import type {OpenJobsViewMode} from '../../../components/common/open-jobs-list';
import {PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {SegmentedToggle} from '../../../components/common/segmented-toggle';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import {useOverviewOpenJobs} from '../../../hooks/useOverviewApi';
import {ContactID} from '../../../../contants';
import {MAX_OVERVIEW_PANEL_DAYS, clampOverviewPanelRange} from '../lib/overviewPanelRange';

/*
 * Dispatch-specific keys: BoxShell remounts panels on a layout-version bump, and
 * the Overview page's own view/sort/paging choices were made at a different width
 * for a different surface.
 */
const VIEW_MODE_KEY = `dispatchOpenJobsViewMode-${ContactID}`;
const SORT_KEY = `dispatchOpenJobsSort-${ContactID}`;
const LIMIT_KEY = `dispatchOpenJobsLimit-${ContactID}`;

export interface OpenJobsBoxProps {
    /** Selected dispatch view ids; jobs are scoped to these, matching the main Jobs List. */
    despatchViewIds: number[];
    startDate: Dayjs;
    endDate: Dayjs;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Select the job into the board's Job Detail panel. */
    onSelectJob?: (jobId: number) => void;
    /** Card header DOM node; the view toggle portals into it. */
    headerSlot?: HTMLElement | null;
}

/**
 * The Overview page's open-jobs list as a dispatch panel: outstanding work by
 * driver, scoped to the toolbar's date range.
 *
 * Opens on the table view rather than the Overview page's cards — a JobCard wants
 * 600px+ to lay out two-up and a dashboard column does not have it.
 */
export const OpenJobsBox: React.FC<OpenJobsBoxProps> = ({
    despatchViewIds,
    startDate,
    endDate,
    refetchIntervalMs = false,
    onSelectJob,
    headerSlot,
}) => {
    const [viewMode, setViewMode] = useLocalStorage<OpenJobsViewMode>({
        key: VIEW_MODE_KEY,
        defaultValue: 'table',
        getInitialValueInEffect: false,
    });
    const [sort, setSort] = useLocalStorage<SortState>({
        key: SORT_KEY,
        defaultValue: {column: 'reference', direction: 'asc'},
        getInitialValueInEffect: false,
    });
    const [limit, setLimit] = useLocalStorage<number>({
        key: LIMIT_KEY,
        defaultValue: 10,
        getInitialValueInEffect: false,
    });
    const [page, setPage] = useState(1);

    const range = useMemo(
        () => clampOverviewPanelRange(startDate, endDate),
        [startDate, endDate],
    );

    const {data = [], isLoading} = useOverviewOpenJobs(
        {startDate: range.startDate, endDate: range.endDate, despatchViewIds},
        refetchIntervalMs || undefined,
    );

    const changeLimit = useCallback((next: number) => {
        setLimit(next);
        setPage(1);
    }, [setLimit]);

    return (
        <Stack h="100%" gap={0} style={{minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                <Group gap={4} wrap="nowrap">
                    <SegmentedToggle<OpenJobsViewMode>
                        aria-label="Open jobs view"
                        value={viewMode}
                        onChange={setViewMode}
                        data={[
                            {
                                value: 'cards',
                                label: 'Cards',
                                icon: <SymbolIcon name="dashboard" size={PANEL_CONTROL_GLYPH_SIZE}/>,
                            },
                            {
                                value: 'table',
                                label: 'Table',
                                icon: <SymbolIcon name="view_list" size={PANEL_CONTROL_GLYPH_SIZE}/>,
                            },
                        ]}
                    />
                </Group>
            </HeaderSlotPortal>

            {range.clamped && (
                <Box px="xs" pt={4} style={{flexShrink: 0}}>
                    <Text fz="xs" c="dimmed">
                        Showing the last {MAX_OVERVIEW_PANEL_DAYS} days of the selected range.
                    </Text>
                </Box>
            )}

            <Box px="xs" style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                <OpenJobsList
                    openJobs={data}
                    isLoading={isLoading}
                    viewMode={viewMode}
                    sort={sort}
                    onSort={setSort}
                    page={page}
                    limit={limit}
                    onPageChange={setPage}
                    onLimitChange={changeLimit}
                    onSelectJob={onSelectJob}
                />
            </Box>
        </Stack>
    );
};

export default OpenJobsBox;
