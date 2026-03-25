/**
 * Recurring Jobs Page Component
 *
 * React component for the recurring jobs page with integrated job details panel.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Icon from '@mui/material/Icon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';
import {useRecurringJobsList} from '../../hooks/useRecurringJobsApi';
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
import {JobDetails} from '../../components/common/job-details/JobDetails';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import {NoData} from '../../components/common/no-data/NoData';

const styles: Record<string, SxProps<Theme>> = {
    root: {
        height: '100%',
        display: 'flex',
        gap: 2,
        p: 2,
        bgcolor: 'background.default',
    },
    leftPanel: {
        flex: '0 0 55%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        overflow: 'hidden',
    },
    rightPanel: {
        flex: '0 0 45%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
    },
    jobDetailsCard: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        boxShadow: 1,
        minHeight: 0,
    },
    card: {
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        boxShadow: 1,
    },
    cardHeader: (theme: Theme) => ({
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        minHeight: 40,
        px: 1.25,
        gap: 0.5,
        flexShrink: 0,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
        '& .MuiIconButton-root': {
            color: 'inherit',
            p: 0.5,
            borderRadius: 1,
            transition: 'background-color 150ms ease, transform 150ms ease',
            '&:hover': {
                bgcolor: alpha(theme.palette.common.white, 0.15),
            },
            '&:active': {
                transform: 'scale(0.92)',
            },
        },
    }),
    headerIcon: {
        fontSize: 20,
        mr: 0.75,
        opacity: 0.9,
    },
    headerTitle: {
        fontWeight: 600,
        fontSize: '0.85rem',
        letterSpacing: '0.01em',
    },
    tableCard: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        boxShadow: 1,
    },
};

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

    const jobDetailsConfig = useMemo<MountJobDetailsConfig | null>(() => {
        if (!selectedJobId) return null;
        return { jobId: selectedJobId, isRecurringJob: true, isBulkJob: false, isUsCustomer: isUsCustomer ?? false, showToast, onJobUpdate: () => refetch() };
    }, [selectedJobId, isUsCustomer, showToast, refetch]);

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
        <Box sx={styles.root}>
            {/* Left Panel: Filters + Table */}
            <Box sx={styles.leftPanel}>
                {/* Filters Card */}
                <Card variant="outlined" sx={{...styles.card as object, flexShrink: 0, overflow: 'hidden'}}>
                    <Toolbar variant="dense" disableGutters sx={styles.cardHeader}>
                        <Icon sx={styles.headerIcon} baseClassName="material-symbols-outlined">tune</Icon>
                        <Typography variant="subtitle2" noWrap sx={styles.headerTitle}>Filters</Typography>
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
                    sx={styles.tableCard}
                >
                    <Toolbar variant="dense" disableGutters sx={styles.cardHeader}>
                        <Icon sx={styles.headerIcon} baseClassName="material-symbols-outlined">event_repeat</Icon>
                        <Typography variant="subtitle2" noWrap sx={styles.headerTitle}>
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

            {/* Right Panel: Job Details */}
            <Box sx={styles.rightPanel}>
                <Card variant="outlined" sx={styles.jobDetailsCard}>
                    <Toolbar variant="dense" disableGutters sx={styles.cardHeader}>
                        <Icon sx={styles.headerIcon} baseClassName="material-symbols-outlined">info</Icon>
                        <Typography variant="subtitle2" noWrap sx={styles.headerTitle}>
                            Job Details{selectedJobId ? ` - Job #${selectedJobId}` : ''}
                        </Typography>
                    </Toolbar>
                    <Box sx={{flex: 1, overflow: 'auto'}}>
                        {jobDetailsConfig ? <JobDetails config={jobDetailsConfig} /> : <NoData title="No Job Selected" message="Select a job to view details" icon="info" />}
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
