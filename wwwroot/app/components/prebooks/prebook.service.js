import app from "../../app";

class PrebookService {
    static $inject = ["$http"];

    constructor($http) {
        this.$http = $http;
    }

    /**
     * Retrieves all prebook jobs
     * @returns {Promise<any>} PreBook jobs data
     */
    async getPreBookJobs() {
        const response = await this.$http.get("/Job/PreBookJobs");
        return response.data;
    }

    /**
     * Sends a prebook job
     * @param {number} jobId - The ID of the job to send
     * @returns {Promise<any>} Response data from sending the job
     */
    async sendPrebookJob(jobId) {
        const response = await this.$http.post(`/Job/SendPrebookJob?jobId=${jobId}`, null);
        return response.data;
    }

    /**
     * Voids a prebook job
     * @param {number} jobId - The ID of the job to void
     * @param {string} despatcherName - Name of the despatcher
     * @param {number} staffId - ID of the staff member
     * @returns {Promise<any>} Response data from voiding the job
     */
    async voidPrebookJob(jobId, despatcherName, staffId) {
        const response = await this.$http.post(
            `/Job/VoidPrebookJob?jobId=${jobId}&despatcher=${despatcherName}&staffId=${staffId}`,
            null
        );
        return response.data;
    }

    /**
     * Gets details for a specific prebook job
     * @param {number} preBookJobId - The ID of the prebook job
     * @returns {Promise<any>} Job detail data
     */
    async getJobDetail(preBookJobId) {
        const response = await this.$http.get(`/Job/PreBookDetail?preBookJobId=${preBookJobId}`);
        return response.data;
    }
}

app.service("uPBData", PrebookService);
