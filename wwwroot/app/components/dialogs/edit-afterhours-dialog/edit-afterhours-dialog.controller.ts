import BaseController from "../../base-controller";
import dayjs from "dayjs";

class EditAfterhoursDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$log',
        'afterHourScheduleItem'
    ];

    editableSchedule: IAfterHoursCourierSchedule;
    daysOfWeek: string[] = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    isFormValid: boolean = true;
    validationErrors: { [key: string]: string } = {};

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        public afterHourScheduleItem: IAfterHoursCourierSchedule) {
        super();
        this.$log.debug('EditAfterhoursDialogController: Controller instantiated');

        // Create a copy for editing to avoid modifying the original
        this.editableSchedule = {
            ...afterHourScheduleItem,
            startTime: afterHourScheduleItem.startTime ? dayjs(afterHourScheduleItem.startTime).toDate() : undefined,
            endTime: afterHourScheduleItem.endTime ? dayjs(afterHourScheduleItem.endTime).toDate() : undefined
        };
    }

    $onInit() {
        this.$log.debug('EditAfterhoursDialogController: Initialized with schedule:', this.editableSchedule);
        this.validateForm();

        // Focus on day field after dialog opens
        this.registerTimeout(() => {
            const dayField = angular.element('#daySelect');
            if (dayField.length) {
                dayField.focus();
            }
        }, 300);
    }

    validateForm(): boolean {
        this.isFormValid = true;
        this.validationErrors = {};

        // Validate day selection
        if (!this.editableSchedule.day) {
            this.isFormValid = false;
            this.validationErrors.day = 'Please select a day';
        }

        // Validate start time
        if (!this.editableSchedule.startTime) {
            this.isFormValid = false;
            this.validationErrors.startTime = 'Please select a start time';
        }

        // Validate end time
        if (!this.editableSchedule.endTime) {
            this.isFormValid = false;
            this.validationErrors.endTime = 'Please select an end time';
        }

        // Validate time logic
        if (this.editableSchedule.startTime && this.editableSchedule.endTime) {
            if (this.editableSchedule.startTime >= this.editableSchedule.endTime) {
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
        if (this.editableSchedule.startTime && this.editableSchedule.endTime) {
            const diff = this.editableSchedule.endTime.getTime() - this.editableSchedule.startTime.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            this.editableSchedule.duration = hours > 0 || minutes > 0 ?
                `${hours}h ${minutes.toString().padStart(2, '0')}m` : '0h 00m';
        } else {
            this.editableSchedule.duration = '';
        }
    }

    save(): void {
        if (this.validateForm()) {
            this.$log.debug('EditAfterhoursDialogController: Saving schedule:', this.editableSchedule);
            this.$mdDialog.hide(this.editableSchedule);
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