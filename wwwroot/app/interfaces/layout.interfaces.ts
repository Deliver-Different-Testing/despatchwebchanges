export interface IBox {
    name?: string;
    height?: string;
    title?: string;
    icon?: string;
    templateUrl?: string;
    showSearch?: boolean;
    showRefresh?: boolean;
    showDetailButtons?: boolean;
    showFilter?: boolean;
    visible: boolean;
    description: string;
}

export interface IColumn {
    id: string;
    width: string;
    boxes: IBox[];
}

export interface ILayout {
    name: string;
    layout: {
        columns: IColumn[];
    };
}

export interface IGridsterLayout {
    name: string;
    items: GridsterItemWithName[];
}

export interface GridsterItemWithName extends angular.gridster.StandardGridsterItem {
    name: string;
    visible: boolean;
}