export interface IBox {
    name?: string;
    height?: string;
    title?: string;
    icon?: string;
    templateUrl?: string;
    showSearch?: number;
    showRefresh?: number;
    showDetailButtons?: number;
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
