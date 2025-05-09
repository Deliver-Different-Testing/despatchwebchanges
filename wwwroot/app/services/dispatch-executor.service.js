"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bindAllMethods_1 = require("../bindAllMethods");
class DispatchExecutorService {
    constructor($mdDialog, DispatchData, moment) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.moment = moment;
        this.pickCouriers = [];
        this.pickAllCouriers = [];
        bindAllMethods_1.bindAllMethods(this);
    }
    $get() {
        return this;
    }
    fetchCouriersData() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Fetching couriers data...");
            try {
                const [activeCouriers, allCouriers] = yield Promise.all([
                    this.DispatchData.getActiveCouriers(),
                    this.DispatchData.getAllCouriers()
                ]);
                this.pickCouriers = activeCouriers;
                this.pickAllCouriers = allCouriers;
                console.log("Couriers data fetched:", {
                    activeCouriers: this.pickCouriers.length,
                    allCouriers: this.pickAllCouriers.length
                });
            }
            catch (error) {
                console.error("Error fetching couriers data:", error);
                throw error;
            }
        });
    }
    getJobListWithCourierData(queryParams, selectedClients, isInternal, selectedAreas) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Getting job list with courier data:", {
                queryParams,
                clientCount: selectedClients === null || selectedClients === void 0 ? void 0 : selectedClients.length,
                isInternal,
                selectedAreas
            });
            try {
                yield this.fetchCouriersData();
                const result = yield this.DispatchData.getJobsWithFilters(queryParams, selectedClients, isInternal, selectedAreas);
                // Get unDispatched jobs (safely handle null courierData)
                const unDispatchedJobs = result.filter((job) => { var _a; return !((_a = job === null || job === void 0 ? void 0 : job.courierData) === null || _a === void 0 ? void 0 : _a.courierId); });
                console.log(`Retrieved ${result.length} jobs, ${unDispatchedJobs.length} unDispatched`);
                return {
                    items: result,
                    undispatchedJobs: unDispatchedJobs,
                    activeCouriers: this.pickCouriers,
                    allCouriers: this.pickAllCouriers
                };
            }
            catch (error) {
                console.error("Error in getJobListWithCourierData:", error);
                throw error;
            }
        });
    }
    getCurrentJobsForCourier(courierId, isDone = false) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Getting current jobs for courier:", courierId);
            try {
                // Find courier in both active and all couriers
                const foundCourier = yield this.DispatchData.getCourierById(courierId);
                console.log("Found courier:", foundCourier);
                if (!foundCourier) {
                    console.warn(`No courier found for ID: ${courierId}`);
                    return { jobs: [], courier: null };
                }
                // Get jobs data
                const jobs = yield this.DispatchData.getJobsCurrent(courierId, isDone);
                console.log(`Retrieved ${jobs.length} jobs for courier`);
                // If no jobs but have courier, get position
                let courierPosition;
                if (jobs.length === 0 && foundCourier.id) {
                    try {
                        courierPosition = yield this.DispatchData.getCourierPosition(foundCourier.id);
                        console.log("Retrieved courier position:", courierPosition);
                    }
                    catch (error) {
                        console.warn("Error getting courier position:", error);
                    }
                }
                return {
                    jobs,
                    courier: foundCourier,
                    position: courierPosition
                };
            }
            catch (error) {
                console.error("Error in getCurrentJobsForCourier:", error);
                throw error;
            }
        });
    }
    dispatchJobByJobId(courierId, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Dispatching job by ID:", { courierId, jobId });
            try {
                const job = yield this.DispatchData.getJobDetail(jobId);
                console.log("Job details fetched:", job);
                const foundCourier = yield this.DispatchData.getCourierById(courierId);
                console.log("Found courier:", foundCourier);
                if (!foundCourier) {
                    console.warn(`Could not find courier with ID ${courierId}`);
                    yield this._showAlertMessage(`Could not find courier with ID ${courierId}`);
                    return;
                }
                yield this.dispatchJob(foundCourier.courierId, job);
            }
            catch (error) {
                console.error("Error in dispatchJobByJobId:", error);
                throw error;
            }
        });
    }
    dispatchJobsByCourierId(courierId, jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Dispatching multiple jobs by courier ID:", { courierId, jobCount: jobs.length });
            try {
                const courier = yield this.DispatchData.getCourierById(courierId);
                console.log("Found courier:", courier);
                if (courier) {
                    yield this._dispatchJobsContinue(courier, jobs);
                }
                else {
                    console.warn(`Could not find courier with ID ${courierId}`);
                }
            }
            catch (error) {
                console.error("Error in dispatchJobsBycourierId:", error);
                throw error;
            }
        });
    }
    dispatchJobs(courierNumber, jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchCouriersData();
            const foundCourier = yield this._findCourierByNumber(courierNumber);
            if (foundCourier != null) {
                yield this._dispatchJobsContinue(foundCourier, jobs);
            }
        });
    }
    dispatchJob(courierNumber, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchCouriersData();
            const foundCourier = yield this._findCourierByNumber(courierNumber);
            if (foundCourier) {
                yield this._dispatchJobsContinue(foundCourier, [job]);
            }
        });
    }
    dispatchJobsFromPotentialCouriers(courierId, jobList, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find courier and check if active
            const foundCourier = yield this.DispatchData.getCourierById(courierId);
            if (!foundCourier || !foundCourier.isActive) {
                yield this._showAlertMessage(`Could not find active courier with ID ${courierId}`);
                return;
            }
            // Filter and validate jobs
            const validJobs = [];
            const activeJobs = jobList.filter(job => job && job.isActive);
            for (const job of activeJobs) {
                const isValid = yield this._validateJob(job, foundCourier);
                if (!job || !isValid) {
                    continue;
                }
                validJobs.push(job.id);
                // Handle dangerous goods followup events
                if (this._requiresFollowupEvent(job)) {
                    yield this.DispatchData.addFollowupEvent(job.id);
                }
            }
            if (validJobs.length === 0) {
                yield this._showAlertMessage("No valid jobs to dispatch");
                return;
            }
            try {
                yield this.DispatchData.allocateJobs(foundCourier.courierId, contactId, validJobs);
                return {
                    gpsCourier: foundCourier.id
                };
            }
            catch (error) {
                yield this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
                throw error;
            }
        });
    }
    restoreJob(job) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[restoreJob] Starting restoration for job #${job.jobNo}`);
            const validationResult = yield this._validateJobForRestore(job);
            console.log(`[restoreJob] Validation result for job #${job.jobNo}:`, { isValid: validationResult.isValid, courierId: (_a = validationResult.courier) === null || _a === void 0 ? void 0 : _a.id });
            if (!validationResult.isValid) {
                console.log(`[restoreJob] Job #${job.jobNo} failed validation, not restoring`);
                return { gpsCourier: undefined };
            }
            try {
                if (validationResult.courier == undefined) {
                    console.error(`[restoreJob] Courier not found for job #${job.jobNo}`);
                    return { gpsCourier: undefined };
                }
                console.log(`[restoreJob] Processing restore for job #${job.jobNo} with courier ID ${validationResult.courier.id}`);
                const restoredJob = yield this._processJobRestore(job, validationResult.courier);
                console.log(`[restoreJob] Successfully restored job #${job.jobNo}, assigned to courier ID ${restoredJob.courierId}`);
                return { gpsCourier: restoredJob.courierId };
            }
            catch (error) {
                console.error(`[restoreJob] Error restoring job #${job.jobNo}:`, error);
                yield this._showAlertMessage(`Failed to restore job #${job.jobNo}`);
                return { gpsCourier: undefined };
            }
        });
    }
    _findCourierByNumber(courierNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!courierNumber || courierNumber <= 0) {
                throw new Error('Invalid courier number');
            }
            yield this.fetchCouriersData();
            const findCourierById = (couriers, id) => couriers.find(c => c.courierId === id) || null;
            // First try to find among active couriers
            const activeCourier = findCourierById(this.pickCouriers, courierNumber);
            if (activeCourier) {
                return activeCourier;
            }
            const confirmed = yield this._showOfflineCourierDialog();
            if (confirmed) {
                return findCourierById(this.pickAllCouriers, courierNumber);
            }
            return null;
        });
    }
    _showOfflineCourierDialog() {
        return this.$mdDialog.show(this.$mdDialog.confirm()
            .title("Courier Offline")
            .textContent("Dispatch anyway?")
            .ok("Yes")
            .cancel("No"));
    }
    _dispatchJobsContinue(courier, jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            const validationResults = yield Promise.all(jobs.map(job => this._validateJob(job, courier)));
            const validJobs = [];
            const errorMessages = [];
            jobs.forEach((job, index) => {
                if (validationResults[index].isValid) {
                    validJobs.push(job);
                }
                else {
                    errorMessages.push(validationResults[index].message);
                }
            });
            if (errorMessages.length > 0) {
                yield this._showAlertMessage(errorMessages.join("\n"));
                if (validJobs.length === 0) {
                    return;
                }
            }
            yield this._processValidJobs(courier, validJobs);
        });
    }
    _requiresFollowupEvent(job) {
        return job.dgClass !== undefined && job.dgClass > 0;
    }
    _validateJob(job, courier) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Validating job:", {
                jobNo: job === null || job === void 0 ? void 0 : job.jobNo,
                courierId: courier === null || courier === void 0 ? void 0 : courier.id,
                hasDG: job.dgClass !== undefined && job.dgClass > 0
            });
            if (job.courierData !== null) {
                const message = `Restore ${job.jobNo} prior to dispatching to another courier`;
                console.warn("Job validation failed:", message);
                return { isValid: false, message };
            }
            if (job.dgClass !== null && job.dgClass !== undefined && job.dgClass > 0) {
                if (!courier.dangerousGoods) {
                    const message = `DG job ${job.jobNo} can not be dispatched to courier ${courier.id} - doesn't have DGLicense.`;
                    console.warn("Job validation failed:", message);
                    return { isValid: false, message };
                }
                if (this.moment(courier.dgLicenseExpiry) < this.moment().add(1, "days")) {
                    const message = `Courier ${courier.id} doesn't have a DGLicense or license has expired.`;
                    console.warn("Job validation failed:", message);
                    return { isValid: false, message };
                }
            }
            console.log("Job validation passed:", job.jobNo);
            return { isValid: true, message: "" };
        });
    }
    _processValidJobs(courier, jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            const LOG_MESSAGES = {
                PROCESSING_JOBS: "Processing valid jobs",
                FOLLOWUP_JOBS: "Jobs requiring followup",
                PROCESSING_FOLLOWUP: "Processing followup events",
                ALLOCATING_JOBS: "Allocating jobs",
                SUCCESS: "Jobs processed successfully",
                ERROR: "Failed to dispatch jobs"
            };
            if (!courier || !(jobs === null || jobs === void 0 ? void 0 : jobs.length)) {
                throw new Error("Invalid courier or jobs data");
            }
            const logJobStatus = (message, data) => {
                console.log(message, data);
            };
            try {
                logJobStatus(LOG_MESSAGES.PROCESSING_JOBS, {
                    courierId: courier.courierId,
                    jobCount: jobs.length
                });
                yield this._processFollowupJobs(jobs);
                yield this._allocateJobsToCourier(courier, jobs);
                logJobStatus(LOG_MESSAGES.SUCCESS);
            }
            catch (error) {
                yield this._handleDispatchError(error);
            }
        });
    }
    _processFollowupJobs(jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobsRequiringFollowup = jobs.filter(this._requiresFollowupEvent);
            console.log("Jobs requiring followup:", jobsRequiringFollowup.length);
            if (jobsRequiringFollowup.length > 0) {
                console.log("Processing followup events");
                yield Promise.all(jobsRequiringFollowup.map(job => this.DispatchData.addFollowupEvent(job.id)));
            }
        });
    }
    _allocateJobsToCourier(courier, jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobIds = jobs.map(job => job.id);
            console.log("Allocating jobs:", jobIds.length);
            yield this.DispatchData.allocateJobs(courier.courierId, ContactID, jobIds);
        });
    }
    _handleDispatchError(error) {
        return __awaiter(this, void 0, void 0, function* () {
            console.error("Error processing valid jobs:", error);
            yield this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
            throw error;
        });
    }
    _validateJobForRestore(job) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const courierId = (_a = job === null || job === void 0 ? void 0 : job.courierData) === null || _a === void 0 ? void 0 : _a.courierId;
            if (courierId === undefined) {
                yield this._handleError("Job has no assigned courier to restore from");
                return { isValid: false };
            }
            const courier = yield this.DispatchData.getCourierById(courierId);
            if (!courier) {
                yield this._handleError(`Could not find courier with ID ${courierId}`);
                return { isValid: false };
            }
            return { isValid: true, courier };
        });
    }
    _processJobRestore(job, courier) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[_processJobRestore] Starting restore process for job #${job.jobNo} with ID ${job.id}`);
            try {
                console.log(`[_processJobRestore] Adding restore event for job ID ${job.id}`);
                yield this.DispatchData.addRestoreEvent(job.id);
                if (job.displaySplitJobDetail) {
                    console.log(`[_processJobRestore] Job #${job.jobNo} is a split job, restoring all split jobs`);
                    yield this.DispatchData.restoreSplitJobs([job.id]);
                }
                else {
                    console.log(`[_processJobRestore] Job #${job.jobNo} is a standard job, restoring`);
                    yield this.DispatchData.restoreJobs([job.id]);
                }
                console.log(`[_processJobRestore] Successfully completed restore process for job #${job.jobNo}, courier ID: ${courier.id}`);
                return courier;
            }
            catch (error) {
                console.error(`[_processJobRestore] Error during restore process for job #${job.jobNo}:`, error);
                throw error;
            }
        });
    }
    _handleError(message) {
        return __awaiter(this, void 0, void 0, function* () {
            console.warn(message);
            yield this._showAlertMessage(message);
            throw new Error(message);
        });
    }
    _showAlertMessage(textContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const alert = this.$mdDialog.alert()
                .parent(document.body)
                .clickOutsideToClose(true)
                .title("Unable to Despatch")
                .textContent(textContent)
                .ariaLabel("unable to despatch")
                .ok("OK");
            yield this.$mdDialog.show(alert);
        });
    }
}
DispatchExecutorService.$inject = ["$mdDialog", "DispatchData", "moment"];
exports.default = DispatchExecutorService;
