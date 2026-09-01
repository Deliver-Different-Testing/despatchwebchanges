/**
 * Recurring Jobs Page Component
 *
 * React component for the recurring jobs list panel and job-details panel.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Box, Card, Stack, Text} from '@mantine/core';
import {Info, Repeat, SlidersHorizontal} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg, dialogSize} from '../../components/dialogs/shared/mantine';
import classes from './RecurringJobsPage.module.css';
import {Panel, PanelGroup, PanelResizeHandle} from 'react-resizable-panels';
import {useRecurringJobsList} from '../../hooks/useRecurringJobsApi';
import {JobDetails} from '../../components/common/job-details/JobDetails';
import {PanelHeader} from '../../components/common/panel-header';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {recurringJobsApi} from '../../services/recurringJobsApi';
import {updateJobDetail} from '../../services/jobListApi';
import {
    InsertRecurringToLiveResult,
    PrebookListModel,
    RecurringJobContextMenu as ContextMenuState,
    RecurringJobQuery,
    RecurringJobSort,
    RecurringJobsPageProps,
    RecurringMode,
} from '../../interfaces';
import {RecurringJobsTable} from './components/RecurringJobsTable';
import {RecurringJobsToolbar, RecurringJobsFilters} from './components/RecurringJobsToolbar';
import {RecurringJobsContextMenu} from './components/RecurringJobsContextMenu';
import {InsertToLiveDialog} from './components/InsertToLiveDialog';
import {RecurringDeliveryJourney} from '../../components/common/recurring-delivery-journey/RecurringDeliveryJourney';

const DEFAULT_QUERY: RecurringJobQuery = {
    order: 'booked',
    orderDirection: 'asc',
    limit: 50,
    page: 1,
    active: true,
    recurringMode: RecurringMode.Active,
};

// The gutter's look lives in RecurringJobsPage.module.css: react-resizable-panels
// stamps data-resize-handle-state on the PanelResizeHandle root, so the rule has to
// select from that parent down to this child.

export const RecurringJobsPage: React.FC<RecurringJobsPageProps> = ({
                                                                        showToast,
                                                                        isUsCustomer = false,
                                                                        onAddStop,
                                                                        setRefreshCallback,
                                                                    }) => {
    // Query state
    const [query, setQuery] = useState<RecurringJobQuery>(DEFAULT_QUERY);
    const [sort, setSort] = useState<RecurringJobSort>({
        column: 'booked',
        direction: 'asc',
    });

    // UI state
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // Deactivate confirmation dialog
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
    const [jobToDeactivate, setJobToDeactivate] = useState<PrebookListModel | null>(null);
    const [isDeactivating, setIsDeactivating] = useState(false);

    // Insert-to-Live dialog (Manual mode push)
    const [insertDialogOpen, setInsertDialogOpen] = useState(false);
    const [jobToInsert, setJobToInsert] = useState<PrebookListModel | null>(null);

    // Fetch data
    const {data, isLoading, isFetching, refetch} = useRecurringJobsList(query);

    // Register refresh callback for AngularJS to call
    useEffect(() => {
        if (setRefreshCallback) {
            setRefreshCallback(async () => {
                await refetch();
            });
        }
    }, [setRefreshCallback, refetch]);

    // Handlers
    const handleSearchChange = useCallback((searchText: string) => {
        setQuery((prev) => ({
            ...prev,
            searchText: searchText || undefined,
            page: 1,
        }));
    }, []);

    const handleRecurringModeChange = useCallback((mode: RecurringMode) => {
        setQuery((prev) => ({
            ...prev,
            // Keep `active` in sync with the new tri-state value so any
            // legacy code path that still reads it makes the right call.
            active: mode === RecurringMode.Active,
            recurringMode: mode,
            page: 1,
        }));
        setSelectedJobId(null);
    }, []);

    const handleInsertToLiveOpen = useCallback((job: PrebookListModel) => {
        setJobToInsert(job);
        setInsertDialogOpen(true);
    }, []);

    const handleInsertToLiveClose = useCallback(() => {
        setInsertDialogOpen(false);
        setJobToInsert(null);
    }, []);

    const handleInsertToLiveSuccess = useCallback(async (_result: InsertRecurringToLiveResult) => {
        setInsertDialogOpen(false);
        setJobToInsert(null);
        await refetch();
    }, [refetch]);

    // Flip a row's RecurringMode (Active / Manual / Inactive). Posts to the
    // existing job/UpdateRecurringJob endpoint with JobProperty.RecurringMode
    // and the byte value. The backend syncs ucbkActive per Steve's compat
    // rule (Active|Manual → ucbkActive=1, Inactive → ucbkActive=0). After
    // the call we refetch so the row falls out of / into whichever tab is
    // currently open.
    const handleSetMode = useCallback(async (job: PrebookListModel, mode: RecurringMode) => {
        const modeLabel = RecurringMode[mode];
        try {
            await updateJobDetail(job.id, 'RecurringMode', String(mode), true);
            showToast(`Mode changed to ${modeLabel}.`, 'success');
            await refetch();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : `Failed to change mode to ${modeLabel}.`;
            console.error('Mode change failed:', error);
            showToast(message, 'error');
        }
    }, [refetch, showToast]);

    const handleFiltersChange = useCallback((filters: RecurringJobsFilters) => {
        setQuery((prev) => ({
            ...prev,
            ...filters,
            page: 1,
        }));
    }, []);

    const handleRefresh = useCallback( async () => {
        await refetch();
    }, [refetch]);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            showToast('Exporting recurring jobs...', 'info');
            await recurringJobsApi.exportToCsv(query);
            showToast('Recurring jobs exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Failed to export recurring jobs', 'error');
        } finally {
            setIsExporting(false);
        }
    }, [query, showToast]);

    const handlePageChange = useCallback((page: number) => {
        setQuery((prev) => ({...prev, page}));
    }, []);

    const handlePageSizeChange = useCallback((pageSize: number) => {
        setQuery((prev) => ({...prev, limit: pageSize, page: 1}));
    }, []);

    const handleSortChange = useCallback((newSort: RecurringJobSort) => {
        setSort(newSort);
        setQuery((prev) => ({
            ...prev,
            order: newSort.column,
            orderDirection: newSort.direction,
            page: 1,
        }));
    }, []);

    const handleRowClick = useCallback((job: PrebookListModel) => {
        setSelectedJobId(job.id);
    }, []);

    const handleDeactivateClick = useCallback((job: PrebookListModel) => {
        setJobToDeactivate(job);
        setDeactivateDialogOpen(true);
    }, []);

    // Reuses handleSetMode so the row icon and the right-click "Deactivate"
    // menu item drive the exact same backend path
    // (updateJobDetail → JobProperty.RecurringMode).
    const handleDeactivateConfirm = useCallback(async () => {
        if (!jobToDeactivate) return;

        setIsDeactivating(true);
        await handleSetMode(jobToDeactivate, RecurringMode.Inactive);
        setIsDeactivating(false);
        setDeactivateDialogOpen(false);
        setJobToDeactivate(null);
        setSelectedJobId(null);
    }, [jobToDeactivate, handleSetMode]);

    const handleDeactivateCancel = useCallback(() => {
        setDeactivateDialogOpen(false);
        setJobToDeactivate(null);
    }, []);

    const handleContextMenu = useCallback((event: React.MouseEvent, job: PrebookListModel) => {
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX,
            mouseY: event.clientY,
            job,
        });
    }, []);

    const handleContextMenuClose = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleAddPickupStop = useCallback((job: PrebookListModel) => {
        if (onAddStop) {
            onAddStop(job, true);
        }
    }, [onAddStop]);

    const handleAddDeliveryStop = useCallback((job: PrebookListModel) => {
        if (onAddStop) {
            onAddStop(job, false);
        }
    }, [onAddStop]);

    return (
        <Box h="100%" p={8} bg="var(--mantine-color-body)">
            <PanelGroup direction="horizontal" autoSaveId="recurring-jobs-layout">
            {/* Left Panel: Filters + Table (~40%) */}
            <Panel defaultSize={40} minSize={25}>
            <Stack gap={16} h="100%" miw={0} style={{minHeight: 0}}>
                {/* Filters Card */}
                <Card withBorder p={0} style={{flexShrink: 0, overflow: 'hidden'}}>
                    <PanelHeader icon={<Icon lucide={SlidersHorizontal}/>} title="Filters" />
                    <RecurringJobsToolbar
                        searchText={query.searchText || ''}
                        recurringMode={query.recurringMode ?? (query.active ? RecurringMode.Active : RecurringMode.Inactive)}
                        isLoading={isLoading}
                        isRefreshing={isFetching}
                        isExporting={isExporting}
                        filters={{
                            speedId: query.speedId,
                            time: query.time,
                            courierId: query.courierId,
                            daysOfWeek: query.daysOfWeek,
                            routeId: query.routeId,
                        }}
                        onSearchChange={handleSearchChange}
                        onRecurringModeChange={handleRecurringModeChange}
                        onFiltersChange={handleFiltersChange}
                        onRefresh={handleRefresh}
                        onExport={handleExport}
                    />
                </Card>

                {/* Recurring Jobs Table Card */}
                <Card
                    withBorder
                    p={0}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 0,
                    }}
                >
                    <PanelHeader
                        icon={<Icon lucide={Repeat}/>}
                        title="Recurring Jobs"
                        count={data?.total || undefined}
                    />
                    <Box style={{flex: 1, overflow: 'hidden'}}>
                        <RecurringJobsTable
                            jobs={data?.items || []}
                            isLoading={isLoading}
                            totalCount={data?.total || 0}
                            page={query.page}
                            pageSize={query.limit}
                            sort={sort}
                            selectedJobId={selectedJobId}
                            isUsCustomer={isUsCustomer}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                            onSortChange={handleSortChange}
                            onRowClick={handleRowClick}
                            onDeleteClick={handleDeactivateClick}
                            onContextMenu={handleContextMenu}
                        />
                    </Box>
                </Card>
            </Stack>
            </Panel>

            <PanelResizeHandle>
                <Box className={classes.resizeHandle} />
            </PanelResizeHandle>

            {/* Middle Panel: Job Details (~35%) */}
            <Panel defaultSize={35} minSize={20}>
            <Stack gap={0} h="100%" miw={0} style={{minHeight: 0}}>
                <Card
                    withBorder
                    p={0}
                    style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
                >
                    <PanelHeader
                        icon={<Icon lucide={Info}/>}
                        title={selectedJobId ? `Job Details - Job #${selectedJobId}` : 'Job Details'}
                    />
                    <Box style={{flex: 1, overflow: 'auto'}}>
                        <ErrorBoundary resetKey={selectedJobId ?? 'none'}>
                            <JobDetails
                                key={selectedJobId ?? 'none'}
                                config={{
                                    jobId: selectedJobId ?? undefined,
                                    isRecurringJob: true,
                                    isBulkJob: false,
                                    isUsCustomer,
                                    showToast,
                                    onJobUpdate: handleRefresh,
                                } satisfies MountJobDetailsConfig}
                            />
                        </ErrorBoundary>
                    </Box>
                </Card>
            </Stack>
            </Panel>

            <PanelResizeHandle>
                <Box className={classes.resizeHandle} />
            </PanelResizeHandle>

            {/* Right Panel: Recurring Log (~25%) */}
            <Panel defaultSize={25} minSize={20}>
            <Stack gap={0} h="100%" miw={0} style={{minHeight: 0}}>
                <ErrorBoundary resetKey={selectedJobId ?? 'none'}>
                    <RecurringDeliveryJourney bookingId={selectedJobId} />
                </ErrorBoundary>
            </Stack>
            </Panel>
            </PanelGroup>

            {/* Context Menu */}
            <RecurringJobsContextMenu
                anchorPosition={contextMenu ? {x: contextMenu.mouseX, y: contextMenu.mouseY} : null}
                job={contextMenu?.job || null}
                onClose={handleContextMenuClose}
                onAddPickupStop={handleAddPickupStop}
                onAddDeliveryStop={handleAddDeliveryStop}
                onInsertToLive={handleInsertToLiveOpen}
                onSetMode={handleSetMode}
            />

            {/* Insert-to-Live Dialog (Manual-mode push) */}
            <InsertToLiveDialog
                open={insertDialogOpen}
                job={jobToInsert}
                onClose={handleInsertToLiveClose}
                onSuccess={handleInsertToLiveSuccess}
                showToast={showToast}
            />

            {/* Deactivate Confirmation Dialog */}
            {/* A raw MUI <Dialog> before; now composed from the shared Mantine
                primitives per CLAUDE.md, which is where the confirm/cancel shape,
                the submitting state and the accessible name all come from. */}
            <DialogShell
                opened={deactivateDialogOpen}
                onClose={handleDeactivateCancel}
                size={dialogSize.sm}
                label="Deactivate Recurring Job"
            >
                <DialogHeader
                    icon={<Icon lucide={Repeat}/>}
                    title="Deactivate Recurring Job"
                    onClose={handleDeactivateCancel}
                    closeDisabled={isDeactivating}
                    variant="warning"
                />
                <Box p={24} bg={dialogContentBg}>
                    <Text>
                        This will deactivate this recurring job. You can re-activate it
                        later from the Inactive tab. Continue?
                    </Text>
                </Box>
                <DialogFooter
                    onCancel={handleDeactivateCancel}
                    onConfirm={handleDeactivateConfirm}
                    cancelLabel="No"
                    confirmLabel={isDeactivating ? 'Deactivating...' : 'Yes'}
                    submitting={isDeactivating}
                />
            </DialogShell>
        </Box>
    );
};

export default RecurringJobsPage;
