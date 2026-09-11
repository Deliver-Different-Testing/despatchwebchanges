import React from 'react';
import {ActionIcon, Badge, Box, Group, Loader, Progress, Stack, Table, Text, Tooltip, alpha} from '@mantine/core';
import {SortableTh, TablePager} from '../data-table';
import type {SortState} from '../data-table';
import {SymbolIcon} from '../symbol-icon';
import type {OverviewTableParentJob} from './DeliveriesTable.types';

interface DeliveriesTableProps {
    deliveries: OverviewTableParentJob[];
    isLoading: boolean;
    sort: SortState;
    onSort: (sort: SortState) => void;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    /** Omit to drop the per-row map action — Dispatch has a Map panel of its own. */
    onShowMap?: (delivery: OverviewTableParentJob) => void;
    onOpenJobDetail: (delivery: OverviewTableParentJob) => void;
    onToggleExpand: (jobId: number) => void;
}

const COLUMNS = [
    {key: 'expand', label: '', sortable: false, width: '48px'},
    {key: 'jobName', label: 'Job Number', sortable: true},
    {key: 'status', label: 'Status', sortable: true},
    {key: 'completion', label: 'Completion', sortable: true},
    {key: 'pickup', label: 'Pickup', sortable: true},
    {key: 'delivery', label: 'Delivery', sortable: true},
    {key: 'driver', label: 'Driver', sortable: true},
    {key: 'region', label: 'Region', sortable: true},
    {key: 'actions', label: 'Actions', sortable: false},
];

type StatusStyle = {bg: string; color?: string};

/**
 * Concrete colour values rather than Mantine colour names: these are read into a
 * background and a text colour on an inline style, where a name would not resolve.
 * The theme lookup and its per-theme WeakMap cache are gone with it — this is a
 * plain module-level constant now, built once.
 */
const INFO = 'var(--mantine-color-cyan-6)';
const SUCCESS = 'var(--mantine-color-green-6)';
const DANGER = 'var(--mantine-color-red-6)';

const STATUS_STYLES: Record<string, StatusStyle> = {
    NEW: {bg: alpha(INFO, 0.25)},
    PREASSIGNED: {bg: alpha(INFO, 0.25)},
    DESPATCHED: {bg: alpha(SUCCESS, 0.2)},
    ACCEPTED: {bg: alpha(SUCCESS, 0.2)},
    PICKED_UP: {bg: alpha(SUCCESS, 0.35)},
    IN_TRANSIT: {bg: alpha(SUCCESS, 0.35)},
    OUT_FOR_DELIVERY: {bg: alpha(SUCCESS, 0.35)},
    REJECTED: {bg: alpha(DANGER, 0.25)},
    LATE_PICKUP: {bg: alpha(DANGER, 0.25)},
    LATE_DELIVERY: {bg: alpha(DANGER, 0.25)},
    WARNING: {bg: alpha(DANGER, 0.25)},
    UNDELIVERABLE: {bg: 'var(--mantine-color-red-8)', color: 'var(--mantine-color-white)'},
    COMPLETED: {bg: 'var(--mantine-color-gray-6)', color: 'var(--mantine-color-white)'},
    AWAITING_POD: {bg: 'var(--mantine-color-gray-6)', color: 'var(--mantine-color-white)'},
    ASSUMING_COMPLETED: {bg: 'var(--mantine-color-gray-6)', color: 'var(--mantine-color-white)'},
};

function getStatusChipStyle(status: string): StatusStyle {
    const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
    return STATUS_STYLES[normalized] ?? {bg: 'var(--mantine-color-gray-3)'};
}

function getProgressColor(completion: number): string {
    if (completion < 30) return 'green.6';
    if (completion < 70) return 'green.4';
    return 'gray.4';
}

/** Normalise an API status into the DISPLAY_FORM the style table is keyed by. */
export function transformStatus(status: string): string {
    return status.toUpperCase().replace(/[\s-]/g, '_');
}

const StatusChip: React.FC<{status: string}> = React.memo(({status}) => {
    const display = transformStatus(status);
    const style = getStatusChipStyle(display);
    return (
        <Badge
            h={24}
            fz="0.75rem"
            fw={500}
            tt="none"
            style={{backgroundColor: style.bg, color: style.color ?? 'var(--mantine-color-text)'}}
        >
            {display}
        </Badge>
    );
});
StatusChip.displayName = 'StatusChip';

const ProgressBar: React.FC<{value: number}> = React.memo(({value}) => (
    <Group gap={8} wrap="nowrap" miw={100}>
        <Progress
            value={value}
            size={6}
            radius={3}
            color={getProgressColor(value)}
            style={{flex: 1}}
        />
        <Text fz="xs" miw={32} ta="right">
            {value}%
        </Text>
    </Group>
));
ProgressBar.displayName = 'ProgressBar';

export const DeliveriesTable: React.FC<DeliveriesTableProps> = React.memo(({
    deliveries,
    isLoading,
    sort,
    onSort,
    page,
    limit,
    total,
    onPageChange,
    onLimitChange,
    onShowMap,
    onOpenJobDetail,
    onToggleExpand,
}) => {
    const handleSort = (columnKey: string) => {
        const newDirection = sort.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc';
        onSort({column: columnKey, direction: newDirection});
    };

    return (
        <Box style={{position: 'relative'}}>
            {/* Loading overlay */}
            {isLoading && (
                <Group
                    justify="center"
                    align="center"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: alpha('var(--mantine-color-body)', 0.7),
                        zIndex: 10,
                    }}
                >
                    <Loader size={40} role="progressbar" aria-label="Loading deliveries"/>
                </Group>
            )}
            {/* Table. Rows nest (a parent expands to its children), so this reuses
                SortableTh and TablePager directly rather than DataTable's column API. */}
            <Table.ScrollContainer minWidth={0}>
                <Table verticalSpacing={4}>
                    <Table.Thead>
                        <Table.Tr>
                            {COLUMNS.map((col) => (
                                <SortableTh
                                    key={col.key}
                                    sortable={col.sortable}
                                    active={sort.column === col.key}
                                    direction={sort.column === col.key ? sort.direction : 'asc'}
                                    onSort={() => handleSort(col.key)}
                                    width={col.width}
                                >
                                    {col.label}
                                </SortableTh>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {deliveries.map((delivery) => (
                            <React.Fragment key={delivery.jobId}>
                                <Table.Tr h={48}>
                                    <Table.Td>
                                        {delivery.childJobs?.length > 0 && (
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                size="sm"
                                                onClick={() => onToggleExpand(delivery.jobId)}
                                                aria-label={delivery.expanded ? 'Collapse child jobs' : 'Expand child jobs'}
                                                aria-expanded={delivery.expanded}
                                            >
                                                <SymbolIcon name={delivery.expanded ? 'expand_more' : 'chevron_right'} size={20} />
                                            </ActionIcon>
                                        )}
                                    </Table.Td>
                                    <Table.Td>{delivery.jobName}</Table.Td>
                                    <Table.Td>
                                        <StatusChip status={delivery.status} />
                                    </Table.Td>
                                    <Table.Td>
                                        <ProgressBar value={delivery.completion} />
                                    </Table.Td>
                                    <Table.Td>{delivery.pickup}</Table.Td>
                                    <Table.Td>{delivery.delivery}</Table.Td>
                                    <Table.Td>{delivery.driver}</Table.Td>
                                    <Table.Td>{delivery.region}</Table.Td>
                                    <Table.Td style={{whiteSpace: 'nowrap'}}>
                                        {onShowMap && (
                                            <Tooltip label="Open Map">
                                                <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onShowMap(delivery)} aria-label="Open map">
                                                    <SymbolIcon name="map" size={20} />
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                        <Tooltip label="View Job Details">
                                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onOpenJobDetail(delivery)} aria-label="View job details">
                                                <SymbolIcon name="visibility" size={20} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Table.Td>
                                </Table.Tr>

                                {/* Child rows */}
                                {delivery.expanded &&
                                    delivery.childJobs?.map((child) => (
                                        <Table.Tr key={child.jobId} bg="var(--mantine-color-gray-0)">
                                            <Table.Td />
                                            <Table.Td>{child.jobName}</Table.Td>
                                            <Table.Td>
                                                <StatusChip status={child.status} />
                                            </Table.Td>
                                            <Table.Td>
                                                <ProgressBar value={child.completion} />
                                            </Table.Td>
                                            <Table.Td>{child.pickup}</Table.Td>
                                            <Table.Td>{child.delivery}</Table.Td>
                                            <Table.Td>{child.driver}</Table.Td>
                                            <Table.Td>{child.region}</Table.Td>
                                            <Table.Td />
                                        </Table.Tr>
                                    ))}
                            </React.Fragment>
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
            {/* Empty state */}
            {deliveries.length === 0 && !isLoading && (
                <Stack align="center" gap={4} py={48} c="dimmed">
                    <SymbolIcon name="local_shipping" size={48} />
                    <Text mt={8}>No deliveries found</Text>
                    <Text fz="sm">Try adjusting your filters or date range.</Text>
                </Stack>
            )}
            {/* Pagination */}
            {total > 0 && (
                // TablePager is 1-based, so the ±1 the MUI pagination needed is gone.
                <Box style={{borderTop: '1px solid var(--mantine-color-default-border)'}}>
                    <TablePager
                        totalCount={total}
                        page={page}
                        pageSize={limit}
                        onPageChange={onPageChange}
                        onPageSizeChange={onLimitChange}
                        pageSizeOptions={[10, 20, 30, 50]}
                    />
                </Box>
            )}
        </Box>
    );
});
DeliveriesTable.displayName = 'DeliveriesTable';

export default DeliveriesTable;
