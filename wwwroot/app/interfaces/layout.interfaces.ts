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
    visible?: boolean;
    collapsed?: boolean;
    description?: string;
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