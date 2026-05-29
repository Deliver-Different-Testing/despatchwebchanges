/**
 * Recurring Jobs Page Component
 *
 * React component for the recurring jobs list panel and job-details panel.
 */

import React, {useCallback, useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import InfoIcon from '@mui/icons-material/Info';
import TuneIcon from '@mui/icons-material/Tune';
import {useRecurringJobsList} from '../../hooks/useRecurringJobsApi';
import {JobDetails} from '../../components/common/job-details/JobDetails';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import {recurringJobsApi} from '../../services/recurringJobsApi';
import {
    PrebookListModel,
    RecurringJobContextMenu as ContextMenuState,
    RecurringJobQuery,
    RecurringJobSort, RecurringJobsPageProps,
} from '../../interfaces';
import {RecurringJobsTable} from './components/RecurringJobsTable';
import {RecurringJobsToolbar, RecurringJobsFilters} from './components/RecurringJobsToolbar';
import {RecurringJobsContextMenu} from './components/RecurringJobsContextMenu';

const DEFAULT_QUERY: RecurringJobQuery = {
    order: 'booked',
    orderDirection: 'asc',
    limit: 50,
    page: 1,
    active: true,
};

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

    // Void confirmation dialog
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [jobToVoid, setJobToVoid] = useState<PrebookListModel | null>(null);
    const [isVoiding, setIsVoiding] = useState(false);

    // Fetch data
    const {data, isLoading, refetch} = useRecurringJobsList(query);

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

    const handleActiveFilterChange = useCallback((isActive: boolean) => {
        setQuery((prev) => ({
            ...prev,
            active: isActive,
            page: 1,
        }));
        setSelectedJobId(null);
    }, []);

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

    const handleDeleteClick = useCallback((job: PrebookListModel) => {
        setJobToVoid(job);
        setVoidDialogOpen(true);
    }, []);

    const handleVoidConfirm = useCallback(async () => {
        if (!jobToVoid) return;

        setIsVoiding(true);
        try {
            await recurringJobsApi.voidPrebookJob(jobToVoid.id);
            showToast('The recurring job has been successfully inactivated.', 'success');
            setVoidDialogOpen(false);
            setJobToVoid(null);
            setSelectedJobId(null);
            await refetch();
        } catch (error) {
            console.error('Error inactivating recurring job:', error);
            showToast('An error occurred while inactivating the recurring job. Please try again.', 'error');
        } finally {
            setIsVoiding(false);
        }
    }, [jobToVoid, refetch, showToast]);

    const handleVoidCancel = useCallback(() => {
        setVoidDialogOpen(false);
        setJobToVoid(null);
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
        <Box sx={{
            height: '100%', display: 'flex', gap: 2,
            p: 2,
            bgcolor: 'background.default',
        }}>
            {/* Left Panel: Filters + Table (~55%) */}
            <Box sx={{flex: 55, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, minWidth: 0}}>
                {/* Filters Card */}
                <Card variant="outlined" sx={{flexShrink: 0, overflow: 'hidden'}}>
                    <Toolbar
                        variant="dense"
                        sx={{
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            minHeight: 44,
                        }}
                    >
                        <TuneIcon sx={{mr: 1}} />
                        <Typography variant="subtitle1">Filters</Typography>
                    </Toolbar>
                    <RecurringJobsToolbar
                        searchText={query.searchText || ''}
                        isActive={query.active}
                        isLoading={isLoading}
                        isExporting={isExporting}
                        filters={{
                            speedId: query.speedId,
                            time: query.time,
                            courierId: query.courierId,
                            daysOfWeek: query.daysOfWeek,
                            routeId: query.routeId,
                        }}
                        onSearchChange={handleSearchChange}
                        onActiveFilterChange={handleActiveFilterChange}
                        onFiltersChange={handleFiltersChange}
                        onRefresh={handleRefresh}
                        onExport={handleExport}
                    />
                </Card>

                {/* Recurring Jobs Table Card */}
                <Card
                    variant="outlined"
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 0,
                    }}
                >
                    <Toolbar
                        variant="dense"
                        sx={{
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            minHeight: 44,
                            flexShrink: 0,
                        }}
                    >
                        <EventRepeatIcon sx={{mr: 1}} />
                        <Typography variant="subtitle1">
                            Recurring Jobs {data?.total ? `(${data.total})` : ''}
                        </Typography>
                    </Toolbar>
                    <Box sx={{flex: 1, overflow: 'hidden'}}>
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
                            onDeleteClick={handleDeleteClick}
                            onContextMenu={handleContextMenu}
                        />
                    </Box>
                </Card>
            </Box>

            {/* Right Panel: Job Details (~45%) */}
            <Box sx={{flex: 45, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0}}>
                <Card
                    variant="outlined"
                    sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
                >
                    <Toolbar
                        variant="dense"
                        sx={{
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            minHeight: 44,
                            flexShrink: 0,
                        }}
                    >
                        <InfoIcon sx={{mr: 1}} />
                        <Typography variant="subtitle1">
                            Job Details{selectedJobId ? ` - Job #${selectedJobId}` : ''}
                        </Typography>
                    </Toolbar>
                    <Box sx={{flex: 1, overflow: 'auto'}}>
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
                    </Box>
                </Card>
            </Box>

            {/* Context Menu */}
            <RecurringJobsContextMenu
                anchorPosition={contextMenu ? {x: contextMenu.mouseX, y: contextMenu.mouseY} : null}
                job={contextMenu?.job || null}
                onClose={handleContextMenuClose}
                onAddPickupStop={handleAddPickupStop}
                onAddDeliveryStop={handleAddDeliveryStop}
            />

            {/* Void Confirmation Dialog */}
            <Dialog
                open={voidDialogOpen}
                onClose={handleVoidCancel}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Inactivate Recurring Job</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will inactivate this recurring job. Please confirm that you wish to do this?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleVoidCancel} disabled={isVoiding}>
                        No
                    </Button>
                    <Button
                        onClick={handleVoidConfirm}
                        color="error"
                        variant="contained"
                        disabled={isVoiding}
                        startIcon={isVoiding ? <CircularProgress size={16} color="inherit"/> : undefined}
                    >
                        {isVoiding ? 'Inactivating...' : 'Yes'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RecurringJobsPage;
