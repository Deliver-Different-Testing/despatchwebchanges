/**
 * DataTable — the app's generic sortable, paginated, optionally-selectable table.
 *
 * Lived in `pages/driver-management/components/shared` while it had one consumer;
 * promoted here when the Phase 5 table sweep needed the same thing in four more
 * places. Composed from {@link SortableTh} and {@link TablePager}, which supply the
 * two pieces Mantine has no primitive for.
 *
 * A table whose markup is genuinely bespoke (the flight-agent grid, the
 * virtualised job list) should reuse those two parts directly rather than being
 * forced through this component's column API.
 */
import React, {useCallback} from 'react';
import {Card, Checkbox, Loader, Stack, Table, Text} from '@mantine/core';
import {SortableTh, type SortDirection} from './SortableTh';
import {DEFAULT_PAGE_SIZE_OPTIONS, TablePager} from './TablePager';
import classes from './DataTable.module.css';

export interface DataTableColumn<T> {
    key: string;
    label: string;
    sortable?: boolean;
    sortKey?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render: (row: T, index: number) => React.ReactNode;
}

export interface SortState {
    column: string;
    direction: SortDirection;
}

export interface DataTableProps<T> {
    totalCount: number;
    rows: T[];
    columns: DataTableColumn<T>[];
    rowKey: (row: T, index: number) => string | number;
    isLoading: boolean;
    sort?: SortState;
    onSortChange?: (sort: SortState) => void;
    /** 1-based. */
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    /** Right-click on a row — used for context menus. */
    onRowContextMenu?: (event: React.MouseEvent, row: T) => void;
    /** Overrides the default "Loading..." caption. */
    loadingMessage?: string;
    isRowSelected?: (row: T) => boolean;
    checkboxSelection?: boolean;
    allSelected?: boolean;
    someSelected?: boolean;
    onSelectAll?: () => void;
    renderCheckbox?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
    totalCount,
    rows,
    columns,
    rowKey,
    isLoading,
    sort,
    onSortChange,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    emptyIcon,
    emptyTitle = 'No Data',
    emptyMessage = 'No records match your criteria.',
    onRowClick,
    onRowContextMenu,
    loadingMessage = 'Loading...',
    isRowSelected,
    checkboxSelection,
    allSelected,
    someSelected,
    onSelectAll,
    renderCheckbox,
}: DataTableProps<T>) {
    const handleSortClick = useCallback(
        (column: string) => {
            if (!sort || !onSortChange) return;
            const isAsc = sort.column === column && sort.direction === 'asc';
            onSortChange({column, direction: isAsc ? 'desc' : 'asc'});
        },
        [sort, onSortChange]
    );

    const colSpan = columns.length + (checkboxSelection ? 1 : 0);

    // `lg` matches BoxShell's panel radius — the dispatch page's Xero-inspired rounder card corners.
    return (
        <Card p={0} radius="lg" withBorder style={{overflow: 'hidden'}}>
            <Table.ScrollContainer minWidth={0}>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            {checkboxSelection && (
                                <Table.Th w={44}>
                                    <Checkbox
                                        checked={allSelected ?? false}
                                        indeterminate={!!(someSelected && !allSelected)}
                                        onChange={onSelectAll}
                                        aria-label="Select all rows"
                                    />
                                </Table.Th>
                            )}
                            {columns.map((column) => {
                                const sortKey = column.sortKey || column.key;
                                return (
                                    <SortableTh
                                        key={column.key}
                                        sortable={!!(column.sortable && sort && onSortChange)}
                                        active={sort?.column === sortKey}
                                        direction={sort?.column === sortKey ? sort.direction : 'asc'}
                                        onSort={() => handleSortClick(sortKey)}
                                        width={column.width}
                                        align={column.align}
                                    >
                                        {column.label}
                                    </SortableTh>
                                );
                            })}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {isLoading ? (
                            <Table.Tr>
                                <Table.Td colSpan={colSpan} ta="center" py={64}>
                                    <Stack align="center" gap="md">
                                        <Loader size={32} role="progressbar" aria-label="Loading" />
                                        <Text fz="sm" c="dimmed">{loadingMessage}</Text>
                                    </Stack>
                                </Table.Td>
                            </Table.Tr>
                        ) : rows.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={colSpan} ta="center" py={64}>
                                    <Stack align="center" gap={4}>
                                        {emptyIcon}
                                        <Text fw={600} c="dimmed">{emptyTitle}</Text>
                                        <Text fz="sm" c="dimmed">{emptyMessage}</Text>
                                    </Stack>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            rows.map((row, index) => (
                                <Table.Tr
                                    key={rowKey(row, index)}
                                    className={classes.row}
                                    data-selected={isRowSelected?.(row) ?? false}
                                    data-clickable={!!onRowClick}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, row) : undefined}
                                >
                                    {checkboxSelection && (
                                        <Table.Td>{renderCheckbox?.(row)}</Table.Td>
                                    )}
                                    {columns.map((column) => (
                                        <Table.Td
                                            key={column.key}
                                            ta={column.align || 'left'}
                                            // Right-aligned columns are numeric/currency data in this app —
                                            // tabular figures keep the digits lined up column-for-column.
                                            style={column.align === 'right' ? {fontVariantNumeric: 'tabular-nums'} : undefined}
                                        >
                                            {column.render(row, index)}
                                        </Table.Td>
                                    ))}
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
            <TablePager
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={pageSizeOptions}
                hideWhenEmpty={false}
            />
        </Card>
    );
}

export default DataTable;
