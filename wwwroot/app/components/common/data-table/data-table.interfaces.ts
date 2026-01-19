/**
 * Data Table Interfaces
 *
 * Type definitions for data table components.
 */

export interface IDataTableColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    truncate?: boolean;
    format?: (value: any, row: any) => string;
}

export interface IDataTableSort {
    column: string;
    direction: 'asc' | 'desc';
}
