import React, {useCallback} from 'react';
import {
    alpha,
    Card,
    Checkbox,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Typography,
} from '@mui/material';

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
    direction: 'asc' | 'desc';
}

export interface DataTableProps<T> {
    totalCount: number;
    rows: T[];
    columns: DataTableColumn<T>[];
    rowKey: (row: T, index: number) => string | number;
    isLoading: boolean;
    sort?: SortState;
    onSortChange?: (sort: SortState) => void;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
    emptyIcon?: React.ReactElement;
    emptyTitle?: string;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    isRowSelected?: (row: T) => boolean;
    checkboxSelection?: boolean;
    allSelected?: boolean;
    someSelected?: boolean;
    onSelectAll?: () => void;
    renderCheckbox?: (row: T) => React.ReactNode;
}

const defaultPageSizeOptions = [10, 25, 50, 100];

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
    pageSizeOptions = defaultPageSizeOptions,
    emptyIcon,
    emptyTitle = 'No Data',
    emptyMessage = 'No records match your criteria.',
    onRowClick,
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

    const handlePageChange = useCallback(
        (_event: unknown, newPage: number) => {
            onPageChange(newPage + 1);
        },
        [onPageChange]
    );

    const handleRowsPerPageChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onPageSizeChange(parseInt(event.target.value, 10));
        },
        [onPageSizeChange]
    );

    const colSpan = columns.length + (checkboxSelection ? 1 : 0);

    return (
        <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {checkboxSelection && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={allSelected ?? false}
                                        indeterminate={!!(someSelected && !allSelected)}
                                        onChange={onSelectAll}
                                    />
                                </TableCell>
                            )}
                            {columns.map((column) => (
                                <TableCell
                                    key={column.key}
                                    align={column.align || 'left'}
                                    sx={{
                                        width: column.width,
                                    }}
                                >
                                    {column.sortable && sort && onSortChange ? (
                                        <TableSortLabel
                                            active={sort.column === (column.sortKey || column.key)}
                                            direction={sort.column === (column.sortKey || column.key) ? sort.direction : 'asc'}
                                            onClick={() => handleSortClick(column.sortKey || column.key)}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    ) : (
                                        column.label
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={colSpan} align="center" sx={{py: 8}}>
                                    <CircularProgress size={32} />
                                    <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
                                        Loading...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={colSpan} align="center" sx={{py: 8}}>
                                    {emptyIcon && React.cloneElement(emptyIcon as React.ReactElement<Record<string, unknown>>, {
                                        sx: {fontSize: 48, color: 'grey.400', mb: 1, ...(emptyIcon.props as Record<string, unknown>)?.sx as object},
                                    })}
                                    <Typography variant="body1" sx={{fontWeight: 600}} color="text.secondary">
                                        {emptyTitle}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {emptyMessage}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row, index) => {
                                const selected = isRowSelected?.(row) ?? false;
                                return (
                                    <TableRow
                                        key={rowKey(row, index)}
                                        hover
                                        selected={selected}
                                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                                        sx={(theme) => ({
                                            cursor: onRowClick ? 'pointer' : undefined,
                                            '&.Mui-selected': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                            },
                                            '&.Mui-selected:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.12),
                                            },
                                        })}
                                    >
                                        {checkboxSelection && (
                                            <TableCell padding="checkbox">
                                                {renderCheckbox?.(row)}
                                            </TableCell>
                                        )}
                                        {columns.map((column) => (
                                            <TableCell
                                                key={column.key}
                                                align={column.align || 'left'}
                                                sx={{py: 1}}
                                            >
                                                {column.render(row, index)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={totalCount}
                page={page - 1}
                rowsPerPage={pageSize}
                rowsPerPageOptions={pageSizeOptions}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                sx={{
                    borderTop: 1,
                    borderColor: 'divider',
                    '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                        mb: 0,
                    },
                }}
            />
        </Card>
    );
}
