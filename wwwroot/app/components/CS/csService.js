import app from "../../app";

class csService {
    static $inject = ["$http"];

    constructor($http) {
        this.$http = $http;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        return this.$http.post(`job/Allocate?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`);
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
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this.$http.post(`job/AddRestoreEvent?jobNo=${jobNo}&clientId=${clientId}&contact=${contact}&staffId=${staffId}&courierId=${courierId}&jobId=${jobId}&jobType=${jobType
            }&despatcherName=${despatcherName}`);
        return response.data;
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
    async getPodJobs(courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
        const response = await this.$http.get(`/Job/PODSearch?courierId=${courierId}&clientId=${clientId}&wild=${wild}&job=${job}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}&pageIndex=${pageIndex}&pageSize=${pageSize}`);
        return response.data;
    }

    podJobsDownload(courierId, clientId, wild, job, fromDate, toDate) {
        return this.$http.get(`/Job/PODSearchDownload?courierId=${courierId}&clientId=${clientId}&wild=${wild}&job=${job}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}`, { responseType: "blob" });
    }

    uploadJobList(file) {
        let fd = new FormData();
        fd.append("file", file);
        return this.$http.post("/Job/Upload", fd, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined }
        });
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
        const response = await this.$http.get(`/Job/BulkSearch?courierId=${courierId}&clientId=${clientId}&job=${job}&wild=${wild}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}&pageIndex=${pageIndex}&pageSize=${pageSize}`);
        return response.data;
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
    async searchPreBookJobs(courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
        const response = await this.$http.get(`/Job/PreBookSearch?courierId=${courierId}&clientId=${clientId}&wild=${wild}&job=${job}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}&pageIndex=${pageIndex}&pageSize=${pageSize}`);
        return response.data;
    }

    /**
     * @param {string} code
     * @param {Date} start
     * @param {Date} end
     */
    async getCourierRoute(code, start, end) {
        const response = await this.$http.get(`/courier/route?code=${code}&start=${start.format("YYYY-MM-DDTHH:mm:ss")}&end=${end.format("YYYY-MM-DDTHH:mm:ss")}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        const response = await this.$http.get(`/Job/Detail?jobId=${jobId}`);
        return response.data;
    }

    /**
    * @param {number} jobId
    * @param {number} year
    * @param {number} month
    */
    async getJobDeliveryPhotosAndSignature(jobId, year, month) {
        const response = await this.$http.get(`/Job/GetJobDeliveryPhotosAndSignature?jobId=${jobId}&year=${year}&month=${month}`);
        return response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        const response = await this.$http.get(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
        return response.data;
    }

    /**
     * @param {Date} runDate
     * @param {string} scan
     * @returns {Promise<BulkScanDetail[]>}
     */
    async getScanDetail(runDate, scan) {
        const response = await this.$http.get(`/Job/ScanJobDetail?runDate=${runDate.toISOString()}&scan=${scan}`);
        return response.data;
    }

    /**
     * @param {number} preBookJobId
     */
    async getPreBookDetail(preBookJobId) {
        const response = await this.$http.get(`/Job/PreBookDetail?preBookJobId=${preBookJobId}`);
        return response.data;
    }

    /**
     * @param {number} bulkJobId
     */
    async getBulkJobDetail(bulkJobId) {
        const response = await this.$http.get(`/Job/BulkDetail?bulkJobId=${bulkJobId}`);
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this.$http.get("courier/active");
        return response.data;
    }

    getAllCouriers() {
        return this.$http.get("courier/AllActive").then(response => response.data);
    }

    /**
     * @param {number} eventId
     * @param {string} note
     */
    async addEventNote(eventId, note) {
        const response = await this.$http.post(`CS/AddEventNote?eventId=${eventId}&note=${note}&userName=${ClientName}`);
        return response.data;
    }

    /**
     * @param {string} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        const response = await this.$http.post(`Job/ValidateSwapPOD?job=${jobNumber}`);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this.$http.post(`job/RestoreJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this.$http.post(`job/RestoreSplitJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {string} jobNumber1
     * @param {string} jobNumber2
     */
    async swapPOD(jobNumber1, jobNumber2) {
        const response = await this.$http.post(`Job/SwapPOD?job1=${jobNumber1}&job2=${jobNumber2}`);
        return response.data;
    }

    /**
     * @param {number} eventId
     * @param {string} userName
     */
    async closeEvent(eventId, userName) {
        const response = await this.$http.post(`CS/CloseEvent?eventId=${eventId}&userName=${`${ClientName}-${userName}`}`);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reSendJobs(jobIds) {
        const response = await this.$http.post(`job/ReSendSelected?jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reAssignJobs(jobIds) {
        const response = await this.$http.post(`job/ReAssignSelected?jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        const response = await this.$http.get(`job/SendPOD?jobId=${jobId}&toEmail=${email}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async unSplitJob(jobId) {
        const response = await this.$http.post(`job/UnSplitJob?jobId=${jobId}`);
        return response.data;
    }

    /**
     * @param {number} eventId
     * @param {number} clientId
     */
    async generateDirectLink(eventId, clientId) {
        const response = await this.$http.get(`/CS/GenerateDirectLink?eventId=${eventId}&clientId=${clientId}`);
        return response.data;
    }

    async createEvent(data, notify) {
        try {
            const response1 = await this.$http({
                url: `book/CreateEvent?clientInternal=${ClientInternal}&notify=${notify}&clientName=${ClientName}`,
                method: "POST",
                data: data
            });
            return response1.data;
        } catch (response2) {
            console.error("Book/CreateEvent error", response2.status, response2.data);
        }
    }

    /**
     * @param {string} searchTerm
     */
    async getActiveClients(searchTerm) {
        const response = await this.$http.get(`/home/ActiveClients?searchTerm=${searchTerm}`);
        return response.data;
    }

    /**
     * @param {string} searchTerm
     */
    async getActiveCouriersSearch(searchTerm) {
        const response = await this.$http.get(`/courier/AllActiveSearch?searchTerm=${searchTerm}`);
        return response.data;
    }

    async doAPI(path, data) {
        const response = await this.$http.post(path, data);
        return response.data;
    }

    async snapToRoads(path) {
        const response = await this.$http.get("https://roads.googleapis.com/v1/snapToRoads", {
            params: {
                interpolate: true,
                key: googleMapsApiKey,
                path: path.join("|")
            }
        });

        return response.data;
    }

    downloadJobs(params) {
        return this.$http.post("/Job/Download", params.data, { responseType: "blob" });
    }
}

app.service("uCSData", csService);