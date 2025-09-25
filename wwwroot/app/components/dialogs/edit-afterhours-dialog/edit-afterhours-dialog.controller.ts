import BaseController from "../../base-controller";
import dayjs from "dayjs";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {ActiveCourierViewModel} from "../../../interfaces/courier.interface";
import {ISuggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";

class EditAfterhoursDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$timeout',
        '$interval',
        'DispatchData',
        '$log',
        'toastrService',
        'afterHourScheduleItem',
    ];

    isNewSchedule: boolean = false;
    daysOfWeek: string[] = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    isFormValid: boolean = true;
    validationErrors: { [key: string]: string } = {};
    selectedCourier?: ActiveCourierViewModel;
    courierSearchText?: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private DispatchData: DispatchCoreService,
        private $log: angular.ILogService,
        private toastrService: ToastrService,
        public afterHourScheduleItem: IAfterHoursCourierSchedule
    ) {
        super();
        this.initServices($timeout, $interval);
        this.$log.debug('EditAfterhoursDialogController: Controller instantiated');

        if (afterHourScheduleItem.afterHoursScheduleId === 0) {
            this.isNewSchedule = true;
        }
    }

    $onInit() {
        this.$log.debug('EditAfterhoursDialogController: Initialized with schedule:', this.afterHourScheduleItem);

        // Focus on day field after dialog opens
        this.registerTimeout(() => {
            const dayField = angular.element('#daySelect');
            if (dayField.length) {
                dayField.focus();
            }
        }, 300);
    }

    courierSearch(searchText: string): Promise<ISuggestion[]> {
        try {
            return this.DispatchData.autocompleteSearch(searchText, "/courier/AllActiveSearch");
        } catch (error: any) {
            this.$log.error(`Search failed: ${error.message}`);
            this.toastrService.showErrorToast("An error occurred while searching. Please try again later.");
            return Promise.resolve([]);
        }
    }

    validateForm(): boolean {
        this.isFormValid = true;
        this.validationErrors = {};

        // Validate courier assignment
        if (!this.afterHourScheduleItem.courierId) {
            this.isFormValid = false;
            this.validationErrors.courierSelection = 'Please select a courier';
        }

        // Validate day selection
        if (!this.afterHourScheduleItem.day) {
            this.isFormValid = false;
            this.validationErrors.day = 'Please select a day';
        }

        // Validate start time
        if (!this.afterHourScheduleItem.startTime) {
            this.isFormValid = false;
            this.validationErrors.startTime = 'Please select a start time';
        }

        // Validate end time
        if (!this.afterHourScheduleItem.endTime) {
            this.isFormValid = false;
            this.validationErrors.endTime = 'Please select an end time';
        }

        // Validate time logic
        if (this.afterHourScheduleItem.startTime && this.afterHourScheduleItem.endTime) {
            if (this.afterHourScheduleItem.startTime >= this.afterHourScheduleItem.endTime) {
                this.isFormValid = false;
                this.validationErrors.timeLogic = 'End time must be after start time';
            }
        }

        return this.isFormValid;
    }

    onDayChange(): void {
        this.validateForm();
    }

    onTimeChange(): void {
        this.validateForm();
        this.updateDuration();
    }

    updateDuration(): void {
        if (this.afterHourScheduleItem.startTime && this.afterHourScheduleItem.endTime) {
            const start = dayjs(this.afterHourScheduleItem.startTime);
            const end = dayjs(this.afterHourScheduleItem.endTime);
            const diff = end.diff(start);

            const duration = dayjs.duration(diff);
            const hours = Math.floor(duration.asHours());
            const minutes = duration.minutes();

            this.afterHourScheduleItem.duration = hours > 0 || minutes > 0 ?
                `${hours}h ${minutes.toString().padStart(2, '0')}m` : '0h 00m';
        } else {
            this.afterHourScheduleItem.duration = '';
        }
    }

    save(): void {
        // If courier assigned
        if (this.selectedCourier?.courierId) {
            this.afterHourScheduleItem.courierId = this.selectedCourier?.courierId;
        }

        if (this.validateForm()) {
            this.$log.debug('EditAfterhoursDialogController: Saving schedule:', this.afterHourScheduleItem);
            this.$mdDialog.hide(this.afterHourScheduleItem);
        } else {
            this.$log.warn('EditAfterhoursDialogController: Form validation failed');
        }
    }

    cancel(): void {
        this.$log.debug('EditAfterhoursDialogController: Dialog cancelled');
        this.$mdDialog.cancel();
    }
}

export default EditAfterhoursDialogController;