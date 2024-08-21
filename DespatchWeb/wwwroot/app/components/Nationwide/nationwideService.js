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
    addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
        return this._$http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName).then(response => response);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    addPallet(pallet, preBook, despatcherName) {
        return this._$http({
            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        }).then(response => response.data);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    editPallet(pallet, preBook, despatcherName) {
        return this._$http({
            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        }).then(response => response.data);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    deletePallet(pallet, preBook, despatcherName) {
        return this._$http({
            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName, method: "POST", data: pallet
        }).then(response => response.data);
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
    addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        return this._$http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(response => response.data);
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
    addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        return this._$http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(response => response.data);
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
    addOtherEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
        return this._$http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes).then(response => response.data);
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
    addEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
        return this._$http.post("job/addEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes + "&eventType=" + eventType).then(response => response.data);
    }

    /**
     * @param {string} eventName
     * @param {string} notes
     * @param {number} clientId
     * @param {string} jobNumber
     * @param {string} despatcherName
     */
    exsalerateActivity(eventName, notes, clientId, jobNumber, despatcherName) {
        return this._$http.post("job/ExsalerateActivity?eventName=" + eventName + "&notes=" + notes + "&clientId=" + clientId + "&jobNumber=" + jobNumber + "&despatcherName=" + despatcherName).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    allocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds).then(response => response);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    reAllocateJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds).then(response => response);
    }

    /**
     * @param {number} courierId
     */
    truckCourierStatus(courierId) {
        return this._$http.post("courier/TruckCourierStatus?courierId=" + courierId).then(response => response);
    }

    /**
     * @param {number} jobId
     */
    voidJob(jobId) {
        return this._$http.post("job/Void?jobId=" + jobId).then(response => response);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {number} currentSpeed
     */
    processUncheckDirect(jobId, despatcherName, staffId, currentSpeed) {
        return this._$http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    restoreJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    restoreSplitJobs(courierId, dispatcherId, jobIds) {
        return this._$http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispatcherId + "&jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number[]} jobIds
     */
    resendJobs(jobIds) {
        return this._$http.post("job/ResendSelected?jobIds=" + jobIds).then(response => response.data);
    }

    /**
     * @param {number} courierId
     */
    resendAllJobs(courierId) {
        return this._$http.post("job/ResendAll?courierId=" + courierId).then(response => response.data);
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    sendPOD(jobId, email) {
        return this._$http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email).then(response => response.data);
    }

    /**
     * @param {number} courierId
     * @param {number} staffId
     * @param {string} despatcherName
     * @param {string} message
     */
    sendSMS(courierId, staffId, despatcherName, message) {
        return this._$http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message).then(response => response.data);
    }

    /**
     * @param {number} jobId
     */
    getJobDetail(jobId) {
        return this._$http.get('/Job/Detail?jobId=' + jobId).then(response => response.data);
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    getRelatedJobs(parentId, clientId) {
        return this._$http.get('/Job/Related?parentId=' + parentId + '&clientId=' + clientId).then(response => response.data);
    }

    getJobsGrouped() {
        return this._$http.get("app/components/home/api/jobsGroupedList.json").then(response => response.data);
    }

    /**
     * @param {string} courierId
     * @param {boolean} done
     */
    getJobsCurrent(courierId, done) {
        return this._$http.get("job/current?courierId=" + courierId + "&done=" + done).then(response => response.data);
    }

    getCouriersPicked() {
        return this._$http.get("app/components/home/api/couriersPicked.json").then(response => response.data);
    }

    getCouriersThrough() {
        return this._$http.get("app/components/home/api/couriersThrough.json").then(response => response.data);
    }

    getCouriersClear() {
        return this._$http.get("app/components/home/api/couriersClear.json").then(response => response.data);
    }

    getAreaList() {
        return this._$http.get("app/components/home/api/areaList.json").then(response => response.data);

    }

    /**
     * @param {string} channel
     */
    getSupports(channel) {
        return this._$http.get("job/supports?channel=" + channel).then(response => response.data);
    }

    /**
     * @param {number} supportId
     * @param {number} staffId
     */
    closeSupport(supportId, staffId) {
        return this._$http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId).then(response => response);
    }

    /**
     * @param {number} supportId
     * @param {string} dispatcher
     */
    lockSupport(supportId, dispatcher) {
        return this._$http.post("job/LockSupport?id=" + supportId + "&dispatcher=" + dispatcher).then(response => response);
    }

    /**
     * @param {number} supportId
     * @param {string} dispatcher
     */
    unLockSupport(supportId, dispatcher) {
        return this._$http.post("job/UnLockSupport?id=" + supportId + "&dispatcher=" + dispatcher).then(response => response);
    }

    getLateCalls() {
        return this._$http.get("app/components/home/api/lateCalls.json").then(response => response.data);
    }

    getClearLists() {
        return this._$http.get("courier").then(response => response.data);
    }

    /**
     * @param {number} clearListId
     */
    getClearListEnvelope(clearListId) {
        return this._$http.get("courier/ClearListEnvelope?clearListId=" + clearListId).then(response => response.data);
    }

    getActiveCouriers() {
        return this._$http.get("courier/active").then(response => response.data);
    }

    getActiveClients() {
        return this._$http.get("home/ActiveClients").then(response => response.data);
    }

    /**
     * @param {number} contactId
     */
    getClientContacts(contactId) {
        return this._$http.get("home/ClientContacts?contactId=" + contactId).then(response => response.data);
    }

    /**
     * @param {number} jobId
     */
    getPotentialCouriers(jobId) {
        return this._$http.get("courier/PotentialCouriers?jobId=" + jobId).then(response => response.data);
    }

    /**
     * @param {string} code
     */
    getCourierPosition(code) {
        return this._$http.get("courier/location?code=" + code).then(response => response.data);
    }

    /**
     * @param {number} minLng
     * @param {number} minLat
     * @param {number} maxLng
     * @param {number} maxLat
     */
    getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        return this._$http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat).then(response => response.data);
    }

    getSuburbList() {
        return this._$http.get("job/SuburbList").then(response => response.data);
    }

    getSpeedList() {
        return this._$http.get("job/SpeedList").then(response => response.data);
    }

    getLeaveList() {
        return this._$http.get("job/LeaveList").then(response => response.data);
    }

    getUndeliverableList() {
        return this._$http.get("job/UndeliverableList").then(response => response.data);
    }

    /**
     * @param {number} jobId
     * @param {number} truckWeightLimit
     */
    getTruckItemsSummary(jobId, truckWeightLimit) {
        return this._$http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit).then(response => response.data);
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
    lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calc) {
        return this._$http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup + "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed + "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc).then(response => response.data);
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
    rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        return this._$http.get("job/RateTruckJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate + "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass + "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours).then(response => response.data);
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
    rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        return this._$http.get("job/RateJob?clientId=" + clientId + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van + "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct + "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity + "&booked=" + booked).then(response => response.data);
    }

    /**
     * @param {number} clientId
     * @param {number} amount
     */
    ppdExclusiveAmount(clientId, amount) {
        return this._$http.get("job/PPDExclusiveAmount?clientId=" + clientId + "&amount=" + amount).then(response => response.data);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    splitJob(jobId, despatcherName) {
        return this._$http.post("job/splitJob?jobId=" + jobId + "&despatcherName=" + despatcherName).then(response => response);
    }

    /**
     * @param {number} jobId
     */
    reRateSplitJob(jobId) {
        return this._$http.post("job/ReRateSplitJob?jobId=" + jobId).then(response => response);
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
    updateDeliveryAddress(jobId, toSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
        return this._$http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName).then(response => response);
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
    updatePickupAddress(jobId, fromSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
        const method = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
        return this._$http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName).then(response => response);
    }

    /**
     * @param {string} jobId
     * @param {string} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return this._$http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng).then(response => response);
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
    updateJobDetail(jobId, field, value, rate, despatcherName, staffId, preBook) {
        if (field === "Time" || field === "CompletedTime") {
            value = this._moment().format("YYYY-MM-DD") + " " + this._moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this._moment(value).format("YYYY-MM-DD");
        }
        const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
        return this._$http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId).then(response => response);
    }

    doAPI(data) {
        return this._$http.post("app/components/home/api/api.php", data).then(response => response.data);
    }

    getNationwideJobsNew(data, selectedClients, internal) {
        return this._$http.get("job/nationwideJobListNew?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(response => response.data);
    }

    getNationwideJobsPOD(data, selectedClients, internal) {
        return this._$http.get("job/nationwideJobListPOD?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(response => response.data);
    }

    getNationwideJobsBookDelivery(data, selectedClients, internal) {
        return this._$http.get("job/nationwideJobListBookDelivery?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(response => response.data);
    }

    getNationwideJobsReprice(data, selectedClients, internal) {
        return this._$http.get("job/nationwideJobListReprice?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(response => response.data);
    }

    getEventTypes() {
        return this._$http.get("job/EventTypeList").then(response => response.data);
    }
}

angular.module("uDispatch").factory("NWData", NationwideService);
