export interface DispatchLayoutDto {
    name: string;
    /** Opaque per-layout payload: the layout's columns/boxes + box visibility. */
    layoutJson: string;
    /** True for the layout that was last active on this page. */
    isActive: boolean;
}