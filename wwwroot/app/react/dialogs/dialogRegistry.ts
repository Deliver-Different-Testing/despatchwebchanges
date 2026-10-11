import {toastService} from '../services/toastService';

/**
 * Typed registry of the dialog modules. Each loader is a dynamic import, so the module is evaluated once
 * and cached by the module system; page bundles currently inline these, a code-splitting build will chunk them.
 */
export const DIALOG_LOADERS = {
    EditDateTime: () => import('../components/dialogs/edit-date-time-dialog/edit-date-time-dialog-react.module').then(m => m.reactEditDateTimeDialog),
    VoidJobConfirmation: () => import('../components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog-react.module').then(m => m.reactVoidJobConfirmationDialog),
    PriceBreakdown: () => import('../components/dialogs/price-breakdown-dialog/price-breakdown-dialog-react.module').then(m => m.reactPriceBreakdownDialog),
    DateRange: () => import('../components/dialogs/date-range-dialog/date-range-dialog-react.module').then(m => m.reactDateRangeDialog),
    SwapPods: () => import('../components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module').then(m => m.reactSwapPodsDialog),
    SplitPricingBreakdown: () => import('../components/dialogs/split-pricing-breakdown-dialog/split-pricing-breakdown-dialog-react.module').then(m => m.reactSplitPricingBreakdownDialog),
    SimplePriceEdit: () => import('../components/dialogs/simple-price-edit-dialog/simple-price-edit-dialog-react.module').then(m => m.reactSimplePriceEditDialog),
    Select: () => import('../components/dialogs/select-dialog/select-dialog-react.module').then(m => m.reactSelectDialog),
    EditParcelDimensions: () => import('../components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog-react.module').then(m => m.reactEditParcelDimensionsDialog),
    SendPod: () => import('../components/dialogs/send-pod-dialog/send-pod-dialog-react.module').then(m => m.reactSendPodDialog),
    JobFileUpload: () => import('../components/dialogs/job-file-upload-dialog/job-file-upload-dialog-react.module').then(m => m.reactJobFileUploadDialog),
    EditAddress: () => import('../components/dialogs/edit-address-dialog/edit-address-dialog-react.module').then(m => m.reactEditAddressDialog),
    AutoComplete: () => import('../components/dialogs/auto-complete-dialog/auto-complete-dialog-react.module').then(m => m.reactAutoCompleteDialog),
    RestoreConfirm: () => import('../components/dialogs/restore-confirmation-dialog/restore-confirmation-dialog-react.module').then(m => m.reactRestoreConfirmDialog),
    RecoveryAgentManagement: () => import('../components/dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog-react.module').then(m => m.reactRecoveryAgentManagementDialog),
    NoteManagement: () => import('../components/dialogs/note-management-dialog/note-management-dialog-react.module').then(m => m.reactNoteManagementDialog),
    Messaging: () => import('../components/dialogs/messaging-dialog/messaging-dialog-react.module').then(m => m.reactMessagingDialog),
    FlightDetails: () => import('../components/dialogs/flight-details-dialog/flight-details-dialog-react.module').then(m => m.reactFlightDetailsDialog),
    FlightAgentConfirmation: () => import('../components/dialogs/flight-agent-confirmation-dialog/flight-agent-confirmation-dialog-react.module').then(m => m.reactFlightAgentConfirmationDialog),
    EventGroup: () => import('../components/dialogs/event-group-dialog/event-group-dialog-react.module').then(m => m.reactEventGroupDialog),
    EditAfterhours: () => import('../components/dialogs/edit-afterhours-dialog/edit-afterhours-dialog-react.module').then(m => m.reactEditAfterhoursDialog),
    Dispatch: () => import('../components/dialogs/dispatch-dialog/dispatch-dialog-react.module').then(m => m.reactDispatchDialog),
    DashboardSettings: () => import('../components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module').then(m => m.reactDashboardSettingsDialog),
    CustomizePanels: () => import('../components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module').then(m => m.reactCustomizePanelsDialog),
    CreateJob: () => import('../components/dialogs/create-job-dialog/create-job-dialog-react.module').then(m => m.reactCreateJobDialog),
    ComposeEmail: () => import('../components/dialogs/compose-email-dialog/compose-email-dialog-react.module').then(m => m.reactComposeEmailDialog),
    BulkPriceUpload: () => import('../components/dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog-react.module').then(m => m.reactBulkPriceUploadDialog),
    AgentInfo: () => import('../components/dialogs/agent-info-dialog/agent-info-dialog-react.module').then(m => m.reactAgentInfoDialog),
    AddEvent: () => import('../components/dialogs/add-event-dialog/add-event-dialog-react.module').then(m => m.reactAddEventDialog),
    AccessorialCharges: () => import('../components/dialogs/accessorial-charges-dialog/accessorial-charges-dialog-react.module').then(m => m.reactAccessorialChargesDialog),
} as const;

export type DialogName = keyof typeof DIALOG_LOADERS;

export type DialogApis = {
    [N in DialogName]: Awaited<ReturnType<(typeof DIALOG_LOADERS)[N]>>;
};

export type DialogLoader = <N extends DialogName>(name: N) => Promise<DialogApis[N]>;

export const DIALOG_LABELS: Record<DialogName, string> = {
    EditDateTime: 'Edit date and time',
    VoidJobConfirmation: 'Void job',
    PriceBreakdown: 'Price breakdown',
    DateRange: 'Date range',
    SwapPods: 'Swap PODs',
    SplitPricingBreakdown: 'Split pricing breakdown',
    SimplePriceEdit: 'Price edit',
    Select: 'Select',
    EditParcelDimensions: 'Parcel dimensions',
    SendPod: 'Send POD',
    JobFileUpload: 'File upload',
    EditAddress: 'Edit address',
    AutoComplete: 'Address search',
    RestoreConfirm: 'Restore',
    RecoveryAgentManagement: 'Recovery agents',
    NoteManagement: 'Notes',
    Messaging: 'Messaging',
    FlightDetails: 'Flight details',
    FlightAgentConfirmation: 'Flight/agent confirmation',
    EventGroup: 'Event group',
    EditAfterhours: 'After hours',
    Dispatch: 'Dispatch',
    DashboardSettings: 'Settings',
    CustomizePanels: 'Customize panels',
    CreateJob: 'Create job',
    ComposeEmail: 'Compose email',
    BulkPriceUpload: 'Bulk price upload',
    AgentInfo: 'Agent info',
    AddEvent: 'Add event',
    AccessorialCharges: 'Accessorial charges',
};

export const loadDialog: DialogLoader = name => DIALOG_LOADERS[name]() as Promise<DialogApis[typeof name]>;

/** Load a dialog, toasting "<Label> dialog is not loaded." and resolving undefined when the import fails. */
export async function requireDialog<N extends DialogName>(
    name: N,
    load: DialogLoader = loadDialog,
): Promise<DialogApis[N] | undefined> {
    try {
        return await load(name);
    } catch (err) {
        console.error(`[dialogRegistry] failed to load ${name}`, err);
        toastService.showErrorToast(`${DIALOG_LABELS[name]} dialog is not loaded.`);
        return undefined;
    }
}
