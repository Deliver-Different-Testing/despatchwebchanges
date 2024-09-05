class NationwideService {
    static $inject = ["$http", "moment"];

    constructor($http, moment) {
        this._$http = $http;
        this._moment = moment;
    }

    /**
     * @param {number} jobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
        let response = await this._$http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName);
        return await response;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async deletePallet(pallet, preBook, despatcherName) {
        let response = await this._$http({
            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        });
        return await response.data;
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
        let response = await this._$http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return await response.data;
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
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        let response = await this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName);
        return await response.data;
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
        let response = await this._$http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes);
        return await response.data;
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
     * @param {number} eventType
     */
    async addEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
        let response = await this._$http.post("job/addEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes + "&eventType=" + eventType);
        return await response.data;
    }

    /**
     * @param {string} eventName
     * @param {string} notes
     * @param {number} clientId
     * @param {string} jobNumber
     * @param {string} despatcherName
     */
    async exsalerateActivity(eventName, notes, clientId, jobNumber, despatcherName) {
        let response = await this._$http.post("job/ExsalerateActivity?eventName=" + eventName + "&notes=" + notes + "&clientId=" + clientId + "&jobNumber=" + jobNumber + "&despatcherName=" + despatcherName);
        return await response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        let response = await this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        let response = await this._$http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response;
    }

    /**
     * @param {number} courierId
     */
    async truckCourierStatus(courierId) {
        let response = await this._$http.post("courier/TruckCourierStatus?courierId=" + courierId);
        return await response;
    }

    /**
     * @param {number} jobId
     */
    async voidJob(jobId) {
        let response = await this._$http.post("job/Void?jobId=" + jobId);
        return await response;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {number} currentSpeed
     */
    async processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        let response = await this._$http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed);
        return await response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        let response = await this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        let response = await this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async resendJobs(jobIds) {
        let response = await this._$http.post("job/ResendSelected?jobIds=" + jobIds);
        return await response.data;
    }

    /**
     * @param {number} courierId
     */
    async resendAllJobs(courierId) {
        let response = await this._$http.post("job/ResendAll?courierId=" + courierId);
        return await response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        let response = await this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email);
        return await response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} staffId
     * @param {string} despatcherName
     * @param {string} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        let response = await this._$http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message);
        return await response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        let response = await this._$http.get('/Job/Detail?jobId=' + jobId);
        return await response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        let response = await this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId);
        return await response.data;
    }

    getJobsGrouped() {
        return this._$http.get("app/components/home/api/jobsGroupedList.json").then(response => response.data);
    }

    /**
     * @param {string} courierId
     * @param {boolean} done
     */
    async getJobsCurrent(courierId, done) {
        let response = await this._$http.get("job/current?courierId=" + courierId + "&done=" + done);
        return await response.data;
    }

    async getCouriersPicked() {
        let response = await this._$http.get("app/components/home/api/couriersPicked.json");
        return await response.data;
    }

    async getCouriersThrough() {
        let response = await this._$http.get("app/components/home/api/couriersThrough.json");
        return await response.data;
    }

    async getCouriersClear() {
        let response = await this._$http.get("app/components/home/api/couriersClear.json");
        return await response.data;
    }

    async getAreaList() {
        let response = await this._$http.get("app/components/home/api/areaList.json");
        return await response.data;

    }

    /**
     * @param {string} channel
     */
    async getSupports(channel) {
        let response = await this._$http.get("job/supports?channel=" + channel);
        return await response.data;
    }

    /**
     * @param {number} supportId
     * @param {number} staffId
     */
    async closeSupport(supportId, staffId) {
        let response = await this._$http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId);
        return await response;
    }

    /**
     * @param {number} supportId
     * @param {string} dispatcher
     */
    async lockSupport(supportId, dispatcher) {
        let response = await this._$http.post("job/LockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
        return await response;
    }

    /**
     * @param {number} supportId
     * @param {string} dispatcher
     */
    async unLockSupport(supportId, dispatcher) {
        let response = await this._$http.post("job/UnLockSupport?id=" + supportId + "&dispatcher=" + dispatcher);
        return await response;
    }

    async getLateCalls() {
        let response = await this._$http.get("app/components/home/api/lateCalls.json");
        return await response.data;
    }

    async getClearLists() {
        let response = await this._$http.get("courier");
        return await response.data;
    }

    /**
     * @param {number} clearListId
     */
    async getClearListEnvelope(clearListId) {
        let response = await this._$http.get("courier/ClearListEnvelope?clearListId=" + clearListId);
        return await response.data;
    }

    async getActiveCouriers() {
        let response = await this._$http.get("courier/active");
        return await response.data;
    }

    async getActiveClients() {
        let response = await this._$http.get("home/ActiveClients");
        return await response.data;
    }

    /**
     * @param {number} contactId
     */
    async getClientContacts(contactId) {
        let response = await this._$http.get("home/ClientContacts?contactId=" + contactId);
        return await response.data;
    }

    /**
     * @param {number} jobId
     */
    async getPotentialCouriers(jobId) {
        let response = await this._$http.get("courier/PotentialCouriers?jobId=" + jobId);
        return await response.data;
    }

    /**
     * @param {string} code
     */
    async getCourierPosition(code) {
        let response = await this._$http.get("courier/location?code=" + code);
        return await response.data;
    }

    /**
     * @param {number} minLng
     * @param {number} minLat
     * @param {number} maxLng
     * @param {number} maxLat
     */
    async getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        let response = await this._$http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat);
        return await response.data;
    }

    async getSuburbList() {
        let response = await this._$http.get("job/SuburbList");
        return await response.data;
    }

    async getSpeedList() {
        let response = await this._$http.get("job/SpeedList");
        return await response.data;
    }

    async getLeaveList() {
        let response = await this._$http.get("job/LeaveList");
        return await response.data;
    }

    async getUndeliverableList() {
        let response = await this._$http.get("job/UndeliverableList");
        return await response.data;
    }

    /**
     * @param {number} jobId
     * @param {number} truckWeightLimit
     */
    async getTruckItemsSummary(jobId, truckWeightLimit) {
        let response = await this._$http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit);
        return await response.data;
    }

    /**
     * @param {string} lateType
     * @param {string} lateTime
     * @param {string} minutes
     * @param {number|string} pickupTime
     * @param {number|string} alertLatePickup
     * @param {number|string} deliveryTime
     * @param {number|string} alertLateDelivery
     * @param {string} jobNo
     * @param {number} clientId
     * @param {string} contact
     * @param {number} staffId
     * @param {string} jobTime
     * @param {string} jobId
     * @param {number} jobType
     * @param {*} bookedSpeed
     * @param {*} notifiedSpeed
     * @param {string} despatcherName
     * @param {string} calc
     */
    async lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calc) {
        let response = await this._$http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup + "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed + "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc);
        return await response.data;
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
     * @param {*} pickUp
     * @param {*} dropOff
     * @param {*} privateRes
     * @param {*} oversizeItems
     * @param {*} overWeightItems
     * @param {number} dGClass
     * @param {*} truckStartTime
     * @param {*} truckHours
     */
    async rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        let response = await this._$http.get("job/RateTruckJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours);
        return await response.data;
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
     * @param {Array|string} quantity
     * @param {Date} booked
     */
    async rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        let response = await this._$http.get("job/RateJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked);
        return await response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        let response = await this._$http.get("job/PPDExclusiveAmount?clientId=" + clientId + "&amount=" + amount);
        return await response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        let response = await this._$http.post("job/splitJob?jobId=" + jobId + "&despatcherName=" + despatcherName);
        return await response;
    }

    /**
     * @param {number} jobId
     */
    async reRateSplitJob(jobId) {
        let response = await this._$http.post("job/ReRateSplitJob?jobId=" + jobId);
        return await response;
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
        let response = await this._$http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
        return await response;
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
        let response = await this._$http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName);
        return await response;
    }

    /**
     * @param {string} jobId
     * @param {string} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        let response = await this._$http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng);
        return await response;
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
        let response = await this._$http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
        return await response;
    }

    async doAPI(data) {
        let response = await this._$http.post("app/components/home/api/api.php", data);
        return await response.data;
    }

    async getNationwideJobsNew(data, selectedClients, internal) {
        let response = await this._$http.get("job/nationwideJobListNew?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients);
        return await response.data;
    }

    async getNationwideJobsPOD(data, selectedClients, internal) {
        let response = await this._$http.get("job/nationwideJobListPOD?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients);
        return await response.data;
    }

    async getNationwideJobsBookDelivery(data, selectedClients, internal) {
        let response = await this._$http.get("job/nationwideJobListBookDelivery?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients);
        return await response.data;
    }

    async getNationwideJobsReprice(data, selectedClients, internal) {
        let response = await this._$http.get("job/nationwideJobListReprice?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients);
        return await response.data;
    }

    async getEventTypes() {
        let response = await this._$http.get("job/EventTypeList");
        return await response.data;
    }
}

angular.module('uDispatch').service('NWData', ['$http', 'moment', ($http, moment) => new NationwideService($http, moment)]);
