class TasksService {
    static $inject = [
        "$http"
    ];

    constructor(private $http: angular.IHttpService) {
        console.log("Tasks service initialized");
    }

    async markTaskAsClosed(eventId: number, closed: boolean) {
        await this.$http.post("task/MarkTaskAsClosed",
            null, {
                params: {
                    eventId: eventId,
                    closed: closed
                }
            });
    }

    async updateTaskDate(eventId: number, date: string) {
        await this.$http.post("task/UpdateTaskDate",
            null, {
                params: {
                    eventId,
                    date
                }
            });
    }

    async updateTaskTime(eventId: number, time: string) {
        await this.$http.post("task/UpdateTaskTime",
            null, {
                params: {
                    eventId,
                    time
                }
            });
    }


    async reassignTaskToStaff(eventId: number, staffId: number) {
        await this.$http.post("task/ReassignTask",
            null, {
                params: {
                    eventId,
                    staffId
                }
            });
    }
}

export default TasksService;
