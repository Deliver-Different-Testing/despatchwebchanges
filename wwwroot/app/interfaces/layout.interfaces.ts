export interface Box {
    name: string;
    height: string;
}

export interface Column {
    id: string;
    width: string;
    boxes: Box[];
}

export interface Layout {
    name: string;
    layout: {
        columns: Column[];
    };
}
