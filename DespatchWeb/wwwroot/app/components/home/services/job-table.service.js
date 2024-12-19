class JobTableService {
    constructor() {
    }

    /**
     * Creates a new JobQueryParams object with default values.
     * @returns {JobQueryParams} A new JobQueryParams object.
     */
    createQuery() {
        return {
            page: 1,
            limit: 10,
            order: 'time',
            direction: 'asc',
            status: 'all'
        };
    }

    /**
     * @param {Job} job
     */
    attention(job) {
        return job.attention || '';
    };

    /**
     * @param {Job} job
     * @param {string} field
     */
    updateField(job, field) {
        // Handle field update logic
        console.log('Updated ' + field + ' for job ' + job.id);
    };

    /**
     * @param {Job} job
     */
    getClientBoxStyle(job) {
        return {
            'background-color': job.clientColor || '#4CAF50'
        };
    }
}

angular.module('uDispatch').service('JobTableService', ['$mdEditDialog', ($mdEditDialog) => new JobTableService($mdEditDialog)]);
