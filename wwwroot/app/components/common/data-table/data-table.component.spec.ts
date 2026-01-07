/**
 * Tests for DataTableController
 * Covers formatting, row actions, cell classes, and column processing
 */

import DataTableComponent from './data-table.component';
import {IDataTableColumn, IDataTableRowAction} from './data-table.interfaces';

// Extract the controller class from the component
const DataTableController = DataTableComponent.controller as any;

describe('DataTableController', () => {
    let controller: any;
    let mockFilter: jest.Mock;
    let mockSce: { trustAsHtml: jest.Mock };

    beforeEach(() => {
        // Create mock $filter service
        mockFilter = jest.fn((filterName: string) => {
            switch (filterName) {
                case 'currency':
                    return (value: number) => `$${value.toFixed(2)}`;
                case 'number':
                    return (value: number, decimals: number) => value.toFixed(decimals);
                case 'date':
                    return (value: Date, format: string) => '1/1/24, 12:00 PM';
                default:
                    return (value: any) => value;
            }
        });

        // Create mock $sce service
        mockSce = {
            trustAsHtml: jest.fn((html: string) => ({ $$unwrapTrustedValue: () => html }))
        };

        // Create controller instance with mocked dependencies
        controller = Object.create(DataTableController.prototype);
        controller.$filter = mockFilter;
        controller.$sce = mockSce;
        controller.columns = [];
        controller.data = [];
        controller.config = {};
        controller._processedColumns = [];
        controller._selectedRowsMap = new Map();
    });

    describe('getFormattedCellValue', () => {
        describe('currency format', () => {
            it('should format value as currency', () => {
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency' };
                const row = { price: 123.45 };

                controller.columns = [column];
                const result = controller.getFormattedCellValue(row, column);

                expect(mockFilter).toHaveBeenCalledWith('currency');
                expect(result).toBe('$123.45');
            });

            it('should format zero as currency', () => {
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency' };
                const row = { price: 0 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('$0.00');
            });

            it('should format negative values as currency', () => {
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency' };
                const row = { price: -50.5 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('$-50.50');
            });
        });

        describe('percent format', () => {
            it('should format value as percent with default 2 decimals', () => {
                const column: IDataTableColumn = { key: 'rate', label: 'Rate', format: 'percent' };
                const row = { rate: 15.5 };

                const result = controller.getFormattedCellValue(row, column);

                expect(mockFilter).toHaveBeenCalledWith('number');
                expect(result).toBe('15.50%');
            });

            it('should format value as percent with custom decimals', () => {
                const column: IDataTableColumn = { key: 'rate', label: 'Rate', format: 'percent', decimals: 0 };
                const row = { rate: 15.5 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('16%'); // 15.5 rounded to 0 decimals
            });

            it('should format value as percent with 4 decimals', () => {
                const column: IDataTableColumn = { key: 'rate', label: 'Rate', format: 'percent', decimals: 4 };
                const row = { rate: 15.5678 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('15.5678%');
            });
        });

        describe('number format', () => {
            it('should format value as number with default 2 decimals', () => {
                const column: IDataTableColumn = { key: 'quantity', label: 'Quantity', format: 'number' };
                const row = { quantity: 1234.5678 };

                const result = controller.getFormattedCellValue(row, column);

                expect(mockFilter).toHaveBeenCalledWith('number');
                expect(result).toBe('1234.57');
            });

            it('should format value as number with custom decimals', () => {
                const column: IDataTableColumn = { key: 'quantity', label: 'Quantity', format: 'number', decimals: 3 };
                const row = { quantity: 1234.5678 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('1234.568');
            });
        });

        describe('date format', () => {
            it('should format value as date', () => {
                const column: IDataTableColumn = { key: 'createdAt', label: 'Created', format: 'date' };
                const row = { createdAt: new Date('2024-01-01T12:00:00') };

                const result = controller.getFormattedCellValue(row, column);

                expect(mockFilter).toHaveBeenCalledWith('date');
                expect(result).toBe('1/1/24, 12:00 PM');
            });
        });

        describe('custom render function', () => {
            it('should use custom render function when provided', () => {
                const renderFn = jest.fn((value, row, column) => `Custom: ${value}`);
                const column: IDataTableColumn = { key: 'name', label: 'Name', render: renderFn };
                const row = { name: 'Test' };

                const result = controller.getFormattedCellValue(row, column);

                expect(renderFn).toHaveBeenCalledWith('Test', row, column);
                expect(result).toBe('Custom: Test');
            });

            it('should prioritize render function over format', () => {
                const renderFn = jest.fn(() => 'Rendered');
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency', render: renderFn };
                const row = { price: 100 };

                const result = controller.getFormattedCellValue(row, column);

                expect(renderFn).toHaveBeenCalled();
                expect(result).toBe('Rendered');
                // Currency filter should NOT be called since render takes precedence
            });
        });

        describe('null/undefined handling', () => {
            it('should return empty string for null value', () => {
                const column: IDataTableColumn = { key: 'name', label: 'Name' };
                const row = { name: null };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('');
            });

            it('should return empty string for undefined value', () => {
                const column: IDataTableColumn = { key: 'name', label: 'Name' };
                const row = {};

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('');
            });

            it('should not apply format to null value', () => {
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency' };
                const row = { price: null };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('');
            });

            it('should not apply format to undefined value', () => {
                const column: IDataTableColumn = { key: 'price', label: 'Price', format: 'currency' };
                const row = {};

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('');
            });
        });

        describe('no format specified', () => {
            it('should convert value to string', () => {
                const column: IDataTableColumn = { key: 'count', label: 'Count' };
                const row = { count: 42 };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('42');
            });

            it('should return string values unchanged', () => {
                const column: IDataTableColumn = { key: 'status', label: 'Status' };
                const row = { status: 'Active' };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('Active');
            });
        });

        describe('nested field access', () => {
            it('should access nested field values', () => {
                const column: IDataTableColumn = { key: 'address.city', label: 'City', format: 'currency' };
                // Note: currency on a string is unusual but tests the flow
                const row = { address: { city: 100 } };

                const result = controller.getFormattedCellValue(row, column);

                expect(result).toBe('$100.00');
            });
        });
    });

    describe('getCellClasses', () => {
        beforeEach(() => {
            // Mock getColumnClasses to return base classes
            controller.getColumnClasses = jest.fn((column: IDataTableColumn) => {
                const classes: string[] = [];
                if (column.sortable) classes.push('sortable');
                if (column.cssClass) classes.push(column.cssClass);
                return classes;
            });
        });

        it('should include base column classes', () => {
            const column: IDataTableColumn = { key: 'name', label: 'Name', sortable: true, cssClass: 'custom-class' };
            const row = { name: 'Test' };

            const result = controller.getCellClasses(row, column);

            expect(result).toContain('sortable');
            expect(result).toContain('custom-class');
        });

        it('should add dynamic cell class from function', () => {
            const cellClassFn = jest.fn((value, row) => value > 0 ? 'positive' : 'negative');
            const column: IDataTableColumn = { key: 'amount', label: 'Amount', cellClass: cellClassFn };
            const row = { amount: 100 };

            const result = controller.getCellClasses(row, column);

            expect(cellClassFn).toHaveBeenCalledWith(100, row);
            expect(result).toContain('positive');
        });

        it('should add negative class for negative values', () => {
            const cellClassFn = jest.fn((value) => value < 0 ? 'negative' : 'positive');
            const column: IDataTableColumn = { key: 'amount', label: 'Amount', cellClass: cellClassFn };
            const row = { amount: -50 };

            const result = controller.getCellClasses(row, column);

            expect(result).toContain('negative');
        });

        it('should not add class when cellClass returns empty string', () => {
            const cellClassFn = jest.fn(() => '');
            const column: IDataTableColumn = { key: 'name', label: 'Name', cellClass: cellClassFn };
            const row = { name: 'Test' };

            const result = controller.getCellClasses(row, column);

            // Should only have base classes, no empty string
            expect(result.trim()).toBe('');
        });

        it('should not add class when cellClass returns null', () => {
            const cellClassFn = jest.fn(() => null as any);
            const column: IDataTableColumn = { key: 'name', label: 'Name', cellClass: cellClassFn };
            const row = { name: 'Test' };

            const result = controller.getCellClasses(row, column);

            expect(result.trim()).toBe('');
        });

        it('should work without cellClass function', () => {
            const column: IDataTableColumn = { key: 'name', label: 'Name', sortable: true };
            const row = { name: 'Test' };

            const result = controller.getCellClasses(row, column);

            expect(result).toContain('sortable');
        });
    });

    describe('trustAsHtml', () => {
        it('should call $sce.trustAsHtml', () => {
            const html = '<strong>Bold</strong>';

            controller.trustAsHtml(html);

            expect(mockSce.trustAsHtml).toHaveBeenCalledWith(html);
        });

        it('should return trusted HTML object', () => {
            const html = '<em>Italic</em>';

            const result = controller.trustAsHtml(html);

            expect(result.$$unwrapTrustedValue()).toBe(html);
        });
    });

    describe('Row Actions', () => {
        describe('handleRowAction', () => {
            it('should call onRowAction callback with correct params', () => {
                const mockOnRowAction = jest.fn();
                controller.onRowAction = mockOnRowAction;

                const action: IDataTableRowAction = { key: 'edit', icon: 'edit' };
                const row = { id: 1, name: 'Test' };
                const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;

                controller.handleRowAction(action, row, 0, event);

                expect(event.stopPropagation).toHaveBeenCalled();
                expect(mockOnRowAction).toHaveBeenCalledWith({
                    action: 'edit',
                    row,
                    index: 0
                });
            });

            it('should stop event propagation', () => {
                const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
                const action: IDataTableRowAction = { key: 'delete', icon: 'delete' };

                controller.handleRowAction(action, {}, 0, event);

                expect(event.stopPropagation).toHaveBeenCalled();
            });

            it('should not throw when onRowAction is undefined', () => {
                controller.onRowAction = undefined;
                const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
                const action: IDataTableRowAction = { key: 'view', icon: 'visibility' };

                expect(() => {
                    controller.handleRowAction(action, {}, 0, event);
                }).not.toThrow();
            });
        });

        describe('isActionDisabled', () => {
            it('should return false when disabled is undefined', () => {
                const action: IDataTableRowAction = { key: 'edit', icon: 'edit' };
                const row = { id: 1 };

                const result = controller.isActionDisabled(action, row);

                expect(result).toBe(false);
            });

            it('should return boolean disabled value', () => {
                const action: IDataTableRowAction = { key: 'edit', icon: 'edit', disabled: true };
                const row = { id: 1 };

                const result = controller.isActionDisabled(action, row);

                expect(result).toBe(true);
            });

            it('should return false for disabled: false', () => {
                const action: IDataTableRowAction = { key: 'edit', icon: 'edit', disabled: false };
                const row = { id: 1 };

                const result = controller.isActionDisabled(action, row);

                expect(result).toBe(false);
            });

            it('should call disabled function with row', () => {
                const disabledFn = jest.fn((row) => row.status === 'locked');
                const action: IDataTableRowAction = { key: 'edit', icon: 'edit', disabled: disabledFn };
                const row = { id: 1, status: 'locked' };

                const result = controller.isActionDisabled(action, row);

                expect(disabledFn).toHaveBeenCalledWith(row);
                expect(result).toBe(true);
            });

            it('should return false from function when row is not locked', () => {
                const disabledFn = jest.fn((row) => row.status === 'locked');
                const action: IDataTableRowAction = { key: 'edit', icon: 'edit', disabled: disabledFn };
                const row = { id: 1, status: 'active' };

                const result = controller.isActionDisabled(action, row);

                expect(result).toBe(false);
            });
        });

        describe('isActionHidden', () => {
            it('should return false when hidden is undefined', () => {
                const action: IDataTableRowAction = { key: 'delete', icon: 'delete' };
                const row = { id: 1 };

                const result = controller.isActionHidden(action, row);

                expect(result).toBe(false);
            });

            it('should call hidden function with row', () => {
                const hiddenFn = jest.fn((row) => row.isProtected);
                const action: IDataTableRowAction = { key: 'delete', icon: 'delete', hidden: hiddenFn };
                const row = { id: 1, isProtected: true };

                const result = controller.isActionHidden(action, row);

                expect(hiddenFn).toHaveBeenCalledWith(row);
                expect(result).toBe(true);
            });

            it('should return false when row is not protected', () => {
                const hiddenFn = jest.fn((row) => row.isProtected);
                const action: IDataTableRowAction = { key: 'delete', icon: 'delete', hidden: hiddenFn };
                const row = { id: 1, isProtected: false };

                const result = controller.isActionHidden(action, row);

                expect(result).toBe(false);
            });
        });

        describe('hasRowActions', () => {
            it('should return true when rowActions array has items', () => {
                controller.rowActions = [
                    { key: 'edit', icon: 'edit' },
                    { key: 'delete', icon: 'delete' }
                ];

                expect(controller.hasRowActions).toBe(true);
            });

            it('should return false when rowActions is empty array', () => {
                controller.rowActions = [];

                expect(controller.hasRowActions).toBe(false);
            });

            it('should return false when rowActions is undefined', () => {
                controller.rowActions = undefined;

                expect(controller.hasRowActions).toBe(false);
            });

            it('should return false when rowActions is null', () => {
                controller.rowActions = null;

                expect(controller.hasRowActions).toBe(false);
            });
        });
    });

    describe('$onChanges', () => {
        it('should process columns with defaults when columns change', () => {
            const changes = {
                columns: {
                    currentValue: [
                        { key: 'name', label: 'Name' },
                        { key: 'status', label: 'Status', sortable: true }
                    ],
                    previousValue: undefined,
                    isFirstChange: () => true
                }
            };

            controller.columns = changes.columns.currentValue;
            controller.$onChanges(changes);

            expect(controller._processedColumns).toHaveLength(2);
            expect(controller._processedColumns[0]).toEqual({
                key: 'name',
                label: 'Name',
                visible: true,
                sortable: false,
                truncate: false,
                align: 'left'
            });
            expect(controller._processedColumns[1]).toEqual({
                key: 'status',
                label: 'Status',
                sortable: true,
                visible: true,
                truncate: false,
                align: 'left'
            });
        });

        it('should preserve custom column properties', () => {
            const changes = {
                columns: {
                    currentValue: [
                        { key: 'amount', label: 'Amount', format: 'currency', align: 'right', width: '100px' }
                    ],
                    previousValue: undefined,
                    isFirstChange: () => true
                }
            };

            controller.columns = changes.columns.currentValue;
            controller.$onChanges(changes);

            expect(controller._processedColumns[0]).toMatchObject({
                key: 'amount',
                label: 'Amount',
                format: 'currency',
                align: 'right',
                width: '100px'
            });
        });

        it('should handle empty columns array', () => {
            const changes = {
                columns: {
                    currentValue: [],
                    previousValue: undefined,
                    isFirstChange: () => true
                }
            };

            controller.columns = [];
            controller.$onChanges(changes);

            expect(controller._processedColumns).toEqual([]);
        });
    });

    describe('visibleColumns', () => {
        it('should return only visible columns', () => {
            controller._processedColumns = [
                { key: 'name', label: 'Name', visible: true },
                { key: 'hidden', label: 'Hidden', visible: false },
                { key: 'status', label: 'Status', visible: true }
            ];

            const visible = controller.visibleColumns;

            expect(visible).toHaveLength(2);
            expect(visible.map((c: IDataTableColumn) => c.key)).toEqual(['name', 'status']);
        });

        it('should include columns without explicit visible property', () => {
            controller._processedColumns = [
                { key: 'name', label: 'Name' },
                { key: 'status', label: 'Status' }
            ];

            const visible = controller.visibleColumns;

            expect(visible).toHaveLength(2);
        });

        it('should return empty array when no columns', () => {
            controller._processedColumns = [];

            const visible = controller.visibleColumns;

            expect(visible).toEqual([]);
        });
    });

    describe('Component Definition', () => {
        it('should have the controller defined', () => {
            expect(DataTableComponent.controller).toBeDefined();
        });

        it('should have correct bindings', () => {
            expect(DataTableComponent.bindings).toBeDefined();
            expect(DataTableComponent.bindings?.columns).toBe('<');
            expect(DataTableComponent.bindings?.data).toBe('<');
            expect(DataTableComponent.bindings?.config).toBe('<?');
            expect(DataTableComponent.bindings?.rowActions).toBe('<?');
            expect(DataTableComponent.bindings?.onRowAction).toBe('&?');
        });

        it('should have rowActions bindings', () => {
            expect(DataTableComponent.bindings?.rowActions).toBeDefined();
            expect(DataTableComponent.bindings?.onRowAction).toBeDefined();
        });

        it('should use ctrl as controllerAs', () => {
            expect(DataTableComponent.controllerAs).toBe('ctrl');
        });
    });
});
