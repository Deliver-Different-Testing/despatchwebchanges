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
        const response = await this.$http<Task[]>({
            method: 'GET',
            url: '/Task/GetAllTasks',
            params: filters,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    }

    async markTaskAsClosed(eventId: number, closed: boolean) {
        await this.$http.post("Task/MarkTaskAsClosed" + "?eventId=" + eventId + "&closed=" + closed, null);
    }

    async updateTaskDate(eventId: number, date: Date) {
        await this.$http.post("Task/UpdateTaskDate" + "?eventId=" + eventId + "&date=" + date, null);
    }
    
    async updateTaskTime(eventId: number, time: Date) {
        await this.$http.post("Task/UpdateTaskTime" + "?eventId=" + eventId + "&time=" + time, null);
    }
}

app.service("tasksDashboardsService", TasksDashboardService);
export default TasksDashboardService;
