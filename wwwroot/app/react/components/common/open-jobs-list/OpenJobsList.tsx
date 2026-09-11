import React, {useCallback, useMemo, useState} from 'react';
import {Badge, Box, Card, Collapse, Divider, Group, Stack, Table, Text} from '@mantine/core';
import dayjs from 'dayjs';
import {SortableTh, TablePager} from '../data-table';
import type {SortState} from '../data-table';
import {SymbolIcon} from '../symbol-icon';
import {formatMins} from '../../../utils/dateUtils';
import type {DriverViewModel, IOpenJobResponse, ViewJob} from './OpenJobsList.types';

export type OpenJobsViewMode = 'cards' | 'table';

/**
 * The open-jobs list body: outstanding jobs either grouped into per-driver cards
 * or laid out as a sortable, paged table.
 *
 * Fully controlled, and deliberately chrome-free — no card, title, collapse or
 * view toggle. The Overview page wraps it in its own collapsible card; on
 * Dispatch a BoxShell panel already supplies that frame. Sort, page and page size
 * are the host's state too, since the two hosts persist them under different keys
 * at very different widths.
 */
export interface OpenJobsListProps {
    openJobs: IOpenJobResponse[];
    isLoading: boolean;
    viewMode: OpenJobsViewMode;
    sort: SortState;
    onSort: (sort: SortState) => void;
    /** 1-based. */
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    /** Omit to leave rows inert — the Overview page has no in-page job detail. */
    onSelectJob?: (jobId: number) => void;
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

export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

function getTimeSinceLastCompleted(lastCompletedTime: string): number {
    if (lastCompletedTime === 'N/A') return 0;
    const lastCompleted = dayjs(lastCompletedTime, 'HH:mm');
    const now = dayjs();
    return Math.round(now.diff(lastCompleted, 'minute'));
}

function toViewJob(job: IOpenJobResponse): ViewJob {
    return {
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
    };
}

/** A job reference that opens the job, for the hosts that can show one. */
const JobReference: React.FC<{
    job: ViewJob;
    onSelectJob?: (jobId: number) => void;
}> = ({job, onSelectJob}) => {
    if (!onSelectJob) return <Text fz="sm">{job.reference}</Text>;
    // The row itself is not the control: a table row has no keyboard affordance,
    // so the reference is the button and carries the accessible name.
    return (
        <Text
            component="button"
            type="button"
            fz="sm"
            bg="transparent"
            c="var(--mantine-primary-color-filled)"
            aria-label={'Open job ' + job.reference}
            onClick={() => onSelectJob(job.jobId)}
            style={{border: 'none', padding: 0, cursor: 'pointer'}}
        >
            {job.reference}
        </Text>
    );
};

export const OpenJobsList: React.FC<OpenJobsListProps> = ({
    openJobs,
    isLoading,
    viewMode,
    sort,
    onSort,
    page,
    limit,
    onPageChange,
    onLimitChange,
    onSelectJob,
}) => {
    const isTableView = viewMode === 'table';

    const viewJobs: ViewJob[] = useMemo(() => openJobs.map(toViewJob), [openJobs]);

    // Card view groups by driver, taking that driver's completion stats from
    // whichever of their rows came first — the API repeats them on every row.
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
            grouped[job.driverName].jobs.push(toViewJob(job));
        });

        return Object.values(grouped);
    }, [openJobs]);

    const sortedTableJobs = useMemo(() => {
        const sorted = [...viewJobs];
        const {column, direction} = sort;
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
    }, [viewJobs, sort]);

    const paginatedTableJobs = useMemo(() => {
        const start = (page - 1) * limit;
        return sortedTableJobs.slice(start, start + limit);
    }, [sortedTableJobs, page, limit]);

    const handleSort = useCallback((columnKey: string) => {
        onSort({
            column: columnKey,
            direction: sort.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc',
        });
    }, [onSort, sort]);

    return (
        <>
            {viewJobs.length === 0 && !isLoading && (
                <Stack align="center" gap={4} py={32} c="dimmed">
                    <SymbolIcon name="inventory_2" size={48}/>
                    <Text mt={8}>No open jobs match your current filter criteria</Text>
                </Stack>
            )}

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
                                            active={sort.column === col.key}
                                            direction={sort.column === col.key ? sort.direction : 'asc'}
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
                                        <Table.Td>
                                            <JobReference job={job} onSelectJob={onSelectJob}/>
                                        </Table.Td>
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
                            page={page}
                            pageSize={limit}
                            onPageChange={onPageChange}
                            onPageSizeChange={onLimitChange}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                        />
                    </Box>
                </Box>
            )}

            {!isTableView && drivers.length > 0 && (
                <Box>
                    {drivers.map((driver) => (
                        <DriverCard key={driver.name} driver={driver} onSelectJob={onSelectJob}/>
                    ))}
                </Box>
            )}
        </>
    );
};

// ── Driver Card (card view subcomponent) ──

const DriverCard: React.FC<{
    driver: DriverViewModel;
    onSelectJob?: (jobId: number) => void;
}> = React.memo(({driver: initialDriver, onSelectJob}) => {
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
                <SymbolIcon name={expanded ? 'expand_less' : 'expand_more'} size={20}/>
                <Text fz="sm" ml={8} fw={600}>
                    {initialDriver.name || 'Unassigned'}
                </Text>
                <Divider orientation="vertical" mx={8}/>
                <Text fz="xs">({initialDriver.jobs.length} open jobs)</Text>

                <div style={{flex: 1}}/>

                <Group gap={16} wrap="nowrap">
                    <Group
                        gap={4}
                        wrap="nowrap"
                        c={initialDriver.completedToday > 0
                            ? 'var(--mantine-color-green-6)'
                            : 'var(--mantine-color-red-6)'}
                    >
                        <SymbolIcon name="check_circle" size={18}/>
                        <Text fz="xs">{initialDriver.completedToday} completed today</Text>
                    </Group>

                    <Divider orientation="vertical"/>

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
                        <JobCard key={job.jobId} job={job} onSelectJob={onSelectJob}/>
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

const JobCard: React.FC<{
    job: ViewJob;
    onSelectJob?: (jobId: number) => void;
}> = React.memo(({job, onSelectJob}) => (
    <Card withBorder p={0} miw={300} style={{width: 'calc(50% - 8px)'}}>
        <Box p={16}>
            {/* Header */}
            <Group justify="space-between" align="center" mb={8} wrap="nowrap">
                <Box>
                    <Text fz="xs" c="dimmed">Reference</Text>
                    <JobReference job={job} onSelectJob={onSelectJob}/>
                </Box>
                <Badge
                    fz="0.75rem"
                    tt="none"
                    variant="light"
                    color="gray"
                    leftSection={<SymbolIcon name="package_2" size={16}/>}
                >
                    {job.status}
                </Badge>
            </Group>

            <Divider my={8}/>

            {/* Pickup / Delivery */}
            <Group gap={16} align="flex-start" wrap="nowrap">
                {LEGS.map((leg) => (
                    <Box key={leg.label} style={{flex: 1}}>
                        <Group gap={4} mb={4} wrap="nowrap" c="var(--mantine-primary-color-filled)">
                            <SymbolIcon name="pin_drop" size={16}/>
                            <Text fz="sm" fw={500} c="var(--mantine-color-text)">
                                {leg.label}: {job[leg.key].timeString}
                            </Text>
                        </Group>
                        <Text fz="sm" pl={24}>{job[leg.key].name}</Text>
                        <Text fz="xs" c="dimmed" pl={24}>{job[leg.key].address}</Text>
                    </Box>
                ))}
            </Group>

            <Divider my={8}/>

            {/* Footer */}
            <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap={4} wrap="nowrap">
                    <SymbolIcon name="directions_car" size={16}/>
                    <Text fz="xs">Mileage: {job.mileage}</Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                    <SymbolIcon name="inventory_2" size={16}/>
                    <Text fz="xs">
                        {job.quantity} {job.packageType}
                    </Text>
                </Group>
            </Group>
        </Box>
    </Card>
));
JobCard.displayName = 'JobCard';

export default OpenJobsList;
