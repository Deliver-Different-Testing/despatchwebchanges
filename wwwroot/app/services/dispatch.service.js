import app from "../app";

class dispatchService {
    static $inject = ["$http", "moment", "APP_CONFIG"];

    /**
     * @param {Object} $http
     * @param {Object} moment
     * @param {APP_CONFIG} appConfig
     */
    constructor($http, moment, appConfig) {
        this.$http = $http;
        this.moment = moment;
        this.isUsCustomer = appConfig.US_Customer;
    }

    /**
     * @param {number} userId
     * @param {number} pageId
     */
    async getSelectedViews(userId, pageId) {
        const response = await this.$http.get(`home/GetPageViews?userid=${userId}&pageid=${pageId}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addNote(jobId, note, despatcherName, preBook) {
        const method = preBook ? "job/AddJobBookingNote" : "job/UpdateNote";
        await this.$http.post(method + "?jobId=" + jobId + "&note=" + note);
    }

    /**
     * @param {number} jobId
     * @param {string} conNote
     */
    async addConNote(jobId, conNote) {
        await this.$http.post(`job/UpdateConnote?jobId= ${jobId}&conNote=${conNote}`);
    }

    /**
     * @param {number} bulkJobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        await this.$http.post(`job/AddBulkJobNote?BulkJobId=${bulkJobId}&note=${note}&despatcher=${despatcherName}`);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this.$http.post("job/AddPallet", pallet, {
            params: {
                preBook,
                despatcher: despatcherName
            }
        });

        return response.data;
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async editPallet(pallet, preBook, despatcherName) {
        const response = await this.$http.post("job/EditPallet", pallet, {
            params: {
                preBook,
                despatcher: despatcherName
            }
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
        return;

        /* const response = await this.$http.post('courier/AddFollowupEvent', null, {
             params: {
                 jobNo,
                 clientId,
                 contact,
                 staffId,
                 courierId,
                 jobId,
                 jobType,
                 despatcherName
             }
         });
         return response.data;*/
    }

    /**
     * Sends a request to add a restore event for a specific job.
     *
     * @param {string} jobNo - The Number identifier of the job.
     * @param {number} clientId - The identifier of the client.
     * @param {string} contact - Contact related to the event.
     * @param {number} staffId - The identifier of the staff member involved.
     * @param {number} courierId - The identifier of the courier.
     * @param {number} jobId - The identifier of the job.
     * @param {string} jobType - The type of the job.
     * @param {string} despatcherName - The name of the despatcher.
     */
    async addRestoreEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        const response = await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobNo,
                clientId,
                contact,
                staffId,
                courierId,
                jobId,
                jobType,
                despatcherName
            }
        });

        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        await this.$http.post("job/Allocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds
            }
        });
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        await this.$http.post("job/ReAllocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds
            }
        });
    }

    /**
     * @param {number} jobId
     * @param {number} courierId
     */
    async setFirstJob(jobId, courierId) {
        await this.$http.post("job/SetFirstJob", null, {
            params: {
                jobId,
                courierId
            }
        });
    }

    /**
     * @param {number} courierId
     */
    async truckCourierStatus(courierId) {
        await this.$http.get(`courier/TruckCourierStatus?courierId=${courierId}`);
    }

    /**
     * @param {string} jobNumber
     */
    async validateSwapPOD(jobNumber) {
        const response = await this.$http.post(`Job/ValidateSwapPOD?job=${jobNumber}`);
        return response.data;
    }

    /**
     * @param {string} jobNumber1
     * @param {string} jobNumber2
     */
    async swapPOD(jobNumber1, jobNumber2) {
        const response = await this.$http.post(`Job/SwapPOD?job1=${jobNumber1}&job2=${jobNumber2}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async voidJob(jobId) {
        await this.$http.post(`job/Void?jobId=${jobId}`);
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this.$http.post(`job/RestoreJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this.$http.post(`job/RestoreSplitJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async resendJobs(jobIds) {
        const response = await this.$http.post(`job/ResendSelected?jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number} courierId
     */
    async resendAllJobs(courierId) {
        const response = await this.$http.post(`job/ResendAll?courierId=${courierId}`);
        return response.data;
    }

    /**
     * @param {number[]} jobIds
     */
    async reAssignJobs(jobIds) {
        const response = await this.$http.post(`job/ReAssignSelected?jobIds=${jobIds}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {string} email
     */
    async sendPOD(jobId, email) {
        const response = await this.$http.get(`job/SendPOD?jobId=${jobId}&toEmail=${email}`);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} speedId
     */
    async hasClientItemsAvailable(clientId, speedId) {
        const response = await this.$http.get(`job/HasClientItemsAvailable?clientId=${clientId}&speedId=${speedId}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getJobDetail(jobId) {
        const response = await this.$http.get(`/Job/Detail?jobId=${jobId}`);
        return response.data;
    }

    /**
     * @param {number} parentId
     * @param {number} clientId
     */
    async getRelatedJobs(parentId, clientId) {
        const response = await this.$http.get(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
        return response.data;
    }
    /**
     * @param {number} courierId
     * @param {boolean} done
     */
    async getJobsCurrent(courierId, done) {
        const response = await this.$http.get(`job/current?courierId=${courierId}&done=${done}`);
        return response.data;
    }

    /**
     * @param {string} channel
     */
    async getSupports(channel) {
        const response = await this.$http.get(`job/supports?channel=${channel}`);
        return response.data;
    }

    /**
     * Closes the support request with the provided supportId and marks it closed by the provided staffId.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {number} staffId - The unique identifier of the staff member marking the request as closed.
     */
    async closeSupport(supportId, staffId) {
        await this.$http.post(`job/CloseSupport?supportId=${supportId}&staffId=${staffId}`);
    }

    /**
     * Locks a support request with the provided id and locks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher locking the request.
     */
    async lockSupport(supportId, dispatcherName) {
        await this.$http.post(`job/LockSupport?id=${supportId}&dispatcher=${dispatcherName}`);
    }

    /**
     * Unlocks a support request with the provided id and unlocks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher unlocking the request.
     */
    async unLockSupport(supportId, dispatcherName) {
        await this.$http.post(`job/UnLockSupport?id=${supportId}&dispatcher=${dispatcherName}`);
    }

    /**
     * @param {Suggestion[]} selectedViews
     */
    async getDriverLocations(selectedViews) {
        // Make sure we only get the selected views
        const filteredViews = selectedViews.filter(view => view.selected);
        const despatchViewIds = this._prepareViewIdsForRequest(filteredViews);

        const params = new URLSearchParams();

        // Append each despatchViewId as a separate query parameter
        despatchViewIds.forEach(id => {
            params.append("despatchViewIds", id.toString());
        });

        const response = await this.$http.get(`courier?${params.toString()}&isUsTenant=${this.isUsCustomer}`);
        return response.data;
    }

    /**
     * @param {number} clearListId
     */
    async getDriverDestinationEnvelope(clearListId) {
        const countryId = this.isUsCustomer ? 2 : 1;

        const response = await this.$http.get(`courier/ClearListEnvelope?clearListId=${clearListId}&countryId=${countryId}`);
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this.$http.get("courier/active");
        return response.data;
    }

    async getAllCouriers() {
        const response = await this.$http.get("courier/AllActive");
        return response.data;
    }

    async getActiveClients() {
        const response = await this.$http.get("home/ActiveClients");
        return response.data;
    }

    /**
     * @param {number} contactId
     */
    async getClientContacts(contactId) {
        const response = await this.$http.get(`home/ClientContacts?contactId=${contactId}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async getPotentialCouriers(jobId) {
        const response = await this.$http.get(`courier/PotentialCouriers?jobId=${jobId}`);
        return response.data;
    }

    /**
     * @param {string} code
     */
    async getCourierPosition(code) {
        const response = await this.$http.get(`courier/location?code=${code}`);
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
        const response = await this.$http.get(`courier/AvailableCourierLocation?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}&isUsTenant=${this._isUsCustomer}`);
        return response.data;
    }

    async getSuburbList() {
        const response = await this.$http.get("job/SuburbList");
        return response.data;
    }

    async getSpeedList() {
        const response = await this.$http.get("job/SpeedList");
        return response.data;
    }

    /**
     * Retrieves the contact list for the client with the provided clientId.
     *
     * @param {number} clientId - The unique identifier of the client.
     */
    async getContactList(clientId) {
        const response = await this.$http.get(`job/ContactList?clientId=${clientId}`);
        return response.data;
    }

    async getLeaveList() {
        const response = await this.$http.get("job/LeaveList");
        return response.data;
    }

    async getUndeliverableList() {
        const response = await this.$http.get("job/UndeliverableList");
        return response.data;
    }

    async getInternalStatusList() {
        const response = await this.$http.get("job/InternalStatusList");
        return response.data;
    }

    async getStatusList() {
        const response = await this.$http.get("job/StatusList");
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
            const response = await this.$http.post(url, data, {headers: {'Content-Type': "application/json"}});
            return response.data;
        } catch (error) {
            console.error("Error in lateCall:", error);
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
        const response = await this.$http.get(`job/RateTruckJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${bookedDate
            }&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime
            }&truckHours=${truckHours}`);
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
        const response = await this.$http.get(`job/TruckJobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${
            bookedDate}&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime
            }&truckHours=${truckHours}&gstRate=${gstRate}`);
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
        const response = await this.$http.get(`job/RateJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight}&size=${size
            }&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${quantity
            }&booked=${booked}`);
        return response.data;
    }

    /**
     * @param {object} jobDetails - An object containing all the job details.
     * @param {number} jobDetails.jobId
     * @param {number} jobDetails.clientId
     * @param {number} jobDetails.speed
     * @param {string} jobDetails.fromZipCode
     * @param {string} jobDetails.toZipCode
     * @param {number} jobDetails.weight
     * @param {Date} jobDetails.booked
     * @param {number} jobDetails.size
     * @param {boolean} jobDetails.dangerousGoods
     * @param {number} jobDetails.totalPallets
     * @param {number} jobDetails.extraStopOffs
     * @param {number} jobDetails.dryIceWeight
     * @param {number} jobDetails.waitTime
     * @param {number} jobDetails.fromLat
     * @param {number} jobDetails.fromLong
     * @param {number} jobDetails.toLat
     * @param {number} jobDetails.toLong
     */
    async rateJobUS(jobDetails) {
        // Helper function to generate a query string
        const generateQueryString = (params) => {
            return Object.entries(params)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join("&");
        };

        // Prepare query string from jobDetails object
        const queryString = generateQueryString(jobDetails);

        // Make the HTTP request
        const response = await this.$http.get(`job/RateJobUs?${queryString}`);
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
        const response = await this.$http.get(`job/JobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight
            }&size=${size}&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${
            quantity}&booked=${booked}&gstRate=${gstRate}&amount=${amount}`);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} amount
     */
    async ppdExclusiveAmount(clientId, amount) {
        const response = await this.$http.get(`job/PPDExclusiveAmount?clientId=${clientId}&amount=${amount}`);
        return response.data;
    }

    /**
     * @param {number} clientId
     * @param {number} speedId
     * @param {number} jobId
     */
    async getServices(clientId, speedId, jobId) {
        const url = "job/GetAllClientItems";
        const response = await this.$http.get(url + "?clientId=" + clientId + "&speedId=" + speedId + "&jobId=" + jobId);

        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {number[]} serviceIds
     * @param {number} totalCost
     */
    async addServicesToJob(jobId, serviceIds, totalCost) {
        const url = "job/AddClientItemsToJob"

        await this.$http({
            method: "POST", url: url + "?jobId=" + jobId, data: {serviceIds, totalCost}
        });
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        await this.$http.post(`job/splitJob?jobId=${jobId}&despatcherName=${despatcherName}`);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async finishSplitJobProcess(jobId, despatcherName) {
        await this.$http.post(`job/finishSplitJobProcess?jobId=${jobId}&despatcherName=${despatcherName}`);
    }

    /**
     * @param {string} jobNumber
     * @param {number} jobStatus
     * @param {string} podName
     * @param {Date} podTime
     */
    async updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        await this.$http.post(`job/UpdatePODDetails?jobNumber=${jobNumber}&jobStatus=${jobStatus}&podName=${podName}&podTime=${podTime}`);
    }

    /**
     * @param {number} courierId
     * @param {number} staffId
     * @param {string} despatcherName
     * @param {string} message
     */
    async sendSMS(courierId, staffId, despatcherName, message) {
        const response = await this.$http.post(`job/SendSMS?courierId=${courierId}&dispId=${staffId}&despatcherName=${despatcherName}&message=${message}`);
        return response.data;
    }

    /**
     * @param {number} jobId
     */
    async reRateSplitJob(jobId) {
        await this.$http.post(`job/ReRateSplitJob?jobId=${jobId}`);
    }

    /**
     * @param {number} jobId
     * @param {number} rate
     * @param {string} despatcherName
     * @param {boolean} prebook
     * @param {Object} addressData - Contains either NZ or US specific address data
     */
    async updateDeliveryAddress(jobId, rate, despatcherName, prebook, addressData) {
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
            } else {
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
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * @param {number} bulkJobId
     * @param {number} toSuburb
     * @param {string|Number} toPostCode
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     * @param {string} despatcherName
     */
    async updateBulkDeliveryAddress(bulkJobId, toSuburb, toPostCode, address, lat, lng, despatcherName) {
        await this.$http.post(`job/UpdateBulkDeliveryAddress?bulkJobId=${bulkJobId}&toSuburb=${toSuburb}&toPostCode=${toPostCode}&address=${address}&deliveryLat=${lat}&deliveryLng=${
            lng}&despatcherName=${despatcherName}`);
    }

    /**
     * @param {number} jobId
     * @param {number} rate
     * @param {string} despatcherName
     * @param {boolean} prebook
     * @param {Object} addressData - Contains either NZ or US specific address data
     */
    async updatePickupAddress(jobId, rate, despatcherName, prebook, addressData) {
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
            } else {
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
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(error);
        }
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
        await this.$http.post(`job/UpdateBulkPickupAddress?bulkJobId=${bulkJobId}&fromSuburb=${fromSuburb}&fromPostCode=${fromPostCode}&address=${address}&pickupLat=${lat}&pickupLng=${lng
            }&despatcherName=${despatcherName}`);
    }

    /**
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async updateJobType(jobId, jobType, despatcherName) {
        await this.$http.post(`job/UpdateJobType?jobId=${jobId}&jobType=${jobType}&despatcherName=${despatcherName}`);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        await this.$http.post(`job/UpdateSplitJobAddress?jobId=${jobId}&toSuburbId=${toSuburbId}&address=${address}&deliveryLat=${lat}&deliveryLng=${lng}`);
    }

    /**
     * @param {string} jobNumber
     * @param {Date} bookDate
     */
    async releaseBulkJob(jobNumber, bookDate) {
        const formattedBookDate = this.moment(bookDate).format("YYYY-MM-DD");
        await this.$http.post(`job/ReleaseBulkJob?jobNumber=${jobNumber}&bookDate=${formattedBookDate}`);
    }

    /**
     * @param {number} jobId
     * @param {string} field
     * @param {string|Date|Number} value
     * @param {number} rate
     * @param {string} despatcherName
     * @param {number} staffId
     * @param {boolean} preBook
     */
    async updateJobDetail(jobId, field, value, rate, despatcherName, staffId, preBook) {
        console.log("Starting updateJobDetail:", {
            jobId,
            field,
            initialValue: value,
            rate,
            despatcherName,
            staffId,
            preBook
        });

        let originalValue = value;

        // Handle time fields
        if (field === "Time" || field === "CompletedTime") {
            const currentDate = this.moment().format("YYYY-MM-DD");
            const timeValue = this.moment(value).format("HH:mm:ss");
            value = currentDate + " " + timeValue;
            console.log("Formatted time field:", { field, originalValue, formattedValue: value });
        }

        // Handle followup time
        if (field === "FollowupTime") {
            const dateValue = this.moment(value).format("YYYY-MM-DD");
            const timeValue = this.moment(value).format("HH:mm:ss");
            value = dateValue + " " + timeValue;
            console.log("Formatted followup time:", { field, originalValue, formattedValue: value });
        }

        // Handle date fields
        const dateFields = ["Date", "StopDate", "RestartDate", "InActiveDate", "FirstDue", "LastDone", "NextDue"];
        if (dateFields.includes(field)) {
            value = this.moment(value).format("YYYY-MM-DD");
            console.log("Formatted date field:", {field, originalValue, formattedValue: value});
        }

        // Handle contact field rename
        if (field === "DeliverToContact") {
            const oldField = field;
            field = "ToContactName";
            console.log("Renamed field:", { oldField, newField: field });
        }

        // Handle rate formatting
        if (rate && typeof rate === "string") {
            const originalRate = rate;
            rate = rate.replace(/[$]/g, "");
            console.log("Formatted rate:", { originalRate, formattedRate: rate });
        }

        const method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
        const url = `${method}?jobId=${jobId}&field=${field}&value=${value}&rate=${rate}&despatcherName=${despatcherName}&staffId=${staffId}`;

        console.log("Making API request:", {
            method: "POST",
            url,
            parameters: {
                jobId,
                field,
                value,
                rate,
                despatcherName,
                staffId
            }
        });

        try {
            const response = await this.$http.post(url);
            console.log("API response received:", {
                status: response.status,
                data: response.data
            });
            return response.data;
        } catch (error) {
            console.error("API request failed:", {
                error: error.message,
                parameters: {
                    jobId,
                    field,
                    value,
                    rate,
                    despatcherName,
                    staffId
                }
            });
            throw error;
        }
    }
    /**
     * @param {number} bulkJobId
     * @param {string} field
     * @param {string|Number|Date} value
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
        await this.$http.post(`job/UpdateBulkJob?bulkJobId=${bulkJobId}&field=${field}&value=${value}&rate=${rate}&despatcherName=${despatcherName}&staffId=${staffId}`);
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {String[]} selectedClients
     * @param {boolean} internal
     * @param {Suggestion[]} selectedAreas
     */
    async getJobsWithFilters(queryParams, selectedClients, internal, selectedAreas) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const params = new URLSearchParams({
            status: queryParams.status || "all",
            order: queryParams.order || "time",
            orderDirection: queryParams.orderDirection || "asc",
            page: queryParams.page || 1,
            limit: queryParams.limit || 10,
            isInternal: internal.toString(),
            cid: ContactID,
            clientIds: selectedClients.join(",")
        });

        // Append each despatchViewId as a separate query parameter
        despatchViewIds.forEach(id => {
            params.append("despatchViewIds", id.toString());
        });

        const response = await this.$http.get(`job?${params.toString()}`);
        return {
            items: response.data.items,
            total: response.data.total,
            page: queryParams.page || 1,
            limit: queryParams.limit || 10
        };
    }

    /**
     * @param {JobQueryParams} queryParams
     * @param {String[]} selectedClients
     * @param {boolean} internal
     * @param {Suggestion[]} selectedAreas
     * @param {ClearListEnvelope} selectedClearList
     */
    async getClearListJobs(queryParams, selectedClients, internal, selectedAreas, selectedClearList) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const params = new URLSearchParams({
            status: queryParams.status || "all",
            order: queryParams.order || "time",
            asc: queryParams.asc || "asc",
            isInternal: internal.toString(),
            cid: ContactID,
            clientIds: selectedClients.join(","),
            minimumLatitude: selectedClearList.minimumLatitude,
            maximumLatitude: selectedClearList.maximumLatitude,
            minimumLongitude: selectedClearList.minimumLongitude,
            maximumLongitude: selectedClearList.maximumLongitude
        });

        // Append each despatchViewId as a separate query parameter
        despatchViewIds.forEach(id => {
            params.append("despatchViewIds", id.toString());
        });

        const response = await this.$http.get(`job/GetJobsByClearListEnvelope?${params.toString()}`);
        return response.data;
    }

    /**
     * Retrieves the auto-complete search results for the given address text from a geocoder service.
     *
     * @param {string} text - The search text for which auto-complete results are to be fetched.
     */
    async autocompleteAddressSearch(text) {
        const response = await this.$http({
            url: "https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json", method: "GET", params: {
                query: text,
                app_id: "bBPfh2x8Cauun3ygLMAx",
                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                country: this.isUsCustomer ? "USA" : "NZL"
            }
        });
        return response.data;
    }

    /**
     * @param {Suggestion} item
     */
    async getGeoCodeInformation(item) {
        const response = await this.$http.get("https://geocoder.cit.api.here.com/6.2/geocode.json", {
            params: {
                app_id: "bBPfh2x8Cauun3ygLMAx", app_code: "yjfwTdkin_R2rGXYTrwWVg", locationId: item.id
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
        const response = await this.$http.get("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
            params: {
                app_id: "bBPfh2x8Cauun3ygLMAx",
                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                mode: "retrieveAddresses",
                prox: lat.toString() + "," + long.toString() + "," + "250"
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
        const response = await this.$http.get(url, {
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
        const response = await this.$http.get(`job/IsFilesAttachedToJob/${jobId}`);
        return response.data;
    }

    async getVehicleSizes() {
        const response = await this.$http.get(`courier/GetVehicleSizes`);
        return response.data;
    }

    /**
     * @param {number} jobId
     * @param {ParcelDimensions[]} parcels
     * @returns {Promise<any>}
     */
    async updatePackages(jobId, parcels) {
        try {
            const response = await this.$http.post('job/UpdateJobPackages', {
                jobId: jobId,
                parcels: parcels
            });
            return response.data;
        } catch (error) {
            console.error('Error updating packages:', error);
            throw error;
        }
    }

    /**
     * Returns a list of the individual components that make up the price
     *
     * @param {number} jobId
     * @returns {Promise<PriceBreakdown[]>} The detailed price breakdown for the job
     */
    async getPriceBreakdown(jobId) {
        const response = await this.$http.get(`job/GetPricingBreakdown?jobId=${jobId}`);
        return response.data;
    }

    /**
     * @param {Suggestion[]} selectedAreas
     * @returns {Array}
     * @private
     */
    _prepareViewIdsForRequest(selectedAreas) {
        return selectedAreas.map(area => {
            const id = typeof area === "object" && area.id ? area.id : area;
            return parseInt(id, 10); // Convert to integer
        });
    }
}

app.service("DispatchData", dispatchService);
