class DispatchData {
    constructor($http, moment, APP_CONFIG) {
        this._$http = $http;
        this._moment = moment;
        this._isUsCustomer = APP_CONFIG.US_Customer;
    }

    /**
     * @param {number} userId
     * @param {number} pageId
     */
    async getSelectedViews(userId, pageId) {
        const response = await this._$http.get('home/GetPageViews?userid=' + userId + '&pageid=' + pageId);
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
        await this._$http.post(method + '?jobId=' + jobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {number} bulkJobId
     * @param {string} note
     * @param {string} despatcherName
     * @param {boolean} preBook
     */
    async addBulkJobNote(bulkJobId, note, despatcherName, preBook) {
        await this._$http.post('job/AddBulkJobNote?BulkJobId=' + bulkJobId + '&note=' + note + '&despatcher=' + despatcherName);
    }

    /**
     * @param {Pallet} pallet
     * @param {boolean} preBook
     * @param {string} despatcherName
     */
    async addPallet(pallet, preBook, despatcherName) {
        const response = await this._$http.post('job/AddPallet', pallet, {
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
        const response = await this._$http.post('job/EditPallet', pallet, {
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
    async deletePallet(pallet, preBook, despatcherName) {
        const response = await this._$http.post('job/DeletePallet', pallet, {
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

        /* const response = await this._$http.post('courier/AddFollowupEvent', null, {
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
        const response = await this._$http.post('job/AddRestoreEvent', null, {
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
     * @param {Number[]} jobIds
     */
    async allocateJobs(courierId, dispatcherId, jobIds) {
        await this._$http.post('job/Allocate', null, {
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
     * @param {Number[]} jobIds
     */
    async reAllocateJobs(courierId, dispatcherId, jobIds) {
        await this._$http.post('job/ReAllocate', null, {
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
        await this._$http.post('job/SetFirstJob', null, {
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
        await this._$http.get('courier/TruckCourierStatus?courierId=' + courierId);
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
        await this._$http.post('job/Void?jobId=' + jobId);
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
     * @param {Number[]} jobIds
     */
    async restoreJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post('job/RestoreJobs?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {number} courierId
     * @param {number} dispatcherId
     * @param {Number[]} jobIds
     */
    async restoreSplitJobs(courierId, dispatcherId, jobIds) {
        const response = await this._$http.post('job/RestoreSplitJobs?courierId=' + courierId + '&dispId=' + dispatcherId + '&jobIds=' + jobIds);
        return response.data;
    }

    /**
     * @param {Number[]} jobIds
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
     * @param {Number[]} jobIds
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
    /**
     * @param {number} courierId
     * @param {boolean} done
     */
    async getJobsCurrent(courierId, done) {
        const response = await this._$http.get('job/current?courierId=' + courierId + '&done=' + done);
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
        await this._$http.post('job/CloseSupport?supportId=' + supportId + '&staffId=' + staffId);
    }

    /**
     * Locks a support request with the provided id and locks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher locking the request.
     */
    async lockSupport(supportId, dispatcherName) {
        await this._$http.post('job/LockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    /**
     * Unlocks a support request with the provided id and unlocks it by the provided dispatcher.
     *
     * @param {number} supportId - The unique identifier of the support request.
     * @param {string} dispatcherName - The unique identifier of the dispatcher unlocking the request.
     */
    async unLockSupport(supportId, dispatcherName) {
        await this._$http.post('job/UnLockSupport?id=' + supportId + '&dispatcher=' + dispatcherName);
    }

    /**
     * @param {Suggestion[]} selectedViews
     */
    async getDriverLocations(selectedViews) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedViews);
        const params = new URLSearchParams();

        // Append each despatchViewId as a separate query parameter
        despatchViewIds.forEach(id => {
            params.append('despatchViewIds', id.toString());
        });

        const response = await this._$http.get(`courier?${params.toString()}`);
        return response.data;
    }

    /**
     * @param {number} clearListId
     */
    async getDriverDestinationEnvelope(clearListId) {
        const countryId = this._isUsCustomer ? 2 : 1;

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
     * @param {Number[]} serviceIds
     * @param {number} totalCost
     */
    async addServicesToJob(jobId, serviceIds, totalCost) {
        const url = 'job/AddClientItemsToJob'

        await this._$http({
            method: 'POST', url: url + '?jobId=' + jobId, data: {serviceIds, totalCost}
        });
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async splitJob(jobId, despatcherName) {
        await this._$http.post('job/splitJob?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {string} despatcherName
     */
    async finishSplitJobProcess(jobId, despatcherName) {
        await this._$http.post('job/finishSplitJobProcess?jobId=' + jobId + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {string} jobNumber
     * @param {number} jobStatus
     * @param {string} podName
     * @param {Date} podTime
     */
    async updatePODDetail(jobNumber, jobStatus, podName, podTime) {
        await this._$http.post('job/UpdatePODDetails?jobNumber=' + jobNumber + '&jobStatus=' + jobStatus + '&podName=' + podName + '&podTime=' + podTime);
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
        await this._$http.post('job/ReRateSplitJob?jobId=' + jobId);
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
            let endpoint = prebook ? 'job/UpdateBookingDeliveryAddress' : 'job/UpdateDeliveryAddress';
            console.log('Using endpoint: ' + endpoint);

            // Create the appropriate request body based on country
            let requestBody;
            if (!this._isUsCustomer) {
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
                endpoint += 'Nz';
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
                endpoint += 'Us';
            }

            console.log('Address Update Request: ' + requestBody);
            await this._$http.post(endpoint, requestBody);
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
        await this._$http.post('job/UpdateBulkDeliveryAddress?bulkJobId=' + bulkJobId + '&toSuburb=' + toSuburb + '&toPostCode=' + toPostCode + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng + '&despatcherName=' + despatcherName);
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
            let endpoint = prebook ? 'job/UpdateBookingPickupAddress' : 'job/UpdatePickupAddress';
            console.log('Using endpoint: ' + endpoint);

            // Create the appropriate request body based on country
            let requestBody;
            if (!this._isUsCustomer) {
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
                endpoint += 'Nz';
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
                endpoint += 'Us';
            }

            console.log('Address Update Request: ' + requestBody);
            await this._$http.post(endpoint, requestBody);
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
        await this._$http.post('job/UpdateBulkPickupAddress?bulkJobId=' + bulkJobId + '&fromSuburb=' + fromSuburb + '&fromPostCode=' + fromPostCode + '&address=' + address + '&pickupLat=' + lat + '&pickupLng=' + lng + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} jobType
     * @param {string} despatcherName
     */
    async updateJobType(jobId, jobType, despatcherName) {
        await this._$http.post('job/UpdateJobType?jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName);
    }

    /**
     * @param {number} jobId
     * @param {number} toSuburbId
     * @param {string} address
     * @param {number} lat
     * @param {number} lng
     */
    async updateSplitJobAddress(jobId, toSuburbId, address, lat, lng) {
        await this._$http.post('job/UpdateSplitJobAddress?jobId=' + jobId + '&toSuburbId=' + toSuburbId + '&address=' + address + '&deliveryLat=' + lat + '&deliveryLng=' + lng);
    }

    /**
     * @param {string} jobNumber
     * @param {Date} bookDate
     */
    async releaseBulkJob(jobNumber, bookDate) {
        const formattedBookDate = this._moment(bookDate).format('YYYY-MM-DD');
        await this._$http.post('job/ReleaseBulkJob?jobNumber=' + jobNumber + '&bookDate=' + formattedBookDate);
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

        // Remove any symbols from rate
        if (rate && typeof rate === 'string') {
            rate = rate.replace(/[$]/g, '');
        }

        const method = preBook ? 'job/UpdateJobBooking' : 'job/UpdateJob';
        const response = await this._$http.post(method + '?jobId=' + jobId + '&field=' + field + '&value=' + value + '&rate=' + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);

        return response.data;
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
        if (field === 'Time' || field === 'CompletedTime') {
            value = this._moment().format('YYYY-MM-DD') + ' ' + this._moment(value).format('HH:mm:ss');
        }
        if (field === 'Date' || field === 'StopDate' || field === 'RestartDate' || field === 'InActiveDate' || field === 'FirstDue' || field === 'LastDone' || field === 'NextDue') {
            value = this._moment(value).format('YYYY-MM-DD');
        }
        await this._$http.post('job/UpdateBulkJob?bulkJobId=' + bulkJobId + '&field=' + field + '&value=' + value + '&rate=' + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId);
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
            status: queryParams.status || 'all',
            order: queryParams.order || 'time',
            asc: queryParams.asc || 'asc',
            isInternal: internal.toString(),
            cid: ContactID,
            clientIds: selectedClients.join(',')
        });

        // Append each despatchViewId as a separate query parameter
        despatchViewIds.forEach(id => {
            params.append('despatchViewIds', id.toString());
        });

        const response = await this._$http.get(`job?${params.toString()}`);
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
                country: this._isUsCustomer ? 'USA' : 'NZL'
            }
        });
        return response.data;
    }

    /**
     * @param {Suggestion} item
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
     * @param {Suggestion[]} selectedAreas
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

angular.module('uDispatch').service('DispatchData', ['$http', 'moment', 'APP_CONFIG', ($http, moment, APP_CONFIG) => new DispatchData($http, moment, APP_CONFIG)]);
