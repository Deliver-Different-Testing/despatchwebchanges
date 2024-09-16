class PrebookService {
    static $inject = ['$http'];

    constructor($http) {
        this._http = $http;
    }

    async getPreBookJobs() {
        const response = await this._http.get('/Job/PreBookJobs');
        return await response.data;
    }

    /**
     * @param {number} jobId
     */
    async sendPrebookJob(jobId) {
        const response = await this._http.post('/Job/SendPrebookJob?jobId=' + jobId);
        return await response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     */
    async voidPrebookJob(jobId, despatcherName, staffId) {
        const response = await this._http.post('/Job/VoidPrebookJob?jobId=' + jobId + '&despatcher=' + despatcherName + '&staffId=' + staffId);
        return await response.data;
    }

    /**
     * @param {number} preBookJobId
     */
    async getJobDetail(preBookJobId) {
        const response = await this._http.get('/Job/PreBookDetail?preBookJobId=' + preBookJobId);
        return await response.data;
    }

}

angular.module('uDispatch').service('uPBData', ['$http', $http => new PrebookService($http)]);
