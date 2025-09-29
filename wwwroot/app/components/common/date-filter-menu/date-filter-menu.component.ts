import "./date-filter-menu.styles.less";
import dayjs from "dayjs";
import IDateFilterData from "./IDateFilterData";
import setDateFilterDefaults from "../../../functions/setDateFilterDefaults";

class DateFilterMenuComponent implements angular.IController {
    onRefreshData?: (data: {dateFilterData: IDateFilterData }) => Promise<void>;
    browserTimeZone: string;
    dateFilterData?: IDateFilterData;
    dateSearchRange: number = 1;

    constructor() {
        console.log("Component: DateFilterMenuComponent");
        this.browserTimeZone = dayjs.tz.guess();
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

        const startTime = dayjs(this.dateFilterData.startDate).valueOf();
        const endTime = dayjs(this.dateFilterData.endDate).valueOf();

        const defaultDate = setDateFilterDefaults();
        const now = defaultDate.startDate
        const next24Hours = defaultDate.endDate;

        // Check if it matches the "next 24 hours" pattern
        return Math.abs(startTime - now.valueOf()) < 60000 && // within 1 minute of now
            Math.abs(endTime - next24Hours.valueOf()) < 60000; // within 1 minute of 24 hours from now
    }

    async refreshData() {
        if (!this.dateFilterData) return;
        console.log("Triggering refresh callback from DateFilterMenuComponent");

        if (this.onRefreshData) {
            console.log('Calling refresh from DateFilterMenuComponent');
            const dateFilter = this.dateFilterData;
            if(!dateFilter) return;
            
            await this.onRefreshData({ dateFilterData: dateFilter });
        }
    }

    async onSearchRangeChange(optionSelected: number): Promise<void> {
        console.log("Triggering onSearchRangeChange - $onSearchRangeChange");

        if (!this.dateFilterData) return;

        this.dateSearchRange = optionSelected;

        if (optionSelected == 1) {
            // 24 Hours mode - reset to defaults
            this.dateFilterData = setDateFilterDefaults();
        } else if (optionSelected == 2) {
            // Custom mode - set reasonable defaults if dates are not set
            if (!this.dateFilterData.startDate || this.dateFilterData.startDate.valueOf() === 0) {
                this.dateFilterData.startDate = dayjs().subtract(7, 'days');
            }
            if (!this.dateFilterData.endDate || this.dateFilterData.endDate.valueOf() === 0) {
                this.dateFilterData.endDate = dayjs();
            }
        }

        await this.refreshData();
    }

    async clearDateFilter(): Promise<void> {
        if (!this.dateFilterData) return;
        console.log("Clearing date filter");
       
        this.dateFilterData = setDateFilterDefaults();
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