class JobTableService {
    constructor() {
    }

    /**
     * Creates a new JobQueryParams object with default values.
     * @returns {JobQueryParams} A new JobQueryParams object.
     */
    createQuery() {
        return {
            order: 'time', filter: '', status: 'all', asc: 'asc'
        };
    }

    /**
     * @param {Job} job
     */
    attention(job) {
        return job.attention || '';
    };

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
