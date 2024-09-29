class DispatchData {
    constructor($http, moment, APP_CONFIG) {
        this._$http = $http;
        this._moment = moment;
        this._useUsFormat = APP_CONFIG.US_Customer;
    }

    /**
     * @param {Number} userId
     * @param {Number} pageId
     */
    async getDespatchViews(userId, pageId) {
        const response = await this._$http.get('DfrntViews/GetPageViews?userid=' + userId + '&pageid=' + pageId);
        return response.data;
    }

    /**
     * @param {Number} jobId
     * @param {String} note
     * @param {String} despatcherName
     * @param {Boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? 'job/AddJobBookingNote' : 'job/AddNote';
        return this._$http.post(method + '?jobId=' + jobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {Number} bulkJobId
     * @param {String} note
     * @param {String} despatcherName
     * @param {Boolean} preBook
     */
    async addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        return this._$http.post('job/AddBulkJobNote?BulkJobId=' + bulkJobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/AddPallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/EditPallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async deletePallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: 'job/DeletePallet?preBook=' + preBook + '&despatcher=' + despatcherName, method: 'POST', data: pallet
        });
        return response.data;
    }

    /**
     * @param {String} jobNo
     * @param {Number} clientId
     * @param {String} contact
     * @param {Number} staffId
     * @param {Number} courierId
     * @param {Number} jobId
     * @param {Number} jobType
     * @param {String} despatcherName
     */
    async addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post('courier/AddFollowupEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
        return response.data;
    }

    /**
     * Sends a request to add a restore event for a specific job.
     *
     * @param {String} jobNo - The number identifier of the job.
     * @param {Number} clientId - The identifier of the client.
     * @param {String} contact - Contact related to the event.
     * @param {Number} staffId - The identifier of the staff member involved.
     * @param {Number} courierId - The identifier of the courier.
     * @param {Number} jobId - The identifier of the job.
     * @param {String} jobType - The type of the job.
     * @param {String} despatcherName - The name of the despatcher.
     */
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post('job/AddRestoreEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
        return response.data;
    }

    /**
     * @param {String} jobNo
     * @param {Number} clientId
     * @param {String} contact
     * @param {Number} staffId
     * @param {Number} courierId
     * @param {Number} jobId
     * @param {Number} jobType
     * @param {String} despatcherName
     * @param {String} notes
     */
    async addOtherEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
        const response = await this._$http.post('job/addOtherEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName + '&notes=' + notes);
        return response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post('job/Allocate?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post('job/ReAllocate?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
    }

    /**
     * @param {Number} jobId
     * @param {Number} courierId
     */
    async setFirstJob(jobId, courierId) {
        return this._$http.post('job/SetFirstJob?jobId=' + jobId + '&courierId=' + courierId);
    }

    /**
     * @param {Number} courierId
     */
    async truckCourierStatus(courierId) {
        return this._$http.post('courier/TruckCourierStatus?courierId=' + courierId);
    }

    /**
     * @param {String} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        const response = await this._$http.post('Job/ValidateSwapPOD?job=' + jobNumber);
        return response.data;
    }

    /**
     * @param {String} jobNumber1
     * @param {String} jobNumber2
     */
    async swapPOD(jobNumber1, jobNumber2) {
        const response = await this._$http.post('Job/SwapPOD?job1=' + jobNumber1 + '&job2=' + jobNumber2);
        return response.data;
    }

    /**
     * @param {Number} jobId
     */
    async voidJob(jobId) {
        return this._$http.post('job/Void?jobId=' + jobId);
    }

    /**
     * @param {Number} jobId
     * @param {String} despatcherName
     * @param {Number} staffId
     * @param {String} currentSpeed
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        const response = await this._$http.post('job/ProcessUncheckDirect?jobId=' + jobId + '&despatcher=' + despatcherName + '&staffId=' + staffId + '&currentSpeed=' + currentSpeed);
        return response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post('job/RestoreJobs?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
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
     * @param {Number} courierId
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
     * @param {Number} jobId
     * @param {String} email
     */
    async sendPOD(jobId, email) {
        const response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} speedId
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
     * @param {Number} jobId
     */
    async getJobDetail(jobId) {
        const response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {Number} parentId
     * @param {Number} clientId
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
     * @param {Number} courierId
     * @param {Boolean} done
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
     * @param {String} channel
     */
    async getSupports(channel) {
        const response = await this._$http.get('job/supports?channel=' + channel);
        return response.data;
    }

    /**
     * Closes the support request with the provided supportId and marks it closed by the provided staffId.
     *
     * @param {Number} supportId - The unique identifier of the support request.
     * @param {Number} staffId - The unique identifier of the staff member marking the request as closed.
     */
    async closeSupport(supportId, staffId) {
        return this._$http.post('job/CloseSupport?supportId=' + supportId + '&staffId=' + staffId);
    }

    /**
     * Locks a support request with the provided id and locks it by the provided dispatcher.
     *
     * @param {Number} supportId - The unique identifier of the support request.
     * @param {String} dispatcherName - The unique identifier of the dispatcher locking the request.
     */
    async lockSupport(supportId, dispatcherName) {
        return this._$http.post('job/LockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    /**
     * Unlocks a support request with the provided id and unlocks it by the provided dispatcher.
     *
     * @param {Number} supportId - The unique identifier of the support request.
     * @param {String} dispatcherName - The unique identifier of the dispatcher unlocking the request.
     */
    async unLockSupport(supportId, dispatcherName) {
        return this._$http.post('job/UnLockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    async getLateCalls() {
        const response = await this._$http.get('app/components/home/api/lateCalls.json');
        return response.data;
    }

    /**
     * @param {Object} selectedViewIds
     */
    async getDriverLocations(selectedViewIds) {
        const query = this._prepareViewIdsForRequest(selectedViewIds);

        const response = await this._$http.get('courier?' + query);
        return response.data;
    }

    /**
     * @param {Number} clearListId
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
     * @param {Number} contactId
     */
    async getClientContacts(contactId) {
        const response = await this._$http.get('home/ClientContacts?contactId=' + contactId);
        return response.data;
    }

    /**
     * @param {Number} jobId
     */
    async getPotentialCouriers(jobId) {
        const response = await this._$http.get('courier/PotentialCouriers?jobId=' + jobId);
        return response.data;
    }

    /**
     * @param {String} code
     */
    async getCourierPosition(code) {
        const response = await this._$http.get('courier/location?code=' + code);
        return response.data;
    }

    /**
     * Retrieves the available courier location within a geographical boundary.
     *
     * @param {Number} minLng - The minimum longitude of the boundary.
     * @param {Number} minLat - The minimum latitude of the boundary.
     * @param {Number} maxLng - The maximum longitude of the boundary.
     * @param {Number} maxLat - The maximum latitude of the boundary.
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
     * @param {Number} clientId - The unique identifier of the client.
     */
    async getContactList(clientId) {
        const response = await this._$http.get('job/ContactList?clientId=' + clientId);
        return response.data;
    }

    /**
     * Retrieves the detailed contact list for the client with the provided clientId.
     *
     * @param {Number} clientId - The unique identifier of the client.
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
     * @param {Number} jobId
     * @param {Number} truckWeightLimit
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        const response = await this._$http.get('job/TruckItemsSummary?jobId=' + jobId + '&truckWeightLimit=' + truckWeightLimit);
        return response.data;
    }

    /**
     * @param {Number} lateType
     * @param {Number} lateTime
     * @param {Number} minutes
     * @param {Number} pickupTime
     * @param {Number} alertLatePickup
     * @param {Number} deliveryTime
     * @param {Number} alertLateDelivery
     * @param {String} jobNo
     * @param {Number} clientId
     * @param {String} contact
     * @param {Number} staffId
     * @param {Date} jobTime
     * @param {Number} jobId
     * @param {Number} jobType
     * @param {String} bookedSpeed
     * @param {String} notifiedSpeed
     * @param {String} despatcherName
     * @param {Boolean} calculationRequired
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
     * @param {Number} clientId
     * @param {Number} fromId
     * @param {Number} toId
     * @param {Number} weight
     * @param {Number} size
     * @param {Number} speed
     * @param {Number} qty
     * @param {Date} bookedDate
     * @param {Number} pickUp
     * @param {Number} dropOff
     * @param {Boolean} privateRes
     * @param {Number} oversizeItems
     * @param {Number} overWeightItems
     * @param {Number} dGClass
     * @param {Date} truckStartTime
     * @param {Number} truckHours
     */
    async rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        const response = await this._$http.get('job/RateTruckJob?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&weight=' + weight + '&size=' + size + '&speed=' + speed + '&qty=' + qty + '&bookedDate=' + bookedDate + '&pickup=' + pickUp + '&dropOff=' + dropOff + '&privateRes=' + privateRes + '&oversizeItems=' + oversizeItems + '&overWeightItems=' + overWeightItems + '&dgClass=' + dGClass + '&truckStartTime=' + truckStartTime + '&truckHours=' + truckHours);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} fromId
     * @param {Number} toId
     * @param {Number} weight
     * @param {Number} size
     * @param {Number} speed
     * @param {Number} qty
     * @param {Date} bookedDate
     * @param {Number} pickUp
     * @param {Number} dropOff
     * @param {Boolean} privateRes
     * @param {Number} oversizeItems
     * @param {Number} overWeightItems
     * @param {Number} dGClass
     * @param {Date} truckStartTime
     * @param {Number} truckHours
     * @param {Number} gstRate
     */
    async truckJobAmountBreakdown(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours, gstRate) {
        const response = await this._$http.get('job/TruckJobAmountBreakdown?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&weight=' + weight + '&size=' + size + '&speed=' + speed + '&qty=' + qty + '&bookedDate=' + bookedDate + '&pickup=' + pickUp + '&dropOff=' + dropOff + '&privateRes=' + privateRes + '&oversizeItems=' + oversizeItems + '&overWeightItems=' + overWeightItems + '&dgClass=' + dGClass + '&truckStartTime=' + truckStartTime + '&truckHours=' + truckHours + '&gstRate=' + gstRate);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} fromId
     * @param {Number} toId
     * @param {Number} speed
     * @param {Boolean} pedal
     * @param {Boolean} van
     * @param {Boolean} returnJob
     * @param {Number} weight
     * @param {Number} size
     * @param {Boolean} includeFuelSurcharge
     * @param {Boolean} direct
     * @param {Number} acceptedJobTypeId
     * @param {String} ourRef
     * @param {String} refA
     * @param {String} refB
     * @param {Number} quantity
     * @param {Date} booked
     */
    async rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        const response = await this._$http.get('job/RateJob?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&speed=' + speed + '&pedal=' + pedal + '&van=' + van + '&returnJob=' + returnJob + '&weight=' + weight + '&size=' + size + '&includeFuelSurcharge=' + includeFuelSurcharge + '&direct=' + direct + '&acceptedJobTypeId=' + acceptedJobTypeId + '&ourRef=' + ourRef + '&refA=' + refA + '&refB=' + refB + '&quantity=' + quantity + '&booked=' + booked);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} fromId
     * @param {Number} toId
     * @param {Number} speed
     * @param {Boolean} pedal
     * @param {Boolean} van
     * @param {Boolean} returnJob
     * @param {Number} weight
     * @param {Number} size
     * @param {Boolean} includeFuelSurcharge
     * @param {Boolean} direct
     * @param {Number} acceptedJobTypeId
     * @param {String} ourRef
     * @param {String} refA
     * @param {String} refB
     * @param {Number} quantity
     * @param {Date} booked
     * @param {Number} gstRate
     * @param {Number} amount
     */
    async jobAmountBreakdown(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked, gstRate, amount) {
        const response = await this._$http.get('job/JobAmountBreakdown?clientId=' + clientId + '&fromId=' + fromId + '&toId=' + toId + '&speed=' + speed + '&pedal=' + pedal + '&van=' + van + '&returnJob=' + returnJob + '&weight=' + weight + '&size=' + size + '&includeFuelSurcharge=' + includeFuelSurcharge + '&direct=' + direct + '&acceptedJobTypeId=' + acceptedJobTypeId + '&ourRef=' + ourRef + '&refA=' + refA + '&refB=' + refB + '&quantity=' + quantity + '&booked=' + booked + '&gstRate=' + gstRate + '&amount=' + amount);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        const response = await this._$http.get('job/PPDExclusiveAmount?clientId=' + clientId + '&amount=' + amount);
        return response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} speedId
     * @param {Number} jobId
     */
    async getServices(clientId, speedId, jobId) {
        const url = 'job/GetAllClientItems';
        const response = await this._$http.get(url + '?clientId=' + clientId + '&speedId=' + speedId + '&jobId=' + jobId);

        return response.data;
    }

    /**
     * @param {Number} jobId
     * @param {number[]} serviceIds
     * @param {Number} totalCost
     */
    async addServicesToJob(jobId, serviceIds, totalCost) {
        const url = 'job/AddClientItemsToJob'

        return this._$http({
            method: 'POST', url: url + '?jobId=' + jobId, data: {serviceIds, totalCost}
        });
    }

    /**
     * @param {Number} jobId
     * @param {String} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        return this._$http.post('job/splitJob?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} jobId
     * @param {String} despatcherName
     */
    async finishSplitJobProcess(jobId, despatcherName) {
        return this._$http.post('job/finishSplitJobProcess?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {String} jobNumber
     * @param {Number} jobStatus
     * @param {String} podName
     * @param {Date} podTime
     */
    async updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        return this._$http.post('job/UpdatePODDetails?jobNumber=' + jobNumber + '&jobStatus=' + jobStatus + '&podName=' + podName + '&podTime=' + podTime);
    }

    /**
     * @param {Number} courierId
     * @param {Number} staffId
     * @param {String} despatcherName
     * @param {String} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        const response = await this._$http.post('job/SendSMS?courierId=' + courierId + '&dispId=' + staffId + '&despatcherName=' + despatcherName + '&message=' + message);
        return response.data;
    }

    /**
     * @param {Number} jobId
     */
    async reRateSplitJob(jobId) {
        return this._$http.post('job/ReRateSplitJob?jobId=' + jobId);
    }

    /**
     * @param {Number} jobId
     * @param {Number} toSuburbId
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     * @param {Boolean} cbd
     * @param {Number} rate
     * @param {String} despatcherName
     * @param {Boolean} prebook
     */
    async updateDeliveryAddress(jobId, toSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? 'job/UpdateBookingDeliveryAddress' : 'job/UpdateDeliveryAddress';
        return this._$http.post(method + '?jobId=' + jobId + '&toSuburbId=' + toSuburbId + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng + '&cbd=' + cbd + '&rate=' + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} bulkJobId
     * @param {Number} toSuburb
     * @param {string|number} toPostCode
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     * @param {String} despatcherName
     */
    async updateBulkDeliveryAddress(bulkJobId, toSuburb, toPostCode, address, lat, lng, despatcherName) {
        return this._$http.post('job/UpdateBulkDeliveryAddress?bulkJobId=' + bulkJobId + '&toSuburb=' + toSuburb + '&toPostCode=' + toPostCode + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} jobId
     * @param {Number} fromSuburbId
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     * @param {Boolean} cbd
     * @param {Number} rate
     * @param {String} despatcherName
     * @param {Boolean} prebook
     */
    async updatePickupAddress(jobId, fromSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? 'job/UpdateBookingPickupAddress' : 'job/UpdatePickupAddress';
        return this._$http.post(method + '?jobId=' + jobId + '&fromSuburbId=' + fromSuburbId + '&address=' + address + '&pickupLat=' + lat + '&pickupLng=' + lng + '&cbd=' + cbd + '&rate=' + rate + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} bulkJobId
     * @param {Number} fromSuburb
     * @param {Number} fromPostCode
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     * @param {String} despatcherName
     */
    async updateBulkPickupAddress(bulkJobId, fromSuburb, fromPostCode, address, lat, lng, despatcherName) {
        return this._$http.post('job/UpdateBulkPickupAddress?bulkJobId=' + bulkJobId + '&fromSuburb=' + fromSuburb + '&fromPostCode=' + fromPostCode + '&address=' + address + '&pickupLat=' + lat + '&pickupLng=' + lng + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} jobId
     * @param {Number} jobType
     * @param {String} despatcherName
     */
    async updateJobType(jobId, jobType, despatcherName) {
        return this._$http.post('job/UpdateJobType?jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {Number} jobId
     * @param {Number} toSuburbId
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return this._$http.post('job/UpdateSplitJobAddress?jobId=' + jobId + '&toSuburbId=' + toSuburbId + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng);
    }

    /**
     * @param {String} jobNumber
     * @param {Date} bookDate
     */
    async releaseBulkJob(jobNumber, bookDate) {
        const formattedBookDate = this._moment(bookDate).format('YYYY-MM-DD');
        return this._$http.post('job/ReleaseBulkJob?jobNumber=' + jobNumber + '&bookDate=' + formattedBookDate);
    }

    /**
     * @param {Number} jobId
     * @param {String} field
     * @param {string|Date|number} value
     * @param {Number} rate
     * @param {String} despatcherName
     * @param {Number} staffId
     * @param {Boolean} preBook
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
     * @param {Number} bulkJobId
     * @param {String} field
     * @param {string|number|Date} value
     * @param {Number} rate
     * @param {String} despatcherName
     * @param {Number} staffId
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
     * @param {Object} queryParams Combined query parameters and filters
     * @param {string[]} selectedClients Array of selected client IDs
     * @param {Boolean} internal Whether the user is internal or not
     * @param {Object} despatchViewIds Object containing dispatch view IDs
     */
    async getJobsWithFilters(queryParams, selectedClients, internal, despatchViewIds) {
        const query = this._prepareViewIdsForRequest(despatchViewIds);

        const params = new URLSearchParams({
            status: queryParams.status || 'all',
            area: queryParams.area || '',
            order: queryParams.order || 'time',
            asc: queryParams.asc || 'asc',
            isInternal: internal.toString(),
            cid: ContactID,
            clientIds: selectedClients.join(','),
            page: queryParams.page.toString(),
            pageSize: queryParams.limit.toString(),
            ...query
        });

        const response = await this._$http.get(`job?${params.toString()}`);
        return response.data;
    }

    /**
     * Retrieves the auto-complete search results for the given address text from a geocoder service.
     *
     * @param {String} text - The search text for which auto-complete results are to be fetched.
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
     * @param {Number} lat - Latitude of the location.
     * @param {Number} long - Longitude of the location.
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
     * @param {String} searchTerm - The term to search for.
     * @param {String} url - The URL to perform the search in.
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
     * @param {Number} jobId
     */
    async isFilesAttachedToJob(jobId) {
        const response = await this._$http.get(`job/IsFilesAttachedToJob/${jobId}`);
        return response.data;
    }

    /**
     * @param {Object} viewIds
     * @returns {Object}
     * @private
     */
    _prepareViewIdsForRequest(viewIds) {
        const activeIds = Object.entries(viewIds)
            .filter(([, value]) => value)
            .map(([key]) => key);

        return {despatchViewIds: activeIds.join(',')};
    }
}

angular.module('uDispatch').service('DispatchData', ['$http', 'moment', 'APP_CONFIG', ($http, moment, APP_CONFIG) => new DispatchData($http, moment, APP_CONFIG)]);
