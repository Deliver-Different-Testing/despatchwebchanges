/**
 * @class NationwideService
 * @description A service for managing nationwide job-related operations, including job creation, updates, queries, and various API interactions.
 */
class NationwideService {
    /**
     * @constructor
     * @param {Object} $http - Angular's $http service for making HTTP requests.
     * @param {Object} moment - Moment.js library for date and time manipulation.
     */
    constructor($http, moment) {
        this._$http = $http;
        this._moment = moment;
    }

    /**
     * Adds a note to a job.
     * @param {number} jobId - The ID of the job.
     * @param {string} note - The note content.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {boolean} preBook - Indicates if this is a pre-booked job.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
        return this._$http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName);
    }

    /**
     * Adds a pallet to a job.
     * @param {Object} pallet - The pallet object to add.
     * @param {boolean} preBook - Indicates if this is a pre-booked job.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * Edits an existing pallet for a job.
     * @param {Object} pallet - The pallet object to edit.
     * @param {boolean} preBook - Indicates if this is a pre-booked job.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async editPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * Deletes a pallet from a job.
     * @param {Object} pallet - The pallet object to delete.
     * @param {boolean} preBook - Indicates if this is a pre-booked job.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async deletePallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * Adds a follow-up event for a job.
     * @param {string} jobNo - The job number.
     * @param {number} clientId - The client ID.
     * @param {string} contact - The contact information.
     * @param {number} staffId - The staff ID.
     * @param {number} courierId - The courier ID.
     * @param {number} jobId - The job ID.
     * @param {number} jobType - The job type.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * Adds a restore event for a job.
     * @param {string} jobNo - The job number.
     * @param {number} clientId - The client ID.
     * @param {string} contact - The contact information.
     * @param {number} staffId - The staff ID.
     * @param {number} courierId - The courier ID.
     * @param {number} jobId - The job ID.
     * @param {number} jobType - The job type.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * Adds an 'other' event for a job.
     * @param {string} jobNo - The job number.
     * @param {number} clientId - The client ID.
     * @param {string} contact - The contact information.
     * @param {number} staffId - The staff ID.
     * @param {number} courierId - The courier ID.
     * @param {number} jobId - The job ID.
     * @param {number} jobType - The job type.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {string} notes - Additional notes for the event.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addOtherEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
        const response = await this._$http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes);
        return response.data;
    }

    /**
     * Adds a generic event for a job.
     * @param {string} jobNo - The job number.
     * @param {number} clientId - The client ID.
     * @param {string} contact - The contact information.
     * @param {number} staffId - The staff ID.
     * @param {number} courierId - The courier ID.
     * @param {number} jobId - The job ID.
     * @param {number} jobType - The job type.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {string} notes - Additional notes for the event.
     * @param {number} eventType - The type of event.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async addEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
        const response = await this._$http.post("job/addEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes + "&eventType=" + eventType);
        return response.data;
    }

    /**
     * Records an Exsalerate activity.
     * @param {string} eventName - The name of the event.
     * @param {string} notes - Additional notes for the activity.
     * @param {number} clientId - The client ID.
     * @param {string} jobNumber - The job number.
     * @param {string} despatcherName - The name of the dispatcher.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async exsalerateActivity(eventName, notes, clientId, jobNumber, despatcherName) {
        const response = await this._$http.post("job/ExsalerateActivity?eventName=" + eventName + "&notes=" + notes + "&clientId=" + clientId + "&jobNumber=" + jobNumber + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * Allocates jobs to a courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} dispatcherId - The ID of the dispatcher.
     * @param {number[]} jobIds - An array of job IDs to allocate.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
    }

    /**
     * Reallocates jobs to a different courier.
     * @param {number} courierId - The ID of the new courier.
     * @param {number} dispatcherId - The ID of the dispatcher.
     * @param {number[]} jobIds - An array of job IDs to reallocate.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
    }

    /**
     * Fetches the status of a truck courier.
     * @param {number} courierId - The ID of the courier.
     * @returns {Promise<Object>} A promise that resolves with the courier status data.
     */
    async truckCourierStatus(courierId) {
        return this._$http.post("courier/TruckCourierStatus?courierId=" + courierId);
    }

    /**
     * Voids a job.
     * @param {number} jobId - The ID of the job to void.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async voidJob(jobId) {
        return this._$http.post("job/Void?jobId=" + jobId);
    }

    /**
     * Processes an uncheck direct operation for a job.
     * @param {number} jobId - The ID of the job.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {number} staffId - The ID of the staff member.
     * @param {number} currentSpeed - The current speed of the job.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        const response = await this._$http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed);
        return response.data;
    }

    /**
     * Restores jobs to a courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} dispatcherId - The ID of the dispatcher.
     * @param {number[]} jobIds - An array of job IDs to restore.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * Restores split jobs to a courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} dispatcherId - The ID of the dispatcher.
     * @param {number[]} jobIds - An array of job IDs to restore.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * Resends selected jobs.
     * @param {number[]} jobIds - An array of job IDs to resend.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async resendJobs(jobIds) {
        const response = await this._$http.post("job/ResendSelected?jobIds=" + jobIds);
        return response.data;
    }

    /**
     * Resends all jobs for a courier.
     * @param {number} courierId - The ID of the courier.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async resendAllJobs(courierId) {
        const response = await this._$http.post("job/ResendAll?courierId=" + courierId);
        return response.data;
    }

    /**
     * Sends a POD (Proof of Delivery) for a job.
     * @param {number} jobId - The ID of the job.
     * @param {string} email - The email address to send the POD to.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async sendPOD(jobId, email) {
        const response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return response.data;
    }

    /**
     * Sends an SMS to a courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} staffId - The ID of the staff member sending the SMS.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {string} message - The SMS message content.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        const response = await this._$http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message);
        return response.data;
    }

    /**
     * Retrieves details of a specific job.
     * @param {number} jobId - The ID of the job.
     * @returns {Promise<Object>} A promise that resolves with the job details.
     */
    async getJobDetail(jobId) {
        const response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return response.data;
    }

    /**
     * Retrieves related jobs for a given parent job and client.
     * @param {number} parentId - The ID of the parent job.
     * @param {number} clientId - The ID of the client.
     * @returns {Promise<Object>} A promise that resolves with the related jobs data.
     */
    async getRelatedJobs(parentId, clientId) {
        const response = await this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return response.data;
    }

    /**
     * Retrieves grouped jobs data.
     * @returns {Promise<Object>} A promise that resolves with the grouped jobs data.
     */
    getJobsGrouped() {
        return this._$http.get("app/components/home/api/jobsGroupedList.json").then(response => response.data);
    }

    /**
     * Retrieves current jobs for a specific courier.
     * @param {string} courierId - The ID of the courier.
     * @param {boolean} done - Indicates whether to retrieve completed jobs.
     * @returns {Promise<Object>} A promise that resolves with the current jobs data.
     */
    async getJobsCurrent(courierId, done) {
        const response = await this._$http.get("job/current?courierId=" + courierId + "&done=" + done);
        return response.data;
    }

    /**
     * Retrieves picked couriers data.
     * @returns {Promise<Object>} A promise that resolves with the picked couriers data.
     */
    async getCouriersPicked() {
        const response = await this._$http.get("app/components/home/api/couriersPicked.json");
        return response.data;
    }

    /**
     * Retrieves through couriers data.
     * @returns {Promise<Object>} A promise that resolves with the through couriers data.
     */
    async getCouriersThrough() {
        const response = await this._$http.get("app/components/home/api/couriersThrough.json");
        return response.data;
    }

    /**
     * Retrieves clear couriers data.
     * @returns {Promise<Object>} A promise that resolves with the clear couriers data.
     */
    async getCouriersClear() {
        const response = await this._$http.get("app/components/home/api/couriersClear.json");
        return response.data;
    }

    /**
     * Retrieves the area list.
     * @returns {Promise<Object>} A promise that resolves with the area list data.
     */
    async getAreaList() {
        const response = await this._$http.get("app/components/home/api/areaList.json");
        return response.data;
    }

    /**
     * Retrieves support data for a specific channel.
     * @param {string} channel - The channel to retrieve support data for.
     * @returns {Promise<Object>} A promise that resolves with the support data.
     */
    async getSupports(channel) {
        const response = await this._$http.get("job/supports?channel=" + channel);
        return response.data;
    }

    /**
     * Closes a support ticket.
     * @param {number} supportId - The ID of the support ticket.
     * @param {number} staffId - The ID of the staff member closing the ticket.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async closeSupport(supportId, staffId) {
        return this._$http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId);
    }

    /**
     * Locks a support ticket.
     * @param {number} supportId - The ID of the support ticket.
     * @param {string} dispatcher - The name of the dispatcher locking the ticket.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async lockSupport(supportId, dispatcher) {
        return this._$http.post("job/LockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
    }

    /**
     * Unlocks a support ticket.
     * @param {number} supportId - The ID of the support ticket.
     * @param {string} dispatcher - The name of the dispatcher unlocking the ticket.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async unLockSupport(supportId, dispatcher) {
        return this._$http.post("job/UnLockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
    }

    /**
     * Retrieves late calls data.
     * @returns {Promise<Object>} A promise that resolves with the late calls data.
     */
    async getLateCalls() {
        const response = await this._$http.get("app/components/home/api/lateCalls.json");
        return response.data;
    }

    /**
     * Retrieves clear lists data.
     * @returns {Promise<Object>} A promise that resolves with the clear lists data.
     */
    async getClearLists() {
        const response = await this._$http.get("courier");
        return response.data;
    }

    /**
     * Retrieves clear list envelope data for a specific clear list.
     * @param {number} clearListId - The ID of the clear list.
     * @returns {Promise<Object>} A promise that resolves with the clear list envelope data.
     */
    async getClearListEnvelope(clearListId) {
        const response = await this._$http.get("courier/ClearListEnvelope?clearListId=" + clearListId);
        return response.data;
    }

    /**
     * Retrieves active couriers data.
     * @returns {Promise<Object>} A promise that resolves with the active couriers data.
     */
    async getActiveCouriers() {
        const response = await this._$http.get("courier/active");
        return response.data;
    }

    /**
     * Retrieves active clients data.
     * @returns {Promise<Object>} A promise that resolves with the active clients data.
     */
    async getActiveClients() {
        const response = await this._$http.get("home/ActiveClients");
        return response.data;
    }

    /**
     * Retrieves client contacts for a specific contact.
     * @param {number} contactId - The ID of the contact.
     * @returns {Promise<Object>} A promise that resolves with the client contacts data.
     */
    async getClientContacts(contactId) {
        const response = await this._$http.get("home/ClientContacts?contactId=" + contactId);
        return response.data;
    }

    /**
     * Retrieves potential couriers for a specific job.
     * @param {number} jobId - The ID of the job.
     * @returns {Promise<Object>} A promise that resolves with the potential couriers data.
     */
    async getPotentialCouriers(jobId) {
        const response = await this._$http.get("courier/PotentialCouriers?jobId=" + jobId);
        return response.data;
    }

    /**
     * Retrieves the position of a courier.
     * @param {string} code - The courier's code.
     * @returns {Promise<Object>} A promise that resolves with the courier's position data.
     */
    async getCourierPosition(code) {
        const response = await this._$http.get("courier/location?code=" + code);
        return response.data;
    }

    /**
     * Retrieves available courier locations within a specified area.
     * @param {number} minLng - The minimum longitude of the area.
     * @param {number} minLat - The minimum latitude of the area.
     * @param {number} maxLng - The maximum longitude of the area.
     * @param {number} maxLat - The maximum latitude of the area.
     * @returns {Promise<Object>} A promise that resolves with the available courier locations data.
     */
    async getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        const response = await this._$http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat);
        return response.data;
    }

    /**
     * Retrieves the suburb list.
     * @returns {Promise<Object>} A promise that resolves with the suburb list data.
     */
    async getSuburbList() {
        const response = await this._$http.get("job/SuburbList");
        return response.data;
    }

    /**
     * Retrieves the speed list.
     * @returns {Promise<Object>} A promise that resolves with the speed list data.
     */
    async getSpeedList() {
        const response = await this._$http.get("job/SpeedList");
        return response.data;
    }

    /**
     * Retrieves the leave list.
     * @returns {Promise<Object>} A promise that resolves with the leave list data.
     */
    async getLeaveList() {
        const response = await this._$http.get("job/LeaveList");
        return response.data;
    }

    /**
     * Retrieves the undeliverable list.
     * @returns {Promise<Object>} A promise that resolves with the undeliverable list data.
     */
    async getUndeliverableList() {
        const response = await this._$http.get("job/UndeliverableList");
        return response.data;
    }

    /**
     * Retrieves a summary of truck items for a specific job.
     * @param {number} jobId - The ID of the job.
     * @param {number} truckWeightLimit - The weight limit of the truck.
     * @returns {Promise<Object>} A promise that resolves with the truck items summary data.
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        const response = await this._$http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit);
        return response.data;
    }

    /**
     * Records a late call for a job.
     * @param {string} lateType - The type of late call.
     * @param {string} lateTime - The time of the late call.
     * @param {string} minutes - The number of minutes late.
     * @param {number|string} pickupTime - The pickup time.
     * @param {number|string} alertLatePickup - The alert time for late pickup.
     * @param {number|string} deliveryTime - The delivery time.
     * @param {number|string} alertLateDelivery - The alert time for late delivery.
     * @param {string} jobNo - The job number.
     * @param {number} clientId - The client ID.
     * @param {string} contact - The contact information.
     * @param {number} staffId - The staff ID.
     * @param {string} jobTime - The job time.
     * @param {string} jobId - The job ID.
     * @param {number} jobType - The job type.
     * @param {*} bookedSpeed - The booked speed.
     * @param {*} notifiedSpeed - The notified speed.
     * @param {string} despatcherName - The name of the dispatcher.
     * @param {string} calc - Calculation required flag.
     * @returns {Promise<Object>} A promise that resolves with the response data.
     */
    async lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calc) {
        const response = await this._$http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup + "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed + "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc);
        return response.data;
    }

    /**
     * Rates a truck job.
     * @param {number} clientId - The client ID.
     * @param {number} fromId - The origin ID.
     * @param {number} toId - The destination ID.
     * @param {number} weight - The weight of the items.
     * @param {number} size - The size of the items.
     * @param {number} speed - The speed of delivery.
     * @param {number} qty - The quantity of items.
     * @param {Date} bookedDate - The booked date.
     * @param {*} pickUp - Pickup details.
     * @param {*} dropOff - Drop-off details.
     * @param {*} privateRes - Private residence flag.
     * @param {*} oversizeItems - Oversize items flag.
     * @param {*} overWeightItems - Overweight items flag.
     * @param {number} dGClass - Dangerous goods class.
     * @param {*} truckStartTime - Truck start time.
     * @param {*} truckHours - Truck hours.
     * @returns {Promise<Object>} A promise that resolves with the rating data.
     */
    async rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        const response = await this._$http.get("job/RateTruckJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} fromId
     * @param {number} toId
     * @param {number} speed
     * @param {boolean} pedal
     * @param {boolean} van
     * @param {boolean} returnJob
     * @param {number} weight
     * @param {number} size
     * @param {boolean} includeFuelSurcharge
     * @param {boolean} direct
     * @param {number} acceptedJobTypeId
     * @param {string} ourRef
     * @param {string} refA
     * @param {string} refB
     * @param {Array|String} quantity
     * @param {Date} booked
     */
    async rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        const response = await this._$http.get("job/RateJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        const response = await this._$http.get("job/PPDExclusiveAmount?clientId=" + clientId + "&amount=" + amount);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        return this._$http.post("job/splitJob?jobId=" + jobId + "&despatcherName=" + despatcherName);
    }

    /**
     * @param {number} jobId
     */
    async reRateSplitJob(jobId) {
        return this._$http.post("job/ReRateSplitJob?jobId=" + jobId);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {boolean} cbd
     * @param {number} rate
     * @param {string} despatcherName
     * @param {boolean} prebook
     */
    async updateDeliveryAddress(jobId, toSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
        return this._$http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} fromSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {boolean} cbd
     * @param {number} rate
     * @param {string} despatcherName
     * @param {boolean} prebook
     */
    async updatePickupAddress(jobId, fromSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
        return this._$http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {string} jobId
     * @param {string} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return this._$http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng);
    }

    /**
     * @param {number} jobId
     * @param {string} field
     * @param {string} value
     * @param {string} rate
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {boolean} preBook
     */
    async updateJobDetail(jobId, field, value, rate, despatcherName, staffId, preBook) {
        if (field === "Time" || field === "CompletedTime") {
            value = this._moment().format("YYYY-MM-DD") + " " + this._moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this._moment(value).format("YYYY-MM-DD");
        }
        const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
        return this._$http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
    }

    async doAPI(data) {
        const response = await this._$http.post("app/components/home/api/api.php", data);
        return response.data;
    }

    /**
     * Fetches nationwide jobs based on specified criteria.
     * @param {string} endpoint - The API endpoint to use.
     * @param {Object} queryParams - Query parameters for filtering jobs.
     * @param {string[]} selectedClients - Array of selected client IDs.
     * @param {boolean} internal - Indicates if this is an internal query.
     * @param {Array} selectedAreas - Array of selected area objects or IDs.
     * @returns {Promise<Object>} A promise that resolves with the job data.
     */
    async getNationwideJobs(endpoint, queryParams, selectedClients, internal, selectedAreas) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const params = new URLSearchParams({
            status: queryParams.status || 'all',
            order: queryParams.order || 'time',
            asc: queryParams.asc || 'asc',
            isInternal: internal.toString(),
            cid: ContactID,
            clientIds: selectedClients.join(',')
        });

        despatchViewIds.forEach(id => {
            params.append('despatchViewIds', id.toString());
        });

        const url = `nationwidejob/${endpoint}?${params.toString()}`;
        const response = await this._$http.get(url);
        return response.data;
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
     */
    getNationwideJobsNew(queryParams, selectedClients, internal, selectedAreas) {
        return this.getNationwideJobs('nationwideJobListNew', queryParams, selectedClients, internal, selectedAreas);
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
     */
    getNationwideJobsPOD(queryParams, selectedClients, internal, selectedAreas) {
        return this.getNationwideJobs('nationwideJobListPOD', queryParams, selectedClients, internal, selectedAreas);
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
     */
    getNationwideJobsBookDelivery(queryParams, selectedClients, internal, selectedAreas) {
        return this.getNationwideJobs('nationwideJobListBookDelivery', queryParams, selectedClients, internal, selectedAreas);
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
     */
    getNationwideJobsReprice(queryParams, selectedClients, internal, selectedAreas) {
        return this.getNationwideJobs('nationwideJobListReprice', queryParams, selectedClients, internal, selectedAreas);
    }

    async getEventTypes() {
        const response = await this._$http.get("job/EventTypeList");
        return response.data;
    }

    /**
     * Fetches flight options for a specific job. Optionally can specify departure date
     * @param {number} jobId - The ID of the job
     * @param {Date|Null} departureDate - The date of departure.
     * @throws {Error} If the API request fails or returns an unexpected response.
     */
    async getFlightOptions(jobId, departureDate) {
        const formattedDate = departureDate ? this._moment(departureDate).format('YYYY-MM-DD') : null;

        const response = await this._$http.get('nationwideJob/GetScheduledFlightOptions', {
            params: {
                departureDate: formattedDate,
                jobId: jobId,
            }
        });

        return {
            flights: response.data,
            message: response.data.length === 0 ? 'Sorry, we couldn\'t find any flights between these airports on the selected date. Please try different dates or airports.' : null
        };
    }

    /**
     * Adds the flight to the JobNationwide table to keep a record
     * @param {number} jobId - The ID of the job
     * @param {string} flightNumber - The flight number
     * @param {Date} departureDate - The date of departure.
     * @throws {Error} If the API request fails or returns an unexpected response.
     */
    async assignFlightToJob(jobId, flightNumber, departureDate) {
        try {
            const formattedDate = departureDate ? this._moment(departureDate).format('YYYY-MM-DD') : null;

            const response = await this._$http.post('nationwideJob/AssignFlightToJob', {
                jobId: jobId,
                flightNumber: flightNumber,
                departureDate: formattedDate,
            });

            return response.data;
        } catch (error) {
            console.error('Error assigning flight to job:', error);
        }
    }

    /**
     * @param {Array} selectedAreas
     * @returns {Array}
     * @private
     */
    _prepareViewIdsForRequest(selectedAreas) {
        return selectedAreas.map(area => {
            const id = typeof area === 'object' && area.id ? area.id : area;
            return parseInt(id, 10); // Convert to integer
        });
    }
}

angular.module('uDispatch').service('NWData', ['$http', 'moment', ($http, moment) => new NationwideService($http, moment)]);
