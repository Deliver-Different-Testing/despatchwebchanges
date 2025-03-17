import {Task, TaskTableFiltersRequest} from "./task-dashboard.interfaces";
import app from "../../app";

class TasksDashboardService implements angular.IServiceProvider {
    static $inject = ["$http"];

    constructor(private $http: angular.IHttpService) {
    }

    $get(): any {
        return this;
    }

    async getAllTasks(filters: TaskTableFiltersRequest): Promise<Task[]> {
        const cleanFilters: Record<string, any> = {};

        // Only add defined filters
        if (filters.courierId !== undefined) cleanFilters.courierId = filters.courierId;
        if (filters.eventTypeId !== undefined) cleanFilters.eventTypeId = filters.eventTypeId;
        if (filters.searchText) cleanFilters.searchText = filters.searchText;
        if (filters.date) cleanFilters.date = filters.date;

        const response = await this.$http<Task[]>({
            method: 'GET',
            url: '/Task/GetAllTasks',
            params: cleanFilters,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    }

    async markTaskAsClosed(eventId: number, closed: boolean) {
        await this.$http.post("Task/MarkTaskAsClosed" + "?eventId=" + eventId + "&closed=" + closed, null);
    }

    async updateTaskDate(eventId: number, date: string) {
        await this.$http.post("Task/UpdateTaskDate" + "?eventId=" + eventId + "&date=" + date, null);
    }

    async updateTaskTime(eventId: number, time: string) {
        await this.$http.post("Task/UpdateTaskTime" + "?eventId=" + eventId + "&time=" + time, null);
    }

    async reassignTask(eventId: number, staffId: number) {
        await this.$http.post("Task/ReassignTask" + "?eventId=" + eventId + "&staffId=" + staffId, null);
    }
}

app.service("tasksDashboardsService", TasksDashboardService);
export default TasksDashboardService;
