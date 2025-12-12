import "./data-table.styles.less";
import {IDataTableColumn, IDataTableConfig, IDataTableSort} from "./data-table.interfaces";

class DataTableController implements angular.IController {
    static $inject = ['$element', '$scope', '$transclude'];

    // Bindings
    columns!: IDataTableColumn[];
    data!: any[];
    config?: IDataTableConfig;
    sort?: IDataTableSort;
    loading?: boolean;
    selectedRows?: any[];
    trackBy?: string;

    // Pagination bindings
    page?: number;
    pageSize?: number;
    total?: number;
    pageSizeOptions?: number[];
    showPagination?: boolean;

    // Event callbacks
    onRowClick?: (params: { row: any; index: number; $event: MouseEvent }) => void;
    onRowDoubleClick?: (params: { row: any; index: number; $event: MouseEvent }) => void;
    onRowSelect?: (params: { selectedRows: any[] }) => void;
    onSort?: (params: { sort: IDataTableSort }) => void;
    onPaginate?: (params: { page: number; pageSize: number }) => void;
    onRowContext?: (params: { row: any; index: number; $event: MouseEvent }) => void;

    // Internal state
    private _selectedRowsMap: Map<any, boolean> = new Map();
    private _allSelected: boolean = false;
    hasTranscludedContent: boolean = false;

    constructor(
        private $element: angular.IAugmentedJQuery,
        private $scope: angular.IScope,
        private $transclude: angular.ITranscludeFunction
    ) {}

    $onInit(): void {
        this.initDefaults();
        this.checkTransclusion();
    }

    $onChanges(changes: angular.IOnChangesObject): void {
        if (changes.data && !changes.data.isFirstChange()) {
            this.syncSelectedRows();
        }
        if (changes.selectedRows && !changes.selectedRows.isFirstChange()) {
            this.updateSelectedRowsMap();
        }
    }

    private initDefaults(): void {
        this.config = {
            selectable: false,
            multiSelect: true,
            hoverEffect: true,
            striped: false,
            bordered: false,
            dense: false,
            stickyHeader: true,
            loading: false,
            emptyMessage: 'No data available',
            emptyIcon: 'inbox',
            trackBy: 'id',
            ...this.config
        };

        this.columns = (this.columns || []).map(col => ({
            visible: true,
            sortable: false,
            truncate: false,
            align: 'left',
            ...col
        }));

        this.selectedRows = this.selectedRows || [];
        this.updateSelectedRowsMap();
    }

    private checkTransclusion(): void {
        if (this.$transclude) {
            this.$transclude((clone) => {
                this.hasTranscludedContent = (clone && clone.length > 0) ?? false;
            });
        }
    }

    private updateSelectedRowsMap(): void {
        this._selectedRowsMap.clear();
        (this.selectedRows || []).forEach(row => {
            this._selectedRowsMap.set(this.getRowId(row), true);
        });
        this.updateAllSelectedState();
    }

    private syncSelectedRows(): void {
        if (!this.config?.selectable) return;

        const validIds = new Set((this.data || []).map(row => this.getRowId(row)));
        const newSelected = (this.selectedRows || []).filter(row =>
            validIds.has(this.getRowId(row))
        );

        if (newSelected.length !== this.selectedRows?.length) {
            this.selectedRows = newSelected;
            this.updateSelectedRowsMap();
            this.emitSelectionChange();
        }
    }

    private getRowId(row: any): any {
        const trackBy = this.trackBy || this.config?.trackBy || 'id';
        return this.getNestedValue(row, trackBy) ?? row;
    }

    // Public methods
    get visibleColumns(): IDataTableColumn[] {
        return (this.columns || []).filter(col => col.visible !== false);
    }

    get isLoading(): boolean {
        return this.loading || this.config?.loading || false;
    }

    get isEmpty(): boolean {
        return !this.data || this.data.length === 0;
    }

    get allSelected(): boolean {
        return this._allSelected;
    }

    get someSelected(): boolean {
        return this._selectedRowsMap.size > 0 && !this._allSelected;
    }

    getNestedValue(obj: any, path: string): any {
        if (!obj || !path) return obj;
        return path.split('.').reduce((current, key) =>
            current && current[key] !== undefined ? current[key] : undefined, obj
        );
    }

    getCellValue(row: any, column: IDataTableColumn): any {
        const field = column.field || column.key;
        return this.getNestedValue(row, field);
    }

    getColumnStyle(column: IDataTableColumn): { [key: string]: string } {
        const style: { [key: string]: string } = {};
        if (column.width) style['width'] = column.width;
        if (column.minWidth) style['min-width'] = column.minWidth;
        if (column.maxWidth) style['max-width'] = column.maxWidth;
        if (column.align) style['text-align'] = column.align;
        return style;
    }

    getColumnClasses(column: IDataTableColumn): string[] {
        const classes: string[] = [];
        if (column.sortable) classes.push('sortable');
        if (column.truncate) classes.push('truncate');
        if (column.hideOnMobile) classes.push('hide-mobile');
        if (column.sticky) classes.push(`sticky-${column.sticky}`);
        if (column.cssClass) classes.push(column.cssClass);
        if (column.align) classes.push(`align-${column.align}`);
        return classes;
    }

    getRowClasses(row: any, index: number): string[] {
        const classes: string[] = [];
        if (this.isRowSelected(row)) classes.push('selected');
        if (this.config?.striped && index % 2 === 1) classes.push('striped');
        return classes;
    }

    getSortIcon(column: IDataTableColumn): string {
        if (!column.sortable) return '';
        const sortKey = column.sortKey || column.field || column.key;
        if (this.sort?.column === sortKey) {
            return this.sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
        }
        return 'unfold_more';
    }

    isSortedColumn(column: IDataTableColumn): boolean {
        const sortKey = column.sortKey || column.field || column.key;
        return this.sort?.column === sortKey;
    }

    // Event handlers
    handleHeaderClick(column: IDataTableColumn, event: MouseEvent): void {
        if (!column.sortable) return;

        const sortKey = column.sortKey || column.field || column.key;
        let newDirection: 'asc' | 'desc' = 'asc';

        if (this.sort?.column === sortKey) {
            newDirection = this.sort.direction === 'asc' ? 'desc' : 'asc';
        }

        this.sort = { column: sortKey, direction: newDirection };

        if (this.onSort) {
            this.onSort({ sort: this.sort });
        }
    }

    handleRowClick(row: any, index: number, event: MouseEvent): void {
        if (this.onRowClick) {
            this.onRowClick({ row, index, $event: event });
        }
    }

    handleRowDoubleClick(row: any, index: number, event: MouseEvent): void {
        if (this.onRowDoubleClick) {
            this.onRowDoubleClick({ row, index, $event: event });
        }
    }

    handleRowContext(row: any, index: number, event: MouseEvent): void {
        if (this.onRowContext) {
            this.onRowContext({ row, index, $event: event });
        }
    }

    // Selection methods
    isRowSelected(row: any): boolean {
        return this._selectedRowsMap.has(this.getRowId(row));
    }

    toggleRowSelection(row: any, event?: MouseEvent): void {
        if (!this.config?.selectable) return;
        if (event) event.stopPropagation();

        const rowId = this.getRowId(row);

        if (this._selectedRowsMap.has(rowId)) {
            this._selectedRowsMap.delete(rowId);
            this.selectedRows = (this.selectedRows || []).filter(r =>
                this.getRowId(r) !== rowId
            );
        } else {
            if (!this.config.multiSelect) {
                this._selectedRowsMap.clear();
                this.selectedRows = [];
            }
            this._selectedRowsMap.set(rowId, true);
            this.selectedRows = [...(this.selectedRows || []), row];
        }

        this.updateAllSelectedState();
        this.emitSelectionChange();
    }

    toggleAllSelection(event?: MouseEvent): void {
        if (!this.config?.selectable || !this.config?.multiSelect) return;
        if (event) event.stopPropagation();

        if (this._allSelected) {
            this._selectedRowsMap.clear();
            this.selectedRows = [];
        } else {
            this.selectedRows = [...(this.data || [])];
            this.selectedRows.forEach(row => {
                this._selectedRowsMap.set(this.getRowId(row), true);
            });
        }

        this.updateAllSelectedState();
        this.emitSelectionChange();
    }

    private updateAllSelectedState(): void {
        const dataLength = this.data?.length || 0;
        this._allSelected = dataLength > 0 && this._selectedRowsMap.size === dataLength;
    }

    private emitSelectionChange(): void {
        if (this.onRowSelect) {
            this.onRowSelect({ selectedRows: this.selectedRows || [] });
        }
    }

    // Pagination methods
    handlePaginate(page: number, pageSize: number): void {
        this.page = page;
        this.pageSize = pageSize;
        if (this.onPaginate) {
            this.onPaginate({ page, pageSize });
        }
    }

    // Track by function for ng-repeat
    trackByFn(index: number, item: any): any {
        return this.getRowId(item);
    }
}

const DataTableComponent: angular.IComponentOptions = {
    template: require("./data-table.template.html"),
    transclude: {
        'cellTemplate': '?cellTemplate',
        'rowActions': '?rowActions',
        'emptyState': '?emptyState',
        'headerActions': '?headerActions'
    },
    bindings: {
        // Core bindings
        columns: '<',
        data: '<',
        config: '<?',
        sort: '=?',
        loading: '<?',
        selectedRows: '=?',
        trackBy: '@?',

        // Pagination bindings
        page: '=?',
        pageSize: '=?',
        total: '<?',
        pageSizeOptions: '<?',
        showPagination: '<?',

        // Event callbacks
        onRowClick: '&?',
        onRowDoubleClick: '&?',
        onRowSelect: '&?',
        onSort: '&?',
        onPaginate: '&?',
        onRowContext: '&?'
    },
    controller: DataTableController,
    controllerAs: 'ctrl'
};

export default DataTableComponent;
