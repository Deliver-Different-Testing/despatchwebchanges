import {
    IAfterHoursCourierSchedule
} from "../../driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";
import {AfterHoursCourierSchedule} from "../../../react/interfaces";
import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import dayjs from "dayjs";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactEditAfterhoursDialog?: {
            open: (
                schedule: AfterHoursCourierSchedule | null,
                isUsTenant: boolean,
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                }
            ) => Promise<AfterHoursCourierSchedule | null>;
        };
    }
}

class EditAfterhoursDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
        'APP_CONFIG',
    ];

    private readonly isUsTenant: boolean;

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        appConfig: IAppConfig,
    ) {
        console.log('EditAfterhoursDialogService: Service instantiated');
        this.isUsTenant = appConfig.US_Customer;
    }

    $get() {
        return this;
    }

    /**
     * Load the React edit afterhours dialog module on demand
     */
    private async loadReactEditAfterhoursDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactEditAfterhoursDialog) {
            return;
        }

        try {
            // Load the manifest to get hashed filenames
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the edit afterhours dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.editAfterhoursDialogReact',
                files: [getAssetPath('editAfterhoursDialogReact.js')]
            });
        } catch (error) {
            console.error('[EditAfterhoursDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    /**
     * Convert AngularJS schedule (with Dayjs times) to React schedule (with string times)
     */
    private toReactSchedule(schedule: IAfterHoursCourierSchedule): AfterHoursCourierSchedule {
        return {
            afterHoursScheduleId: schedule.afterHoursScheduleId,
            courierId: schedule.courierId,
            courierName: schedule.courierName,
            courierCode: schedule.courierCode,
            days: schedule.days || [],
            startTime: schedule.startTime ? schedule.startTime.format('HH:mm') : undefined,
            endTime: schedule.endTime ? schedule.endTime.format('HH:mm') : undefined,
            timezone: schedule.timezone,
            duration: schedule.duration,
        };
    }

    /**
     * Convert React schedule (with string times) to AngularJS schedule (with Dayjs times)
     */
    private toAngularSchedule(schedule: AfterHoursCourierSchedule): IAfterHoursCourierSchedule {
        const today = dayjs().startOf('day');

        return {
            afterHoursScheduleId: schedule.afterHoursScheduleId,
            courierId: schedule.courierId,
            courierName: schedule.courierName,
            courierCode: schedule.courierCode,
            days: schedule.days || [],
            startTime: schedule.startTime
                ? today.hour(parseInt(schedule.startTime.split(':')[0]))
                    .minute(parseInt(schedule.startTime.split(':')[1]))
                : undefined,
            endTime: schedule.endTime
                ? today.hour(parseInt(schedule.endTime.split(':')[0]))
                    .minute(parseInt(schedule.endTime.split(':')[1]))
                : undefined,
            timezone: schedule.timezone,
            duration: schedule.duration,
        };
    }

    async openEditAfterhoursDialog(
        _$event: MouseEvent,
        afterHourScheduleItem: IAfterHoursCourierSchedule
    ): Promise<IAfterHoursCourierSchedule | undefined> {
        try {
            console.log('EditAfterhoursDialogService: Opening dialog for schedule:', afterHourScheduleItem);

            // Load the React dialog module on demand
            await this.loadReactEditAfterhoursDialog();

            if (!window.ReactEditAfterhoursDialog) {
                throw new Error('React edit afterhours dialog not loaded');
            }

            // Create toast service wrapper for UI notifications
            const toastService = {
                showToast: (message: string, type: 'success' | 'warning' | 'error') => {
                    switch (type) {
                        case 'success':
                            this.toastrService.showSuccessToast(message);
                            break;
                        case 'warning':
                            this.toastrService.showWarningToast(message);
                            break;
                        case 'error':
                            this.toastrService.showErrorToast(message);
                            break;
                    }
                },
            };

            // Convert the schedule to React format
            const reactSchedule = this.toReactSchedule(afterHourScheduleItem);

            // Open the React dialog
            const result = await window.ReactEditAfterhoursDialog.open(
                reactSchedule,
                this.isUsTenant,
                toastService
            );

            console.log('EditAfterhoursDialogService: Dialog resolved with:', result);

            if (!result) {
                // Dialog was canceled
                return undefined;
            }

            // Convert result back to AngularJS format
            return this.toAngularSchedule(result);
        } catch (error) {
            console.error("An error occurred in afterhours dialog: " + error);
            throw error;
        }
    }
}

export default EditAfterhoursDialogService;
