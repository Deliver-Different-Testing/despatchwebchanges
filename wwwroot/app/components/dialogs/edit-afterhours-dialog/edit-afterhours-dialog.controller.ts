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

        // Validate day selection
        if (!this.editableAfterHoursSchedule.day) {
            this.isFormValid = false;
            this.validationErrors.day = 'Please select a day';
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

    updateDay() {
        console.debug('EditAfterhoursDialogController: Day updated:', this.editableAfterHoursSchedule.day);
        this.validateForm();
        this.updateDuration();
        this.applyScope();
    }
    
    updateStartTime(startTime: Dayjs): void {
        this.editableAfterHoursSchedule.startTime = startTime;

        this.validateForm();
        this.updateDuration();
        this.applyScope();
    }

    updateEndTime(endTime: Dayjs): void {
        this.editableAfterHoursSchedule.endTime = endTime;

        this.validateForm();
        this.updateDuration();
        this.applyScope();
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

            // Check if end time is before start time (crosses midnight)
            this.isNextDay = endTime.isBefore(startTime) || endTime.isSame(startTime);

            // If end time is before or equal to start time, assume it's the next day
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

    getEffectiveEndDay(): string {
        if (!this.isNextDay || !this.editableAfterHoursSchedule.day) {
            return '';
        }

        const currentDayIndex = this.daysOfWeek.indexOf(this.editableAfterHoursSchedule.day);
        const nextDayIndex = (currentDayIndex + 1) % this.daysOfWeek.length;
        return this.daysOfWeek[nextDayIndex];
    }

    courierSelected(courier: ISuggestion) {
        if (!courier) return;

        this.editableAfterHoursSchedule.courierId = courier.id;
        this.editableAfterHoursSchedule.courierName = courier.text;

        // Extract courier code if present in format "CODE - Name"
        const parts = courier.text.split(' - ');
        if (parts.length > 0) {
            this.editableAfterHoursSchedule.courierCode = parts[0];
        }

        this.validateForm();
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