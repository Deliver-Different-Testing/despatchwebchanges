import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {DataTable, DataTableColumn, SortState} from './DataTable';

const theme = createTheme();

interface MockRow {
    id: number;
    name: string;
    value: number;
}

const mockColumns: DataTableColumn<MockRow>[] = [
    {key: 'id', label: 'ID', sortable: true, render: (row) => row.id},
    {key: 'name', label: 'Name', sortable: true, render: (row) => row.name},
    {key: 'value', label: 'Value', sortable: false, render: (row) => row.value},
];

const mockRows: MockRow[] = [
    {id: 1, name: 'Alice', value: 100},
    {id: 2, name: 'Bob', value: 200},
    {id: 3, name: 'Charlie', value: 300},
];

const defaultProps = {
    totalCount: 3,
    rows: mockRows,
    columns: mockColumns,
    rowKey: (row: MockRow) => row.id,
    isLoading: false,
    sort: {column: 'name', direction: 'asc'} as SortState,
    onSortChange: jest.fn(),
    page: 1,
    pageSize: 10,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
};

const renderTable = (props = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <DataTable<MockRow> {...defaultProps} {...props} />
        </ThemeProvider>
    );

describe('DataTable', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('Column headers', () => {
        it('should render all column headers', () => {
            renderTable();

            expect(screen.getByText('ID')).toBeInTheDocument();
            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Value')).toBeInTheDocument();
        });
    });

    describe('Row rendering', () => {
        it('should render all rows', () => {
            renderTable();

            expect(screen.getByText('Alice')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('Charlie')).toBeInTheDocument();
        });

        it('should render row values', () => {
            renderTable();

            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('200')).toBeInTheDocument();
            expect(screen.getByText('300')).toBeInTheDocument();
        });
    });

    describe('Sorting', () => {
        it('should call onSortChange when sortable header is clicked', () => {
            const onSortChange = jest.fn();
            renderTable({onSortChange});

            fireEvent.click(screen.getByText('ID'));

            expect(onSortChange).toHaveBeenCalledWith({column: 'id', direction: 'asc'});
        });

        it('should toggle direction when active sort column is clicked', () => {
            const onSortChange = jest.fn();
            renderTable({onSortChange, sort: {column: 'name', direction: 'asc'}});

            fireEvent.click(screen.getByText('Name'));

            expect(onSortChange).toHaveBeenCalledWith({column: 'name', direction: 'desc'});
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator', () => {
            renderTable({isLoading: true});

            expect(screen.getByText('Loading...')).toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('should not show rows when loading', () => {
            renderTable({isLoading: true});

            expect(screen.queryByText('Alice')).not.toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show default empty message when no rows', () => {
            renderTable({rows: [], totalCount: 0});

            expect(screen.getByText('No Data')).toBeInTheDocument();
            expect(screen.getByText('No records match your criteria.')).toBeInTheDocument();
        });

        it('should show custom empty title and message', () => {
            renderTable({rows: [], totalCount: 0, emptyTitle: 'Nothing Found', emptyMessage: 'Try different filters.'});

            expect(screen.getByText('Nothing Found')).toBeInTheDocument();
            expect(screen.getByText('Try different filters.')).toBeInTheDocument();
        });
    });

    describe('Row click', () => {
        it('should call onRowClick when row is clicked', () => {
            const onRowClick = jest.fn();
            renderTable({onRowClick});

            fireEvent.click(screen.getByText('Alice'));

            expect(onRowClick).toHaveBeenCalledWith(mockRows[0]);
        });
    });

    describe('Checkbox selection', () => {
        it('should render checkboxes when checkboxSelection is true', () => {
            renderTable({
                checkboxSelection: true,
                allSelected: false,
                someSelected: false,
                onSelectAll: jest.fn(),
                renderCheckbox: (row: MockRow) => <input type="checkbox" data-testid={`check-${row.id}`} />,
            });

            expect(screen.getByTestId('check-1')).toBeInTheDocument();
            expect(screen.getByTestId('check-2')).toBeInTheDocument();
        });
    });

    describe('Pagination', () => {
        it('should show pagination controls', () => {
            renderTable();

            expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
        });
    });
});
