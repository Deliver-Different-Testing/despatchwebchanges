class JobTableService {
    constructor($mdEditDialog) {
        this.$mdEditDialog = $mdEditDialog;
    }

    createQuery() {
        return {
            order: 'time', limit: 10, page: 1, filter: ''
        };
    }

    attention(job) {
        return job.attention || '';
    }

    getClientBoxStyle(job) {
        return {
            'background-color': job.clientColor || '#4CAF50'
        };
    }

    /**
     * @param event
     * @param {Job} job
     * @param {string|number} field
     * @param {string} placeholder
     * @param {string} type
     */
    editField(event, job, field, placeholder, type = 'text') {
        event.stopPropagation();
        return this.$mdEditDialog.small({
            modelValue: job[field], placeholder, type, save: (input) => {
                job[field] = input.$modelValue;
            }, targetEvent: event
        });
    }

    /**
     * @param event
     * @param {Job} job
     */
    editTo(event, job) {
        event.stopPropagation();
        return this.$mdEditDialog.small({
            modelValue: `${job.to} ${job.toAddress || ''}`, placeholder: 'Set to', save: (input) => {
                const parts = input.$modelValue.split(' ');
                job.to = parts[0];
                job.toAddress = parts.slice(1).join(' ');
            }, targetEvent: event
        });
    }
}

angular.module('uDispatch').service('JobTableService', ['$mdEditDialog', ($mdEditDialog) => new JobTableService($mdEditDialog)]);
