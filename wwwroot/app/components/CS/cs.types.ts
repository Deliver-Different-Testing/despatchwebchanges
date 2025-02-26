
export type Box = {
    name: string;
    height: string;
};

export type Column = {
    id: string;
    width: string;
    boxes: Box[];
};

export type Layout = {
    name: string;
    layout: {
        columns: Column[];
    };
};
