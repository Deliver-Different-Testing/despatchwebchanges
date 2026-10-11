import type {IBox} from '../../interfaces/layout.interfaces';
import type {CourierDisplayMode} from '../interfaces/courierDisplayMode';
import type {EditAddressDialogViewModel} from '../interfaces';
import type {AddressType} from '../../enums/address-type.enum';
import {toastService, type ToastService} from '../services/toastService';

export interface DashboardSettingsInterval {
    id: number;
    text: string;
}

export interface DashboardSettingsDialogConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    showTaskRefresh?: boolean;
    showCourierDisplayMode?: boolean;
}

export interface DashboardSettingsDialogResult {
    selectedRefreshInterval?: DashboardSettingsInterval;
    selectedDriverLocationRefreshInterval?: DashboardSettingsInterval;
    selectedTaskRefreshInterval?: DashboardSettingsInterval;
    courierDisplayMode?: CourierDisplayMode;
}

export interface DialogRegistry {
    ReactEditAddressDialog: {
        open: (
            addressDetails: EditAddressDialogViewModel | null,
            title?: string,
            submitLabel?: string,
            showContactInfo?: boolean,
            isUsTenant?: boolean,
            toastService?: ToastService,
            addressType?: AddressType,
            readOnly?: boolean,
        ) => Promise<EditAddressDialogViewModel | null>;
    };
    ReactMessagingDialog: {open: (opts?: unknown) => Promise<void>};
    ReactDashboardSettingsDialog: {
        open: (
            config: DashboardSettingsDialogConfig,
            selectedRefreshInterval?: DashboardSettingsInterval,
            selectedDriverLocationRefreshInterval?: DashboardSettingsInterval,
            selectedTaskRefreshInterval?: DashboardSettingsInterval,
            selectedCourierDisplayMode?: CourierDisplayMode,
        ) => Promise<DashboardSettingsDialogResult | null>;
    };
    ReactCustomizePanelsDialog: {
        open: (
            boxes: Record<string, IBox>,
            title?: string,
            layoutEditable?: boolean,
        ) => Promise<Record<string, IBox> | null>;
    };
}

export type DialogName = keyof DialogRegistry;

export type DialogOpener = <N extends DialogName>(name: N) => DialogRegistry[N] | undefined;

const DIALOG_LABELS: Record<DialogName, string> = {
    ReactEditAddressDialog: 'Edit address',
    ReactMessagingDialog: 'Messaging',
    ReactDashboardSettingsDialog: 'Settings',
    ReactCustomizePanelsDialog: 'Customize panels',
};

/**
 * Thin seam over the window globals the lazily-loaded dialog bundles assign.
 * Hooks take a {@link DialogOpener} so this is the only place to change when
 * the dialogs become plain imports.
 */
export const getDialog: DialogOpener = name =>
    (window as unknown as Partial<DialogRegistry>)[name];

/** Resolve a dialog, toasting "<Label> dialog is not loaded." when its bundle is absent. */
export function requireDialog<N extends DialogName>(
    open: DialogOpener,
    name: N,
): DialogRegistry[N] | undefined {
    const dialog = open(name);
    if (!dialog) toastService.showErrorToast(`${DIALOG_LABELS[name]} dialog is not loaded.`);
    return dialog;
}
