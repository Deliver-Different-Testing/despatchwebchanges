import type {DfrntPageViewModel} from "../../../../interfaces/dfrnt-page-view-model.interface";

export interface ViewsRailProps {
    views: DfrntPageViewModel[];
    selectedIds: number[];
    /**
     * Drives the empty-selection copy: with no view selected the server returns
     * every job on US tenants but nothing at all on NZ tenants
     * (`Repositories/BaseJobRepository.cs`).
     */
    isUsCustomer: boolean;
    loading?: boolean;
    onToggle: (viewId: number) => void;
    onClearAll: () => void;
}
