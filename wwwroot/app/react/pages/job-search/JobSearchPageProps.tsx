import type {ShowToastFn} from "../../services/toastTypes";

import {JobSearchLayoutBridge} from "./JobSearchLayoutBridge";

export interface JobSearchPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    timeZone: string;
    timeZoneShort?: string;
    deepLinkJobId?: number;
    /** Called once with imperative handles for the AppShell toolbar to drive layout selection. */
    /** Leave "Edit Layout" mode; routes back through the toolbar so its menu stays in sync. */
    onExitColumnEditMode?: () => void;
    onLayoutBridgeReady?: (bridge: JobSearchLayoutBridge) => void;
    /** Leave edit mode (in-shell "Done editing" button). Routes back through the toolbar. */
}