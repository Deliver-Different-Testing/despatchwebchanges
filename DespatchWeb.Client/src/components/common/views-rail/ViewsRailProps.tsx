import type {DfrntPageViewModel} from "../../../types/interfaces/dfrnt-page-view-model.interface";

export interface ViewsRailProps {
    views: DfrntPageViewModel[];
    selectedIds: number[];
    loading?: boolean;
    onToggle: (viewId: number) => void;
    onClearAll: () => void;
}
