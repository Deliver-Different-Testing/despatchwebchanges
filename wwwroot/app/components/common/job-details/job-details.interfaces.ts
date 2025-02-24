export interface JobOptions {
    detail: {
        size: Array<{ id: number; label: string }>;
        tracking: Array<{ id: number; label: string }>;
        DGClass: Array<{ id: number; label: string }>;
    }
}

export interface JobNote {
    icon: string;
    text: string;
    type?: string;
}

export interface TabItem {
    id: number;
    text: string;
    isMainJob: boolean;
}
