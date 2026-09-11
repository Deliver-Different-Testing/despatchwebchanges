/**
 * Global Window type augmentations
 *
 * Centralizes type declarations for all window globals used across the app.
 * Eliminates the need for (window as any) casts throughout the codebase.
 */

import type * as React from 'react';
import type * as ReactDOM from 'react-dom';
import type * as ReactDOMClient from 'react-dom/client';
import type {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type angular from 'angular';

// Page module mount configs
import type {MountRecurringJobsConfig, MountDriverManagementConfig, MountJobListConfig, DispatchJob, JobListSearchParams} from '../app/react/interfaces';
import type {MountJobDetailsConfig} from '../app/react/components/common/job-details/JobDetails.types';
import type {MountOverviewConfig} from '../app/react/pages/overview/OverviewPage.interfaces';
import type {MountTaskDashboardConfig} from '../app/react/pages/task-dashboard/TaskDashboardPage.interfaces';
import type {MountErrorPageConfig} from '../app/react/pages/error-page/error-page-react.module';
import type {MountCourierMapConfig} from '../app/react/pages/courier-map/courier-map-react.module';

// Shared service types
import type {ToastService} from '../app/react/services/toastService';

// Dialog option/result types from dedicated types.ts files
import type {FlightViewModel, AgentSuggestion, FlightAgentDialogResult} from '../app/react/components/dialogs/flight-agent-confirmation-dialog/types';
import type {
    OpenDispatchDialogOptions,
    DispatchDialogOutcome,
} from '../app/react/components/dialogs/dispatch-dialog/dispatch-dialog-react.module';
import type {EditDateTimeDialogOptions, EditDateTimeDialogResult} from '../app/react/components/dialogs/edit-date-time-dialog/types';
import type {OpenBulkPriceUploadDialogOptions} from '../app/react/components/dialogs/bulk-price-upload-dialog/types';
import type {OpenAccessorialChargesDialogOptions} from '../app/react/components/dialogs/accessorial-charges-dialog/types';
import type {EditParcelDimensionsDialogOptions, EditParcelDimensionsDialogResult} from '../app/react/components/dialogs/edit-parcel-dimensions-dialog/types';
import type {OpenMessagingDialogOptions} from '../app/react/components/dialogs/messaging-dialog/types';
import type {SelectDialogOptions, SelectDialogResult} from '../app/react/components/dialogs/select-dialog/types';
import type {SimplePriceEditDialogOptions, PriceEditResult} from '../app/react/components/dialogs/simple-price-edit-dialog/types';

// Dialog types from component/interface files
import type {VoidJobDialogJob, VoidJobResult} from '../app/react/interfaces/job';
import type {EditAddressDialogViewModel} from '../app/react/interfaces/address';
import type {AfterHoursCourierSchedule} from '../app/react/interfaces/afterhours';
import type {DriverEmail, GroupEmailData} from '../app/react/interfaces/driverManagement';
import type {JobNote} from '../app/react/interfaces/notes';
import type {SendPodJobData} from '../app/react/components/dialogs/send-pod-dialog/SendPodDialog';
import type {PodPhoto} from '../app/react/components/common/pod-photo-viewer/pod-photo-viewer.types';
import type {Suggestion} from '../app/react/components/dialogs/auto-complete-dialog/AutoCompleteDialog';
import type {DashboardSettingsConfig, DashboardBox, RefreshOption, DashboardSettingsResult} from '../app/react/components/dialogs/dashboard-settings-dialog/DashboardSettingsDialog';
import type {DateRange} from '../app/react/components/dialogs/date-range-dialog/DateRangeDialog';
import type {PriceBreakdown} from '../app/react/components/dialogs/price-breakdown-dialog/PriceBreakdownDialog';
import type {IFlightViewModel} from '../app/components/Nationwide/nationwide.interfaces';

// App shell types
import type {ToolbarActionsConfig} from '../app/react/components/common/app-shell/app-shell-react.module';

// Shared enums
import type {AddressType} from '../app/enums/address-type.enum';


/** Typed interface for a React page module with specific config */
interface ReactPageModule<TConfig> {
    mount(containerId: string, config: TConfig): void;
    unmount(): void;
    refresh?(): void | Promise<void>;
}

declare global {
    interface Window {
        // ── Server-injected user/tenant globals ──────────────────────────
        FirstName?: string;
        FullName?: string;
        ContactID?: number;
        ClientInternal?: boolean;
        IsNetworkPartner?: boolean;
        /**
         * Dashboard feature keys DF Admin has exposed to this session, or null
         * when the session is not gated at all. See IFeatureVisibilityService.
         */
        VisibleFeatures?: string[] | null;
        TimeZone?: string;
        CurrencyCode?: string;
        serverConfig?: {
            isProduction: boolean;
            isUSCustomer: boolean;
            /** The signed-in network partner's geocoded address, when there is one. */
            npMapCenter?: {lat: number; lng: number} | null;
        };

        // ── React library globals (set by vendor-react bundle) ──────────
        React?: typeof React;
        ReactDOM?: typeof ReactDOM & typeof ReactDOMClient;
        ReactJsxRuntime?: typeof import('react/jsx-runtime');

        // ── React Query globals (set by vendor-react bundle) ─────────────
        QueryClient?: typeof QueryClient;
        QueryClientProvider?: typeof QueryClientProvider;
        keepPreviousData?: typeof import('@tanstack/react-query').keepPreviousData;
        useQuery?: typeof import('@tanstack/react-query').useQuery;
        useInfiniteQuery?: typeof import('@tanstack/react-query').useInfiniteQuery;
        useMutation?: typeof import('@tanstack/react-query').useMutation;
        useQueryClient?: typeof import('@tanstack/react-query').useQueryClient;
        ReactQueryClient?: QueryClient;

        // ── Mantine globals (set by vendor-react bundle) ─────────────────
        MantineCore?: typeof import('@mantine/core');
        MantineHooks?: typeof import('@mantine/hooks');
        MantineDates?: typeof import('@mantine/dates');
        MantineNotifications?: typeof import('@mantine/notifications');

        // ── Utility library globals (set by vendor-core bundle) ──────────
        dayjs?: typeof import('dayjs').default;
        windowsIana?: typeof import('windows-iana');

        // ── AngularJS app module (set by vendor-plugins bundle) ──────────
        uDispatchApp?: angular.IModule;
        angular?: typeof angular;

        // ── Lazy-loaded React page modules ───────────────────────────────
        ReactAppShell?: {
            mount: (containerId: string, config: {
                title?: string;
                breadcrumbs?: Array<{label: string; href?: string}>;
                firstName: string;
                fullName: string;
                isUsCustomer: boolean;
                currentState: string;
                logoUrl?: string;
                companyName?: string;
                onLogoClick?: () => void;
                onNavigate: (state: string) => void;
            }) => void;
            update: (updates: Record<string, unknown>) => void;
            updateState: (state: string) => void;
            updateTitle: (title: string) => void;
            updateBreadcrumbs: (breadcrumbs: Array<{label: string; href?: string}>) => void;
            setToolbarActions: (actions: ToolbarActionsConfig | null) => void;
            updateToolbarAction: <K extends Exclude<keyof ToolbarActionsConfig, 'customContent'>>(
                actionKey: K,
                updates: Partial<NonNullable<ToolbarActionsConfig[K]>>
            ) => void;
            unmount: () => void;
        };
        ReactRecurringJobs?: ReactPageModule<MountRecurringJobsConfig>;
        ReactOverview?: ReactPageModule<MountOverviewConfig>;
        ReactTaskDashboard?: ReactPageModule<MountTaskDashboardConfig>;
        ReactDriverManagement?: ReactPageModule<MountDriverManagementConfig>;
        ReactCourierMap?: ReactPageModule<MountCourierMapConfig>;
        ReactErrorPage?: ReactPageModule<MountErrorPageConfig>;
        ReactJobDetails?: ReactPageModule<MountJobDetailsConfig>;
        ReactJobList?: {
            mount(containerId: string, config: MountJobListConfig): void;
            unmount(): void;
            updateJobs(jobs: DispatchJob[], totalCount: number): void;
            updateConfig(config: Partial<MountJobListConfig>): void;
            refresh(): void;
            selectJob(jobId: number): void;
            updateSearchParams(params: Partial<JobListSearchParams>): void;
        };
        ReactCurrentWorkJobList?: {
            mount(containerId: string, config: MountJobListConfig): void;
            unmount(): void;
            updateJobs(jobs: DispatchJob[], totalCount: number): void;
            updateConfig(config: Partial<MountJobListConfig>): void;
            refresh(): void;
        };
        ReactNationwideJobList?: {
            mount(instanceId: string, containerId: string, config: MountJobListConfig): void;
            unmount(instanceId: string): void;
            unmountAll(): void;
            updateJobs(instanceId: string, jobs: DispatchJob[], totalCount: number): void;
            updateConfig(instanceId: string, config: Partial<MountJobListConfig>): void;
            refresh(instanceId: string): void;
            selectJob(instanceId: string, jobId: number): void;
            updateSearchParams(instanceId: string, params: Partial<JobListSearchParams>): void;
        };
        ReactJobSearchJobList?: {
            mount(instanceId: string, containerId: string, config: MountJobListConfig): void;
            unmount(instanceId: string): void;
            unmountAll(): void;
            updateJobs(instanceId: string, jobs: DispatchJob[], totalCount: number): void;
            updateConfig(instanceId: string, config: Partial<MountJobListConfig>): void;
            refresh(instanceId: string): void;
            selectJob(instanceId: string, jobId: number): void;
            updateSearchParams(instanceId: string, params: Partial<JobListSearchParams>): void;
        };

        // ── Lazy-loaded React dialog modules ─────────────────────────────
        ReactCreateJobDialog?: {
            open: (
                isUsTenant: boolean,
                toastService?: ToastService
            ) => Promise<number | null>;
        };
        ReactVoidJobConfirmationDialog?: {
            open: (job: VoidJobDialogJob, toastService?: ToastService) => Promise<VoidJobResult | null>;
        };
        /** Universal dispatch dialog (Courier / Agent / NP / DFRNT Partner), opened from AngularJS. */
        ReactDispatchDialog?: {
            open: (options: OpenDispatchDialogOptions) => Promise<DispatchDialogOutcome | null>;
        };
        ReactFlightAgentConfirmationDialog?: {
            openFlightDialog: (options: {
                jobId: number;
                jobNumber: string;
                flight: FlightViewModel;
                existingAwb?: string;
                dgClass?: number;
                toastService?: ToastService;
            }) => Promise<FlightAgentDialogResult>;
            openAgentDialog: (options: {
                jobId: number;
                jobNumber: string;
                agent: AgentSuggestion;
                existingAwb?: string;
                dgClass?: number;
                stopJobCount?: number;
                toastService?: ToastService;
            }) => Promise<FlightAgentDialogResult>;
        };
        ReactEditDateTimeDialog?: {
            showEditTimeDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResult | null>;
            showEditDateDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResult | null>;
            showEditDateAndTimeDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResult | null>;
            setToastService: (service: ToastService) => void;
        };
        ReactBulkPriceUploadDialog?: {
            open: (options: OpenBulkPriceUploadDialogOptions) => Promise<boolean>;
        };
        ReactSendPodDialog?: {
            open: (jobData: SendPodJobData) => Promise<boolean>;
        };
        ReactJobFileUploadDialog?: {
            open: (jobId: number, uploadType?: string) => Promise<void>;
            setToastService: (service: ToastService) => void;
        };
        ReactPodPhotoViewer?: {
            open: (photos: PodPhoto[], initialPhotoIndex?: number, timeZone?: string, onClose?: () => void) => void;
            close: () => void;
        };
        ReactAccessorialChargesDialog?: {
            open: (options: OpenAccessorialChargesDialogOptions) => Promise<boolean>;
        };
        ReactAddEventDialog?: {
            open: (options: {
                job: { id: number; jobNo: string; client: string; clientId?: number };
                toastService?: ToastService;
            }) => Promise<boolean>;
        };
        ReactAgentInfoDialog?: {
            open: (options: { agentId: number }) => Promise<void>;
        };
        ReactRecoveryAgentManagementDialog?: {
            open: (options: { jobId: number }) => Promise<void>;
        };
        ReactAutoCompleteDialog?: {
            open: (
                title: string,
                placeholder: string,
                searchFn: (searchTerm: string) => Promise<Suggestion[]>,
                existingItem?: Suggestion,
                showRerateOption?: boolean,
                itemIcon?: string,
                minInputLength?: number
            ) => Promise<{ item: Suggestion; shouldRerate: boolean; selectedType?: string } | null>;
            /**
             * 3-way Assign picker variant (Steve 2026-05-26,
             * HANDOVER-KEVIN-2026-05-26.md). Renders a Type radio row above
             * the dropdown. Resolves with the picked item plus the selected
             * radio value so the caller routes the write to the right column.
             */
            openWithTypes: (
                title: string,
                typeOptions: Array<{
                    value: string;
                    label: string;
                    placeholder: string;
                    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
                }>,
                options?: {
                    existingItem?: Suggestion;
                    initialTypeValue?: string;
                    showRerateOption?: boolean;
                    minInputLength?: number;
                    itemIcon?: string;
                }
            ) => Promise<{ item: Suggestion; shouldRerate: boolean; selectedType?: string } | null>;
        };
        ReactComposeEmailDialog?: {
            open: (selectedCouriers: DriverEmail[]) => Promise<GroupEmailData | null>;
        };
        ReactDashboardSettingsDialog?: {
            open: (
                config: DashboardSettingsConfig,
                selectedRefreshInterval?: RefreshOption,
                selectedDriverLocationRefreshInterval?: RefreshOption,
                selectedTaskRefreshInterval?: RefreshOption,
                aiEnabled?: boolean,
                jobSearchBetaEnabled?: boolean,
                dispatchBetaEnabled?: boolean,
                nationwideBetaEnabled?: boolean
            ) => Promise<DashboardSettingsResult | null>;
        };
        ReactCustomizePanelsDialog?: {
            open: (
                boxes: Record<string, DashboardBox>,
                title?: string,
                layoutEditable?: boolean
            ) => Promise<Record<string, DashboardBox> | null>;
        };
        ReactDateRangeDialog?: {
            open: (initialRange?: { start?: Date; end?: Date }) => Promise<DateRange | null>;
        };
        ReactEditAddressDialog?: {
            open: (
                addressDetails: EditAddressDialogViewModel | null,
                title?: string,
                submitLabel?: string,
                showContactInfo?: boolean,
                isUsTenant?: boolean,
                toastService?: ToastService,
                addressType?: AddressType,
                readOnly?: boolean
            ) => Promise<EditAddressDialogViewModel | null>;
        };
        ReactEditAfterhoursDialog?: {
            open: (
                schedule: AfterHoursCourierSchedule | null,
                isUsTenant: boolean,
                toastService?: ToastService
            ) => Promise<AfterHoursCourierSchedule | null>;
        };
        ReactEditParcelDimensionsDialog?: {
            showEditParcelDimensionsDialog: (options: EditParcelDimensionsDialogOptions) => Promise<EditParcelDimensionsDialogResult | null>;
            setToastService: (service: ToastService) => void;
        };
        ReactEventGroupDialog?: {
            open: (options: {
                eventGroupId: number;
                jobId: number;
                toastService?: ToastService;
            }) => Promise<boolean>;
        };
        ReactFlightDetailsDialog?: {
            openFlightDetailsDialog: (flightData: IFlightViewModel) => Promise<void>;
        };
        ReactMessagingDialog?: {
            open: (options?: OpenMessagingDialogOptions) => Promise<void>;
        };
        ReactNoteManagementDialog?: {
            open: (note: JobNote | null) => Promise<boolean>;
            close: () => void;
        };
        ReactPriceBreakdownDialog?: {
            open: (
                priceBreakdowns: PriceBreakdown[],
                jobId: number,
                isPrebook: boolean,
                isArchived: boolean,
                isUsCustomer?: boolean,
                readOnly?: boolean,
                apiService?: {
                    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
                    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
                    deletePriceBreakdown: (chargeId: number, jobId: number, isArchived: boolean) => Promise<void>;
                    getSuggestedFuelCharge: (jobId: number, chargeAmount: number, isPrebook: boolean, isArchived: boolean) => Promise<{ fuelChargeAmount: number; fuelCostAmount: number }>;
                }
            ) => Promise<number | null>;
            setToastService: (service: ToastService) => void;
        };
        ReactSelectDialog?: {
            showSelectDialog: (options: SelectDialogOptions) => Promise<SelectDialogResult | null>;
            setToastService: (service: ToastService) => void;
        };
        ReactSimplePriceEditDialog?: {
            open: (options: SimplePriceEditDialogOptions) => Promise<PriceEditResult | null>;
            setToastService: (service: ToastService) => void;
        };
        ReactSwapPodsDialog?: {
            open: (jobNo: string, toastService?: ToastService) => Promise<boolean | null>;
        };
        ReactRestoreConfirmDialog?: {
            open: (request: {jobId: number; done?: boolean}) => Promise<
                {action: 'restore'; removeCapturedImages: boolean} | {action: 'swapPod'} | null
            >;
        };

        // ── Lazy-loaded React utility modules ────────────────────────────
        ReactAiAssistant?: {
            renderSummaryPanel: (container: HTMLElement, jobId: number) => void;
            renderOperationsInsightsPanel: (container: HTMLElement) => void;
            unmountSummaryPanel: (container: HTMLElement) => void;
        };

        // ── Diagnostic utilities ─────────────────────────────────────────
        __diagAiPanel?: () => void;
    }

    // ── Bare globals injected by server-rendered script tags ──────────
    // These are set via <script> in _Layout.cshtml and used without window. prefix
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: boolean;
    const IsNetworkPartner: boolean;
    const VisibleFeatures: string[] | null;
    const TimeZone: string;
    const serverConfig: {
        isProduction: boolean;
        isUSCustomer: boolean;
        npMapCenter?: {lat: number; lng: number} | null;
    };
}

export {};
