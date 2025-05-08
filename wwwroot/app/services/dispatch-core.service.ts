import {AppConfig} from "../interfaces/app-config.interface";
import {
    AddressViewModel,
    ClearListViewModel,
    ClientItemsViewModel,
    IClearListEnvelope,
    IDispatchJob,
    IJob,
    ILateCallRequest,
    InternalStatus,
    JobQueryParams,
    ParcelDimensions,
    PriceBreakdown,
    SuburbLookup,
    Suggestion, TimeZoneSuggestion,
} from "../interfaces/job.interface";
import {IPaginatedResponse} from "../interfaces/paginated-response.interface";
import {
    ActiveCourierViewModel,
    AvailableCourierPosition,
    TruckCourierStatusViewModel
} from "../interfaces/courier.interface";
import {EventGroupViewModel} from "../interfaces/event-group-view-model.interface";
import {ClearListEnvelopeViewModel, DfrntPageViewModel} from "../interfaces/dfrnt-page-view-model.interface";
import {bindAllMethods} from "../bindAllMethods";
import {TaskTableFiltersRequest, TaskViewModel} from "../components/task-dashboard/task-dashboard.interfaces";
import {JobProperty} from "../enums/job-property.enum";
import moment from "moment";

class DispatchCoreService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "APP_CONFIG",
    ];

    private readonly isUsCustomer: boolean;
    browserTimeZone: string;

    constructor(
        private $http: angular.IHttpService,
        private appConfig: AppConfig,
    ) {
        this.isUsCustomer = this.appConfig.US_Customer;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        bindAllMethods(this);
    }

    $get() {
        return this;
    }

    async getSelectedViews(userId: number, pageId: number) {
        const response = await this.$http.get<DfrntPageViewModel[]>(`home/GetPageViews?userid=${userId}&pageid=${pageId}`);
        return response.data;
    }

    async getEventTypes(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("job/EventTypeList");
        return response.data;
    }

    async getEventGroups() {
        const response = await this.$http.get<Suggestion[]>("task/GetEventGroups");
        return response.data;
    }

    async getEventTypeGroups(eventGroupId: number) {
        const response = await this.$http.get<EventGroupViewModel[]>("task/GetEventTypeGroups?eventGroupId=" + eventGroupId);
        return response.data;
    }

    async getActiveStaff() {
        const response = await this.$http.get<Suggestion[]>('task/GetStaff');
        return response.data;
    }

    async getTimeZoneOptions(): Promise<TimeZoneSuggestion[]> {
        const response = await this.$http.get<TimeZoneSuggestion[]>('job/GetTimeZoneOptions');
        return response.data;
    }

    async isJobParent(jobId: number) {
        const response = await this.$http.get<boolean>('job/IsJobParent?jobId=' + jobId);
        return response.data;
    }

    async addRestoreEvent(jobId: number) {
       await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobId,
                staffId: ContactID,
                despatcherName: FirstName
            }
        });
    }

    async addFollowupEvent(jobId: number) {
        const response = await this.$http.post("job/AddFollowupEvent", null, {
            params: {
                jobId,
                ContactID,
                FirstName
            }
        });

        return response.data;
    }

    async allocateJobs(courierId: number, dispatcherId: number, jobIds: number[]) {
        await this.$http.post("job/Allocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds
            }
        });
    }

    async reAllocateJobs(courierId: number, dispatcherId: number, jobIds: number[]) {
        await this.$http.post("job/ReAllocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds
            }
        });
    }

    async setFirstJob(jobId: number, courierId: number) {
        await this.$http.post("job/SetFirstJob", null, {
            params: {
                jobId,
                courierId
            }
        });
    }

    async truckCourierStatus(courierId: number) {
        const response = await this.$http.get<TruckCourierStatusViewModel>(`courier/TruckCourierStatus?courierId=${courierId}`);
        return response.data;
    }

    async validateSwapPOD(jobNumber: string) {
        const response = await this.$http.post(`Job/ValidateSwapPOD?job=${jobNumber}`, null);
        return response.data;
    }

    async swapPOD(jobNumber1: string, jobNumber2: string) {
        const response = await this.$http.post(`Job/SwapPOD?job1=${jobNumber1}&job2=${jobNumber2}`, null);
        return response.data;
    }

    async voidJob(jobId: number) {
        await this.$http.post(`job/Void?jobId=${jobId}`, null);
    }

    async restoreJobs(jobIds: number[]) {
        await this.$http.post(`job/RestoreJobs?jobIds=${jobIds}`, null);
    }

    async restoreSplitJobs(jobIds: number[]) {
        await this.$http.post(`job/RestoreSplitJobs?jobIds=${jobIds}`, null);
    }

    async resendJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ResendSelected?jobIds=${jobIds}`, null);
        return response.data;
    }

    async resendAllJobs(courierId: number) {
        const response = await this.$http.post(`job/ResendAll?courierId=${courierId}`, null);
        return response.data;
    }

    async reAssignJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ReAssignSelected?jobIds=${jobIds}`, null);
        return response.data;
    }

    async sendPOD(jobId: number, email: string) {
        const response = await this.$http.get(`job/SendPOD?jobId=${jobId}&toEmail=${email}`);
        return response.data;
    }

    async hasClientItemsAvailable(clientId: number, speedId: number) {
        const response = await this.$http.get(`job/HasClientItemsAvailable?clientId=${clientId}&speedId=${speedId}`);
        return response.data;
    }

    async getJobDetail(jobId: number) {
        const response = await this.$http.get<IJob>(`job/Detail?jobId=${jobId}`);
        return response.data;
    }

  async getRecurringJobDetail(jobId: number) {
        const response = await this.$http.get<IJob>(`job/RecurringJobDetail?jobId=${jobId}`);
        return response.data;
    }

    async getRelatedJobs(parentId: number, clientId: number) {
        const response = await this.$http.get<Suggestion[]>(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
        return response.data;
    }

    async getJobsCurrent(courierId: number, done: boolean) {
        const response = await this.$http.get<IDispatchJob[]>(`job/current?courierId=${courierId}&done=${done}`);
        return response.data;
    }

    async getDriverLocations(selectedViews: DfrntPageViewModel[]) {
        const filteredViews = selectedViews.filter(view => view.selected);
        const despatchViewIds = this._prepareViewIdsForRequest(filteredViews);

        const params = new URLSearchParams();

        despatchViewIds.forEach(id => {
            params.append("despatchViewIds", id.toString());
        });

        const response = await this.$http.get<ClearListViewModel>(`courier?${params.toString()}&isUsTenant=${this.isUsCustomer}`);
        return response.data;
    }

    async getDriverDestinationEnvelope(clearListId: number) {
        const countryId = this.isUsCustomer ? 2 : 1;

        const response = await this.$http.get<ClearListEnvelopeViewModel>(`courier/ClearListEnvelope?clearListId=${clearListId}&countryId=${countryId}`);
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this.$http.get<ActiveCourierViewModel[]>("courier/active");
        return response.data;
    }

    async getAllCouriers() {
        const response = await this.$http.get<ActiveCourierViewModel[]>("courier/AllActive");
        return response.data;
    }

    async getActiveClients() {
        const response = await this.$http.get("home/ActiveClients");
        return response.data;
    }

    async getClientContacts(contactId: number) {
        const response = await this.$http.get(`home/ClientContacts?contactId=${contactId}`);
        return response.data;
    }

    async getPotentialCouriers(jobId: number) {
        const response = await this.$http.get(`courier/PotentialCouriers?jobId=${jobId}`);
        return response.data;
    }

    async getCourierPosition(code: string) {
        const response = await this.$http.get(`courier/location?code=${code}`);
        return response.data;
    }

    async getCourierById(courierId: number) {
        const response = await this.$http.get<ActiveCourierViewModel>(`courier/GetCourier?courierId=${courierId}`);
        return response.data;
    }

    async getAvailableCourierLocation(minLng: number, minLat: number, maxLng: number, maxLat: number) {
        const response = await this.$http.get<AvailableCourierPosition[]>(`courier/AvailableCourierLocation?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}&isUsTenant=${this.isUsCustomer}`);
        return response.data;
    }

    async getSuburbList(): Promise<SuburbLookup[]> {
        const response = await this.$http.get<SuburbLookup[]>("job/SuburbList");
        return response.data;
    }

    async getSpeedList(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("job/SpeedList");
        return response.data;
    }

    async getContactList(clientId: number) {
        const response = await this.$http.get<Suggestion[]>(`job/ContactList?clientId=${clientId}`);
        return response.data;
    }

    async getLeaveList() {
        const response = await this.$http.get<Suggestion[]>("job/LeaveList");
        return response.data;
    }

    async getUndeliverableList() {
        const response = await this.$http.get("job/UndeliverableList");
        return response.data;
    }

    async getInternalStatusList() {
        const response = await this.$http.get<InternalStatus[]>("job/InternalStatusList");
        return response.data;
    }

    async getStatusList() {
        const response = await this.$http.get<Suggestion[]>("job/StatusList");
        return response.data;
    }

    async lateCall(lateCallRequest: ILateCallRequest) {
        const url = "job/LateCall";

        try {
            await this.$http.post(url, lateCallRequest, {headers: {'Content-Type': "application/json"}});
        } catch (error) {
            console.error("Error in lateCall:", error);
            throw error;
        }
    }


    async ppdExclusiveAmount(clientId: number, amount: number): Promise<number> {
        const response = await this.$http.get<number>(`job/PPDExclusiveAmount?clientId=${clientId}&amount=${amount}`);
        return response.data;
    }

    async getServices(clientId: number, speedId: number, jobId: number): Promise<IPaginatedResponse<ClientItemsViewModel>> {
        const url = "job/GetAllClientItems";
        const response = await this.$http.get<IPaginatedResponse<ClientItemsViewModel>>(url + "?clientId=" + clientId + "&speedId=" + speedId + "&jobId=" + jobId);

        return response.data;
    }

    async addServicesToJob(jobId: number, serviceIds: number[], totalCost: number) {
        const url = "job/AddClientItemsToJob"

        await this.$http({
            method: "POST", url: url + "?jobId=" + jobId, data: {serviceIds, totalCost}
        });
    }

    async splitJob(jobId: number, despatcherName: string) {
        await this.$http.post(`job/splitJob?jobId=${jobId}&despatcherName=${despatcherName}`, null);
    }

    async finishSplitJobProcess(jobId: number, despatcherName: string) {
        await this.$http.post(`job/finishSplitJobProcess?jobId=${jobId}&despatcherName=${despatcherName}`, null);
    }

    async updatePODDetail(jobId: number, jobStatus: number, podName: string, podTime: Date) {
        const formattedDate = moment(podTime).utc().format();
        console.log(`[DispatchCoreService] Updating POD details - Job: ${jobId}, Status: ${jobStatus}, POD Name: ${podName}, POD Time: ${formattedDate}`);

        try {
            await this.$http.post(
                `job/UpdatePODDetails?jobId=${jobId}` +
                `&jobStatus=${jobStatus}` +
                `&podName=${encodeURIComponent(podName)}` +
                `&podTime=${encodeURIComponent(formattedDate)}`,
                null
            );

            console.log(`[DispatchCoreService] Successfully updated POD details for job ${jobId}`);
        } catch (error) {
            console.error(`[DispatchCoreService] Error updating POD details for job ${jobId}:`, error);
            throw error;
        }
    }

    async sendSMS(courierId: number, staffId: number, despatcherName: string, message: string) {
        const response = await this.$http.post(`job/SendSMS?courierId=${courierId}&dispId=${staffId}&despatcherName=${despatcherName}&message=${message}`, null);
        return response.data;
    }

    async reRateSplitJob(jobId: number) {
        await this.$http.post(`job/ReRateSplitJob?jobId=${jobId}`, null);
    }

    async updateDeliveryAddress(jobId: number, despatcherName: string, prebook: boolean, addressData: AddressViewModel) {
        try {
            let endpoint = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
            console.log(`Using endpoint: ${endpoint}`);

            let requestBody;
            if (!this.isUsCustomer) {
                requestBody = {
                    jobId: jobId,
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

    async updatePickupAddress(jobId: number, despatcherName: string, prebook: boolean, addressData: AddressViewModel) {
        try {
            let endpoint = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
            console.log(`Using endpoint: ${endpoint}`);

            let requestBody;
            if (!this.isUsCustomer) {
                requestBody = {
                    jobId: jobId,
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
                    despatcherName: despatcherName,
                    address: addressData
                };
                endpoint += "Us";
            }

            console.log(`Address Update Request: ${requestBody}`);
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(error);
        }
    }

    async updateSplitJobAddress(jobId: number, toSuburbId: number, address: string, lat: number, lng: number) {
        await this.$http.post(`job/UpdateSplitJobAddress?jobId=${jobId}&toSuburbId=${toSuburbId}&address=${address}&deliveryLat=${lat}&deliveryLng=${lng}`, null);
    }

    async updateDeliverByTime(jobId: number, deliverByTime: Date, selectedTimeZoneId?: number) {
        console.log("[UpdateJobDetail] Converting date to string: ", deliverByTime);

        const  convertedDate = moment(deliverByTime).utc().format();
        console.log("[UpdateJobDetail] Converted date to string: ", convertedDate);

        const params = new URLSearchParams({
            jobId: String(jobId),
            deliverByTime: String(convertedDate),
            timeZoneId: String(selectedTimeZoneId)
        });

        const url = `job/UpdateDeliverByTime?${params.toString()}`;
        await this.$http.post(url, null);
    }

    async updatePickUpTime(jobId: number, pickUpTime: Date, selectedTimeZoneId?: number) {
        console.log("[UpdateJobDetail] Converting date to string: ", pickUpTime);

        const  convertedDate = moment(pickUpTime).utc().format();
        console.log("[UpdateJobDetail] Converted date to string: ", convertedDate);

        const params = new URLSearchParams({
            jobId: String(jobId),
            pickUpTime: String(convertedDate),
            timeZoneId: String(selectedTimeZoneId)
        });

        const url = `job/UpdateDeliverByTime?${params.toString()}`;
        await this.$http.post(url, null);
    }

    async updateJobDetail(
        jobId: number,
        field: JobProperty | string,
        value: string | Date | number | boolean,
        isRecurring: boolean,
        selectedTimeZoneId?: number, // For DateTime Conversions
    ) {
        console.log("Starting updateJobDetail:", {
            jobId, field, initialValue: value, preBook: isRecurring
        });

        if(field === JobProperty.DeliverBy) {
            return await this.updateDeliverByTime(jobId, value as Date, selectedTimeZoneId)
        }

        if(field === JobProperty.PuTime) {
            return await this.updatePickUpTime(jobId, value as Date, selectedTimeZoneId)
        }

        if(value instanceof Date) {
            value = moment(value).utc().format();
        }

        const method: string = isRecurring ? "job/UpdateRecurringJob" : "job/UpdateJob";

        const params = new URLSearchParams({
            jobId: String(jobId),
            field: String(field),
            value: String(value ?? '')
        });

        const url = `${method}?${params.toString()}`;

        try {
            const response = await this.$http.post(url, null);
            console.log("API response received:", {
                data: response.data
            });
            return response.data;
        } catch (error) {
            console.error("API request failed:", {
                error: error instanceof Error ? error.message : 'Unknown error',
                parameters: {jobId, field: field, value: value}
            });
            throw error;
        }
    }

    async updateBulkJobDetail(bulkJobId: number, field: string, value: string | number | Date | boolean, rate: number | string , despatcherName: string, staffId: number) {
        // Handle time fields
        if (field === JobProperty.Time || field === JobProperty.CompletedTime) {
            if (value instanceof Date) {
                // Format as YYYY-MM-DD HH:mm:ss using current date and time from value
                const today = new Date();
                const timeDate = value as Date;

                // Create a new date with today's date and the time from the value
                const combined = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                    timeDate.getHours(),
                    timeDate.getMinutes(),
                    timeDate.getSeconds()
                );

                // Format to YYYY-MM-DD HH:mm:ss
                value =  moment(combined).utc().format();
            }
        }

        // Handle date fields
        if (field === JobProperty.Date || field === JobProperty.StopDate || field === JobProperty.RestartDate || field === JobProperty.InActiveDate ||
            field === JobProperty.FirstDue || field === JobProperty.LastDone || field === JobProperty.NextDue) {
            if (value instanceof Date) {
                value = moment(value).utc().format();
            }
        }

        await this.$http.post(
            `job/UpdateBulkJob?bulkJobId=${bulkJobId}` +
            `&field=${encodeURIComponent(field)}` +
            `&value=${encodeURIComponent(String(value))}` +
            `&rate=${encodeURIComponent(String(rate))}` +
            `&despatcherName=${encodeURIComponent(despatcherName)}` +
            `&staffId=${staffId}`,
            null
        );
    }

    async getJobsWithFilters(
        queryParams: JobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: Suggestion[]
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const paramObject = {
            order: String(queryParams.order ?? "time"),
            orderDirection: String(queryParams.orderDirection ?? "asc"),
            dateCutoff: String(queryParams.dateCutoff ? moment(queryParams.dateCutoff).format() : moment().format()),
            isInternal: String(internal),
            cid: String(ContactID),
            clientIds: selectedClients.length ? selectedClients.join(',') : ''
        };

        const params = new URLSearchParams(paramObject);

        // Add despatch view IDs as separate parameters
        if (despatchViewIds.length) {
            despatchViewIds.forEach(id => {
                params.append('despatchViewIds', String(id));
            });
        }

        const response = await this.$http.get<IDispatchJob[]>(`job?${params.toString()}`);
        return response.data;
    }

    async getClearListJobs(
        queryParams: JobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearList: IClearListEnvelope
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const defaultParams = {
            order: 'time',
            orderDirection: 'asc'
        };

        // Build query parameters
        const params = new URLSearchParams();

        // Add JobQueryParams
        params.append('order', queryParams.order ?? defaultParams.order);
        params.append('asc', queryParams.orderDirection ?? defaultParams.orderDirection);

        // Add basic parameters
        params.append('isInternal', internal.toString());
        params.append('cid', ContactID.toString());
        params.append('clientIds', selectedClients.join(','));

        // Add despatchViewIds as repeated parameters
        despatchViewIds.forEach(id => {
            params.append('despatchViewIds', id.toString());
        });

        // Add ClearListEnvelope properties as query parameters
        params.append('clearListEnvelope.minimumLatitude', selectedClearList.minimumLatitude.toString());
        params.append('clearListEnvelope.maximumLatitude', selectedClearList.maximumLatitude.toString());
        params.append('clearListEnvelope.minimumLongitude', selectedClearList.minimumLongitude.toString());
        params.append('clearListEnvelope.maximumLongitude', selectedClearList.maximumLongitude.toString());

        // Make the request
        const response = await this.$http.get<IDispatchJob[]>(
            `job/GetJobsByClearListEnvelope?${params.toString()}`
        );

        return response.data;
    }

    async autocompleteAddressSearch(text: string) {
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

    async getGeoCodeInformation(item: Suggestion) {
        const response = await this.$http.get("https://geocoder.cit.api.here.com/6.2/geocode.json", {
            params: {
                app_id: "bBPfh2x8Cauun3ygLMAx", app_code: "yjfwTdkin_R2rGXYTrwWVg", locationId: item.id
            }
        });

        return response.data;
    }

    async retrieveAddresses(lat: number, long: number) {
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

    async autocompleteSearch(searchTerm: string, url: string): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>(url, {
            params: {
                searchTerm: searchTerm
            }
        });

        return response.data;
    }

    async isFilesAttachedToJob(jobId: number) {
        const response = await this.$http.get<boolean>(`job/IsFilesAttachedToJob/${jobId}`);
        return response.data;
    }

    async getVehicleSizes(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>(`courier/GetVehicleSizes`);
        return response.data;
    }

    async updatePackages(jobId: number, parcels: ParcelDimensions[]) {
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

    async getPriceBreakdown(jobId: number): Promise<PriceBreakdown[]> {
        const response = await this.$http.get<PriceBreakdown[]>(`job/GetPricingBreakdown?jobId=${jobId}`);
        return response.data;
    }

    async addPriceBreakdown(breakdown: PriceBreakdown) {
        try {
            const queryParams = new URLSearchParams({
                staffId: String(ContactID),
                despatcherName: String(FirstName),
            }).toString();

            const response = await this.$http.post<number>(`job/AddPriceComponent?${queryParams}`, breakdown);

            return response.data;
        } catch (error) {
            console.error('Error adding price component:', error);
            throw error;
        }
    }

    async updatePriceBreakdown(breakdown: PriceBreakdown) {
        try {
            const queryParams = new URLSearchParams({
                staffId: String(ContactID),
                despatcherName: String(FirstName),
            }).toString();

            await this.$http.post(`job/UpdatePriceComponent?${queryParams}`, breakdown);
        } catch (error) {
            console.error('Error updating price breakdown:', error);
            throw error;
        }
    }

    async deletePriceBreakdown(chargeId: number, jobId: number) {
        try {
            const queryParams = new URLSearchParams({
                chargeId: String(chargeId),
                jobId: String(jobId),
                staffId: String(ContactID),
                despatcherName: String(FirstName)
            }).toString();

            await this.$http.post(`job/DeletePriceComponent?${queryParams}`, null);
        } catch (error) {
            console.error('Error deleting price breakdown:', error);
            throw error;
        }
    }

    async getJobDeliveryPhotosAndSignature(jobId: number, year: number, month: number) {
        const response = await this.$http.get<any>(`/Job/GetJobDeliveryPhotosAndSignature?jobId=${jobId}&year=${year}&month=${month}`);
        return response.data;
    }

    async getAllTasks(filters?: TaskTableFiltersRequest) {
        try {
            let url = '/Task/GetAllTasks';

            if (filters) {
                const queryParams = new URLSearchParams();

                if (filters.staffId) queryParams.append('staffId', filters.staffId.toString());
                if (filters.courierId) queryParams.append('courierId', filters.courierId.toString());
                if (filters.eventTypeId) queryParams.append('eventTypeId', filters.eventTypeId.toString());
                if (filters.searchText) queryParams.append('searchText', filters.searchText);
                if (filters.date) queryParams.append('date', filters.date);
                if (filters.showCompleted != undefined) queryParams.append('showCompleted', filters.showCompleted.toString());
                if (filters.orderBy) queryParams.append('orderBy', filters.orderBy);
                if (filters.orderDirection)  queryParams.append('orderDirection', filters.orderDirection);


                const queryString = queryParams.toString();
                if (queryString) {
                    console.log(`Query string: ${queryString}`);
                    url += `?${queryString}`;
                }
            }

            const response = await this.$http.get<TaskViewModel[]>(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    }

    async updateJobReadStatus(jobId: number, hasBeenRead: boolean) {
        try {
            const queryParams = new URLSearchParams({
                jobId: String(jobId),
                hasBeenRead: String(hasBeenRead)
            }).toString();

            await this.$http.post(`job/UpdateJobReadStatus?${queryParams}`, null);
        } catch (error) {
            console.error('Error updating job read status:', error);
            throw error;
        }
    }

    private _prepareViewIdsForRequest(selectedAreas: DfrntPageViewModel[] | Suggestion[]): number[] {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}

export default DispatchCoreService;
