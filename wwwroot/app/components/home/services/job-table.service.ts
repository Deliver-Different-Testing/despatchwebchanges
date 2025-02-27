import app from "../../../app";
import {Job, JobQueryParams} from "../../../interfaces/job.interface";

class JobTableService implements angular.IServiceProvider {
    constructor() {
    }

    createQuery(): JobQueryParams {
        return {
            page: 1,
            limit: 10,
            order: "time",
            orderDirection: "asc",
            status: "all"
        };
    }

    attention(job: Job): boolean {
        return job.attention || false;
    };

    updateField(job: Job, field: string): void {
        // Handle field update logic
        console.log(`Updated ${field} for job ${job.id}`);
    };

    getClientBoxStyle(job: Job): { 'background-color': string } {
        return {
            'background-color': job.clientColor || "#4CAF50"
        };
    }

    $get(): any {
        return this;
    }
}

app.service("JobTableService", JobTableService);
export default JobTableService;
