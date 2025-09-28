import "./date-filter-menu.styles.less";
import dayjs from "dayjs";
import IDateFilterData from "./IDateFilterData";

class DateFilterMenuComponent implements angular.IController {
    onRefreshData?: (data: {dateFilterData: IDateFilterData }) => Promise<void>;
    browserTimeZone: string;
    dateFilterData?: IDateFilterData;
    dateSearchRange: number = 1;

    constructor() {
        console.log("Component: DateFilterMenuComponent");
        this.browserTimeZone = dayjs.tz.guess();
        this.bindMethods();
    }

    private bindMethods(): void {
        this.refreshData = this.refreshData.bind(this);
        this.onSearchRangeChange = this.onSearchRangeChange.bind(this);
        this.clearDateFilter = this.clearDateFilter.bind(this);
        this.applyDateFilter = this.applyDateFilter.bind(this);
        this.isLast24Hours = this.isLast24Hours.bind(this);
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
            if (this.isLast24Hours()) {
                this.dateSearchRange = 1;
            } else {
                this.dateSearchRange = 2;
            }
        }
    }

    private isLast24Hours(): boolean {
        if (!this.dateFilterData) return true;

        const startTime = this.dateFilterData.startDate?.getTime() || 0;
        const endTime = this.dateFilterData.endDate?.getTime() || 0;
        const epochStart = new Date(0).getTime();
        const now = dayjs();
        const tomorrow = now.add(24, 'hours');

        // Check if it matches the "last 24 hours" pattern
        return startTime === epochStart &&
            Math.abs(endTime - tomorrow.valueOf()) < 60000; // within 1 minute
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
            this.dateFilterData.startDate = dayjs().toDate();
            this.dateFilterData.endDate = dayjs().add(24, 'hours').toDate();
        } else if (optionSelected == 2) {
            // Custom mode - set reasonable defaults if dates are not set
            if (!this.dateFilterData.startDate || this.dateFilterData.startDate.getTime() === new Date(0).getTime()) {
                this.dateFilterData.startDate = dayjs().subtract(7, 'days').toDate();
            }
            if (!this.dateFilterData.endDate || this.dateFilterData.endDate.getTime() === new Date(0).getTime()) {
                this.dateFilterData.endDate = dayjs().toDate();
            }
        }

        await this.refreshData();
    }

    async clearDateFilter(): Promise<void> {
        console.log("Clearing date filter");

        if (!this.dateFilterData) return;

        // 24-hour mode
        this.dateFilterData.startDate = dayjs().toDate();
        this.dateFilterData.endDate = dayjs().add(24, 'hours').toDate();

        await this.refreshData();
    }

    async applyDateFilter(): Promise<void> {
        console.log("Applying date filter");

        // Validate dates before applying
        if (this.dateSearchRange == 2) {
            if (!this.dateFilterData?.startDate || !this.dateFilterData?.endDate) {
                console.warn("Both start and end dates must be selected");
                return;
            }

            // Ensure end date is after start date
            if (this.dateFilterData.startDate > this.dateFilterData.endDate) {
                console.warn("End date must be after start date");
                return;
            }
        }

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