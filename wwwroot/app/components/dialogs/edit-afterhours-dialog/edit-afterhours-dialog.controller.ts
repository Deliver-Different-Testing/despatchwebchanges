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

dayjs.extend(duration);
dayjs.extend(isSameOrAfter);

class EditAfterhoursDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$timeout',
        '$interval',
        'DispatchData',
        'toastrService',
        'afterHourScheduleItem',
    ];

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

    editableAfterHoursSchedule: IAfterHoursCourierSchedule;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        afterHourScheduleItem: IAfterHoursCourierSchedule
    ) {
        super();
        this.initServices($timeout, $interval);
        console.log('EditAfterhoursDialogController: Controller instantiated');

        if (afterHourScheduleItem.afterHoursScheduleId === 0) {
            this.isNewSchedule = true;
        }

        this.DispatchData.getTimeZoneOptions().then(options => {
            this.timeZoneOptions = options;

            if (!this.editableAfterHoursSchedule.timezone) {
                this.selectedTimeZone = options.find(t => t.timeZoneIana == TimeZone);
            } else {
                this.selectedTimeZone = options.find(t => t.timeZoneIana == this.editableAfterHoursSchedule.timezone);
            }
        });

        this.editableAfterHoursSchedule = angular.copy(afterHourScheduleItem);
        this.validateForm();
    }

    async courierSearch(searchText: string): Promise<ISuggestion[]> {
        try {
            return await this.DispatchData.autocompleteSearch(searchText, "/courier/AllActiveSearch");
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

        return this.isFormValid;
    }

    updateStartTime(startTime: Dayjs): void {
        this.editableAfterHoursSchedule.startTime = startTime;

        this.validateForm();
        this.updateDuration();
    }

    updateEndTime(endTime: Dayjs): void {
        this.editableAfterHoursSchedule.endTime = endTime;

        this.validateForm();
        this.updateDuration();
    }

    private updateDuration(): void {
        if (this.editableAfterHoursSchedule.startTime && this.editableAfterHoursSchedule.endTime) {
            const diff = this.editableAfterHoursSchedule.endTime.diff(this.editableAfterHoursSchedule.startTime);

            const duration = dayjs.duration(diff);
            const hours = Math.floor(duration.asHours());
            const minutes = duration.minutes();

            this.editableAfterHoursSchedule.duration = hours > 0 || minutes > 0 ?
                `${hours}h ${minutes.toString().padStart(2, '0')}m` : '0h 00m';
        } else {
            this.editableAfterHoursSchedule.duration = '';
        }
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