import {ICourierDataDashboard} from "./interfaces/ICourierDataDashboard";
import ICourierCompliance from "./interfaces/ICourierCompliance";
import IDriverEmail from "./interfaces/IDriverEmail";
import IGroupEmailData from "./interfaces/IGroupEmailData";
import {
    ICourierAfterHoursPaginated, ICourierAfterHoursPaginatedDto,
    ICourierCompliancePaginated, ICourierDailyEarningsPaginated, IPaginatedResponse, ITodayActiveDriverPaginated,
    ITodayActiveDriverPaginatedDto,
} from "../../interfaces/paginated-response.interface";
import {ISuggestion} from "../../interfaces/job.interface";
import {IPaginatedRequest} from "../../interfaces/paginated-request.interfaces";
import {
    IAfterHoursFilter,
    ICourierComplianceFilter,
    ITodayActiveDriverFilter
} from "./interfaces/ICourierComplianceFilter";
import {formatDateForApiWithTzs} from "../../functions/formatDates";
import {IAfterHoursCourierSchedule} from "./interfaces/IAfterHoursCourierSchedule";
import {transformerAfterHoursScheduleDto, transformTodayActiveDriversDTO} from "../../functions/dtoMappings";

class DriverManagementService implements angular.IServiceProvider {
    static $inject = [
        "$http",
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.log('DriverManagementService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async searchAllCouriers(searchTerm: string): Promise<ISuggestion[]> {
        console.log("Searching couriers");
        console.log("Search term: ", searchTerm);

        const response = await this.$http.get<ISuggestion[]>("courier/SearchAllCouriers", {
            params: {
                searchTerm
            }
        });

        return response.data;
    }

    async getCourierDetailsForDashboard(courierId: number): Promise<ICourierDataDashboard> {
        console.log("Getting courier details for dashboard");
        console.log("Courier ID: ", courierId);

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
        console.log("Getting courier compliance list with filters:", filters);

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
        console.log("Sending compliance reminder for:", item);

        try {
            await this.$http.post("courier/SendComplianceReminder", {
                code: item.code,
                type: item.complianceType
            });
        } catch (error) {
            console.error("Error sending compliance reminder:", error);
            throw error;
        }
    }

    async sendBulkComplianceReminders(items: ICourierCompliance[]): Promise<void> {
        console.log("Sending bulk compliance reminders:", items.length);

        try {
            await this.$http.post("courier/SendBulkComplianceReminders", {items});
        } catch (error) {
            console.error("Error sending bulk reminders:", error);
            throw error;
        }
    }

    async getAfterHoursCourierScheduleList(requestData: IPaginatedRequest,
                                           filters: IAfterHoursFilter): Promise<ICourierAfterHoursPaginated> {
        console.log("Getting after hours courier schedule");
        console.log("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ICourierAfterHoursPaginatedDto>("courier/GetAfterHoursCourierSchedule", {
            // Pagination data
            page: requestData.page,
            pageSize: requestData.pageSize,
            orderBy: requestData.orderBy,
            sortDescending: requestData.sortDescending,
            searchTerm: requestData.searchTerm,

            // Filter data
            day: filters.day,
        });

        return {
            ...response.data,
            items: response.data.items.map(transformerAfterHoursScheduleDto)
        }
    }

    async getDriverEmails(requestData: IPaginatedRequest): Promise<IPaginatedResponse<IDriverEmail>> {
        console.log("Getting driver emails");

        try {
            const response = await this.$http.post<IPaginatedResponse<IDriverEmail>>("courier/GetAllCourierEmails", requestData);
            return response.data;
        } catch (error) {
            console.error("Error getting driver emails:", error);
            throw error;
        }
    }

    async sendEmailToCouriers(emailData: IGroupEmailData): Promise<void> {
        console.log("Sending group email");

        try {
            await this.$http.post("courier/SendEmailToCouriers", emailData);
        } catch (error) {
            console.error("Error sending group email:", error);
            throw error;
        }
    }

    async updateAfterHoursCourierSchedule(afterHoursSchedule: IAfterHoursCourierSchedule): Promise<void> {
        console.log("Updating after hours courier schedule");

        const payload = {
            ...afterHoursSchedule,
            startTime: afterHoursSchedule.startTime ? formatDateForApiWithTzs(afterHoursSchedule.startTime, afterHoursSchedule.timezone) : null,
            endTime: afterHoursSchedule.endTime ? formatDateForApiWithTzs(afterHoursSchedule.endTime, afterHoursSchedule.timezone) : null,
        };

        try {
            await this.$http.post("courier/UpdateAfterHoursCourierSchedule", payload);
        } catch (error) {
            console.error("Error updating after hours schedule:", error);
            throw error;
        }
    }

    async createAfterHoursCourierSchedule(afterHoursSchedule: IAfterHoursCourierSchedule): Promise<void> {
        console.log("Updating after hours courier schedule");

        const payload = {
            ...afterHoursSchedule,
            startTime: afterHoursSchedule.startTime ? formatDateForApiWithTzs(afterHoursSchedule.startTime, afterHoursSchedule.timezone) : null,
            endTime: afterHoursSchedule.endTime ? formatDateForApiWithTzs(afterHoursSchedule.endTime, afterHoursSchedule.timezone) : null,
        };

        try {
            await this.$http.post("courier/CreateAfterHoursCourierSchedule", payload);
        } catch (error) {
            console.error("Error updating after hours schedule:", error);
            throw error;
        }
    }

    async deleteAfterHoursCourierSchedule(afterHoursScheduleId: number): Promise<void> {
        console.log("Deleting after hours courier schedule");
        await this.$http.delete('courier/DeleteAfterHoursCourierSchedule', {
            params: {
                afterHoursScheduleId
            }
        });
    }

    async getTodayActiveDriversAsync(requestData: IPaginatedRequest,
                                     filters: ITodayActiveDriverFilter): Promise<ITodayActiveDriverPaginated> {
        console.log("Getting today active drivers");
        console.log("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ITodayActiveDriverPaginatedDto>("courier/GetTodayActiveDrivers", {
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

        return {
            ...response.data,
            items: response.data.items.map(transformTodayActiveDriversDTO)
        };
    }

    async getAllFleetOptions(): Promise<ISuggestion[]> {
        console.log("Getting all fleet options");

        try {
            const response = await this.$http.get<ISuggestion[]>("courier/GetAllFleetOptions");
            return response.data;
        } catch (error) {
            console.error("Error getting all fleet options:", error);
            throw error;
        }
    }

    async getDriverDailyEarnings(requestData: IPaginatedRequest): Promise<ICourierDailyEarningsPaginated> {
        console.log("Getting today active drivers");
        console.log("Search term: ", requestData.searchTerm);

        const response = await this.$http.post<ICourierDailyEarningsPaginated>("courier/GetCourierDailyEarnings", requestData);
        return response.data;
    }
}

export default DriverManagementService;