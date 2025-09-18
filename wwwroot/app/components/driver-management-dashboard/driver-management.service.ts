import {ICourierDataDashboard} from "./interfaces/ICourierDataDashboard";
import ICourierCompliance from "./interfaces/ICourierCompliance";
import IDriverEmail from "./interfaces/IDriverEmail";
import IGroupEmailData from "./interfaces/IGroupEmailData";
import {
    ICourierAfterHoursPaginated,
    ICourierCompliancePaginated, ICourierDailyEarningsPaginated, ITodayActiveDriverPaginated,
} from "../../interfaces/paginated-response.interface";
import {ISuggestion} from "../../interfaces/job.interface";
import {IPaginatedRequest} from "../../interfaces/paginated-request.interfaces";
import {
    IAfterHoursFilter,
    ICourierComplianceFilter,
    ITodayActiveDriverFilter
} from "./interfaces/ICourierComplianceFilter";

class DriverManagementService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "$log",
    ];

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService,
    ) {
        this.$log.debug('DriverManagementService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async searchAllCouriers(searchTerm: string): Promise<ISuggestion[]> {
        this.$log.debug("Searching couriers");
        this.$log.debug("Search term: ", searchTerm);

        const response = await this.$http.get<ISuggestion[]>("courier/SearchAllCouriers", {
            params: {
                searchTerm
            }
        });

        return response.data;
    }

    async getCourierDetailsForDashboard(courierId: number): Promise<ICourierDataDashboard> {
        this.$log.debug("Getting courier details for dashboard");
        this.$log.debug("Courier ID: ", courierId);

        const response = await this.$http.get<ICourierDataDashboard>("courier/GetCourierDetailsForDashboard", {
            params: {
                courierId
            }
        });

        return response.data;
    }

    async getCourierComplianceList(
        requestData: IPaginatedRequest,
        filters: ICourierComplianceFilter
    ): Promise<ICourierCompliancePaginated> {
        this.$log.debug("Getting courier compliance list with filters:", filters);

        const response = await this.$http.post<ICourierCompliancePaginated>("courier/GetCourierComplianceList", {
            // Pagination data
            page: requestData.page,
            pageSize: requestData.pageSize,
            orderBy: requestData.orderBy,
            sortDescending: requestData.sortDescending,
            searchTerm: requestData.searchTerm,

            // Filter data
            type: filters.type,
            status: filters.status,
            fleet: filters.fleet
        });

        return response.data;
    }

    async sendComplianceReminder(item: ICourierCompliance): Promise<void> {
        this.$log.debug("Sending compliance reminder for:", item);

        try {
            await this.$http.post("courier/SendComplianceReminder", {
                code: item.code,
                type: item.complianceType
            });
        } catch (error) {
            this.$log.error("Error sending compliance reminder:", error);
            throw error;
        }
    }

    async sendBulkComplianceReminders(items: ICourierCompliance[]): Promise<void> {
        this.$log.debug("Sending bulk compliance reminders:", items.length);

        try {
            await this.$http.post("courier/SendBulkComplianceReminders", {items});
        } catch (error) {
            this.$log.error("Error sending bulk reminders:", error);
            throw error;
        }
    }

    async getAfterHoursCourierScheduleList(requestData: IPaginatedRequest,
                                           filters: IAfterHoursFilter): Promise<ICourierAfterHoursPaginated> {
        this.$log.debug("Getting after hours courier schedule");
        this.$log.debug("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ICourierAfterHoursPaginated>("courier/GetAfterHoursCourierSchedule", {
            // Pagination data
            page: requestData.page,
            pageSize: requestData.pageSize,
            orderBy: requestData.orderBy,
            sortDescending: requestData.sortDescending,
            searchTerm: requestData.searchTerm,

            // Filter data
            day: filters.day,
        });

        return response.data;
    }

    async getDriverEmails(): Promise<IDriverEmail[]> {
        this.$log.debug("Getting driver emails");

        try {
            const response = await this.$http.get<IDriverEmail[]>("courier/GetDriverEmails");
            return response.data;
        } catch (error) {
            this.$log.error("Error getting driver emails:", error);
            throw error;
        }
    }

    async sendGroupEmail(emailData: IGroupEmailData): Promise<void> {
        this.$log.debug("Sending group email to:", emailData.recipients.length, "recipients");

        try {
            await this.$http.post("courier/SendGroupEmail", emailData);
        } catch (error) {
            this.$log.error("Error sending group email:", error);
            throw error;
        }
    }

    async getTodayActiveDriversAsync(requestData: IPaginatedRequest,
                                     filters: ITodayActiveDriverFilter): Promise<ITodayActiveDriverPaginated> {
        this.$log.debug("Getting today active drivers");
        this.$log.debug("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ITodayActiveDriverPaginated>("courier/GetTodayActiveDrivers", {
            // Pagination data
            page: requestData.page,
            pageSize: requestData.pageSize,
            orderBy: requestData.orderBy,
            sortDescending: requestData.sortDescending,
            searchTerm: requestData.searchTerm,

            // Filter data
            location: filters.location,
            status: filters.status,
            fleet: filters.fleet
        });

        return response.data;
    }
    
    async getAllFleetOptions(): Promise<ISuggestion[]> {
        this.$log.debug("Getting all fleet options");
        
        try {
            const response = await this.$http.get<ISuggestion[]>("courier/GetAllFleetOptions");
            return response.data;
        } catch (error) {
            this.$log.error("Error getting all fleet options:", error);
            throw error;
        }
    }

    async getDriverDailyEarnings(requestData: IPaginatedRequest): Promise<ICourierDailyEarningsPaginated> {
        this.$log.debug("Getting today active drivers");
        this.$log.debug("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ICourierDailyEarningsPaginated>("courier/GetCourierDailyEarnings", {
            // Pagination data
            page: requestData.page,
            pageSize: requestData.pageSize,
            orderBy: requestData.orderBy,
            sortDescending: requestData.sortDescending,
            searchTerm: requestData.searchTerm
        });

        return response.data;
    }
}

export default DriverManagementService;