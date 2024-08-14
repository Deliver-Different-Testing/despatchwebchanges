class DispatchData {
    static $inject = ["$http", "moment"];

    constructor($http, moment) {
        this._$http = $http;
        this.moment = moment;
    }

    /**
     * @param {number} jobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
        return await this._$http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName);
    }

    /**
     * @param {number} bulkJobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        return await this._$http.post("job/AddBulkJobNote?BulkJobId=" + bulkJobId + "&note=" + note + "&despatcher=" + despatcherName);
    }

    /**
     * @param {{}} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * @param {{}} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * @param {{}} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async deletePallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return response.data;
    }

    /**
     * @param {string} jobNo
     * @param {number} clientId
     * @param {*} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        let response = await this._$http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * Sends a request to add a restore event for a specific job.
     *
     * @param {string} jobNo - The number identifier of the job.
     * @param {number} clientId - The identifier of the client.
     * @param {string} contact - Contact related to the event.
     * @param {number} staffId - The identifier of the staff member involved.
     * @param {number} courierId - The identifier of the courier.
     * @param {number} jobId - The identifier of the job.
     * @param {string} jobType - The type of the job.
     * @param {string} despatcherName - The name of the despatcher.
     */
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        let response = await this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * Sends a request to add a price suburb change event for a specific job.
     *
     * @param {string} jobNo - The number identifier of the job.
     * @param {number} clientId - The identifier of the client.
     * @param {string} contact - Contact related to the event.
     * @param {number} staffId - The identifier of the staff member involved.
     * @param {number} courierId - The identifier of the courier.
     * @param {number} jobId - The identifier of the job.
     * @param {string} jobType - The type of the job.
     * @param {string} despatcherName - The name of the despatcher.
     */
    async addPriceSuburbChangeEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        let response = await this._$http.post("job/addPriceSuburbChangeEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return response.data;
    }

    /**
     * @param {string} jobNo
     * @param {number} clientId
     * @param {*} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     * @param {string} notes
     */
    async addOtherEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
        let response = await this._$http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispId, jobIds) {
        return await this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
    }

    /**
     * @param {$scope.currentCourier.courierID|string} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispId, jobIds) {
        return await this._$http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number} jobId
     */
    async transferJob(courierId, dispId, jobId) {
        return await this._$http.post("job/Transfer?jobId=" + jobId + "&courierId=" + courierId + "&dispId=" + dispId);
    }

    /**
     * @param {number} jobId
     * @param {number} courierId
     */
    async setFirstJob(jobId, courierId) {
        return await this._$http.post("job/SetFirstJob?jobId=" + jobId + "&courierId=" + courierId);
    }

    /**
     * @param {number} courierId
     */
    async truckCourierStatus(courierId) {
        return await this._$http.post("courier/TruckCourierStatus?courierId=" + courierId);
    }

    /**
     * @param {string} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        let response = await this._$http.post('Job/ValidateSwapPOD?job=' + jobNumber);
        return response.data;
    }

    /**
     * @param {string} job1
     * @param {string} job2
     */
    async swapPOD(job1, job2) {
        let response = await this._$http.post('Job/SwapPOD?job1=' + job1 + '&job2=' + job2);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async voidJob(jobId) {
        return await this._$http.post("job/Void?jobId=" + jobId);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {*} currentSpeed
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        let response = await this._$http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispId, jobIds) {
        let response = await this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispId, jobIds) {
        let response = await this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async resendJobs(jobIds) {
        let response = await this._$http.post("job/ResendSelected?jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     */
    async resendAllJobs(courierId) {
        let response = await this._$http.post("job/ResendAll?courierId=" + courierId);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reAssignJobs(jobIds) {
        let response = await this._$http.post("job/ReAssignSelected?jobIds=" + jobIds);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        let response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} speedId
     */
    async hasClientItemsAvailable(clientId, speedId) {
        let response = await this._$http.get('job/HasClientItemsAvailable?clientId=' + clientId + '&speedId=' + speedId);
        return response.data;
    }

    async getJobs() {
        let response = await this._$http.get("app/components/home/api/jobsList.php");
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        let response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        let response = await this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return response.data;
    }

    async getJobsGrouped() {
        let response = await this._$http.get("app/components/home/api/jobsGroupedList.json");
        return response.data;

    }

    /**
     * @param {number} courierId
     * @param {boolean} done
     */
    async getJobsCurrent(courierId, done) {
        let response = await this._$http.get("job/current?courierId=" + courierId + "&done=" + done);
        return response.data;
    }

    async getCouriersPicked() {
        let response = await this._$http.get("app/components/home/api/couriersPicked.json");
        return response.data;

    }

    async getCouriersThrough() {
        let response = await this._$http.get("app/components/home/api/couriersThrough.json");
        return response.data;
    }

    async getCouriersClear() {
        let response = await this._$http.get("app/components/home/api/couriersClear.json");
        return response.data;

    }

    async getAreaList() {
        let response = await this._$http.get("app/components/home/api/areaList.json");
        return response.data;
    }

    async getJobUpdates() {
        let response = await this._$http.get("app/components/home/api/jobUpdates.json");
        return response.data;

    }

    /**
     * @param {string} channel
     */
    async getSupports(channel) {
        let response = await this._$http.get("job/supports?channel=" + channel);
        return response.data;

    }

    /**
     * Closes the support request with the provided supportId and marks it closed by the provided staffId.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {number} staffId - The unique identifier of the staff member marking the request as closed.
     */
    async closeSupport(supportId, staffId) {
        return await this._$http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId);
    }

    /**
     * Locks a support request with the provided id and locks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcher - The unique identifier of the dispatcher locking the request.
     */
    async lockSupport(supportId, dispatcher) {
        return await this._$http.post("job/LockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
    }

    /**
     * Unlocks a support request with the provided id and unlocks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcher - The unique identifier of the dispatcher unlocking the request.
     */
    async unLockSupport(supportId, dispatcher) {
        return await this._$http.post("job/UnLockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
    }

    async getLateCalls() {
        let response = await this._$http.get("app/components/home/api/lateCalls.json");
        return response.data;
    }

    async getClearLists() {
        let response = await this._$http.get("courier");
        return response.data;

    }

    /**
     * @param {number} clearListId
     */
    async getClearListEnvelope(clearListId) {
        let response = await this._$http.get("courier/ClearListEnvelope?clearListId=" + clearListId);
        return response.data;
    }

    async getActiveCouriers() {
        let response = await this._$http.get("courier/active");
        return response.data;
    }

    async getAllCouriers() {
        let response = await this._$http.get("courier/AllActive");
        return response.data;
    }

    async getActiveClients() {
        let response = await this._$http.get("home/ActiveClients");
        return response.data;
    }

    /**
     * @param {number} contactId
     */
    async getClientContacts(contactId) {
        let response = await this._$http.get("home/ClientContacts?contactId=" + contactId);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getPotentialCouriers(jobId) {
        let response = await this._$http.get("courier/PotentialCouriers?jobId=" + jobId);
        return response.data;
    }

    /**
     * @param {string} code
     */
    async getCourierPosition(code) {
        let response = await this._$http.get("courier/location?code=" + code);
        return response.data;

    }

    /**
     * Retrieves the available courier location within a geographical boundary.
     *
     * @param {number} minLng - The minimum longitude of the boundary.
     * @param {number} minLat - The minimum latitude of the boundary.
     * @param {number} maxLng - The maximum longitude of the boundary.
     * @param {number} maxLat - The maximum latitude of the boundary.
     */
    async getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        let response = await this._$http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat);
        return response.data;
    }

    async getSuburbList() {
        let response = await this._$http.get("job/SuburbList");
        return response.data;
    }

    async getSpeedList() {
        let response = await this._$http.get("job/SpeedList");
        return response.data;
    }

    /**
     * Retrieves the contact list for the client with the provided clientId.
     *
     * @param {number} clientId - The unique identifier of the client.
     */
    async getContactList(clientId) {
        let response = await this._$http.get("job/ContactList?clientId=" + clientId);
        return response.data;
    }

    /**
     * Retrieves the detailed contact list for the client with the provided clientId.
     *
     * @param {number} clientId - The unique identifier of the client.
     */
    async getContactDetailList(clientId) {
        let response = await this._$http.get("job/ContactDetailList?clientId=" + clientId);
        return response.data;
    }

    async getLeaveList() {
        let response = await this._$http.get("job/LeaveList");
        return response.data;
    }

    async getUndeliverableList() {
        let response = await this._$http.get("job/UndeliverableList");
        return response.data;
    }

    async getInternalStatusList() {
        let response = await this._$http.get("job/InternalStatusList");
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {number} truckWeightLimit
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        let response = await this._$http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit);
        return response.data;
    }

    /**
     * @param {number} lateType
     * @param {number} lateTime
     * @param {number} minutes
     * @param {number} pickupTime
     * @param {number} alertLatePickup
     * @param {number} deliveryTime
     * @param {number} alertLateDelivery
     * @param {string} jobNo
     * @param {number} clientId
     * @param {string} contact
     * @param {number} staffId
     * @param {Date} jobTime
     * @param {number} jobId
     * @param {number} jobType
     * @param {number} bookedSpeed
     * @param {number} notifiedSpeed
     * @param {string} despatcherName
     * @param {boolean} calc
     */
    async lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calc) {
        let response = await this._$http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup + "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed + "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} fromId
     * @param {number} toId
     * @param {number} weight
     * @param {number} size
     * @param {number} speed
     * @param {number} qty
     * @param {Date} bookedDate
     * @param {number} pickUp
     * @param {number} dropOff
     * @param {boolean} privateRes
     * @param {number} oversizeItems
     * @param {number} overWeightItems
     * @param {number} dGClass
     * @param {Date} truckStartTime
     * @param {number} truckHours
     */
    async rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        let response = await this._$http.get("job/RateTruckJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours);
        return response.data;
    }

    /**
     * @param {number} cid
     * @param {number} fromId
     * @param {number} toId
     * @param {number} weight
     * @param {number} size
     * @param {number} speed
     * @param {number} qty
     * @param {Date} bookedDate
     * @param {number} pickUp
     * @param {number} dropOff
     * @param {boolean} privateRes
     * @param {number} oversizeItems
     * @param {number} overWeightItems
     * @param {number} dGClass
     * @param {Date} truckStartTime
     * @param {number} truckHours
     * @param {number} gstRate
     */
    async truckJobAmountBreakdown(cid, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours, gstRate) {
        let response = await this._$http.get("job/TruckJobAmountBreakdown?clientId=" + cid + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours + "&gstRate=" + gstRate);
        return response.data;
    }

    async rateJob(cid, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        let response = await this._$http.get("job/RateJob?clientId=" + cid + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked);
        return response.data;
    }

    async jobAmountBreakdown(cid, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked, gstRate, amount) {
        let response = await this._$http.get("job/JobAmountBreakdown?clientId=" + cid + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked + "&gstRate=" + gstRate + "&amount=" + amount);
        return response.data;
    }

    /**
     * @param {number} cid
     * @param {number} amount
     */
    async ppdExclusiveAmount(cid, amount) {
        let response = await this._$http.get("job/PPDExclusiveAmount?clientId=" + cid + "&amount=" + amount);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        return await this._$http.post("job/splitJob?jobId=" + jobId + "&despatcherName=" + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async finishSplitJobProcess(jobId, despatcherName) {
        return await this._$http.post("job/finishSplitJobProcess?jobId=" + jobId + "&despatcherName=" + despatcherName);
    }

    /**
     * @param {string} jobNumber
     * @param {number|string} jobStatus
     * @param {string} podName
     * @param {Date} podTime
     */
    async updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        return await this._$http.post("job/UpdatePODDetails?jobNumber=" + jobNumber + "&jobStatus=" + jobStatus + "&podName=" + podName + "&podTime=" + podTime);
    }

    /**
     * @param {number} courierId
     * @param {number} staffId
     * @param {string} despatcherName
     * @param {string} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        let response = await this._$http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async reRateSplitJob(jobId) {
        return await this._$http.post("job/ReRateSplitJob?jobId=" + jobId);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {boolean} cbd
     * @param {string|*} rate
     * @param {string} despatcherName
     * @param {boolean} prebook
     */
    async updateDeliveryAddress(jobId, toSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
        return await this._$http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} bulkJobId
     * @param {number} toSuburb
     * @param {string|number} toPostCode
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {string} despatcherName
     */
    async updateBulkDeliveryAddress(bulkJobId, toSuburb, toPostCode, address, lat, lng, despatcherName) {
        return await this._$http.post("job/UpdateBulkDeliveryAddress?bulkJobId=" + bulkJobId + "&toSuburb=" + toSuburb + "&toPostCode=" + toPostCode + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + '&despatcherName=' + despatcherName);
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
        return await this._$http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} bulkJobId
     * @param {number} fromSuburb
     * @param {number} fromPostCode
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {string} despatcherName
     */
    async updateBulkPickupAddress(bulkJobId, fromSuburb, fromPostCode, address, lat, lng, despatcherName) {
        return await this._$http.post("job/UpdateBulkPickupAddress?bulkJobId=" + bulkJobId + "&fromSuburb=" + fromSuburb + "&fromPostCode=" + fromPostCode + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async updateJobType(jobId, jobType, despatcherName) {
        return await this._$http.post("job/UpdateJobType?jobId=" + jobId + "&jobType=" + jobType + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return await this._$http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng);
    }

    /**
     * @param {number} jobNumber
     * @param {Date} bookDate
     */
    async releaseBulkJob(jobNumber, bookDate) {
        const dt = this.moment(bookDate).format("YYYY-MM-DD");
        return await this._$http.post("job/ReleaseBulkJob?jobNumber=" + jobNumber + "&bookDate=" + dt);
    }

    /**
     * @param {number} jobId
     * @param {string} field
     * @param {string|Date|number} value
     * @param {number} rate
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {boolean} preBook
     */
    async updateJobDetail(jobId, field, value, rate, despatcherName, staffId, preBook) {
        if (field === "Time" || field === "CompletedTime") {
            value = this.moment().format("YYYY-MM-DD") + " " + this.moment(value).format("HH:mm:ss");
        }
        if (field === "FollowupTime") {
            value = this.moment(value).format("YYYY-MM-DD") + " " + this.moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this.moment(value).format("YYYY-MM-DD");
        }
        const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
        return await this._$http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
    }

    /**
     * @param {number} bulkJobId
     * @param {string} field
     * @param {string|number|Date} value
     * @param {number} rate
     * @param {string} despatcherName
     * @param {number} staffId
     */
    async updateBulkJobDetail(bulkJobId, field, value, rate, despatcherName, staffId) {
        if (field === "Time" || field === "CompletedTime") {
            value = this.moment().format("YYYY-MM-DD") + " " + this.moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this.moment(value).format("YYYY-MM-DD");
        }
        return await this._$http.post("job/UpdateBulkJob?bulkJobId=" + bulkJobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
    }

    async doAPI(data) {
        let response = await this._$http.post("app/components/home/api/api.php", data);
        return response.data;
    }

    /**
     * @param {*|{area: string, asc: string, status: string, order: string}} data
     * @param {*[]|string} selectedClients
     * @param {boolean|string} internal
     */
    async getJobsFilter(data, selectedClients, internal) {
        let response = await this._$http.get("job?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients);
        return response.data;
    }

    /**
     * Retrieves the auto-complete search results for the given address text from a geocoder service.
     *
     * @param {string} text - The search text for which auto-complete results are to be fetched.
     */
    async autocompleteAddressSearch(text) {
        let response = await this._$http({
            url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json', method: 'GET', params: {
                query: text, app_id: "bBPfh2x8Cauun3ygLMAx", app_code: "yjfwTdkin_R2rGXYTrwWVg", country: "NZL"
            }
        });
        return await response.data;
    }

    /**
     * @param {{text: string, id: number}} item
     */
    async getGeoCodeInformation(item) {
        let response = await this._$http.get("https://geocoder.cit.api.here.com/6.2/geocode.json", {
            params: {
                app_id: "bBPfh2x8Cauun3ygLMAx", app_code: "yjfwTdkin_R2rGXYTrwWVg", locationId: item.id
            }
        });
        return await response.data;
    }

    /**
     * Retrieves addresses based on the provided latitude and longitude.
     *
     * @param {number} lat - Latitude of the location.
     * @param {number} long - Longitude of the location.
     */
    async retrieveAddresses(lat, long) {
        let response = await this._$http.get("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
            params: {
                app_id: "bBPfh2x8Cauun3ygLMAx",
                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                mode: "retrieveAddresses",
                prox: lat.toString() + "," + long.toString() + "," + "250"
            }
        });
        return await response.data;
    }

    /**
     * Performs an async search using the provided search term and URL.
     *
     * @param {string} searchTerm - The term to search for.
     * @param {string} url - The URL to perform the search in.
     */
    async autocompleteSearch(searchTerm, url) {
        let response = await this._$http.get(url, {
            params: {
                searchTerm: searchTerm
            }
        });
        return await response.data;
    }
}

angular.module("uDispatch").factory("DispatchData", DispatchData);
