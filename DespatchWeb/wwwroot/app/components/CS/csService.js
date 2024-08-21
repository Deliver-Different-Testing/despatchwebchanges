class CsService {
    static $inject = ['$http'];

    constructor($http) {
        this._$http = $http;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    allocateJobs(courierId, dispId, jobIds) {
        return this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(response => response);
    }

    /**
     * @param {string} jobNo
     * @param {number} clientId
     * @param {number} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        return this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} clientId
     * @param {string} wild
     * @param {string} job
     * @param {Date} fromDate
     * @param {Date} toDate
     * @param {number} pageIndex
     * @param {number} pageSize
     */
    getPodJobs(courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
        return this._$http.get('/Job/PODSearch?courierId=' + courierId + '&clientId=' + clientId + '&wild=' + wild + '&job=' + job + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} clientId
     * @param {string} job
     * @param {string} wild
     * @param {number} pageIndex
     * @param {number} pageSize
     */
    searchBulkJobs(courierId, clientId, job, wild, fromDate, toDate, pageIndex, pageSize) {
        return this._$http.get('/Job/BulkSearch?courierId=' + courierId + '&clientId=' + clientId + '&job=' + job + '&wild=' + wild + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} clientId
     * @param {string} wild
     * @param {string} job
     * @param {number} pageIndex
     * @param {number} pageSize
     */
    searchPreBookJobs(courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
        return this._$http.get('/Job/PreBookSearch?courierId=' + courierId + '&clientId=' + clientId + '&wild=' + wild + '&job=' + job + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(response => response.data);
    }

    /**
     * @param {string} code
     * @param {Date} start
     * @param {Date} end
     */
    getCourierRoute(code, start, end) {
        return this._$http.get('/courier/route?code=' + code + '&start=' + start.format("YYYY-MM-DDTHH:mm:ss") + '&end=' + end.format("YYYY-MM-DDTHH:mm:ss")).then(response => response.data);
    }

    /**
     * @param {number} jobId
     */
    getJobDetail(jobId) {
        return this._$http.get('/Job/Detail?jobId=' + jobId).then(response => response.data);
    }

    /**
     * @param {number} id
     * @param {number} clientId
     */
    getRelatedJobs(id, clientId) {
        return this._$http.get('/Job/Related?parentId=' + id + '&clientId=' + clientId).then(response => response.data);
    }

    /**
     * @param {Date} runDate
     * @param {string} scan
     */
    getScanDetail(runDate, scan) {
        return this._$http.get('/Job/ScanJobDetail?runDate=' + runDate.toISOString() + '&scan=' + scan).then(response => response.data);
    }

    /**
     * @param {number} preBookJobId
     */
    getPreBookDetail(preBookJobId) {
        return this._$http.get('/Job/PreBookDetail?preBookJobId=' + preBookJobId).then(response => response.data);
    }

    getBulkJobDetail(bulkJobId) {
        return this._$http.get('/Job/BulkDetail?bulkJobId=' + bulkJobId).then(response => response.data);
    }

    getActiveCouriers() {
        return this._$http.get("courier/active").then(response => response.data);
    }

    getAllCouriers() {
        return this._$http.get("courier/AllActive").then(response => response.data);
    }

    /**
     * @param {number} eventId
     * @param {string} note
     */
    addEventNote(eventId, note) {
        return this._$http.post('CS/AddEventNote?eventId=' + eventId + '&note=' + note + '&userName=' + ClientName).then(response => response.data);
    }

    /**
     * @param {string} jobNumber
     */
    validateSwapPOD(jobNumber) {
        return this._$http.post('Job/ValidateSwapPOD?job=' + jobNumber).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    restoreJobs(courierId, dispId, jobIds) {
        return this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    restoreSplitJobs(courierId, dispId, jobIds) {
        return this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {string} jobNumber1
     * @param {string} jobNumber2
     */
    swapPOD(jobNumber1, jobNumber2) {
        return this._$http.post('Job/SwapPOD?job1=' + jobNumber1 + '&job2=' + jobNumber2).then(response => response.data);
    }

    /**
     * @param {number} eventId
     * @param {string} userName
     */
    closeEvent(eventId, userName) {
        return this._$http.post('CS/CloseEvent?eventId=' + eventId + '&userName=' + `${ClientName}-${userName}`).then(response => response.data);
    }

    /**
     * @param {number[]} jobIds
     */
    reSendJobs(jobIds) {
        return this._$http.post("job/ReSendSelected?jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number[]} jobIds
     */
    reAssignJobs(jobIds) {
        return this._$http.post("job/ReAssignSelected?jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    sendPOD(jobId, email) {
        return this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email).then(response => response.data);
    }

    /**
     * @param {number} jobId
     */
    unSplitJob(jobId) {
        return this._$http.post('job/UnSplitJob?jobId=' + jobId).then(response => response.data);
    }

    /**
     * @param {number} eventId
     * @param {number} clientId
     */
    generateDirectLink(eventId, clientId) {
        return this._$http.get('/CS/GenerateDirectLink?eventId=' + eventId + '&clientId=' + clientId).then(response => response.data);
    }

    createEvent(data, notify) {
        return this._$http({
            url: 'book/CreateEvent?clientInternal=' + ClientInternal + '&notify=' + notify + '&clientName=' + ClientName,
            method: "POST",
            data: data
        }).then(response => response.data).catch(response => {
            console.error('Book/CreateEvent error', response.status, response.data);
        });
    }

    /**
     * @param {string} searchTerm
     */
    getActiveClients(searchTerm) {
        return this._$http.get('/home/ActiveClients?searchTerm=' + searchTerm)
            .then(response => response.data);
    }

    /**
     * @param {string} searchTerm
     */
    getActiveCouriersSearch(searchTerm) {
        return this._$http.get('/courier/AllActiveSearch?searchTerm=' + searchTerm)
            .then(response => response.data);
    }

    doAPI(path, data) {
        return this._$http.post(path, data).then(response => response.data);
    }
}

angular.module('uDispatch').factory('uCSData', CsService);
