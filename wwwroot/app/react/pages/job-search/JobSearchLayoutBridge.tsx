import type {ImportLayoutsResult} from "../../components/common/box-shell/layoutPersistence";

export interface JobSearchLayoutBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Opens the MUI "Save Layout" dialog and resolves with the entered name (or null if cancelled). */
    promptSaveLayout: () => Promise<string | null>;
    /** Opens the MUI "Delete Layout" confirmation and resolves true if confirmed. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    /** Opens the MUI "Rename Layout" dialog and resolves with the new name (or null if cancelled). */
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
    /** Set layout edit mode (driven by the toolbar's Layouts → Edit layout toggle). */
    resetCurrentLayout: () => void;
    setColumnEditMode: (enabled: boolean) => void;
    /** Opens the Inter-Courier Charge dialog, wired to this page's toast. */
    openInterCourierCharge: () => Promise<void>;
    /** Open a job that was just created, in the detail panel. */
    jobCreated: (jobId: number) => void;
    /** Copy the user's V1 layouts into this page's (V2) layout store. */
    importLegacyLayouts: () => ImportLayoutsResult;
}