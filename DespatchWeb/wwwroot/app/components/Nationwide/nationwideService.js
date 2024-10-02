class NationwideService {
    constructor($http, moment) {
        this._$http = $http;
        this._moment = moment;
    }

    /**
     * @param {Number} jobId
     * @param {String} note
     * @param {String} despatcherName
     * @param {Boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
        const response = await this._$http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName);
        return await response;
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {Boolean} preBook
     * @param {String} despatcherName
     */
    async deletePallet(pallet, preBook, despatcherName) {
        const response = await this._$http({
            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
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
        const response = await this._$http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return await response.data;
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
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return await response.data;
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
        const response = await this._$http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes);
        return await response.data;
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
     * @param {Number} eventType
     */
    async addEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
        const response = await this._$http.post("job/addEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes + "&eventType=" + eventType);
        return await response.data;
    }

    /**
     * @param {String} eventName
     * @param {String} notes
     * @param {Number} clientId
     * @param {String} jobNumber
     * @param {String} despatcherName
     */
    async exsalerateActivity(eventName, notes, clientId, jobNumber, despatcherName) {
        const response = await this._$http.post("job/ExsalerateActivity?eventName=" + eventName + "&notes=" + notes + "&clientId=" + clientId + "&jobNumber=" + jobNumber + "&despatcherName=" + despatcherName);
        return await response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response;
    }

    /**
     * @param {Number} courierId
     */
    async truckCourierStatus(courierId) {
        const response = await this._$http.post("courier/TruckCourierStatus?courierId=" + courierId);
        return await response;
    }

    /**
     * @param {Number} jobId
     */
    async voidJob(jobId) {
        const response = await this._$http.post("job/Void?jobId=" + jobId);
        return await response;
    }

    /**
     * @param {Number} jobId
     * @param {String} despatcherName
     * @param {Number} staffId
     * @param {Number} currentSpeed
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        const response = await this._$http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed);
        return await response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async resendJobs(jobIds) {
        const response = await this._$http.post("job/ResendSelected?jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {Number} courierId
     */
    async resendAllJobs(courierId) {
        const response = await this._$http.post("job/ResendAll?courierId=" + courierId);
        return await response.data;
    }

    /**
     * @param {Number} jobId
     * @param {String} email
     */
    async sendPOD(jobId, email) {
        const response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return await response.data;
    }

    /**
     * @param {Number} courierId
     * @param {Number} staffId
     * @param {String} despatcherName
     * @param {String} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        const response = await this._$http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message);
        return await response.data;
    }

    /**
     * @param {Number} jobId
     */
    async getJobDetail(jobId) {
        const response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return await response.data;
    }

    /**
     * @param {Number} parentId
     * @param {Number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        const response = await this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return await response.data;
    }

    getJobsGrouped() {
        return this._$http.get("app/components/home/api/jobsGroupedList.json").then(response => response.data);
    }

    /**
     * @param {String} courierId
     * @param {Boolean} done
     */
    async getJobsCurrent(courierId, done) {
        const response = await this._$http.get("job/current?courierId=" + courierId + "&done=" + done);
        return await response.data;
    }

    async getCouriersPicked() {
        const response = await this._$http.get("app/components/home/api/couriersPicked.json");
        return await response.data;
    }

    async getCouriersThrough() {
        const response = await this._$http.get("app/components/home/api/couriersThrough.json");
        return await response.data;
    }

    async getCouriersClear() {
        const response = await this._$http.get("app/components/home/api/couriersClear.json");
        return await response.data;
    }

    async getAreaList() {
        const response = await this._$http.get("app/components/home/api/areaList.json");
        return await response.data;

    }

    /**
     * @param {String} channel
     */
    async getSupports(channel) {
        const response = await this._$http.get("job/supports?channel=" + channel);
        return await response.data;
    }

    /**
     * @param {Number} supportId
     * @param {Number} staffId
     */
    async closeSupport(supportId, staffId) {
        const response = await this._$http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId);
        return await response;
    }

    /**
     * @param {Number} supportId
     * @param {String} dispatcher
     */
    async lockSupport(supportId, dispatcher) {
        const response = await this._$http.post("job/LockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
        return await response;
    }

    /**
     * @param {Number} supportId
     * @param {String} dispatcher
     */
    async unLockSupport(supportId, dispatcher) {
        const response = await this._$http.post("job/UnLockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
        return await response;
    }

    async getLateCalls() {
        const response = await this._$http.get("app/components/home/api/lateCalls.json");
        return await response.data;
    }

    async getClearLists() {
        const response = await this._$http.get("courier");
        return await response.data;
    }

    /**
     * @param {Number} clearListId
     */
    async getClearListEnvelope(clearListId) {
        const response = await this._$http.get("courier/ClearListEnvelope?clearListId=" + clearListId);
        return await response.data;
    }

    async getActiveCouriers() {
        const response = await this._$http.get("courier/active");
        return await response.data;
    }

    async getActiveClients() {
        const response = await this._$http.get("home/ActiveClients");
        return await response.data;
    }

    /**
     * @param {Number} contactId
     */
    async getClientContacts(contactId) {
        const response = await this._$http.get("home/ClientContacts?contactId=" + contactId);
        return await response.data;
    }

    /**
     * @param {Number} jobId
     */
    async getPotentialCouriers(jobId) {
        const response = await this._$http.get("courier/PotentialCouriers?jobId=" + jobId);
        return await response.data;
    }

    /**
     * @param {String} code
     */
    async getCourierPosition(code) {
        const response = await this._$http.get("courier/location?code=" + code);
        return await response.data;
    }

    /**
     * @param {Number} minLng
     * @param {Number} minLat
     * @param {Number} maxLng
     * @param {Number} maxLat
     */
    async getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        const response = await this._$http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat);
        return await response.data;
    }

    async getSuburbList() {
        const response = await this._$http.get("job/SuburbList");
        return await response.data;
    }

    async getSpeedList() {
        const response = await this._$http.get("job/SpeedList");
        return await response.data;
    }

    async getLeaveList() {
        const response = await this._$http.get("job/LeaveList");
        return await response.data;
    }

    async getUndeliverableList() {
        const response = await this._$http.get("job/UndeliverableList");
        return await response.data;
    }

    /**
     * @param {Number} jobId
     * @param {Number} truckWeightLimit
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        const response = await this._$http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit);
        return await response.data;
    }

    /**
     * @param {String} lateType
     * @param {String} lateTime
     * @param {String} minutes
     * @param {number|string} pickupTime
     * @param {number|string} alertLatePickup
     * @param {number|string} deliveryTime
     * @param {number|string} alertLateDelivery
     * @param {String} jobNo
     * @param {Number} clientId
     * @param {String} contact
     * @param {Number} staffId
     * @param {String} jobTime
     * @param {String} jobId
     * @param {Number} jobType
     * @param {*} bookedSpeed
     * @param {*} notifiedSpeed
     * @param {String} despatcherName
     * @param {String} calc
     */
    async lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calc) {
        const response = await this._$http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup + "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed + "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc);
        return await response.data;
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
     * @param {*} pickUp
     * @param {*} dropOff
     * @param {*} privateRes
     * @param {*} oversizeItems
     * @param {*} overWeightItems
     * @param {Number} dGClass
     * @param {*} truckStartTime
     * @param {*} truckHours
     */
    async rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        const response = await this._$http.get("job/RateTruckJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours);
        return await response.data;
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
     * @param {Array|string} quantity
     * @param {Date} booked
     */
    async rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        const response = await this._$http.get("job/RateJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked);
        return await response.data;
    }

    /**
     * @param {Number} clientId
     * @param {Number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        const response = await this._$http.get("job/PPDExclusiveAmount?clientId=" + clientId + "&amount=" + amount);
        return await response.data;
    }

    /**
     * @param {Number} jobId
     * @param {String} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        const response = await this._$http.post("job/splitJob?jobId=" + jobId + "&despatcherName=" + despatcherName);
        return await response;
    }

    /**
     * @param {Number} jobId
     */
    async reRateSplitJob(jobId) {
        const response = await this._$http.post("job/ReRateSplitJob?jobId=" + jobId);
        return await response;
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
        const method = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
        const response = await this._$http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
        return await response;
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
        const method = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
        const response = await this._$http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
        return await response;
    }

    /**
     * @param {String} jobId
     * @param {String} toSuburbId
     * @param {String} address
     * @param {Number} lat
     * @param {Number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        const response = await this._$http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng);
        return await response;
    }

    /**
     * @param {Number} jobId
     * @param {String} field
     * @param {String} value
     * @param {String} rate
     * @param {String} despatcherName
     * @param {Number} staffId
     * @param {Boolean} preBook
     */
    async updateJobDetail(jobId, field, value, rate, despatcherName, staffId, preBook) {
        if (field === "Time" || field === "CompletedTime") {
            value = this._moment().format("YYYY-MM-DD") + " " + this._moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this._moment(value).format("YYYY-MM-DD");
        }
        const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
        const response = await this._$http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
        return await response;
    }

    async doAPI(data) {
        const response = await this._$http.post("app/components/home/api/api.php", data);
        return await response.data;
    }

    /**
     * @param {string} endpoint
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
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

        const response = await this._$http.get(`job/${endpoint}?${params.toString()}`);
        return response.data;
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {string[]} selectedClients
     * @param {boolean} internal
     * @param {Array} selectedAreas
     */
    getNationwideJobsNew(queryParams, selectedClients, internal, selectedAreas) {
        return this.getNationwideJobs('nationwideJobListPOD', queryParams, selectedClients, internal, selectedAreas);

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
        return await response.data;
    }

    /**
     * @param {Date} departureDate
     * @param {Number} departureAirportId
     * @returns {Promise<FlightOptions[]>}
     */
    async getFlightOptions(departureDate, departureAirportId) {
        const response = await this._$http.get("nationwideJob/GetScheduledFlightOptions?departureDate=" + departureDate + "&departureAirportId=" + departureAirportId);
        return await response;
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
