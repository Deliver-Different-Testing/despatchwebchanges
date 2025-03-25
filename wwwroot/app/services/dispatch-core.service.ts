import {AppConfig} from "../interfaces/app-config.interface";
import {
    AddressViewModel, ClientItemsViewModel, InternalStatus,
    IJob,
    JobQueryParams, JobRateDetails, Lookup,
    Pallet,
    ParcelDimensions, PriceBreakdown, SuburbLookup,
    Suggestion, SupportViewModel,
    ClearListViewModel,
} from "../interfaces/job.interface";
import {PaginatedResponse} from "../interfaces/paginated-response.interface";
import {DateField, JobField} from "../interfaces/job-field.types";
import {
    ActiveCourierViewModel,
    AvailableCourierPosition,
    TruckCourierStatusViewModel
} from "../interfaces/courier.interface";
import {EventGroupViewModel} from "../interfaces/event-group-view-model.interface";
import {ClearListEnvelopeViewModel, DfrntPageViewModel} from "../interfaces/dfrnt-page-view-model.interface";
import {bindAllMethods} from "../bindAllMethods";
import {Task, TaskTableFiltersRequest} from "../components/task-dashboard/task-dashboard.interfaces";

class DispatchCoreService implements angular.IServiceProvider {
    static $inject = ["$http", "moment", "APP_CONFIG"];

    private readonly isUsCustomer: boolean;

    constructor(
        private $http: angular.IHttpService,
        private moment: any,
        appConfig: AppConfig
    ) {
        this.isUsCustomer = appConfig.US_Customer;
        bindAllMethods(this);
    }

    $get(): any {
        return this;
    }

    async getSelectedViews(userId: number, pageId: number) {
        const response = await this.$http.get<DfrntPageViewModel[]>(`home/GetPageViews?userid=${userId}&pageid=${pageId}`);
        return response.data;
    }

    async addNote(jobId: number, note: string, despatcherName: string, preBook: boolean) {
        const method = preBook ? "job/AddJobBookingNote" : "job/UpdateNote";
        await this.$http.post(method + "?jobId=" + jobId + "&note=" + note, null);
    }

    async addConNote(jobId: number, conNote: string) {
        await this.$http.post(`job/UpdateConnote?jobId= ${jobId}&conNote=${conNote}`, null);
    }

    async addBulkJobNote(bulkJobId: number, note: string, despatcherName: string, preBook: boolean) {
        await this.$http.post(`job/AddBulkJobNote?BulkJobId=${bulkJobId}&note=${note}&despatcher=${despatcherName}`, null);
    }

    async addPallet(pallet: Pallet, preBook: boolean, despatcherName: string) {
        const response = await this.$http.post("job/AddPallet", pallet, {
            params: {
                preBook,
                despatcher: despatcherName
            }
        });

        return response.data;
    }

    async editPallet(pallet: Pallet, preBook: boolean, despatcherName: string) {
        const response = await this.$http.post("job/EditPallet", pallet, {
            params: {
                preBook,
                despatcher: despatcherName
            }
        });

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

    async addRestoreEvent(jobId: number) {
        const response = await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobId,
                ContactID,
                FirstName
            }
        });

        return response.data;
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
        const response = await this.$http.get<IJob>(`/Job/Detail?jobId=${jobId}`);
        return response.data;
    }

    async getRelatedJobs(parentId: number, clientId: number) {
        const response = await this.$http.get<Suggestion[]>(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
        return response.data;
    }

    async getJobsCurrent(courierId: number, done: boolean) {
        const response = await this.$http.get<IJob[]>(`job/current?courierId=${courierId}&done=${done}`);
        return response.data;
    }

    async getSupports(channel: string) {
        const response = await this.$http.get<SupportViewModel[]>(`job/supports?channel=${channel}`);
        return response.data;
    }

    async closeSupport(supportId: number, staffId: number) {
        await this.$http.post(`job/CloseSupport?supportId=${supportId}&staffId=${staffId}`, null);
    }

    async lockSupport(supportId: number, dispatcherName: string) {
        await this.$http.post(`job/LockSupport?id=${supportId}&dispatcher=${dispatcherName}`, null);
    }

    async unLockSupport(supportId: number, dispatcherName: string) {
        await this.$http.post(`job/UnLockSupport?id=${supportId}&dispatcher=${dispatcherName}`, null);
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
        const response = await this.$http.get<Lookup[]>("job/LeaveList");
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

    async lateCall(lateType: number, lateTime: number, minutes: number, pickupTime: number, alertLatePickup: number,
                   deliveryTime: number, alertLateDelivery: number, jobNo: string, clientId: number, contact: string, staffId: number,
                   jobTime: Date, jobId: number, jobType: number, bookedSpeed: string, notifiedSpeed: string,
                   despatcherName: string, calculationRequired: boolean) {
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


    async rateTruckJob(clientId: number, fromId: number, toId: number, weight: number, size: number, speed: number, qty: number, bookedDate: Date, pickUp: number, dropOff: number, privateRes: boolean, oversizeItems: number, overWeightItems: number, dGClass: number, truckStartTime: Date, truckHours: number) {
        const response = await this.$http.get(`job/RateTruckJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${bookedDate
        }&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime
        }&truckHours=${truckHours}`);
        return response.data;
    }

    async truckJobAmountBreakdown(clientId: number, fromId: number, toId: number, weight: number, size: number, speed: number, qty: number, bookedDate: Date, pickUp: number, dropOff: number, privateRes: boolean, oversizeItems: number, overWeightItems: number, dGClass: number, truckStartTime: Date, truckHours: number, gstRate: number) {
        const response = await this.$http.get(`job/TruckJobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&weight=${weight}&size=${size}&speed=${speed}&qty=${qty}&bookedDate=${
            bookedDate}&pickup=${pickUp}&dropOff=${dropOff}&privateRes=${privateRes}&oversizeItems=${oversizeItems}&overWeightItems=${overWeightItems}&dgClass=${dGClass}&truckStartTime=${truckStartTime
        }&truckHours=${truckHours}&gstRate=${gstRate}`);
        return response.data;
    }

    async rateJob(clientId: number, fromId: number, toId: number, speed: number, pedal: boolean, van: boolean, returnJob: boolean, weight: number, size: number, includeFuelSurcharge: boolean, direct: boolean, acceptedJobTypeId: number, ourRef: string, refA: string, refB: string, quantity: number, booked: Date) {
        const response = await this.$http.get(`job/RateJob?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight}&size=${size
        }&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${quantity
        }&booked=${booked}`);
        return response.data;
    }

    async rateJobUS(jobDetails: JobRateDetails) {
        const generateQueryString = (params: JobRateDetails): string => {
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
        const response = await this.$http.get(`job/RateJobUs?${queryString}`);
        return response.data;
    }


    async jobAmountBreakdown(clientId: number, fromId: number, toId: number, speed: number, pedal: boolean, van: boolean, returnJob: boolean, weight: number, size: number, includeFuelSurcharge: boolean, direct: boolean, acceptedJobTypeId: number, ourRef: string, refA: string, refB: string, quantity: number, booked: Date, gstRate: number, amount: number) {
        const response = await this.$http.get(`job/JobAmountBreakdown?clientId=${clientId}&fromId=${fromId}&toId=${toId}&speed=${speed}&pedal=${pedal}&van=${van}&returnJob=${returnJob}&weight=${weight
        }&size=${size}&includeFuelSurcharge=${includeFuelSurcharge}&direct=${direct}&acceptedJobTypeId=${acceptedJobTypeId}&ourRef=${ourRef}&refA=${refA}&refB=${refB}&quantity=${
            quantity}&booked=${booked}&gstRate=${gstRate}&amount=${amount}`);
        return response.data;
    }

    async ppdExclusiveAmount(clientId: number, amount: number): Promise<number> {
        const response = await this.$http.get<number>(`job/PPDExclusiveAmount?clientId=${clientId}&amount=${amount}`);
        return response.data;
    }

    async getServices(clientId: number, speedId: number, jobId: number): Promise<PaginatedResponse<ClientItemsViewModel>> {
        const url = "job/GetAllClientItems";
        const response = await this.$http.get<PaginatedResponse<ClientItemsViewModel>>(url + "?clientId=" + clientId + "&speedId=" + speedId + "&jobId=" + jobId);

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

    async updatePODDetail(jobNumber: string, jobStatus: number, podName: string, podTime: Date) {
        await this.$http.post(`job/UpdatePODDetails?jobNumber=${jobNumber}&jobStatus=${jobStatus}&podName=${podName}&podTime=${podTime}`, null);
    }

    async sendSMS(courierId: number, staffId: number, despatcherName: string, message: string) {
        const response = await this.$http.post(`job/SendSMS?courierId=${courierId}&dispId=${staffId}&despatcherName=${despatcherName}&message=${message}`, null);
        return response.data;
    }

    async reRateSplitJob(jobId: number) {
        await this.$http.post(`job/ReRateSplitJob?jobId=${jobId}`, null);
    }

    async updateDeliveryAddress(jobId: number, rate: number, despatcherName: string, prebook: boolean, addressData: AddressViewModel) {
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

    async updateBulkDeliveryAddress(bulkJobId: number, toSuburb: number, toPostCode: string | number, address: string, lat: number, lng: number, despatcherName: string) {
        await this.$http.post(`job/UpdateBulkDeliveryAddress?bulkJobId=${bulkJobId}&toSuburb=${toSuburb}&toPostCode=${toPostCode}&address=${address}&deliveryLat=${lat}&deliveryLng=${
            lng}&despatcherName=${despatcherName}`, null);
    }

    async updatePickupAddress(jobId: number, rate: number, despatcherName: string, prebook: boolean, addressData: AddressViewModel) {
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

    async updateBulkPickupAddress(bulkJobId: number, fromSuburb: number, fromPostCode: number, address: string, lat: number, lng: number, despatcherName: string) {
        await this.$http.post(`job/UpdateBulkPickupAddress?bulkJobId=${bulkJobId}&fromSuburb=${fromSuburb}&fromPostCode=${fromPostCode}&address=${address}&pickupLat=${lat}&pickupLng=${lng
        }&despatcherName=${despatcherName}`, null);
    }

    async updateJobType(jobId: number, jobType: number, despatcherName: string) {
        await this.$http.post(`job/UpdateJobType?jobId=${jobId}&jobType=${jobType}&despatcherName=${despatcherName}`, null);
    }

    async updateSplitJobAddress(jobId: number, toSuburbId: number, address: string, lat: number, lng: number) {
        await this.$http.post(`job/UpdateSplitJobAddress?jobId=${jobId}&toSuburbId=${toSuburbId}&address=${address}&deliveryLat=${lat}&deliveryLng=${lng}`, null);
    }

    async releaseBulkJob(jobNumber: string, bookDate: Date) {
        const formattedBookDate = this.moment(bookDate).format("YYYY-MM-DD");
        await this.$http.post(`job/ReleaseBulkJob?jobNumber=${jobNumber}&bookDate=${formattedBookDate}`, null);
    }

    async updateJobDetail(
        jobId: number,
        field: JobField,
        value: string | Date | number | boolean,
        rate: number | string,
        preBook: boolean
    ) {
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
            console.log("Formatted time field:", {field, originalValue, formattedValue: processedValue});
        }

        // Format followup time
        if (field === "FollowupTime") {
            const dateValue = this.moment(value).format("YYYY-MM-DD");
            const timeValue = this.moment(value).format("HH:mm:ss");
            processedValue = `${dateValue} ${timeValue}`;
            console.log("Formatted followup time:", {field, originalValue, formattedValue: processedValue});
        }

        // Format date fields
        const dateFields: DateField[] = ["Date", "StopDate", "RestartDate", "InActiveDate", "FirstDue", "LastDone", "NextDue", "DeliverBy", "PuTime"];
        if (dateFields.includes(field as DateField)) {
            processedValue = this.moment(value).format("YYYY-MM-DD");
            console.log("Formatted date field:", {field, originalValue, formattedValue: processedValue});
        }

        // Handle field rename
        if (field === "DeliverToContact") {
            processedField = "ToContactName";
            console.log("Renamed field:", {oldField: field, newField: processedField});
        }

        // Format rate
        const processedRate = typeof rate === "string" ? rate.replace(/[$]/g, "") : rate;
        if (typeof rate === "string") {
            console.log("Formatted rate:", {originalRate: rate, formattedRate: processedRate});
        }

        const method: string = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";

        // Create URL parameters with proper encoding
        const params = new URLSearchParams({
            jobId: String(jobId),
            field: processedField,
            value: String(processedValue ?? ''),
            rate: String(processedRate ?? ''),
            despatcherName: String(FirstName),
            staffId: String(ContactID)
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
                parameters: {jobId, field: processedField, value: processedValue, rate: processedRate}
            });
            throw error;
        }
    }

    async updateBulkJobDetail(bulkJobId: number, field: string, value: string | number | Date, rate: number | string, despatcherName: string, staffId: number) {
        if (field === "Time" || field === "CompletedTime") {
            value = this.moment().format("YYYY-MM-DD") + " " + this.moment(value).format("HH:mm:ss");
        }
        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
            value = this.moment(value).format("YYYY-MM-DD");
        }
        await this.$http.post(`job/UpdateBulkJob?bulkJobId=${bulkJobId}&field=${field}&value=${value}&rate=${rate}&despatcherName=${despatcherName}&staffId=${staffId}`, null);
    }

    async getJobsWithFilters(queryParams: JobQueryParams, selectedClients: string[],
                             internal: boolean, selectedAreas: Suggestion[]) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const paramObject = {
            order: String(queryParams.order ?? "time"),
            orderDirection: String(queryParams.orderDirection ?? "asc"),
            dateCutoff: String(queryParams.dateCutoff?.toISOString() ?? new Date().toISOString()),
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

        const response = await this.$http.get<IJob[]>(`job?${params.toString()}`);
        return response.data;
    }

    async getClearListJobs(queryParams: JobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[], selectedClearList: ClearListEnvelope) {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const defaultParams = {
            order: 'time',
            orderDirection: 'asc'
        };

        // Create params object with explicit string conversion
        const paramObject = {
            order: String(queryParams.order ?? defaultParams.order),
            asc: String(queryParams.orderDirection ?? defaultParams.orderDirection),
            isInternal: String(internal),
            cid: String(ContactID),
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

        const response = await this.$http.get(`job/GetJobsByClearListEnvelope?${params.toString()}`);
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

    async autocompleteSearch(searchTerm: string, url: string) {
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

    async getAllJobTypes() {
        const response = await this.$http.get<Suggestion[]>(`job/GetJobTypes`);
        return response.data;
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
        const cleanFilters: Record<string, any> = {};

        // Only add defined filters
        if (filters) {
            if (filters.courierId) cleanFilters.courierId = filters.courierId;
            if (filters.eventTypeId) cleanFilters.eventTypeId = filters.eventTypeId;
            if (filters.searchText) cleanFilters.searchText = filters.searchText;
            if (filters.date) cleanFilters.date = filters.date;
        }

        const response = await this.$http<Task[]>({
            method: 'GET',
            url: '/Task/GetAllTasks',
            params: cleanFilters,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    }

    private _prepareViewIdsForRequest(selectedAreas: DfrntPageViewModel[] | Suggestion[]): number[] {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}

export default DispatchCoreService;
