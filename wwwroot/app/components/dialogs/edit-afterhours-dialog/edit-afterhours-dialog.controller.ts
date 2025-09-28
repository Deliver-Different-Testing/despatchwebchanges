import "./edit-afterhours-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {ISuggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import duration from "dayjs/plugin/duration";
import {IAfterHoursCourierSchedule} from "../../driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

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
        
        this.editableAfterHoursSchedule = angular.copy(afterHourScheduleItem);
        this.validateForm();
    }

    $onInit() {
        console.log('EditAfterhoursDialogController: Initialized with schedule:', this.editableAfterHoursSchedule);

        // Force close any open select/autocomplete on click
        this.registerTimeout(() => {
            const dialogElement = document.querySelector('.edit-afterhours-dialog');
            if (dialogElement) {
                dialogElement.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    // Close select if clicking outside select elements
                    if (!target.closest('md-select') && !target.closest('md-autocomplete')) {
                        angular.element(document.querySelectorAll('md-select-menu')).remove();
                        angular.element(document.querySelectorAll('.md-autocomplete-suggestions')).remove();
                    }
                });
            }
        }, 100);
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

        // Validate start time
        if (!this.editableAfterHoursSchedule.startTime) {
            this.isFormValid = false;
            this.validationErrors.startTime = 'Please select a start time';
        }

        // Validate end time
        if (!this.editableAfterHoursSchedule.endTime) {
            this.isFormValid = false;
            this.validationErrors.endTime = 'Please select an end time';
        }

        // Validate time logic
        if (this.editableAfterHoursSchedule.startTime && this.editableAfterHoursSchedule.endTime) {
            if (this.editableAfterHoursSchedule.startTime.isSameOrAfter(this.editableAfterHoursSchedule.endTime)) {
                this.isFormValid = false;
                this.validationErrors.timeLogic = 'End time must be after start time';
            }
        }

        return this.isFormValid;
    }

    onDayChange(): void {
        this.validateForm();

        // Force close the select menu
        this.registerTimeout(() => {
            angular.element(document.querySelectorAll('md-select-menu')).remove();
            angular.element(document.querySelectorAll('.md-select-menu-container')).remove();
        }, 100);
    }

    onTimeChange(): void {
        this.validateForm();
        this.updateDuration();
    }

    updateDuration(): void {
        if (this.editableAfterHoursSchedule.startTime && this.editableAfterHoursSchedule.endTime) {
            const start = dayjs(this.editableAfterHoursSchedule.startTime);
            const end = dayjs(this.editableAfterHoursSchedule.endTime);
            const diff = end.diff(start);

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

        // Force Angular Material to close the autocomplete dropdown
        this.registerTimeout(() => {
            // Trigger the blur event on the input to close the dropdown
            const autocompleteInput = document.querySelector('.edit-afterhours-dialog md-autocomplete input') as HTMLInputElement;
            if (autocompleteInput) {
                autocompleteInput.blur();
            }

            // Also remove any lingering dropdown containers
            angular.element(document.querySelectorAll('.md-autocomplete-suggestions-container')).remove();
            angular.element(document.querySelectorAll('.md-scroll-mask')).remove();
            angular.element(document.querySelectorAll('.md-virtual-repeat-container')).remove();
        }, 100);
    }


    get startTime(): Date | undefined {
        return this.editableAfterHoursSchedule.startTime?.toDate();
    }

    set startTime(value: Date | undefined) {
        this.editableAfterHoursSchedule.startTime = value ? dayjs(value) : undefined;
    }

    get endTime(): Date | undefined {
        return this.editableAfterHoursSchedule.endTime?.toDate();
    }

    set endTime(value: Date | undefined) {
        this.editableAfterHoursSchedule.endTime = value ? dayjs(value) : undefined;
    }

    save(): void {
        if (this.validateForm()) {
            console.log('EditAfterhoursDialogController: Saving schedule:', this.editableAfterHoursSchedule);
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