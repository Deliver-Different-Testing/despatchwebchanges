class DispatchData {
    constructor($http, moment, APP_CONFIG) {
        this._$http = $http;
        this._moment = moment;
        this._useUsFormat = APP_CONFIG.US_Customer;
    }

    /**
     * @param {number} userId
     */
    async getDespatchViews(userId) {
        const response = await this._$http.get('clearListZones/GetDespatchViews?userid=' + userId);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? 'job/AddJobBookingNote' : 'job/AddNote';
        return this._$http.post(method + '?jobId=' + jobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {number} bulkJobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        return this._$http.post('job/AddBulkJobNote?BulkJobId=' + bulkJobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/AddPallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/EditPallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async deletePallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/DeletePallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {string} jobNo
     * @param {number} clientId
     * @param {string} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post('courier/AddFollowupEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
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
        const response = await this._$http.post('job/AddRestoreEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
        return response.data;
    }

    /**
     * @param {string} jobNo
     * @param {number} clientId
     * @param {string} contact
     * @param {number} staffId
     * @param {number} courierId
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     * @param {string} notes
     */
    async addOtherEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
        const response = await this._$http.post('job/addOtherEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName + '&notes=' + notes);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post('job/Allocate?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post('job/ReAllocate?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
    }

    /**
     * @param {number} jobId
     * @param {number} courierId
     */
    async setFirstJob(jobId, courierId) {
        return this._$http.post('job/SetFirstJob?jobId=' + jobId + '&courierId=' + courierId);
    }

    /**
     * @param {number} courierId
     */
    async truckCourierStatus(courierId) {
        return this._$http.post('courier/TruckCourierStatus?courierId=' + courierId);
    }

    /**
     * @param {string} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        const response = await this._$http.post('Job/ValidateSwapPOD?job=' + jobNumber);
        return response.data;
    }

    /**
     * @param {string} jobNumber1
     * @param {string} jobNumber2
     */
    async swapPOD(jobNumber1, jobNumber2) {
        const response = await this._$http.post('Job/SwapPOD?job1=' + jobNumber1 + '&job2=' + jobNumber2);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async voidJob(jobId) {
        return this._$http.post('job/Void?jobId=' + jobId);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {string} currentSpeed
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        const response = await this._$http.post('job/ProcessUncheckDirect?jobId=' + jobId + '&despatcher=' + despatcherName + '&staffId=' + staffId + '&currentSpeed=' + currentSpeed);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post('job/RestoreJobs?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post('job/RestoreSplitJobs?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async resendJobs(jobIds) {
        const response = await this._$http.post('job/ResendSelected?jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     */
    async resendAllJobs(courierId) {
        const response = await this._$http.post('job/ResendAll?courierId=' + courierId);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reAssignJobs(jobIds) {
        const response = await this._$http.post('job/ReAssignSelected?jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        const response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} speedId
     */
    async hasClientItemsAvailable(clientId, speedId) {
        const response = await this._$http.get('job/HasClientItemsAvailable?clientId=' + clientId + '&speedId=' + speedId);
        return response.data;
    }

    async getJobs() {
        const response = await this._$http.get('app/components/home/api/jobsList.php');
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        const response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        const response = await this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return response.data;
    }

    async getJobsGrouped() {
        const response = await this._$http.get('app/components/home/api/jobsGroupedList.json');
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {boolean} done
     */
    async getJobsCurrent(courierId, done) {
        const response = await this._$http.get('job/current?courierId=' + courierId + '&done=' + done);
        return response.data;
    }

    async getCouriersPicked() {
        const response = await this._$http.get('app/components/home/api/couriersPicked.json');
        return response.data;

    }

    async getCouriersThrough() {
        const response = await this._$http.get('app/components/home/api/couriersThrough.json');
        return response.data;
    }

    async getCouriersClear() {
        const response = await this._$http.get('app/components/home/api/couriersClear.json');
        return response.data;

    }

    async getAreaList() {
        const response = await this._$http.get('app/components/home/api/areaList.json');
        return response.data;
    }

    /**
     * @param {string} channel
     */
    async getSupports(channel) {
        const response = await this._$http.get('job/supports?channel=' + channel);
        return response.data;
    }

    /**
     * Closes the support request with the provided supportId and marks it closed by the provided staffId.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {number} staffId - The unique identifier of the staff member marking the request as closed.
     */
    async closeSupport(supportId, staffId) {
        return this._$http.post('job/CloseSupport?supportId=' + supportId + '&staffId=' + staffId);
    }

    /**
     * Locks a support request with the provided id and locks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher locking the request.
     */
    async lockSupport(supportId, dispatcherName) {
        return this._$http.post('job/LockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    /**
     * Unlocks a support request with the provided id and unlocks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher unlocking the request.
     */
    async unLockSupport(supportId, dispatcherName) {
        return this._$http.post('job/UnLockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    async getLateCalls() {
        const response = await this._$http.get('app/components/home/api/lateCalls.json');
        return response.data;
    }

    /**
     * @param {Object} despatchViewIds
     */
    async getDriverLocations(despatchViewIds) {
        const query = this._prepareDespatchViewIds(despatchViewIds);

        const response = await this._$http.get('courier?' + query);
        return response.data;
    }

    /**
     * @param {number} clearListId
     */
    async getDriverDestinationEnvelope(clearListId) {
        const countryId = this._useUsFormat ? 2 : 1;

        const response = await this._$http.get('courier/ClearListEnvelope?clearListId=' + clearListId + '&countryId=' + countryId);
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this._$http.get('courier/active');
        return response.data;
    }

    async getAllCouriers() {
        const response = await this._$http.get('courier/AllActive');
        return response.data;
    }

    async getActiveClients() {
        const response = await this._$http.get('home/ActiveClients');
        return response.data;
    }

    /**
     * @param {number} contactId
     */
    async getClientContacts(contactId) {
        const response = await this._$http.get('home/ClientContacts?contactId=' + contactId);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getPotentialCouriers(jobId) {
        const response = await this._$http.get('courier/PotentialCouriers?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {string} code
     */
    async getCourierPosition(code) {
        const response = await this._$http.get('courier/location?code=' + code);
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
        const response = await this._$http.get('courier/AvailableCourierLocation?minLng=' + minLng + '&minLat=' + minLat + '&maxLng=' + maxLng + '&maxLat=' + maxLat);
        return response.data;
    }

    async getSuburbList() {
        const response = await this._$http.get('job/SuburbList');
        return response.data;
    }

    async getSpeedList() {
        const response = await this._$http.get('job/SpeedList');
        return response.data;
    }

    /**
     * Retrieves the contact list for the client with the provided clientId.
     *
     * @param {number} clientId - The unique identifier of the client.
     */
    async getContactList(clientId) {
        const response = await this._$http.get('job/ContactList?clientId=' + clientId);
        return response.data;
    }

    /**
     * Retrieves the detailed contact list for the client with the provided clientId.
     *
     * @param {number} clientId - The unique identifier of the client.
     */
    async getContactDetailList(clientId) {
        const response = await this._$http.get('job/ContactDetailList?clientId=' + clientId);
        return response.data;
    }

    async getLeaveList() {
        const response = await this._$http.get('job/LeaveList');
        return response.data;
    }

    async getUndeliverableList() {
        const response = await this._$http.get('job/UndeliverableList');
        return response.data;
    }

    async getInternalStatusList() {
        const response = await this._$http.get('job/InternalStatusList');
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {number} truckWeightLimit
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        const response = await this._$http.get('job/TruckItemsSummary?jobId=' + jobId + '&truckWeightLimit=' + truckWeightLimit);
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
     * @param {string} bookedSpeed
     * @param {string} notifiedSpeed
     * @param {string} despatcherName
     * @param {boolean} calculationRequired
     */
    async lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calculationRequired) {
        const url = 'job/LateCall';
        const data = {
            lateType,
            lateTime,
            minutes,
            pickupTime,
            alertLatePickup,
            deliveryTime,
            alertLateDelivery,
            jobNo,
            clientId,
            contact,
            staffId,
            jobTime,
            jobId,
            jobType,
            bookedSpeed,
            notifiedSpeed,
            despatcherName,
            calculationRequired
        };

        try {
            const response = await this._$http.post(url, data, {headers: {'Content-Type': 'application/json'}});
            return response.data;
        } catch (error) {
            console.error('Error in lateCall:', error);
            throw error;
        }
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
        const response = await this._$http.get('job/RateTruckJob?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&weight=' + weight + '&size=' + size + '&speed=' + speed + '&qty=' + qty + '&bookedDate=' + bookedDate + '&pickup=' + pickUp + '&dropOff=' + dropOff + '&privateRes=' + privateRes + '&oversizeItems=' + oversizeItems + '&overWeightItems=' + overWeightItems + '&dgClass=' + dGClass + '&truckStartTime=' + truckStartTime + '&truckHours=' + truckHours);
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
     * @param {number} gstRate
     */
    async truckJobAmountBreakdown(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours, gstRate) {
        const response = await this._$http.get('job/TruckJobAmountBreakdown?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&weight=' + weight + '&size=' + size + '&speed=' + speed + '&qty=' + qty + '&bookedDate=' + bookedDate + '&pickup=' + pickUp + '&dropOff=' + dropOff + '&privateRes=' + privateRes + '&oversizeItems=' + oversizeItems + '&overWeightItems=' + overWeightItems + '&dgClass=' + dGClass + '&truckStartTime=' + truckStartTime + '&truckHours=' + truckHours + '&gstRate=' + gstRate);
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
     * @param {number} quantity
     * @param {Date} booked
     */
    async rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        const response = await this._$http.get('job/RateJob?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&speed=' + speed + '&pedal=' + pedal + '&van=' + van + '&returnJob=' + returnJob + '&weight=' + weight + '&size=' + size + '&includeFuelSurcharge=' + includeFuelSurcharge + '&direct=' + direct + '&acceptedJobTypeId=' + acceptedJobTypeId + '&ourRef=' + ourRef + '&refA=' + refA + '&refB=' + refB + '&quantity=' + quantity + '&booked=' + booked);
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
     * @param {number} quantity
     * @param {Date} booked
     * @param {number} gstRate
     * @param {number} amount
     */
    async jobAmountBreakdown(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked, gstRate, amount) {
        const response = await this._$http.get('job/JobAmountBreakdown?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&speed=' + speed + '&pedal=' + pedal + '&van=' + van + '&returnJob=' + returnJob + '&weight=' + weight + '&size=' + size + '&includeFuelSurcharge=' + includeFuelSurcharge + '&direct=' + direct + '&acceptedJobTypeId=' + acceptedJobTypeId + '&ourRef=' + ourRef + '&refA=' + refA + '&refB=' + refB + '&quantity=' + quantity + '&booked=' + booked + '&gstRate=' + gstRate + '&amount=' + amount);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        const response = await this._$http.get('job/PPDExclusiveAmount?clientId=' + clientId + '&amount=' + amount);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} speedId
     * @param {number} jobId
     */
    async getServices(clientId, speedId, jobId) {
        const url = 'job/GetAllClientItems';
        const response = await this._$http.get(url + '?clientId=' + clientId + '&speedId=' + speedId + '&jobId=' + jobId);

        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {number[]} serviceIds
     * @param {number} totalCost
     */
    async addServicesToJob(jobId, serviceIds, totalCost) {
        const url = 'job/AddClientItemsToJob'

        return this._$http({
            method: 'POST', url: url + '?jobId=' + jobId, data: {serviceIds, totalCost}
        });
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        return this._$http.post('job/splitJob?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async finishSplitJobProcess(jobId, despatcherName) {
        return this._$http.post('job/finishSplitJobProcess?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {string} jobNumber
     * @param {number} jobStatus
     * @param {string} podName
     * @param {Date} podTime
     */
    async updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        return this._$http.post('job/UpdatePODDetails?jobNumber=' + jobNumber + '&jobStatus=' + jobStatus + '&podName=' + podName + '&podTime=' + podTime);
    }

    /**
     * @param {number} courierId
     * @param {number} staffId
     * @param {string} despatcherName
     * @param {string} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        const response = await this._$http.post('job/SendSMS?courierId=' + courierId + '&dispId=' + staffId + '&despatcherName=' + despatcherName + '&message=' + message);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async reRateSplitJob(jobId) {
        return this._$http.post('job/ReRateSplitJob?jobId=' + jobId);
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
        const method = prebook ? 'job/UpdateBookingDeliveryAddress' : 'job/UpdateDeliveryAddress';
        return this._$http.post(method + '?jobId=' + jobId + '&toSuburbId=' + toSuburbId + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng + '&cbd=' + cbd + '&rate=' + rate + '&despatcherName=' + despatcherName);
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
        return this._$http.post('job/UpdateBulkDeliveryAddress?bulkJobId=' + bulkJobId + '&toSuburb=' + toSuburb + '&toPostCode=' + toPostCode + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng + '&despatcherName=' + despatcherName);
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
        const method = prebook ? 'job/UpdateBookingPickupAddress' : 'job/UpdatePickupAddress';
        return this._$http.post(method + '?jobId=' + jobId + '&fromSuburbId=' + fromSuburbId + '&address=' + address + '&pickupLat=' + lat + '&pickupLng=' + lng + '&cbd=' + cbd + '&rate=' + rate + '&despatcherName=' + despatcherName);
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
        return this._$http.post('job/UpdateBulkPickupAddress?bulkJobId=' + bulkJobId + '&fromSuburb=' + fromSuburb + '&fromPostCode=' + fromPostCode + '&address=' + address + '&pickupLat=' + lat + '&pickupLng=' + lng + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async updateJobType(jobId, jobType, despatcherName) {
        return this._$http.post('job/UpdateJobType?jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return this._$http.post('job/UpdateSplitJobAddress?jobId=' + jobId + '&toSuburbId=' + toSuburbId + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng);
    }

    /**
     * @param {string} jobNumber
     * @param {Date} bookDate
     */
    async releaseBulkJob(jobNumber, bookDate) {
        const dt = this._moment(bookDate).format('YYYY-MM-DD');
        return this._$http.post('job/ReleaseBulkJob?jobNumber=' + jobNumber + '&bookDate=' + dt);
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
        if (field === 'Time' || field === 'CompletedTime') {
            value = this._moment().format('YYYY-MM-DD') + ' ' + this._moment(value).format('HH:mm:ss');
        }
        if (field === 'FollowupTime') {
            value = this._moment(value).format('YYYY-MM-DD') + ' ' + this._moment(value).format('HH:mm:ss');
        }
        if (field === 'Date' || field === 'StopDate' || field === 'RestartDate' || field === 'InActiveDate' || field === 'FirstDue' || field === 'LastDone' || field === 'NextDue') {
            value = this._moment(value).format('YYYY-MM-DD');
        }
        if (field === 'DeliverToContact') {
            field = 'ToContactName';
        }
        const method = preBook ? 'job/UpdateJobBooking' : 'job/UpdateJob';
        return this._$http.post(method + '?jobId=' + jobId + '&field=' + field + '&value=' + value + '&rate=' + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
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
        if (field === 'Time' || field === 'CompletedTime') {
            value = this._moment().format('YYYY-MM-DD') + ' ' + this._moment(value).format('HH:mm:ss');
        }
        if (field === 'Date' || field === 'StopDate' || field === 'RestartDate' || field === 'InActiveDate' || field === 'FirstDue' || field === 'LastDone' || field === 'NextDue') {
            value = this._moment(value).format('YYYY-MM-DD');
        }
        return this._$http.post('job/UpdateBulkJob?bulkJobId=' + bulkJobId + '&field=' + field + '&value=' + value + '&rate=' + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
    }

    async doAPI(data) {
        const response = await this._$http.post('app/components/home/api/api.php', data);
        return response.data;
    }

    /**
     * @param {*|{area: string, asc: string, status: string, order: string}} data
     * @param {*[]|string} selectedClients
     * @param {boolean} internal
     * @param {Object} despatchViewIds
     */
    async getJobsFilter(data, selectedClients, internal, despatchViewIds) {
        const query = this._prepareDespatchViewIds(despatchViewIds);

        const response = await this._$http.get('job?status=' + data.status + '&area=' + data.area + '&order=' + data.order + '&asc=' + data.asc + '&isInternal=' + internal + '&cid=' + ContactID + '&clientIds=' + selectedClients + '&' + query);
        return response.data;
    }

    /**
     * Retrieves the auto-complete search results for the given address text from a geocoder service.
     *
     * @param {string} text - The search text for which auto-complete results are to be fetched.
     */
    async autocompleteAddressSearch(text) {
        const response = await this._$http({
            url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json', method: 'GET', params: {
                query: text,
                app_id: 'bBPfh2x8Cauun3ygLMAx',
                app_code: 'yjfwTdkin_R2rGXYTrwWVg',
                country: this._useUsFormat ? 'USA' : 'NZL'
            }
        });
        return response.data;
    }

    /**
     * @param {{text: string, id: number}} item
     */
    async getGeoCodeInformation(item) {
        const response = await this._$http.get('https://geocoder.cit.api.here.com/6.2/geocode.json', {
            params: {
                app_id: 'bBPfh2x8Cauun3ygLMAx', app_code: 'yjfwTdkin_R2rGXYTrwWVg', locationId: item.id
            }
        });
        return response.data;
    }

    /**
     * Retrieves addresses based on the provided latitude and longitude.
     *
     * @param {number} lat - Latitude of the location.
     * @param {number} long - Longitude of the location.
     */
    async retrieveAddresses(lat, long) {
        const response = await this._$http.get('https://reverse.geocoder.api.here.com/6.2/reversegeocode.json', {
            params: {
                app_id: 'bBPfh2x8Cauun3ygLMAx',
                app_code: 'yjfwTdkin_R2rGXYTrwWVg',
                mode: 'retrieveAddresses',
                prox: lat.toString() + ',' + long.toString() + ',' + '250'
            }
        });
        return response.data;
    }

    /**
     * Performs an async search using the provided search term and URL.
     *
     * @param {string} searchTerm - The term to search for.
     * @param {string} url - The URL to perform the search in.
     */
    async autocompleteSearch(searchTerm, url) {
        const response = await this._$http.get(url, {
            params: {
                searchTerm: searchTerm
            }
        });
        return response.data;
    }

    /**
     * Checks if job has any attached files
     *
     * @param {number} jobId
     */
    async isFilesAttachedToJob(jobId) {
        const response = await this._$http.get(`job/IsFilesAttachedToJob/${jobId}`);
        return response.data;
    }

    /**
     * @param {Object} despatchViewIds
     * @returns {string}
     */
    _prepareDespatchViewIds(despatchViewIds) {
        // Extract the IDs that are set to true
        const selectedIds = Object.keys(despatchViewIds).filter(key => despatchViewIds[key] === true && !isNaN(parseInt(key)));

        // Create the query string
        return selectedIds.map(id => 'despatchViewIds=' + id).join('&');
    }
}

angular.module('uDispatch').service('DispatchData', ['$http', 'moment', 'APP_CONFIG', ($http, moment, APP_CONFIG) => new DispatchData($http, moment, APP_CONFIG)]);
