import "./date-filter-menu.styles.less";
import dayjs, {Dayjs} from "dayjs";
import IDateFilterData from "./IDateFilterData";
import setDateFilterDefaults from "../../../functions/setDateFilterDefaults";
import ToastrService from "../../../services/toastr.service";
import DateRangeOption from "./enums/dateRangeOption";
import {AppPage} from "../../../enums/app-pages.enum";
import {ISuggestion} from "../../../interfaces/job.interface";
import {getMinsSelectionOptions} from "../../../functions/MinsSelectionOptions";

class DateFilterMenuComponent implements angular.IController {
    static $inject = [
        'toastrService',
    ];
    
    private readonly DateRangeOptionKey: string = `dateRangeOption-${ContactID}`;

    appPage?: AppPage;
    onRefreshData?: (locals: { dateFilterData: IDateFilterData }) => void;
    timeZone: string = TimeZone;
    private dateFilterData?: IDateFilterData;
    selectedRangeOption: DateRangeOption = DateRangeOption.AllTime;
    startDate: Dayjs;
    endDate: Dayjs;
    minsOptions: ISuggestion[];
    selectedMinsOption?: ISuggestion;

    constructor(private toasterService: ToastrService) {
        console.log("Component: DateFilterMenuComponent");
        console.log("Browser Time Zone:", this.timeZone);

        this.minsOptions = getMinsSelectionOptions(5 * 60, 5 * 60, 180);
        
        // Set dates
        this.startDate = this.dateFilterData?.startDate || dayjs();
        this.endDate = this.dateFilterData?.endDate || dayjs();
    }

    $onInit() {
        console.log("DateFilterMenuComponent $onInit - dateFilterData:", this.dateFilterData);

        if (!this.dateFilterData) {
            console.warn("DateFilterData is null on init, creating default values");
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes.dateFilterData && changes.dateFilterData.currentValue) {
            console.log("DateFilterData changed:", changes.dateFilterData.currentValue);
            this.dateFilterData = changes.dateFilterData.currentValue;

            if (!this.dateFilterData) return;

            // Update local date references
            this.startDate = this.dateFilterData.startDate;
            this.endDate = this.dateFilterData.endDate;

            // Ensure the end date is at least 24 hours from now
            const minEndDate = dayjs().add(24, 'hour');

            if (this.endDate.isBefore(minEndDate)) {
                this.endDate = minEndDate;
                this.dateFilterData.endDate = minEndDate;
            }

            // Set the initial search range based on the dates
            if (this.isNext24Hours()) {
                this.selectedRangeOption = DateRangeOption.AllTime;
            } else {
                this.loadDateRangeOptionFromStorageOrSetDefault();
            }
        }
    }

    private isNext24Hours(): boolean {
        if (!this.dateFilterData) return true;

        const {startDate, endDate} = this.dateFilterData;
        const defaults = setDateFilterDefaults();

        // Compare only the date parts, ignoring time
        return startDate.isSame(defaults.startDate, 'day') &&
            endDate.isSame(defaults.endDate, 'day');
    }

    private loadDateRangeOptionFromStorageOrSetDefault() {
        try {
            if (Modernizr.localstorage) {
                const savedDateOption = localStorage.getItem(`${this.appPage}-${this.DateRangeOptionKey}`);
                if(savedDateOption) {
                    this.selectedRangeOption = savedDateOption as DateRangeOption;
                } else {
                    // Default to all time
                    this.selectedRangeOption = DateRangeOption.AllTime;
                }
            }
        } catch (error) {
            console.error("Error loading date range option from storage:", error);
            this.selectedRangeOption = DateRangeOption.AllTime;
        }
    }

    async refreshData() {
        if (!this.dateFilterData) return;
        console.log("Triggering refresh callback from DateFilterMenuComponent");

        if (this.onRefreshData) {
            console.log('Calling refresh from DateFilterMenuComponent');
            const dateFilter = this.dateFilterData;
            if (!dateFilter) return;

            this.onRefreshData({
                dateFilterData: dateFilter
            });
        }
    }

    async onSearchRangeChange(optionSelected: DateRangeOption): Promise<void> {
        console.log("Triggering onSearchRangeChange - $onSearchRangeChange");

        if (!this.dateFilterData) return;

        this.selectedRangeOption = optionSelected;
        const defaults = setDateFilterDefaults();

        switch (optionSelected) {
            case DateRangeOption.AllTime:
                // 24 Hours mode - reset to defaults
                this.dateFilterData = defaults;
                this.startDate = defaults.startDate;
                this.endDate = defaults.endDate;
                break;

            case DateRangeOption.Date:
                // Custom mode - set reasonable defaults if dates are not set
                if (!this.dateFilterData.startDate || this.dateFilterData.startDate.valueOf() === 0) {
                    this.startDate = dayjs().subtract(7, 'days');
                    this.dateFilterData.startDate = this.startDate;
                }
                if (!this.dateFilterData.endDate || this.dateFilterData.endDate.valueOf() === 0) {
                    this.endDate = dayjs();
                    this.dateFilterData.endDate = this.endDate;
                }
                break;

            case DateRangeOption.Mins:
                // Set to the current time and selected minutes
                if (this.selectedMinsOption) {
                    this.startDate = defaults.startDate;
                    this.dateFilterData.startDate = defaults.startDate;

                    const seconds = this.selectedMinsOption.id as number;
                    this.endDate = dayjs().add(seconds, 'seconds');
                    this.dateFilterData.endDate = this.endDate;
                } else {
                    // Default to 5 minutes if no option selected
                    this.startDate = defaults.startDate;
                    this.endDate = dayjs().add(5, 'minutes');
                    this.dateFilterData.startDate = defaults.startDate;
                    this.dateFilterData.endDate = this.endDate;

                    // Set default selection
                    this.selectedMinsOption = this.minsOptions.find(opt => opt.id === 5 * 60); // 5 mins
                }
                break;
        }

        // Save the selected date range option to local storage
        if (Modernizr.localstorage) {
            localStorage.setItem(`${this.appPage}-${this.DateRangeOptionKey}`, optionSelected);
        }

        await this.refreshData();
    }

    async clearDateFilter(): Promise<void> {
        if (!this.dateFilterData) return;
        console.log("Clearing date filter");

        const defaults = setDateFilterDefaults();
        this.dateFilterData = defaults;
        this.startDate = defaults.startDate;
        this.endDate = defaults.endDate;
        this.selectedRangeOption = DateRangeOption.AllTime;

        await this.refreshData();
    }

    async onStartDateChange(dateTime: Dayjs): Promise<void> {
        console.log("Start date changed:", dateTime);
        this.startDate = dateTime;
        await this.validateAndRefresh();
    }

    async onEndDateChange(dateTime: Dayjs): Promise<void> {
        console.log("End date changed:", dateTime);
        this.endDate = dateTime;
        await this.validateAndRefresh();
    }

    private async validateAndRefresh(): Promise<void> {
        // Validate that the start date is not after the end date
        const start = this.startDate;
        const end = this.endDate;

        if (start.isAfter(end)) {
            this.toasterService.showWarningToast("Start date cannot be after end date");
            return;
        }

        console.log("Date filter changed:", {start, end});
        this.dateFilterData = {
            startDate: start,
            endDate: end,
        }

        this.toasterService.showSuccessToast(`Dates Applied: ${start.format('MMM DD, YYYY')} - ${end.format('MMM DD, YYYY')}`);
        console.log("Date filter data:", this.dateFilterData);
        await this.refreshData();
    }

    async applyButtonClicked(): Promise<void> {
        console.log("Apply button clicked");
        await this.validateAndRefresh();
    }

    async onMinsOptionChange(option: ISuggestion): Promise<void> {
        console.log("Mins option changed:", option);

        if (!this.dateFilterData || !option) return;

        this.selectedMinsOption = option;

        // Set the start date now
        this.startDate = dayjs();
        this.dateFilterData.startDate = this.startDate;

        // Set the end date to now + selected minutes (id is in seconds)
        const seconds = option.id;
        this.endDate = dayjs().add(seconds, 'seconds');
        this.dateFilterData.endDate = this.endDate;

        await this.refreshData();
    }
}

const DateFilterComponent: angular.IComponentOptions = {
    template: require("./date-filter-menu.template.html"),
    bindings: {
        dateFilterData: "<",
        appPage: "<",
        onRefreshData: '&',
    },
    controller: DateFilterMenuComponent,
    controllerAs: "ctrl"
}

export default DateFilterComponent;