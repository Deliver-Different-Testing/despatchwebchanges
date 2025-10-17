import "./date-filter-menu.styles.less";
import dayjs, {Dayjs} from "dayjs";
import IDateFilterData from "./IDateFilterData";
import setDateFilterDefaults from "../../../functions/setDateFilterDefaults";
import ToastrService from "../../../services/toastr.service";

class DateFilterMenuComponent implements angular.IController {
    static $inject = [
        'toastrService',
    ]
    onRefreshData?: (locals: { dateFilterData: IDateFilterData }) => void;
    timeZone: string = TimeZone;
    private dateFilterData?: IDateFilterData;
    dateSearchRange: number = 1;
    startDate: Dayjs;
    endDate: Dayjs;

    constructor(private toasterService: ToastrService) {
        console.log("Component: DateFilterMenuComponent");
        console.log("Browser Time Zone:", this.timeZone);

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

            if(!this.dateFilterData) return;
            
            // Update local date references
            this.startDate = this.dateFilterData.startDate;
            this.endDate = this.dateFilterData.endDate;

            // Set the initial search range based on the dates
            if (this.isNext24Hours()) {
                this.dateSearchRange = 1;
            } else {
                this.dateSearchRange = 2;
            }
        }
    }

    private isNext24Hours(): boolean {
        if (!this.dateFilterData) return true;

        const { startDate, endDate } = this.dateFilterData;
        const defaults = setDateFilterDefaults();
        const tolerance = 60000; // 1 minute

        return Math.abs(startDate.valueOf() - defaults.startDate.valueOf()) < tolerance &&
            Math.abs(endDate.valueOf() - defaults.endDate.valueOf()) < tolerance;
    }

    async refreshData() {
        if (!this.dateFilterData) return;
        console.log("Triggering refresh callback from DateFilterMenuComponent");

        if (this.onRefreshData) {
            console.log('Calling refresh from DateFilterMenuComponent');
            const dateFilter = this.dateFilterData;
            if(!dateFilter) return;

            this.onRefreshData({
                dateFilterData: dateFilter
            });
        }
    }

    async onSearchRangeChange(optionSelected: number): Promise<void> {
        console.log("Triggering onSearchRangeChange - $onSearchRangeChange");

        if (!this.dateFilterData) return;

        this.dateSearchRange = optionSelected;

        if (optionSelected == 1) {
            // 24 Hours mode - reset to defaults
            const defaults = setDateFilterDefaults();
            this.dateFilterData = defaults;
            this.startDate = defaults.startDate;
            this.endDate = defaults.endDate;
        } else if (optionSelected == 2) {
            // Custom mode - set reasonable defaults if dates are not set
            if (!this.dateFilterData.startDate || this.dateFilterData.startDate.valueOf() === 0) {
                this.startDate = dayjs().subtract(7, 'days');
                this.dateFilterData.startDate = this.startDate;
            }
            if (!this.dateFilterData.endDate || this.dateFilterData.endDate.valueOf() === 0) {
                this.endDate = dayjs();
                this.dateFilterData.endDate = this.endDate;
            }
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
        this.dateSearchRange = 1;

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

        console.log("Date filter changed:", { start, end });
        this.dateFilterData = {
            startDate: start,
            endDate: end,
        }

        console.log("Date filter data:", this.dateFilterData);
        await this.refreshData();
    }
}

const DateFilterComponent: angular.IComponentOptions = {
    template: require("./date-filter-menu.template.html"),
    bindings: {
        dateFilterData: "<",
        onRefreshData: '&',
    },
    controller: DateFilterMenuComponent,
    controllerAs: "ctrl"
}

export default DateFilterComponent;