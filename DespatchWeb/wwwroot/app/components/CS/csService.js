class CSData {
    static $inject = ["$http"];

    constructor($http) {
        this.$http = $http;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispId, jobIds) {
        return await this.$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
    }

    /**
     * @param {number} jobNo
     * @param {number} clientId
     * @param {number} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number|string} jobType
     * @param {string} despatcherName
     */
    async addRestoreEvent(
        jobNo,
        clientId,
        contact,
        staffId,
        courierId,
        jobId,
        jobType,
        despatcherName
    ) {
        let response = await this.$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * @param {object} params
     */
    async getPodJobs(params) {
        const {courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize} = params;
        const response = await this.$http.get('/Job/PODSearch?courierId='
            + courierId + '&clientId=' + clientId
            + '&wild=' + wild + '&job=' + job
            + '&fromDate=' + fromDate + '&toDate=' + toDate
            + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} clientId
     * @param {string} job
     * @param {string} wild
     * @param {number} pageIndex
     * @param {number} pageSize
     */
    async searchBulkJobs(courierId, clientId, job, wild, fromDate, toDate, pageIndex, pageSize) {
        let response = await this.$http.get('/Job/BulkSearch?courierId=' + courierId + '&clientId=' + clientId + '&job=' + job + '&wild=' + wild + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} clientId
     * @param {string} wild
     * @param {string} job
     * @param {string} fromDate
     * @param {string} toDate
     * @param {number} pageIndex
     * @param {number} pageSize
     */
    async searchPreBookJobs(courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
        let response = await this.$http.get('/Job/PreBookSearch?courierId=' + courierId + '&clientId=' + clientId + '&wild=' + wild + '&job=' + job + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize);
        return response.data;
    }

    /**
     * @param {string} code
     * @param {number} start
     * @param {number} end
     */
    async getCourierRoute(code, start, end) {
        let response = await this.$http.get('/courier/route?code=' + code + '&start=' + start.format("YYYY-MM-DDTHH:mm:ss") + '&end=' + end.format("YYYY-MM-DDTHH:mm:ss"));
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        let response = await this.$http.get('/Job/Detail?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        let response = await this.$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return response.data;
    }

    /**
     * @param {Date} runDate
     * @param {string} scan
     */
    async getScanDetail(runDate, scan) {
        let response = await this.$http.get('/Job/ScanJobDetail?runDate=' + runDate.toISOString() + '&scan=' + scan);
        return response.data;
    }

    /**
     * @param {number} preBookJobId
     */
    async getPreBookDetail(preBookJobId) {
        let response = await this.$http.get('/Job/PreBookDetail?preBookJobId=' + preBookJobId);
        return response.data;
    }

    /**
     * @param {number} bulkJobId
     */
    async getBulkJobDetail(bulkJobId) {
        let response = await this.$http.get('/Job/BulkDetail?bulkJobId=' + bulkJobId);
        return response.data;
    }

    /**
     * @param {number} bulkJobId
     */
    async getBulkJobPhoto(bulkJobId) {
        let response = await this.$http.get('/CS/GetBulkJobPhoto?bulkJobId=' + bulkJobId);
        return response.data;
    }

    async getActiveCouriers() {
        let response = await this.$http.get("courier/active");
        return response.data;
    }

    async getAllCouriers() {
        let response = await this.$http.get("courier/AllActive");
        return response.data;
    }

    /**
     * @param {number} eventId
     * @param {string} note
     */
    async addEventNote(eventId, note) {
        let response = await this.$http.post('CS/AddEventNote?eventId=' + eventId + '&note=' + note + '&userName=' + ClientName);
        return response.data;
    }

    /**
     * @param {string} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        let response = await this.$http.post('Job/ValidateSwapPOD?job=' + jobNumber);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispId, jobIds) {
        let response = await this.$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispId, jobIds) {
        let response = await this.$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {*} job1
     * @param {*} job2
     */
    async swapPOD(job1, job2) {
        let response = await this.$http.post('Job/SwapPOD?job1=' + job1 + '&job2=' + job2);
        return response.data;
    }

    /**
     * @param {number} eventId
     * @param {string} userName
     */
    async closeEvent(eventId, userName) {
        let response = await this.$http.post('CS/CloseEvent?eventId=' + eventId + '&userName=' + `${ClientName}-${userName}`);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reSendJobs(jobIds) {
        let response = await this.$http.post("job/ReSendSelected?jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reAssignJobs(jobIds) {
        let response = await this.$http.post("job/ReAssignSelected?jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        let response = await this.$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async unSplitJob(jobId) {
        let response = await this.$http.post('job/UnSplitJob?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {number} eventId
     * @param {number} clientId
     */
    async generateDirectLink(eventId, clientId) {
        let response = await this.$http.get('/CS/GenerateDirectLink?eventId=' + eventId + '&clientId=' + clientId);
        return response.data;
    }

    /**
     * @param {{EventDate, ClientFollowup: number, dataType: string, Internal: (boolean|number), ClientCreated: boolean, ClientID: (string|number|*), BulkJobID: *, CourierID, Notes: string, Name: string}} data
     * @param {(function())|HTMLElement|((typedArray: BigInt64Array, index: number, count?: number) => number)|((typedArray: Int32Array, index: number, count?: number) => number)|boolean|*|boolean} notify
     */
    async createEvent(data, notify) {
        try {
            let response1 = await this.$http({
                url: 'book/CreateEvent?clientInternal=' + ClientInternal + '&notify=' + notify + '&clientName=' + ClientName,
                method: "POST",
                data: data
            });
            return response1.data;
        } catch (response2) {
            console.error('Book/CreateEvent error', response2.status, response2.data);
        }
    }

    /**
     * @param {string} searchTerm
     */
    async getActiveClients(searchTerm) {
        let response = await this.$http.get('/home/ActiveClients?searchTerm=' + searchTerm);
        return response.data;
    }

    /**
     * @param {string} searchTerm
     */
    async getActiveCouriersSearch(searchTerm) {
        let response = await this.$http.get('/courier/AllActiveSearch?searchTerm=' + searchTerm);
        return response.data;
    }

    /**
     * @param {string} path
     * @param {*} data
     */
    async doAPI(path, data) {
        let response = await this.$http.post(path, data);
        return response.data;
    }
}

angular.module('uDispatch').factory('uCSData', CSData);
