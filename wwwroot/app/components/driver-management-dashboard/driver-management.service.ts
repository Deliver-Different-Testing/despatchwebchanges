import {ICourierDataDashboard} from "./interfaces/ICourierDataDashboard";
import ICourierCompliance from "./interfaces/ICourierCompliance";
import IDriverEmail from "./interfaces/IDriverEmail";
import IGroupEmailData from "./interfaces/IGroupEmailData";
import {
    ICourierCompliancePaginated,
    IPaginatedRequest,
    IPaginatedResponse
} from "../../interfaces/paginated-response.interface";

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

    async updateCourierDetails(courier: ICourierDataDashboard): Promise<ICourierDataDashboard> {
        this.$log.debug("Updating courier details:", courier);

        try {
            const response = await this.$http.post<ICourierDataDashboard>("courier/UpdateCourierDetails", courier);
            return response.data;
        } catch (error) {
            this.$log.error("Error updating courier details:", error);
            throw error;
        }
    }

    async findDriverByRego(rego: string): Promise<ICourierDataDashboard | undefined> {
        this.$log.debug("Finding driver by rego:", rego);

        try {
            const response = await this.$http.get<ICourierDataDashboard>("courier/FindByRego", {
                params: { rego }
            });
            return response.data;
        } catch (error) {
            if ((error as any).status === 404) {
                return undefined;
            }
            this.$log.error("Error finding driver by rego:", error);
            throw error;
        }
    }

    async getCourierComplianceList(requestData: IPaginatedRequest): Promise<ICourierCompliancePaginated> {
        this.$log.debug("Getting courier compliance list");
        this.$log.debug("Search term: ", requestData.searchTerm);

        const response = await this.$http.get<ICourierCompliancePaginated>("courier/GetCourierComplianceList", {
            params: {
                searchTerm: requestData.searchTerm,
                page: requestData.page,
                pageSize: requestData.pageSize,
                orderBy: requestData.orderBy,
                sortDescending: requestData.sortDescending
            }
        });

        return response.data;
    }
    
    async saveComplianceItem(item: ICourierCompliance): Promise<ICourierCompliance> {
        this.$log.debug("Saving compliance item:", item);

        try {
            const response = await this.$http.post<ICourierCompliance>("courier/SaveComplianceItem", item);
            return response.data;
        } catch (error) {
            this.$log.error("Error saving compliance item:", error);
            throw error;
        }
    }

    async deleteComplianceItem(item: ICourierCompliance): Promise<void> {
        this.$log.debug("Deleting compliance item:", item);

        try {
            await this.$http.delete("courier/DeleteComplianceItem", {
                params: {
                    code: item.code,
                    type: item.complianceType
                }
            });
        } catch (error) {
            this.$log.error("Error deleting compliance item:", error);
            throw error;
        }
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
            await this.$http.post("courier/SendBulkComplianceReminders", { items });
        } catch (error) {
            this.$log.error("Error sending bulk reminders:", error);
            throw error;
        }
    }


    async getAfterHoursCourierSchedule(searchTerm: string): Promise<IAfterHoursCourierSchedule[]> {
        this.$log.debug("Getting after hours courier schedule");
        this.$log.debug("Search term: ", searchTerm);

        const response = await this.$http.get<IAfterHoursCourierSchedule[]>("courier/GetAfterHoursCourierSchedule", {
            params: {
                searchTerm
            }
        });

        return response.data;
    }

    async saveAfterHoursSchedule(schedule: IAfterHoursCourierSchedule): Promise<IAfterHoursCourierSchedule> {
        this.$log.debug("Saving after hours schedule:", schedule);

        try {
            const response = await this.$http.post<IAfterHoursCourierSchedule>("courier/SaveAfterHoursSchedule", schedule);
            return response.data;
        } catch (error) {
            this.$log.error("Error saving after hours schedule:", error);
            throw error;
        }
    }

    async deleteAfterHoursSchedule(schedule: IAfterHoursCourierSchedule): Promise<void> {
        this.$log.debug("Deleting after hours schedule:", schedule);

        try {
            await this.$http.delete("courier/DeleteAfterHoursSchedule", {
                params: {
                    courierId: schedule.courierId,
                    day: schedule.day
                }
            });
        } catch (error) {
            this.$log.error("Error deleting after hours schedule:", error);
            throw error;
        }
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

    async exportComplianceReport(): Promise<Blob> {
        this.$log.debug("Exporting compliance report");

        try {
            const response = await this.$http.get("courier/ExportComplianceReport", {
                responseType: 'blob'
            });
            return response.data as Blob;
        } catch (error) {
            this.$log.error("Error exporting compliance report:", error);
            throw error;
        }
    }

    async exportDriversList(format: string = 'csv'): Promise<Blob> {
        this.$log.debug(`Exporting drivers list as ${format}`);

        try {
            const response = await this.$http.get("courier/ExportDriversList", {
                params: { format },
                responseType: 'blob'
            });
            return response.data as Blob;
        } catch (error) {
            this.$log.error("Error exporting drivers list:", error);
            throw error;
        }
    }
}

export default DriverManagementService;