import React, {useCallback, useState} from 'react';
import {Box, Card, Collapse} from '@mantine/core';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {SegmentedToggle} from '../../../components/common/segmented-toggle';
import {OpenJobsList} from '../../../components/common/open-jobs-list';
import {PanelHeader} from '../../../components/common/panel-header';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import type {IOpenJobResponse, TableSort} from '../OverviewPage.interfaces';
import {ContactID} from "../../../../contants";

const OPEN_JOBS_VIEW_MODE_KEY = `openJobsViewMode_${ContactID}`;
const OPEN_JOBS_LIMIT_KEY = `openJobsTableViewLimit${ContactID}`;

interface OpenJobsWidgetProps {
    openJobs: IOpenJobResponse[];
    isLoading: boolean;
}

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

/**
 * The Overview page's Open Jobs card: the collapsible frame, the view toggle, and
 * the view/sort/paging preferences this page persists. The list itself is the
 * shared `OpenJobsList`, which Dispatch mounts as a panel with its own frame and
 * its own storage keys.
 */
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

    // Sets rather than flips: the control is a radio group, so re-picking the
    // active view must be a no-op, not a switch to the other one.
    const selectViewMode = useCallback((table: boolean) => {
        localStorage.setItem(OPEN_JOBS_VIEW_MODE_KEY, table ? 'table' : 'card');
        setIsTableView(table);
    }, []);

    const handleLimitChange = useCallback((newLimit: number) => {
        setTableLimit(newLimit);
        localStorage.setItem(OPEN_JOBS_LIMIT_KEY, `${newLimit}`);
        setTablePage(1);
    }, []);

    return (
        <Card withBorder p={0} mt={16}>
            <PanelHeader
                icon={<SymbolIcon name="inventory_2" />}
                title="Open Jobs"
                action={
                    <>
                        {/* A Switch reads as on/off; this picks one of two views, so
                            it takes the app's single-select grammar instead. */}
                        <SegmentedToggle<'cards' | 'table'>
                            aria-label="Open jobs view"
                            value={isTableView ? 'table' : 'cards'}
                            onChange={(value) => selectViewMode(value === 'table')}
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

                        <HeaderActionIcon
                            label={isCollapsed ? 'Expand open jobs' : 'Collapse open jobs'}
                            onClick={toggleCollapse}
                            aria-expanded={!isCollapsed}
                        >
                            <SymbolIcon
                                name={isCollapsed ? 'expand_more' : 'expand_less'}
                                size={PANEL_CONTROL_GLYPH_SIZE}
                            />
                        </HeaderActionIcon>
                    </>
                }
            />
            <Collapse expanded={!isCollapsed}>
                <Box p={16}>
                    <OpenJobsList
                        openJobs={openJobs}
                        isLoading={isLoading}
                        viewMode={isTableView ? 'table' : 'cards'}
                        sort={tableSort}
                        onSort={setTableSort}
                        page={tablePage}
                        limit={tableLimit}
                        onPageChange={setTablePage}
                        onLimitChange={handleLimitChange}
                    />
                </Box>
            </Collapse>
        </Card>
    );
};

export default OpenJobsWidget;
