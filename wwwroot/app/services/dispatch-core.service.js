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
const contants_1 = require("../contants");
const bindAllMethods_1 = require("../bindAllMethods");
class DispatchCoreService {
    constructor($http, moment, appConfig) {
        this.$http = $http;
        this.moment = moment;
        this.isUsCustomer = appConfig.US_Customer;
        bindAllMethods_1.bindAllMethods(this);
    }
    $get() {
        return this;
    }
    getSelectedViews(userId, pageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`home/GetPageViews?userid=${userId}&pageid=${pageId}`);
            return response.data;
        });
    }
    addNote(jobId, note, despatcherName, preBook) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = preBook ? "job/AddJobBookingNote" : "job/UpdateNote";
            yield this.$http.post(method + "?jobId=" + jobId + "&note=" + note, null);
        });
    }
    addConNote(jobId, conNote) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdateConnote?jobId= ${jobId}&conNote=${conNote}`, null);
        });
    }
    addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/AddBulkJobNote?BulkJobId=${bulkJobId}&note=${note}&despatcher=${despatcherName}`, null);
        });
    }
    addPallet(pallet, preBook, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post("job/AddPallet", pallet, {
                params: {
                    preBook,
                    despatcher: despatcherName
                }
            });
            return response.data;
        });
    }
    editPallet(pallet, preBook, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post("job/EditPallet", pallet, {
                params: {
                    preBook,
                    despatcher: despatcherName
                }
            });
            return response.data;
        });
    }
    getEventTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/EventTypeList");
            return response.data;
        });
    }
    getEventGroups() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("task/GetEventGroups");
            return response.data;
        });
    }
    getEventTypeGroups(eventGroupId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("task/GetEventTypeGroups?eventGroupId=" + eventGroupId);
            return response.data;
        });
    }
    getActiveStaff() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get('task/GetStaff');
            return response.data;
        });
    }
    addRestoreEvent(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post("job/AddRestoreEvent", null, {
                params: {
                    jobId,
                    ContactID: contants_1.ContactID,
                    FirstName
                }
            });
            return response.data;
        });
    }
    addFollowupEvent(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post("job/AddFollowupEvent", null, {
                params: {
                    jobId,
                    ContactID: contants_1.ContactID,
                    FirstName
                }
            });
            return response.data;
        });
    }
    allocateJobs(courierId, dispatcherId, jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("job/Allocate", null, {
                params: {
                    courierId,
                    dispId: dispatcherId,
                    jobIds
                }
            });
        });
    }
    reAllocateJobs(courierId, dispatcherId, jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("job/ReAllocate", null, {
                params: {
                    courierId,
                    dispId: dispatcherId,
                    jobIds
                }
            });
        });
    }
    setFirstJob(jobId, courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("job/SetFirstJob", null, {
                params: {
                    jobId,
                    courierId
                }
            });
        });
    }
    truckCourierStatus(courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/TruckCourierStatus?courierId=${courierId}`);
            return response.data;
        });
    }
    validateSwapPOD(jobNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`Job/ValidateSwapPOD?job=${jobNumber}`, null);
            return response.data;
        });
    }
    swapPOD(jobNumber1, jobNumber2) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`Job/SwapPOD?job1=${jobNumber1}&job2=${jobNumber2}`, null);
            return response.data;
        });
    }
    voidJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/Void?jobId=${jobId}`, null);
        });
    }
    restoreJobs(jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/RestoreJobs?jobIds=${jobIds}`, null);
        });
    }
    restoreSplitJobs(jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/RestoreSplitJobs?jobIds=${jobIds}`, null);
        });
    }
    resendJobs(jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`job/ResendSelected?jobIds=${jobIds}`, null);
            return response.data;
        });
    }
    resendAllJobs(courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`job/ResendAll?courierId=${courierId}`, null);
            return response.data;
        });
    }
    reAssignJobs(jobIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`job/ReAssignSelected?jobIds=${jobIds}`, null);
            return response.data;
        });
    }
    sendPOD(jobId, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/SendPOD?jobId=${jobId}&toEmail=${email}`);
            return response.data;
        });
    }
    hasClientItemsAvailable(clientId, speedId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/HasClientItemsAvailable?clientId=${clientId}&speedId=${speedId}`);
            return response.data;
        });
    }
    getJobDetail(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`/Job/Detail?jobId=${jobId}`);
            return response.data;
        });
    }
    getRelatedJobs(parentId, clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
            return response.data;
        });
    }
    getJobsCurrent(courierId, done) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/current?courierId=${courierId}&done=${done}`);
            return response.data;
        });
    }
    getSupports(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/supports?channel=${channel}`);
            return response.data;
        });
    }
    closeSupport(supportId, staffId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/CloseSupport?supportId=${supportId}&staffId=${staffId}`, null);
        });
    }
    lockSupport(supportId, dispatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/LockSupport?id=${supportId}&dispatcher=${dispatcherName}`, null);
        });
    }
    unLockSupport(supportId, dispatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UnLockSupport?id=${supportId}&dispatcher=${dispatcherName}`, null);
        });
    }
    getDriverLocations(selectedViews) {
        return __awaiter(this, void 0, void 0, function* () {
            const filteredViews = selectedViews.filter(view => view.selected);
            const despatchViewIds = this._prepareViewIdsForRequest(filteredViews);
            const params = new URLSearchParams();
            despatchViewIds.forEach(id => {
                params.append("despatchViewIds", id.toString());
            });
            const response = yield this.$http.get(`courier?${params.toString()}&isUsTenant=${this.isUsCustomer}`);
            return response.data;
        });
    }
    getDriverDestinationEnvelope(clearListId) {
        return __awaiter(this, void 0, void 0, function* () {
            const countryId = this.isUsCustomer ? 2 : 1;
            const response = yield this.$http.get(`courier/ClearListEnvelope?clearListId=${clearListId}&countryId=${countryId}`);
            return response.data;
        });
    }
    getActiveCouriers() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("courier/active");
            return response.data;
        });
    }
    getAllCouriers() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("courier/AllActive");
            return response.data;
        });
    }
    getActiveClients() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("home/ActiveClients");
            return response.data;
        });
    }
    getClientContacts(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`home/ClientContacts?contactId=${contactId}`);
            return response.data;
        });
    }
    getPotentialCouriers(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/PotentialCouriers?jobId=${jobId}`);
            return response.data;
        });
    }
    getCourierPosition(code) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/location?code=${code}`);
            return response.data;
        });
    }
    getCourierById(courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/GetCourier?courierId=${courierId}`);
            return response.data;
        });
    }
    getAvailableCourierLocation(minLng, minLat, maxLng, maxLat) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/AvailableCourierLocation?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}&isUsTenant=${this.isUsCustomer}`);
            return response.data;
        });
    }
    getSuburbList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/SuburbList");
            return response.data;
        });
    }
    getSpeedList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/SpeedList");
            return response.data;
        });
    }
    getContactList(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/ContactList?clientId=${clientId}`);
            return response.data;
        });
    }
    getLeaveList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/LeaveList");
            return response.data;
        });
    }
    getUndeliverableList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/UndeliverableList");
            return response.data;
        });
    }
    getInternalStatusList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/InternalStatusList");
            return response.data;
        });
    }
    getStatusList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("job/StatusList");
            return response.data;
        });
    }
    lateCall(lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact, staffId, jobTime, jobId, jobType, bookedSpeed, notifiedSpeed, despatcherName, calculationRequired) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "job/LateCall";
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
                const response = yield this.$http.post(url, data, { headers: { 'Content-Type': "application/json" } });
                return response.data;
            }
            catch (error) {
                console.error("Error in lateCall:", error);
                throw error;
            }
        });
    }
    rateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/RateTruckJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${bookedDate}&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime}&truckHours=${truckHours}`);
            return response.data;
        });
    }
    truckJobAmountBreakdown(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours, gstRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/TruckJobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${bookedDate}&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime}&truckHours=${truckHours}&gstRate=${gstRate}`);
            return response.data;
        });
    }
    rateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/RateJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight}&size=${size}&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${quantity}&booked=${booked}`);
            return response.data;
        });
    }
    rateJobUS(jobDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            const generateQueryString = (params) => {
                return Object.entries(params)
                    .map(([key, value]) => {
                    if (value instanceof Date) {
                        value = value.toISOString();
                    }
                    // Handle boolean values
                    if (typeof value === 'boolean') {
                        value = value.toString();
                    }
                    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                })
                    .join("&");
            };
            // Prepare query string from jobDetails object
            const queryString = generateQueryString(jobDetails);
            // Make the HTTP request
            const response = yield this.$http.get(`job/RateJobUs?${queryString}`);
            return response.data;
        });
    }
    jobAmountBreakdown(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId, ourRef, refA, refB, quantity, booked, gstRate, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/JobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight}&size=${size}&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${quantity}&booked=${booked}&gstRate=${gstRate}&amount=${amount}`);
            return response.data;
        });
    }
    ppdExclusiveAmount(clientId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/PPDExclusiveAmount?clientId=${clientId}&amount=${amount}`);
            return response.data;
        });
    }
    getServices(clientId, speedId, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "job/GetAllClientItems";
            const response = yield this.$http.get(url + "?clientId=" + clientId + "&speedId=" + speedId + "&jobId=" + jobId);
            return response.data;
        });
    }
    addServicesToJob(jobId, serviceIds, totalCost) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "job/AddClientItemsToJob";
            yield this.$http({
                method: "POST", url: url + "?jobId=" + jobId, data: { serviceIds, totalCost }
            });
        });
    }
    splitJob(jobId, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/splitJob?jobId=${jobId}&despatcherName=${despatcherName}`, null);
        });
    }
    finishSplitJobProcess(jobId, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/finishSplitJobProcess?jobId=${jobId}&despatcherName=${despatcherName}`, null);
        });
    }
    updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdatePODDetails?jobNumber=${jobNumber}&jobStatus=${jobStatus}&podName=${podName}&podTime=${podTime}`, null);
        });
    }
    sendSMS(courierId, staffId, despatcherName, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`job/SendSMS?courierId=${courierId}&dispId=${staffId}&despatcherName=${despatcherName}&message=${message}`, null);
            return response.data;
        });
    }
    reRateSplitJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/ReRateSplitJob?jobId=${jobId}`, null);
        });
    }
    updateDeliveryAddress(jobId, rate, despatcherName, prebook, addressData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let endpoint = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
                console.log(`Using endpoint: ${endpoint}`);
                // Create the appropriate request body based on country
                let requestBody;
                if (!this.isUsCustomer) {
                    requestBody = {
                        jobId: jobId,
                        rate: rate,
                        despatcherName: despatcherName,
                        address: addressData.address,
                        suburbId: addressData.toSuburbId,
                        cbd: addressData.cbd,
                        latitude: addressData.latitude,
                        longitude: addressData.longitude
                    };
                    endpoint += "Nz";
                }
                else {
                    requestBody = {
                        jobId: jobId,
                        rate: rate,
                        despatcherName: despatcherName,
                        address: {
                            addressLine1: addressData.addressLine1,
                            addressLine2: addressData.addressLine2,
                            addressLine3: addressData.addressLine3,
                            addressLine4: addressData.addressLine4,
                            addressLine5: addressData.addressLine5,
                            addressLine6: addressData.addressLine6,
                            addressLine7: addressData.addressLine7,
                            latitude: addressData.latitude,
                            longitude: addressData.longitude
                        }
                    };
                    endpoint += "Us";
                }
                console.log(`Address Update Request: ${requestBody}`);
                yield this.$http.post(endpoint, requestBody);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    updateBulkDeliveryAddress(bulkJobId, toSuburb, toPostCode, address, lat, lng, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdateBulkDeliveryAddress?bulkJobId=${bulkJobId}&toSuburb=${toSuburb}&toPostCode=${toPostCode}&address=${address}&deliveryLat=${lat}&deliveryLng=${lng}&despatcherName=${despatcherName}`, null);
        });
    }
    updatePickupAddress(jobId, rate, despatcherName, prebook, addressData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let endpoint = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
                console.log(`Using endpoint: ${endpoint}`);
                // Create the appropriate request body based on country
                let requestBody;
                if (!this.isUsCustomer) {
                    requestBody = {
                        jobId: jobId,
                        rate: rate,
                        despatcherName: despatcherName,
                        address: addressData.address,
                        suburbId: addressData.toSuburbId,
                        cbd: addressData.cbd,
                        latitude: addressData.latitude,
                        longitude: addressData.longitude
                    };
                    endpoint += "Nz";
                }
                else {
                    requestBody = {
                        jobId: jobId,
                        rate: rate,
                        despatcherName: despatcherName,
                        address: {
                            addressLine1: addressData.addressLine1,
                            addressLine2: addressData.addressLine2,
                            addressLine3: addressData.addressLine3,
                            addressLine4: addressData.addressLine4,
                            addressLine5: addressData.addressLine5,
                            addressLine6: addressData.addressLine6,
                            addressLine7: addressData.addressLine7,
                            latitude: addressData.latitude,
                            longitude: addressData.longitude
                        }
                    };
                    endpoint += "Us";
                }
                console.log(`Address Update Request: ${requestBody}`);
                yield this.$http.post(endpoint, requestBody);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    updateBulkPickupAddress(bulkJobId, fromSuburb, fromPostCode, address, lat, lng, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdateBulkPickupAddress?bulkJobId=${bulkJobId}&fromSuburb=${fromSuburb}&fromPostCode=${fromPostCode}&address=${address}&pickupLat=${lat}&pickupLng=${lng}&despatcherName=${despatcherName}`, null);
        });
    }
    updateJobType(jobId, jobType, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdateJobType?jobId=${jobId}&jobType=${jobType}&despatcherName=${despatcherName}`, null);
        });
    }
    updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/UpdateSplitJobAddress?jobId=${jobId}&toSuburbId=${toSuburbId}&address=${address}&deliveryLat=${lat}&deliveryLng=${lng}`, null);
        });
    }
    releaseBulkJob(jobNumber, bookDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedBookDate = this.moment(bookDate).format("YYYY-MM-DD");
            yield this.$http.post(`job/ReleaseBulkJob?jobNumber=${jobNumber}&bookDate=${formattedBookDate}`, null);
        });
    }
    updateJobDetail(jobId, field, value, rate, preBook) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Starting updateJobDetail:", {
                jobId, field, initialValue: value, rate, preBook
            });
            const originalValue = value;
            let processedValue = value;
            let processedField = field;
            // Format time fields
            if (field === "Time" || field === "CompletedTime") {
                const currentDate = this.moment().format("YYYY-MM-DD");
                const timeValue = this.moment(value).format("HH:mm:ss");
                processedValue = `${currentDate} ${timeValue}`;
                console.log("Formatted time field:", { field, originalValue, formattedValue: processedValue });
            }
            // Format followup time
            if (field === "FollowupTime") {
                const dateValue = this.moment(value).format("YYYY-MM-DD");
                const timeValue = this.moment(value).format("HH:mm:ss");
                processedValue = `${dateValue} ${timeValue}`;
                console.log("Formatted followup time:", { field, originalValue, formattedValue: processedValue });
            }
            // Format date fields
            const dateFields = ["Date", "StopDate", "RestartDate", "InActiveDate", "FirstDue", "LastDone", "NextDue", "DueDate"];
            if (dateFields.includes(field)) {
                processedValue = this.moment(value).format("YYYY-MM-DD");
                console.log("Formatted date field:", { field, originalValue, formattedValue: processedValue });
            }
            // Handle field rename
            if (field === "DeliverToContact") {
                processedField = "ToContactName";
                console.log("Renamed field:", { oldField: field, newField: processedField });
            }
            // Format rate
            const processedRate = typeof rate === "string" ? rate.replace(/[$]/g, "") : rate;
            if (typeof rate === "string") {
                console.log("Formatted rate:", { originalRate: rate, formattedRate: processedRate });
            }
            const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
            // Create URL parameters with proper encoding
            const params = new URLSearchParams({
                jobId: String(jobId),
                field: processedField,
                value: String(processedValue !== null && processedValue !== void 0 ? processedValue : ''),
                rate: String(processedRate !== null && processedRate !== void 0 ? processedRate : ''),
                despatcherName: String(FirstName),
                staffId: String(contants_1.ContactID)
            });
            const url = `${method}?${params.toString()}`;
            try {
                const response = yield this.$http.post(url, null);
                console.log("API response received:", {
                    status: response.status,
                    data: response.data
                });
                return response.data;
            }
            catch (error) {
                console.error("API request failed:", {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    parameters: { jobId, field: processedField, value: processedValue, rate: processedRate }
                });
                throw error;
            }
        });
    }
    updateBulkJobDetail(bulkJobId, field, value, rate, despatcherName, staffId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (field === "Time" || field === "CompletedTime") {
                value = this.moment().format("YYYY-MM-DD") + " " + this.moment(value).format("HH:mm:ss");
            }
            if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
                value = this.moment(value).format("YYYY-MM-DD");
            }
            yield this.$http.post(`job/UpdateBulkJob?bulkJobId=${bulkJobId}&field=${field}&value=${value}&rate=${rate}&despatcherName=${despatcherName}&staffId=${staffId}`, null);
        });
    }
    getJobsWithFilters(queryParams, selectedClients, internal, selectedAreas) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);
            const paramObject = {
                status: String((_a = queryParams.status) !== null && _a !== void 0 ? _a : "all"),
                order: String((_b = queryParams.order) !== null && _b !== void 0 ? _b : "time"),
                orderDirection: String((_c = queryParams.orderDirection) !== null && _c !== void 0 ? _c : "asc"),
                isInternal: String(internal),
                cid: String(contants_1.ContactID),
                clientIds: selectedClients.length ? selectedClients.join(',') : ''
            };
            const params = new URLSearchParams(paramObject);
            // Add despatch view IDs as separate parameters
            if (despatchViewIds.length) {
                despatchViewIds.forEach(id => {
                    params.append('despatchViewIds', String(id));
                });
            }
            const response = yield this.$http.get(`job?${params.toString()}`);
            return response.data;
        });
    }
    getClearListJobs(queryParams, selectedClients, internal, selectedAreas, selectedClearList) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);
            const defaultParams = {
                status: 'all',
                order: 'time',
                orderDirection: 'asc'
            };
            // Create params object with explicit string conversion
            const paramObject = {
                status: String((_a = queryParams.status) !== null && _a !== void 0 ? _a : defaultParams.status),
                order: String((_b = queryParams.order) !== null && _b !== void 0 ? _b : defaultParams.order),
                asc: String((_c = queryParams.orderDirection) !== null && _c !== void 0 ? _c : defaultParams.orderDirection),
                isInternal: String(internal),
                cid: String(contants_1.ContactID),
                clientIds: selectedClients.length ? selectedClients.join(',') : '',
                minimumLatitude: String(selectedClearList.minimumLatitude),
                maximumLatitude: String(selectedClearList.maximumLatitude),
                minimumLongitude: String(selectedClearList.minimumLongitude),
                maximumLongitude: String(selectedClearList.maximumLongitude)
            };
            const params = new URLSearchParams(paramObject);
            // Add despatch view IDs
            if (despatchViewIds.length) {
                despatchViewIds.forEach(id => {
                    params.append('despatchViewIds', String(id));
                });
            }
            const response = yield this.$http.get(`job/GetJobsByClearListEnvelope?${params.toString()}`);
            return response.data;
        });
    }
    autocompleteAddressSearch(text) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http({
                url: "https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json", method: "GET", params: {
                    query: text,
                    app_id: "bBPfh2x8Cauun3ygLMAx",
                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                    country: this.isUsCustomer ? "USA" : "NZL"
                }
            });
            return response.data;
        });
    }
    getGeoCodeInformation(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("https://geocoder.cit.api.here.com/6.2/geocode.json", {
                params: {
                    app_id: "bBPfh2x8Cauun3ygLMAx", app_code: "yjfwTdkin_R2rGXYTrwWVg", locationId: item.id
                }
            });
            return response.data;
        });
    }
    retrieveAddresses(lat, long) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
                params: {
                    app_id: "bBPfh2x8Cauun3ygLMAx",
                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                    mode: "retrieveAddresses",
                    prox: lat.toString() + "," + long.toString() + "," + "250"
                }
            });
            return response.data;
        });
    }
    autocompleteSearch(searchTerm, url) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(url, {
                params: {
                    searchTerm: searchTerm
                }
            });
            return response.data;
        });
    }
    isFilesAttachedToJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/IsFilesAttachedToJob/${jobId}`);
            return response.data;
        });
    }
    getVehicleSizes() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`courier/GetVehicleSizes`);
            return response.data;
        });
    }
    updatePackages(jobId, parcels) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.$http.post('job/UpdateJobPackages', {
                    jobId: jobId,
                    parcels: parcels
                });
                return response.data;
            }
            catch (error) {
                console.error('Error updating packages:', error);
                throw error;
            }
        });
    }
    getAllJobTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/GetJobTypes`);
            return response.data;
        });
    }
    getPriceBreakdown(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`job/GetPricingBreakdown?jobId=${jobId}`);
            return response.data;
        });
    }
    getJobDeliveryPhotosAndSignature(jobId, year, month) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`/Job/GetJobDeliveryPhotosAndSignature?jobId=${jobId}&year=${year}&month=${month}`);
            return response.data;
        });
    }
    _prepareViewIdsForRequest(selectedAreas) {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}
DispatchCoreService.$inject = ["$http", "moment", "APP_CONFIG"];
exports.default = DispatchCoreService;
