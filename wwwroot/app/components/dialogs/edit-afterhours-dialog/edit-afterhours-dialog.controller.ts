import "./edit-afterhours-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs, {Dayjs} from "dayjs";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {ISuggestion, ITimeZoneSuggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import duration from "dayjs/plugin/duration";
import {IAfterHoursCourierSchedule} from "../../driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {TimeZone} from "../../../contants";
import {getIanaTimezone} from "../../../functions/formatDates";
import {IAppConfig} from "../../../interfaces/app-config.interface";

dayjs.extend(duration);
dayjs.extend(isSameOrAfter);

class EditAfterhoursDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$scope',
        '$timeout',
        '$interval',
        'APP_CONFIG',
        'DispatchData',
        'toastrService',
        'afterHourScheduleItem',
    ];

    private static CourierSearchURL: string = '/courier/AllActiveSearch';

    isNewSchedule: boolean = false;
    daysOfWeek: string[] = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];

    isFormValid: boolean = true;
    validationErrors: { [key: string]: string } = {};
    selectedCourier?: ISuggestion;
    courierSearchText?: string;
    timeZoneOptions?: ITimeZoneSuggestion[];
    selectedTimeZone?: ITimeZoneSuggestion;
    isNextDay: boolean = false;
    isUsTenant: boolean;

    editableAfterHoursSchedule: IAfterHoursCourierSchedule;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: IAppConfig,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        afterHourScheduleItem: IAfterHoursCourierSchedule
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        console.log('EditAfterhoursDialogController: Controller instantiated');

        this.isUsTenant = appConfig.US_Customer;

        if (afterHourScheduleItem.afterHoursScheduleId === 0) {
            this.isNewSchedule = true;
        }

        this.DispatchData.getTimeZoneOptions().then(options => {
            this.timeZoneOptions = options;

            if (!this.editableAfterHoursSchedule.timezone) {
                const tenantTimeZone = getIanaTimezone(TimeZone);
                this.selectedTimeZone = options.find(t => t.timeZoneIana == tenantTimeZone);
            } else {
                this.selectedTimeZone = options.find(t => t.timeZoneIana == this.editableAfterHoursSchedule.timezone);
            }
        });

        this.editableAfterHoursSchedule = angular.copy(afterHourScheduleItem);

        // Initialize a selected courier for existing schedules
        if (!this.isNewSchedule && this.editableAfterHoursSchedule.courierId) {
            this.selectedCourier = {
                id: this.editableAfterHoursSchedule.courierId,
                text: this.editableAfterHoursSchedule.courierName || '',
            };
            // Set the search text to show the current courier
            this.courierSearchText = this.editableAfterHoursSchedule.courierName;
        }

        this.validateForm();
    }

    async courierSearch(searchText: string): Promise<ISuggestion[]> {
        try {
            return await this.DispatchData.autocompleteSearch(searchText, EditAfterhoursDialogController.CourierSearchURL);
        } catch (error) {
            console.error(error);
            this.toastrService.showErrorToast("An error occurred while searching. Please try again later.");
            return Promise.resolve([]);
        }
    }

    validateForm(): boolean {
        this.isFormValid = true;
        this.validationErrors = {};

        if (!this.editableAfterHoursSchedule.courierId) {
            this.isFormValid = false;
            this.validationErrors.courierSelection = 'Please select a courier';
        }

        // Validate days selection (changed from single day)
        if (!this.editableAfterHoursSchedule.days || this.editableAfterHoursSchedule.days.length === 0) {
            this.isFormValid = false;
            this.validationErrors.days = 'Please select at least one day';
        }

        if (!this.selectedTimeZone) {
            this.isFormValid = false;
            this.validationErrors.timeZone = 'Please select a time zone';
        }

        // Validate times are set
        if (!this.editableAfterHoursSchedule.startTime) {
            this.isFormValid = false;
            this.validationErrors.startTime = 'Please set a start time';
        }

        if (!this.editableAfterHoursSchedule.endTime) {
            this.isFormValid = false;
            this.validationErrors.endTime = 'Please set an end time';
        }

        // Check if times are equal (both times must be set for this check)
        if (this.editableAfterHoursSchedule.startTime &&
            this.editableAfterHoursSchedule.endTime &&
            this.editableAfterHoursSchedule.startTime.format('HH:mm') ===
            this.editableAfterHoursSchedule.endTime.format('HH:mm')) {
            this.isFormValid = false;
            this.validationErrors.timeLogic = 'Start time and end time cannot be the same';
        }

        return this.isFormValid;
    }

    updateDays() {
        console.debug('EditAfterhoursDialogController: Days updated:', this.editableAfterHoursSchedule.days);
        this.validateForm();
        this.updateDuration();
        this.applyScope();
    }

    getSelectedDaysText(): string {
        if (!this.editableAfterHoursSchedule.days || this.editableAfterHoursSchedule.days.length === 0) {
            return '';
        }

        if (this.editableAfterHoursSchedule.days.length === 7) {
            return 'Every day';
        }

        if (this.editableAfterHoursSchedule.days.length === 1) {
            return '1 day selected';
        }

        return `${this.editableAfterHoursSchedule.days.length} days selected`;
    }

    getEffectiveEndDay(): string {
        if (!this.isNextDay || !this.editableAfterHoursSchedule.days || this.editableAfterHoursSchedule.days.length === 0) {
            return '';
        }

        if (this.editableAfterHoursSchedule.days.length > 1) {
            return 'the next day';
        }

        const currentDay = this.editableAfterHoursSchedule.days[0];
        const currentDayIndex = this.daysOfWeek.indexOf(currentDay);
        const nextDayIndex = (currentDayIndex + 1) % this.daysOfWeek.length;
        return this.daysOfWeek[nextDayIndex];
    }

    private updateDuration(): void {
        if (this.editableAfterHoursSchedule.startTime && this.editableAfterHoursSchedule.endTime) {
            // Normalize both times to today's date for comparison
            const today = dayjs().startOf('day');
            const startTime = today.hour(this.editableAfterHoursSchedule.startTime.hour())
                .minute(this.editableAfterHoursSchedule.startTime.minute())
                .second(0)
                .millisecond(0);

            let endTime = today.hour(this.editableAfterHoursSchedule.endTime.hour())
                .minute(this.editableAfterHoursSchedule.endTime.minute())
                .second(0)
                .millisecond(0);

            this.isNextDay = endTime.isBefore(startTime) || endTime.isSame(startTime);

            if (this.isNextDay) {
                endTime = endTime.add(1, 'day');
            }

            const diff = endTime.diff(startTime);

            const duration = dayjs.duration(diff);
            const hours = Math.floor(duration.asHours());
            const minutes = duration.minutes();

            this.editableAfterHoursSchedule.duration = hours > 0 || minutes > 0 ?
                `${hours}h ${minutes.toString().padStart(2, '0')}m` : '0h 00m';
        } else {
            this.editableAfterHoursSchedule.duration = '';
            this.isNextDay = false;
        }
    }

    courierSelected(courier: ISuggestion) {
        if (!courier) {
            // Handle clearing the selection
            this.editableAfterHoursSchedule.courierId = 0;
            this.editableAfterHoursSchedule.courierName = '';
            this.editableAfterHoursSchedule.courierCode = '';
            this.validateForm();
            return;
        }

        this.editableAfterHoursSchedule.courierId = courier.id;
        this.editableAfterHoursSchedule.courierName = courier.text;

        // Extract courier code if present (format is typically "Code (Name)" or just "Code")
        const parts = courier.text.split('(');
        if (parts.length > 1) {
            // Format: "Code (Name)"
            this.editableAfterHoursSchedule.courierCode = parts[0].trim();
        } else {
            // Use the full text as the code if no parentheses
            this.editableAfterHoursSchedule.courierCode = courier.text;
        }

        console.log('EditAfterhoursDialogController: Courier selected:', {
            id: courier.id,
            name: this.editableAfterHoursSchedule.courierName,
            code: this.editableAfterHoursSchedule.courierCode
        });

        this.validateForm();
    }

    updateStartTime(dateTime: Dayjs) {
        this.editableAfterHoursSchedule.startTime = dateTime;
        this.validateForm();
        this.updateDuration();
        this.applyScope();
    }

    updateEndTime(dateTime: Dayjs) {
        this.editableAfterHoursSchedule.endTime = dateTime;
        this.validateForm();
        this.updateDuration();
        this.applyScope();
    }

    save(): void {
        if (this.validateForm()) {
            console.log('EditAfterhoursDialogController: Saving schedule:', this.editableAfterHoursSchedule);
            this.editableAfterHoursSchedule.timezone = this.selectedTimeZone?.timeZoneIana;
            this.$mdDialog.hide(this.editableAfterHoursSchedule);
        } else {
            console.warn('EditAfterhoursDialogController: Form validation failed');
        }
    }

    cancel(): void {
        console.log('EditAfterhoursDialogController: Dialog cancelled');
        this.$mdDialog.cancel();
    }
}

export default EditAfterhoursDialogController;