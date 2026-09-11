import type {ShowToastFn} from '../../services/toastService';

export interface NationwideLayoutBridge {
    setCurrentLayoutName: (name: string) => void;
    reloadFromStorage: () => void;
    /** Opens the shared Mantine "Save Layout" dialog; resolves the name, or null if cancelled. */
    promptSaveLayout: () => Promise<string | null>;
    /** Opens the shared "Delete Layout" confirmation; resolves true if confirmed. */
    promptDeleteLayout: (layoutName: string) => Promise<boolean>;
    /** Opens the shared "Rename Layout" dialog; resolves the new name, or null if cancelled. */
    promptRenameLayout: (layoutName: string) => Promise<string | null>;
    /** Copy the operator's V1 Nationwide layouts into this page's store. */
    importLegacyLayouts: () => unknown;
}

export interface NationwidePageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    timeZone: string;
    timeZoneShort?: string;
    /**
     * Job to select on mount, from `?jobId`.
     *
     * V1 accepted this but could never honour it: its `$onInit` searched
     * `this.jobList`, an array nothing ever populated, so deep links silently
     * did nothing. Here it resolves against the server.
     */
    deepLinkJobId?: number;
    onLayoutBridgeReady?: (bridge: NationwideLayoutBridge) => void;
}
