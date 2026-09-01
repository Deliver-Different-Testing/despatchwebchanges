import React, {useCallback, useMemo, useState} from 'react';
import {Badge, Box, Card, Collapse, Divider, Group, Stack, Table, Text} from '@mantine/core';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {SegmentedToggle} from '../../../components/common/segmented-toggle';
import {SortableTh, TablePager} from '../../../components/common/data-table';
import dayjs from 'dayjs';
import {formatMins} from '../../../utils/dateUtils';
import {PanelHeader} from '../../../components/common/panel-header';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import type {DriverViewModel, IOpenJobResponse, TableSort, ViewJob,} from '../OverviewPage.interfaces';
import {ContactID} from "../../../../contants";

const OPEN_JOBS_VIEW_MODE_KEY = `openJobsViewMode_${ContactID}`;
const OPEN_JOBS_LIMIT_KEY = `openJobsTableViewLimit${ContactID}`;

interface OpenJobsWidgetProps {
    openJobs: IOpenJobResponse[];
    isLoading: boolean;
}

const TABLE_COLUMNS = [
    {key: 'reference', label: 'Job Number', sortable: true},
    {key: 'driverName', label: 'Driver', sortable: true},
    {key: 'status', label: 'Status', sortable: true},
    {key: 'pickup', label: 'Pickup', sortable: true},
    {key: 'pickupAddress', label: 'Pickup Location', sortable: true},
    {key: 'delivery', label: 'Delivery', sortable: true},
    {key: 'deliveryAddress', label: 'Delivery Location', sortable: true},
    {key: 'package', label: 'Package', sortable: false},
    {key: 'mileage', label: 'Mileage', sortable: true},
];

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

function getTimeSinceLastCompleted(lastCompletedTime: string): number {
    if (lastCompletedTime === 'N/A') return 0;
    const lastCompleted = dayjs(lastCompletedTime, 'HH:mm');
    const now = dayjs();
    return Math.round(now.diff(lastCompleted, 'minute'));
}

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

    // Transform open jobs into ViewJob format
    const viewJobs: ViewJob[] = useMemo(() => {
        return openJobs.map((job) => ({
            jobId: job.jobId,
            reference: job.reference,
            status: job.status,
            pickup: {
                time: job.pickupTime,
                timeString: job._pickUpTimeStr,
                name: job.pickupName,
                address: job.pickupAddress,
            },
            delivery: {
                time: job.deliveryTime,
                timeString: job._deliveryTimeStr,
                name: job.deliveryName,
                address: job.deliveryAddress,
            },
            quantity: job.quantity,
            packageType: job.packageType,
            mileage: job.mileage,
            driverName: job.driverName,
        }));
    }, [openJobs]);

    // Group by driver for card view
    const drivers: DriverViewModel[] = useMemo(() => {
        const grouped: Record<string, DriverViewModel> = {};

        openJobs.forEach((job) => {
            if (!grouped[job.driverName]) {
                grouped[job.driverName] = {
                    name: job.driverName,
                    jobs: [],
                    completedToday: job.completedToday,
                    lastCompleted: job.lastCompleted ? formatMins(job.lastCompleted) : 'N/A',
                    expanded: false,
                };
            }

            grouped[job.driverName].jobs.push({
                jobId: job.jobId,
                reference: job.reference,
                status: job.status,
                pickup: {
                    time: job.pickupTime,
                    timeString: job._pickUpTimeStr,
                    name: job.pickupName,
                    address: job.pickupAddress,
                },
                delivery: {
                    time: job.deliveryTime,
                    timeString: job._deliveryTimeStr,
                    name: job.deliveryName,
                    address: job.deliveryAddress,
                },
                quantity: job.quantity,
                packageType: job.packageType,
                mileage: job.mileage,
                driverName: job.driverName,
            });
        });

        return Object.values(grouped);
    }, [openJobs]);

    // Sorted table jobs
    const sortedTableJobs = useMemo(() => {
        const sorted = [...viewJobs];
        const {column, direction} = tableSort;
        const dir = direction === 'asc' ? 1 : -1;

        sorted.sort((a: ViewJob, b: ViewJob) => {
            let valA: string | number | undefined | Record<string, unknown> = a[column as keyof ViewJob] as string | number | undefined | Record<string, unknown>;
            let valB: string | number | undefined | Record<string, unknown> = b[column as keyof ViewJob] as string | number | undefined | Record<string, unknown>;

            if (column === 'pickup' || column === 'delivery') {
                valA = a[column]?.timeString || '';
                valB = b[column]?.timeString || '';
            } else if (column === 'pickupAddress') {
                valA = a.pickup?.address || '';
                valB = b.pickup?.address || '';
            } else if (column === 'deliveryAddress') {
                valA = a.delivery?.address || '';
                valB = b.delivery?.address || '';
            }

            if (valA == null) return 1;
            if (valB == null) return -1;
            if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * dir;
            if (typeof valA === 'number' && typeof valB === 'number') return (valA < valB ? -1 : 1) * dir;
            return String(valA).localeCompare(String(valB)) * dir;
        });

        return sorted;
    }, [viewJobs, tableSort]);

    const paginatedTableJobs = useMemo(() => {
        const start = (tablePage - 1) * tableLimit;
        return sortedTableJobs.slice(start, start + tableLimit);
    }, [sortedTableJobs, tablePage, tableLimit]);

    const handleSort = (columnKey: string) => {
        setTableSort((prev) => ({
            column: columnKey,
            direction: prev.column === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

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
                    {/* Empty state */}
                    {viewJobs.length === 0 && !isLoading && (
                        <Stack align="center" gap={4} py={32} c="dimmed">
                            <SymbolIcon name="inventory_2" size={48} />
                            <Text mt={8}>No open jobs match your current filter criteria</Text>
                        </Stack>
                    )}

                    {/* Table View */}
                    {isTableView && viewJobs.length > 0 && (
                        <Box>
                            <Table.ScrollContainer minWidth={0}>
                                <Table verticalSpacing={4}>
                                    <Table.Thead>
                                        <Table.Tr>
                                            {TABLE_COLUMNS.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    sortable={col.sortable}
                                                    active={tableSort.column === col.key}
                                                    direction={tableSort.column === col.key ? tableSort.direction : 'asc'}
                                                    onSort={() => handleSort(col.key)}
                                                    align={col.key === 'mileage' ? 'right' : 'left'}
                                                >
                                                    {col.label}
                                                </SortableTh>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {paginatedTableJobs.map((job) => (
                                            <Table.Tr key={job.reference}>
                                                <Table.Td>{job.reference}</Table.Td>
                                                <Table.Td>{job.driverName || 'Unassigned'}</Table.Td>
                                                <Table.Td>
                                                    <Badge h={24} fz="0.75rem" tt="none" variant="light" color="gray">
                                                        {job.status}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>{job.pickup.timeString}</Table.Td>
                                                <Table.Td maw={180}>
                                                    <Box>
                                                        <Text fz="sm" truncate>{job.pickup.name}</Text>
                                                        <Text fz="xs" c="dimmed" truncate>{job.pickup.address}</Text>
                                                    </Box>
                                                </Table.Td>
                                                <Table.Td>{job.delivery.timeString}</Table.Td>
                                                <Table.Td maw={180}>
                                                    <Box>
                                                        <Text fz="sm" truncate>{job.delivery.name}</Text>
                                                        <Text fz="xs" c="dimmed" truncate>{job.delivery.address}</Text>
                                                    </Box>
                                                </Table.Td>
                                                <Table.Td>
                                                    {job.quantity} {job.packageType}
                                                </Table.Td>
                                                <Table.Td align="right">
                                                    {job.mileage}
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>

                            {/* TablePager is 1-based, so the ±1 the MUI pagination
                                needed is gone. */}
                            <Box style={{borderTop: '1px solid var(--mantine-color-default-border)'}}>
                                <TablePager
                                    totalCount={sortedTableJobs.length}
                                    page={tablePage}
                                    pageSize={tableLimit}
                                    onPageChange={setTablePage}
                                    onPageSizeChange={(newLimit) => {
                                        setTableLimit(newLimit);
                                        localStorage.setItem(OPEN_JOBS_LIMIT_KEY, `${newLimit}`);
                                        setTablePage(1);
                                    }}
                                    pageSizeOptions={[5, 10, 15, 20]}
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Card View (driver grouped) */}
                    {!isTableView && drivers.length > 0 && (
                        <Box>
                            {drivers.map((driver) => (
                                <DriverCard key={driver.name} driver={driver} />
                            ))}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};

// ── Driver Card (card view subcomponent) ──

const DriverCard: React.FC<{driver: DriverViewModel}> = React.memo(({driver: initialDriver}) => {
    const [expanded, setExpanded] = useState(false);
    // Avoid running dayjs() per render — only recompute when the timestamp changes.
    // For a 60-driver list each render previously triggered 60 dayjs() + diff() calls.
    const minsSinceLastCompleted = useMemo(() => {
        if (initialDriver.lastCompleted === 'N/A') return null;
        return getTimeSinceLastCompleted(initialDriver.lastCompleted);
    }, [initialDriver.lastCompleted]);

    return (
        <Card withBorder p={0} mb={8}>
            <Group
                onClick={() => setExpanded(!expanded)}
                px={16}
                py={8}
                mih={44}
                gap={0}
                wrap="nowrap"
                bg="var(--mantine-color-body)"
                style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    cursor: 'pointer',
                }}
            >
                <SymbolIcon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
                <Text fz="sm" ml={8} fw={600}>
                    {initialDriver.name || 'Unassigned'}
                </Text>
                <Divider orientation="vertical" mx={8} />
                <Text fz="xs">({initialDriver.jobs.length} open jobs)</Text>

                <div style={{flex: 1}} />

                <Group gap={16} wrap="nowrap">
                    <Group
                        gap={4}
                        wrap="nowrap"
                        c={initialDriver.completedToday > 0
                            ? 'var(--mantine-color-green-6)'
                            : 'var(--mantine-color-red-6)'}
                    >
                        <SymbolIcon name="check_circle" size={18} />
                        <Text fz="xs">{initialDriver.completedToday} completed today</Text>
                    </Group>

                    <Divider orientation="vertical" />

                    <Box>
                        <Text fz="xs">
                            Last completed:{' '}
                            {initialDriver.lastCompleted === 'N/A' ? (
                                <Text component="span" fz="xs" c="var(--mantine-color-yellow-6)">N/A</Text>
                            ) : (
                                initialDriver.lastCompleted
                            )}
                        </Text>
                        {minsSinceLastCompleted !== null && (
                            <Text fz="0.625rem" display="block">
                                {minsSinceLastCompleted} mins ago
                            </Text>
                        )}
                    </Box>
                </Group>
            </Group>
            <Collapse expanded={expanded}>
                <Group p={16} gap={16} align="stretch">
                    {initialDriver.jobs.map((job) => (
                        <JobCard key={job.jobId} job={job} />
                    ))}
                </Group>
            </Collapse>
        </Card>
    );
});
DriverCard.displayName = 'DriverCard';

const LEGS = [
    {key: 'pickup', label: 'Pickup'},
    {key: 'delivery', label: 'Delivery'},
] as const;

const JobCard: React.FC<{job: ViewJob}> = React.memo(({job}) => (
    <Card withBorder p={0} miw={300} style={{width: 'calc(50% - 8px)'}}>
        <Box p={16}>
            {/* Header */}
            <Group justify="space-between" align="center" mb={8} wrap="nowrap">
                <Box>
                    <Text fz="xs" c="dimmed">Reference</Text>
                    <Text fz="sm">{job.reference}</Text>
                </Box>
                <Badge
                    fz="0.75rem"
                    tt="none"
                    variant="light"
                    color="gray"
                    leftSection={<SymbolIcon name="package_2" size={16} />}
                >
                    {job.status}
                </Badge>
            </Group>

            <Divider my={8} />

            {/* Pickup / Delivery */}
            <Group gap={16} align="flex-start" wrap="nowrap">
                {LEGS.map((leg) => (
                    <Box key={leg.label} style={{flex: 1}}>
                        <Group gap={4} mb={4} wrap="nowrap" c="var(--mantine-primary-color-filled)">
                            <SymbolIcon name="pin_drop" size={16} />
                            <Text fz="sm" fw={500} c="var(--mantine-color-text)">
                                {leg.label}: {job[leg.key].timeString}
                            </Text>
                        </Group>
                        <Text fz="sm" pl={24}>{job[leg.key].name}</Text>
                        <Text fz="xs" c="dimmed" pl={24}>{job[leg.key].address}</Text>
                    </Box>
                ))}
            </Group>

            <Divider my={8} />

            {/* Footer */}
            <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap={4} wrap="nowrap">
                    <SymbolIcon name="directions_car" size={16} />
                    <Text fz="xs">Mileage: {job.mileage}</Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                    <SymbolIcon name="inventory_2" size={16} />
                    <Text fz="xs">
                        {job.quantity} {job.packageType}
                    </Text>
                </Group>
            </Group>
        </Box>
    </Card>
));
JobCard.displayName = 'JobCard';

export default OpenJobsWidget;
