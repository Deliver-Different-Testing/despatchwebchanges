import "./table-pagination.styles.less";

interface IPaginationBindings {
    page: number;
    limit: number;
    pageSize: number;
    total: number;
    limitOptions?: number[];
    onPaginate: (params: { page: number; limit: number; pageSize: number }) => void;
    showPageSelect?: boolean;
}

class TablePaginationController implements angular.IController, IPaginationBindings {
    // Bindings - limit and pageSize are aliases
    page!: number;
    limit!: number;
    pageSize!: number;
    total!: number;
    limitOptions?: number[];
    onPaginate!: (params: { page: number; limit: number; pageSize: number }) => void;
    showPageSelect?: boolean;

    // Internal
    private defaultLimitOptions = [10, 25, 50, 100];
    private _effectiveLimit!: number;

    $onInit(): void {
        this.page = this.page || 1;
        // Support both limit and pageSize bindings
        this._effectiveLimit = this.limit || this.pageSize || 25;
        this.total = this.total || 0;
        this.showPageSelect = this.showPageSelect !== false;
    }

    // Getter/setter to keep limit and pageSize in sync
    get effectiveLimit(): number {
        return this._effectiveLimit;
    }

    set effectiveLimit(value: number) {
        this._effectiveLimit = value;
        // Sync both bindings
        if (this.limit !== undefined) this.limit = value;
        if (this.pageSize !== undefined) this.pageSize = value;
    }

    get effectiveLimitOptions(): number[] {
        return this.limitOptions || this.defaultLimitOptions;
    }

    get totalPages(): number {
        return Math.ceil(this.total / this.effectiveLimit) || 1;
    }

    get startItem(): number {
        if (this.total === 0) return 0;
        return ((this.page - 1) * this.effectiveLimit) + 1;
    }

    get endItem(): number {
        const end = this.page * this.effectiveLimit;
        return end > this.total ? this.total : end;
    }

    get canGoBack(): boolean {
        return this.page > 1;
    }

    get canGoForward(): boolean {
        return this.page < this.totalPages;
    }

    get pageOptions(): number[] {
        const pages: number[] = [];
        for (let i = 1; i <= this.totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }

    onLimitChange(): void {
        // Reset to page 1 when limit changes
        this.page = 1;
        this.triggerPaginate();
    }

    onPageSelectChange(): void {
        this.triggerPaginate();
    }

    goToFirstPage(): void {
        if (!this.canGoBack) return;
        this.page = 1;
        this.triggerPaginate();
    }

    goToPreviousPage(): void {
        if (!this.canGoBack) return;
        this.page--;
        this.triggerPaginate();
    }

    goToNextPage(): void {
        if (!this.canGoForward) return;
        this.page++;
        this.triggerPaginate();
    }

    goToLastPage(): void {
        if (!this.canGoForward) return;
        this.page = this.totalPages;
        this.triggerPaginate();
    }

    private triggerPaginate(): void {
        if (this.onPaginate && typeof this.onPaginate === 'function') {
            this.onPaginate({
                page: this.page,
                limit: this.effectiveLimit,
                pageSize: this.effectiveLimit
            });
        }
    }
}

const TablePaginationComponent: angular.IComponentOptions = {
    template: require("./table-pagination.template.html"),
    bindings: {
        page: '=',
        limit: '=?',
        pageSize: '=?',  // Alias for limit - use either one
        total: '<',
        limitOptions: '<?',
        onPaginate: '&',
        showPageSelect: '<?'
    },
    controller: TablePaginationController,
    controllerAs: 'ctrl'
};

export default TablePaginationComponent;
