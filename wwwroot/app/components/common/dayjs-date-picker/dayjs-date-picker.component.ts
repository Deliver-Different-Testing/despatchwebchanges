import "./dayjs-date-picker.styles.less";
import BaseController from "../../base-controller";
import dayjs, {Dayjs} from "dayjs";

class DayjsDatePickerController extends BaseController {
    dateTime?: Dayjs;
    isDisabled: boolean = false;
    showDate: boolean = true;
    showTime: boolean = true;
    onChange?: (locals: { dateTime: Dayjs }) => void;

    selectedDate?: Date;
    selectedTime?: Date;

    constructor() {
        super();
    }
    
    $onInit() {
        if (!this.dateTime) {
            console.log('No dateTime provided, setting to current time');
            this.dateTime = dayjs();
            console.log('Current time:', this.dateTime);
        }

        this.initializeDateTimeInputs();
    }

    $onChanges(onChanges: angular.IOnChangesObject) {
        if(onChanges['dateTime'] && onChanges['dateTime'].currentValue && onChanges['dateTime'].currentValue !== this.dateTime) {
            console.log('DateTime changed:', onChanges['dateTime'].currentValue);
            this.dateTime = onChanges['dateTime'].currentValue;
            this.initializeDateTimeInputs();
        }
        
        if(onChanges['showDate'] && onChanges['showDate'].currentValue) {
            console.log('showDate changed:', onChanges['showDate'].currentValue);
            this.showDate = onChanges['showDate'].currentValue;
        }
        
        if(onChanges['showTime'] && onChanges['showTime'].currentValue) {
            console.log('ShowTime changed: ', onChanges['showTime'].currentValue);
            this.showTime = onChanges['showTime'].currentValue;
        }
        
        if(onChanges['isDisabled'] && onChanges['isDisabled'].currentValue) {
            console.log('isDisabled changed: ', onChanges['isDisabled'].currentValue);
            this.isDisabled = onChanges['isDisabled'].currentValue;
        }
    }

    private initializeDateTimeInputs(): void {
        if (this.dateTime && this.dateTime.isValid()) {
            // Convert existing dateTime to dayjs object
            this.selectedDate = this.dateTime.toDate();
            this.selectedTime = this.dateTime.toDate();
        } else {
            // Use the current time
            const now = dayjs();
            this.selectedDate = now.toDate();
            this.selectedTime = now.toDate();
        }
    }

    updateDateTime(): void {
        try {
            if (this.showDate && this.showTime) {
                // Both date and time required
                if (this.selectedDate && this.selectedTime) {
                    const dateValue = dayjs(this.selectedDate);
                    const timeValue = dayjs(this.selectedTime);

                    // Combine date and time
                    this.dateTime = dateValue
                        .hour(timeValue.hour())
                        .minute(timeValue.minute())
                        .second(0)
                        .millisecond(0);
                }
            } else if (this.showDate && !this.showTime) {
                // Date only - set to midnight (00:00:00)
                if (this.selectedDate) {
                    this.dateTime = dayjs(this.selectedDate)
                        .startOf('day');
                }
            } else if (this.showTime && !this.showDate) {
                // Time only - use minimum date (1900-01-01) with the selected time
                if (this.selectedTime) {
                    const timeValue = dayjs(this.selectedTime);
                    this.dateTime = dayjs('1900-01-01')
                        .hour(timeValue.hour())
                        .minute(timeValue.minute())
                        .second(0)
                        .millisecond(0);
                }
            }

            if (!this.dateTime) {
                console.debug('DateTime not updated');
                return;
            }
            
            if(this.onChange) {
                console.log("Updating datetime object!");
                this.onChange({
                    dateTime: this.dateTime
                });
            }

            console.debug('DateTime updated:', this.dateTime.format());
        } catch (error) {
            console.error('Error updating dateTime:', error);
            this.dateTime = undefined;
        }
    }
}

const DayJsDatePickerComponent: angular.IComponentOptions = {
    template: require('./dayjs-date-picker.template.html'),
    controller: DayjsDatePickerController,
    controllerAs: 'ctrl',
    bindings: {
        dateTime: '=',
        showDate: '<',
        showTime: '<',
        isDisabled: '<',
        onChange: '&',
    }
}

export default DayJsDatePickerComponent;