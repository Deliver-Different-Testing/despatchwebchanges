class PrebookService {
    constructor($http) {
        this.http = $http;
    }

    async getPreBookJobs() {
        const response = await this.http.get('/Job/PreBookJobs');
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async sendPrebookJob(jobId) {
        const response = await this.http.post('/Job/SendPrebookJob?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     */
    async voidPrebookJob(jobId, despatcherName, staffId) {
        const response = await this.http.post('/Job/VoidPrebookJob?jobId=' + jobId + '&despatcher=' + despatcherName + '&staffId=' + staffId);
        return response.data;
    }

    /**
     * @param {number} preBookJobId
     */
    async getJobDetail(preBookJobId) {
        const response = await this.http.get('/Job/PreBookDetail?preBookJobId=' + preBookJobId);
        return response.data;
    }

}

angular.module('uDispatch').service('uPBData', ['$http', $http => new PrebookService($http)]);
