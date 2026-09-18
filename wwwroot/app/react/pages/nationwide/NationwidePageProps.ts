import type {ShowToastFn} from '../../services/toastService';
import type {DfrntPageViewModel} from '../../../interfaces/dfrnt-page-view-model.interface';
import type {ImportLayoutsResult} from '../../components/common/box-shell/layoutPersistence';

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
    importLegacyLayouts: () => ImportLayoutsResult;
    /** Restore the current layout to the shipped arrangement (toolbar → Layouts → Reset layout). */
    resetCurrentLayout: () => void;
    /**
     * Subscribe the host's Views menu to the page's view list + selection.
     * Fires immediately with the current state and on every change; returns an
     * unsubscribe function.
     */
    registerViewsListener: (listener: (views: DfrntPageViewModel[]) => void) => () => void;
    /** Replace the selected views (the host toolbar's Views menu). */
    setViewSelection: (viewIds: number[]) => void;
    /** Push a new auto-refresh cadence (from the settings dialog) into the page; `false` = off. */
    updateRefreshIntervalMs: (ms: number | false) => void;
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
