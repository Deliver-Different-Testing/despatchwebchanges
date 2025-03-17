export interface IBox {
    name: string;
    height: string;
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
