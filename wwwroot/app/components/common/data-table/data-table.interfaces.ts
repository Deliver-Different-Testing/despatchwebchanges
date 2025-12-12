export interface IDataTableColumn {
    /** Unique identifier for the column */
    key: string;
    /** Display label for the column header */
    label: string;
    /** Property path to access data (supports nested: 'address.city') */
    field?: string;
    /** Enable sorting for this column */
    sortable?: boolean;
    /** Sort key if different from field */
    sortKey?: string;
    /** Column width (e.g., '100px', '20%', 'auto') */
    width?: string;
    /** Minimum width */
    minWidth?: string;
    /** Maximum width */
    maxWidth?: string;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Show ellipsis for overflow text */
    truncate?: boolean;
    /** Custom template ID for cell content */
    templateId?: string;
    /** Custom CSS class for the column */
    cssClass?: string;
    /** Hide column on smaller screens */
    hideOnMobile?: boolean;
    /** Sticky column position */
    sticky?: 'left' | 'right';
    /** Column is visible */
    visible?: boolean;
}

export interface IDataTableSort {
    /** Column key to sort by */
    column: string;
    /** Sort direction */
    direction: 'asc' | 'desc';
}

export interface IDataTableConfig {
    /** Enable row selection */
    selectable?: boolean;
    /** Allow multiple row selection */
    multiSelect?: boolean;
    /** Enable row hover effect */
    hoverEffect?: boolean;
    /** Enable striped rows */
    striped?: boolean;
    /** Enable borders */
    bordered?: boolean;
    /** Compact/dense mode */
    dense?: boolean;
    /** Fixed header on scroll */
    stickyHeader?: boolean;
    /** Show loading overlay */
    loading?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Empty state icon */
    emptyIcon?: string;
    /** Track by field for ng-repeat */
    trackBy?: string;
    /** Enable virtual scrolling for large datasets */
    virtualScroll?: boolean;
    /** Row height for virtual scrolling */
    rowHeight?: number;
}

export interface IDataTablePagination {
    /** Current page (1-indexed) */
    page: number;
    /** Items per page */
    pageSize: number;
    /** Total number of items */
    total: number;
    /** Available page size options */
    pageSizeOptions?: number[];
}

export interface IDataTableEvents {
    onRowClick?: (row: any, index: number, event: MouseEvent) => void;
    onRowDoubleClick?: (row: any, index: number, event: MouseEvent) => void;
    onRowSelect?: (selectedRows: any[]) => void;
    onSort?: (sort: IDataTableSort) => void;
    onPaginate?: (pagination: { page: number; pageSize: number }) => void;
}
