import {AppConfig} from "../interfaces/app-config.interface";
import {
    AddressViewModel,
    ClearListViewModel,
    ClientItemsViewModel,
    EditAddressDialogViewModel,
    IClearListEnvelope,
    IDispatchJob,
    IJob,
    ILateCallRequest,
    InternalStatus,
    JobQueryParams,
    ParcelDimensions,
    PriceBreakdown,
    SuburbLookup,
    Suggestion,
    TimeZoneSuggestion,
} from "../interfaces/job.interface";
import {IPaginatedResponse} from "../interfaces/paginated-response.interface";
import {
    ActiveCourierViewModel,
    AvailableCourierPosition,
    TruckCourierStatusViewModel,
} from "../interfaces/courier.interface";
import {EventGroupViewModel} from "../interfaces/event-group-view-model.interface";
import {ClearListEnvelopeViewModel, DfrntPageViewModel,} from "../interfaces/dfrnt-page-view-model.interface";
import {bindAllMethods} from "../functions/bindAllMethods";
import {TaskTableFiltersRequest, TaskViewModel,} from "../components/task-dashboard/task-dashboard.interfaces";
import {JobProperty} from "../enums/job-property.enum";
import ConfigService from "./config.service";
import {UpdateJobTimeRequest, UpdatePodDetailsRequest} from "../interfaces/requests.interfaces";
import dayjs from "dayjs";

class DispatchCoreService implements angular.IServiceProvider {
    static $inject = ["$http", "APP_CONFIG", "configService"];

    private readonly isUsCustomer: boolean;
    browserTimeZone: string;

    constructor(
        private $http: angular.IHttpService,
        private appConfig: AppConfig,
        private configService: ConfigService
    ) {
        this.isUsCustomer = this.appConfig.US_Customer;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        bindAllMethods(this);
    }

    $get() {
        return this;
    }

    async getSelectedViews(userId: number, pageId: number) {
        const response = await this.$http.get<DfrntPageViewModel[]>(
            `home/GetPageViews`, {
                params: {
                    userId,
                    pageId,
                }
            }
        );
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
        const response = await this.$http.get<EventGroupViewModel[]>(
            "task/GetEventTypeGroups", {
                params: {
                    eventGroupId,
                }
            }
        );
        return response.data;
    }

    async getActiveStaff() {
        const response = await this.$http.get<Suggestion[]>("task/GetStaff");
        return response.data;
    }

    async getTimeZoneOptions(): Promise<TimeZoneSuggestion[]> {
        const response = await this.$http.get<TimeZoneSuggestion[]>(
            "job/GetTimeZoneOptions"
        );
        return response.data;
    }

    async isJobParent(jobId: number) {
        const response = await this.$http.get<boolean>(
            "job/IsJobParent", {
                params: {
                    jobId,
                }
            }
        );
        return response.data;
    }

    async addRestoreEvent(jobId: number) {
        await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobId,
                staffId: ContactID,
                despatcherName: FirstName,
            },
        });
    }

    async addFollowupEvent(jobId: number) {
        const response = await this.$http.post("job/AddFollowupEvent", null, {
            params: {
                jobId,
                ContactID,
                FirstName,
            },
        });

        return response.data;
    }

    async allocateJobs(
        courierId: number,
        dispatcherId: number,
        jobIds: number[]
    ) {
        await this.$http.post("job/Allocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds,
            },
        });
    }

    async reAllocateJobs(
        courierId: number,
        dispatcherId: number,
        jobIds: number[]
    ) {
        await this.$http.post("job/ReAllocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds,
            },
        });
    }

    async setFirstJob(jobId: number, courierId: number) {
        await this.$http.post("job/SetFirstJob", null, {
            params: {
                jobId,
                courierId,
            },
        });
    }

    async truckCourierStatus(courierId: number) {
        const response = await this.$http.get<TruckCourierStatusViewModel>(
            `courier/TruckCourierStatus`, {
                params: {
                    courierId,
                },
            }
        );
        return response.data;
    }

    async validateSwapPOD(jobNumber: string) {
        const response = await this.$http.post(
            `Job/ValidateSwapPOD`,
            null, {
                params: {
                    job: jobNumber,
                },
            }
        );
        return response.data;
    }

    async swapPOD(jobNumber1: string, jobNumber2: string) {
        const response = await this.$http.post(
            `Job/SwapPOD`,
            null, {
                params: {
                    job1: jobNumber1,
                    job2: jobNumber2,
                },
            }
        );
        return response.data;
    }

    async voidJob(jobId: number) {
        await this.$http.post(`job/Void`, null, {
            params: {
                jobId,
            },
        });
    }

    async restoreJobs(jobIds: number[]) {
        await this.$http.post(`job/RestoreJobs`, null, {
            params: {
                jobIds,
            }
        });
    }

    async restoreSplitJobs(jobIds: number[]) {
        await this.$http.post(`job/RestoreSplitJobs`, null, {
            params: {
                jobIds,
            }
        });
    }

    async resendJobs(jobIds: number[]) {
        const response = await this.$http.post(
            `job/ResendSelected`,
            null, {
                params: {
                    jobIds,
                },
            }
        );
        return response.data;
    }

    async resendAllJobs(courierId: number) {
        const response = await this.$http.post(
            `job/ResendAll`,
            null, {
                params: {
                    courierId,
                },
            }
        );
        return response.data;
    }

    async reAssignJobs(jobIds: number[]) {
        const response = await this.$http.post(
            `job/ReAssignSelected`,
            null, {
                params: {
                    jobIds,
                },
            }
        );
        return response.data;
    }

    async sendPOD(jobId: number, email: string) {
        const response = await this.$http.get(
            `job/SendPOD`, {
                params: {
                    jobId,
                    toEmail: email,
                },
            }
        );
        return response.data;
    }

    async hasClientItemsAvailable(clientId: number, speedId: number) {
        const response = await this.$http.get(
            `job/HasClientItemsAvailable`, {
                params: {
                    clientId,
                    speedId,
                },
            }
        );
        return response.data;
    }

    async getJobDetail(jobId: number) {
        const response = await this.$http.get<IJob>(`job/Detail`, {
            params: {
                jobId,
            },
        });
        return response.data;
    }

    async getDispatchJobDetail(jobId: number) {
        const response = await this.$http.get<IDispatchJob>(`job/DispatchJobDetail`, {
            params: {
                jobId
            }
        });
        return response.data;
    }

    async getRecurringJobDetail(jobId: number) {
        const response = await this.$http.get<IJob>(
            `job/RecurringJobDetail`, {
                params: {
                    jobId,
                },
            }
        );
        return response.data;
    }

    async getRelatedJobs(parentId: number, clientId: number) {
        const response = await this.$http.get<Suggestion[]>(
            `job/Related`, {
                params: {
                    parentId,
                    clientId,
                },
            }
        );
        return response.data;
    }

    async getJobsCurrent(courierId: number, done: boolean) {
        const response = await this.$http.get<IDispatchJob[]>(
            `job/current`, {
                params: {
                    courierId,
                    done,
                },
            }
        );
        return response.data;
    }

    async getDriverLocations(selectedViews: DfrntPageViewModel[]) {
        const filteredViews = selectedViews.filter((view) => view.selected);
        const despatchViewIds = this._prepareViewIdsForRequest(filteredViews);

        const response = await this.$http.get<ClearListViewModel>(
            `courier`, {
                params: {
                    despatchViewIds: despatchViewIds,
                    isUsTenant: this.isUsCustomer,
                }
            }
        );
        return response.data;
    }

    async getDriverDestinationEnvelope(clearListId: number) {
        const countryId = this.isUsCustomer ? 2 : 1;

        const response = await this.$http.get<ClearListEnvelopeViewModel>(
            `courier/ClearListEnvelope`, {
                params: {
                    clearListId,
                    countryId,
                }
            }
        );
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this.$http.get<ActiveCourierViewModel[]>(
            "courier/active"
        );
        return response.data;
    }

    async getAllCouriers() {
        const response = await this.$http.get<ActiveCourierViewModel[]>(
            "courier/AllActive"
        );
        return response.data;
    }

    async getActiveClients() {
        const response = await this.$http.get("home/ActiveClients");
        return response.data;
    }

    async getClientContacts(contactId: number) {
        const response = await this.$http.get(
            `home/ClientContacts`, {
                params: {
                    contactId,
                },
            }
        );
        return response.data;
    }

    async getPotentialCouriers(jobId: number) {
        const response = await this.$http.get(
            `courier/PotentialCouriers`, {
                params: {
                    jobId
                }
            }
        );
        return response.data;
    }

    async getCourierPosition(code: string) {
        const response = await this.$http.get(`courier/location`, {
            params: {
                code,
            }
        });
        return response.data;
    }

    async getCourierById(courierId: number) {
        const response = await this.$http.get<ActiveCourierViewModel>(
            `courier/GetCourier`, {
                params: {
                    courierId,
                }
            }
        );
        return response.data;
    }

    async getAvailableCourierLocation(
        minLng: number,
        minLat: number,
        maxLng: number,
        maxLat: number
    ) {
        const response = await this.$http.get<AvailableCourierPosition[]>(
            `courier/AvailableCourierLocation`, {
                params: {
                    minLng,
                    minLat,
                    maxLng,
                    maxLat,
                    isUsTenant: this.isUsCustomer,
                }
            }
        );
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
        const response = await this.$http.get<Suggestion[]>(
            `job/ContactList`, {
                params: {
                    clientId,
                },
            }
        );
        return response.data;
    }

    async getLeaveList() {
        const response = await this.$http.get<Suggestion[]>("job/LeaveList");
        return response.data;
    }

    async getInternalStatusList() {
        const response = await this.$http.get<InternalStatus[]>(
            "job/InternalStatusList"
        );
        return response.data;
    }

    async getStatusList() {
        const response = await this.$http.get<Suggestion[]>("job/StatusList");
        return response.data;
    }

    async lateCall(lateCallRequest: ILateCallRequest) {
        const url = "job/LateCall";

        try {
            await this.$http.post(url, lateCallRequest, {
                headers: {"Content-Type": "application/json"},
            });
        } catch (error) {
            console.error("Error in lateCall:", error);
            throw error;
        }
    }

    async ppdExclusiveAmount(clientId: number, amount: number): Promise<number> {
        const response = await this.$http.get<number>(
            `job/PPDExclusiveAmount`, {
                params: {
                    clientId,
                    amount,
                },
            }
        );
        return response.data;
    }

    async getServices(
        clientId: number,
        speedId: number,
        jobId: number
    ): Promise<IPaginatedResponse<ClientItemsViewModel>> {
        const url = "job/GetAllClientItems";
        const response = await this.$http.get<IPaginatedResponse<ClientItemsViewModel>>(
            url,
            {
                params: {
                    clientId: clientId,
                    speedId: speedId,
                    jobId: jobId
                }
            }
        );

        return response.data;
    }

    async addServicesToJob(
        jobId: number,
        serviceIds: number[],
        totalCost: number
    ) {
        const url = "job/AddClientItemsToJob";

        await this.$http.post(url, {
            serviceIds,
            totalCost,
        }, {
            params: {
                jobId,
            }
        });
    }

    async splitJob(jobId: number, despatcherName: string) {
        await this.$http.post(
            `job/splitJob`,
            null, {
                params: {
                    jobId,
                    despatcherName,
                }
            }
        );
    }

    async finishSplitJobProcess(jobId: number, despatcherName: string) {
        await this.$http.post(
            `job/finishSplitJobProcess`,
            null, {
                params: {
                    jobId,
                    despatcherName,
                }
            }
        );
    }

    async updatePODDetail(requestData: UpdatePodDetailsRequest) {
        await this.$http.post("job/UpdatePODDetails", requestData);
    }

    async sendSMS(
        courierId: number,
        staffId: number,
        despatcherName: string,
        message: string
    ) {
        const response = await this.$http.post(
            `job/SendSMS`,
            null, {
                params: {
                    courierId,
                    dispId: staffId,
                    despatcherName,
                    message,
                }
            }
        );
        return response.data;
    }

    async reRateSplitJob(jobId: number) {
        await this.$http.post(`job/ReRateSplitJob`, null, {
            params: {
                jobId,
            }
        });
    }

    async updateDeliveryAddress(
        jobId: number,
        despatcherName: string,
        prebook: boolean,
        addressData: AddressViewModel
    ) {
        try {
            let endpoint = prebook
                ? "job/UpdateBookingDeliveryAddress"
                : "job/UpdateDeliveryAddress";
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
                    longitude: addressData.longitude,
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
                        longitude: addressData.longitude,
                    },
                };
                endpoint += "Us";
            }

            console.log(`Address Update Request: ${requestBody}`);
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(error);
        }
    }

    async updatePickupAddress(
        jobId: number,
        despatcherName: string,
        prebook: boolean,
        addressData: AddressViewModel
    ) {
        try {
            let endpoint = prebook
                ? "job/UpdateBookingPickupAddress"
                : "job/UpdatePickupAddress";
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
                    longitude: addressData.longitude,
                };
                endpoint += "Nz";
            } else {
                requestBody = {
                    jobId: jobId,
                    despatcherName: despatcherName,
                    address: addressData,
                };
                endpoint += "Us";
            }

            console.log(`Address Update Request: ${requestBody}`);
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(error);
        }
    }

    async updateSplitJobAddress(
        jobId: number,
        toSuburbId: number,
        address: string,
        lat: number,
        lng: number
    ) {
        await this.$http.post(
            `job/UpdateSplitJobAddress`,
            null, {
                params: {
                    jobId,
                    toSuburbId,
                    address,
                    deliveryLat: lat,
                    deliveryLng: lng,
                }
            }
        );
    }

    async updateJobTime(
        jobId: number,
        field: JobProperty,
        dateTime: string,
        isRecurring: boolean,
        selectedTimeZoneId: number
    ) {
        const requestData: UpdateJobTimeRequest = {
            jobId: jobId,
            dateTime: dateTime,
            isRecurring: isRecurring,
            timeZoneId: selectedTimeZoneId,
        };

        let functionUrl;
        if (field === JobProperty.DeliverBy) {
            functionUrl = "job/UpdateDeliverByTime";
        } else if (field === JobProperty.Time) {
            functionUrl = "job/UpdatePickUpTime";
        } else {
            return;
        }
        ;
        await this.$http.post(functionUrl, requestData);
    }

    async updateJobDetail(
        jobId: number,
        field: JobProperty | string,
        value: string | Date | number | boolean,
        isRecurring: boolean,
        selectedTimeZoneId?: number // For DateTime Conversions
    ) {
        console.log("Starting updateJobDetail:", {
            jobId,
            field,
            initialValue: value,
            preBook: isRecurring,
        });

        if (field === JobProperty.DeliverBy || field === JobProperty.Time) {
            return await this.updateJobTime(
                jobId,
                field,
                String(value),
                isRecurring,
                selectedTimeZoneId ?? 0
            );
        }

        if (value instanceof Date) {
            value = dayjs(value).format();
        }

        const url: string = isRecurring
            ? "job/UpdateRecurringJob"
            : "job/UpdateJob";

        try {
            const response = await this.$http.post(url, null, {
                params: {
                    jobId,
                    field,
                    value,
                    isRecurring,
                }
            });
            console.log("API response received:", {
                data: response.data,
            });
            return response.data;
        } catch (error) {
            console.error("API request failed:", {
                error: error instanceof Error ? error.message : "Unknown error",
                parameters: {jobId, field: field, value: value},
            });
            throw error;
        }
    }

    async updateBulkJobDetail(
        bulkJobId: number,
        field: string,
        value: string | number | Date | boolean,
        rate: number | string,
        despatcherName: string,
        staffId: number
    ) {
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
                value = dayjs(combined).utc().format();
            }
        }

        // Handle date fields
        if (
            field === JobProperty.Date ||
            field === JobProperty.StopDate ||
            field === JobProperty.RestartDate ||
            field === JobProperty.InActiveDate ||
            field === JobProperty.FirstDue ||
            field === JobProperty.LastDone ||
            field === JobProperty.NextDue
        ) {
            if (value instanceof Date) {
                value = dayjs(value).utc().format();
            }
        }

        await this.$http.post(
            `job/UpdateBulkJob`,
            null, {
                params: {
                    bulkJobId,
                    field,
                    value,
                    rate,
                    despatcherName,
                    staffId
                }
            }
        );
    }
    async getJobsWithFilters(
        queryParams: JobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: Suggestion[]
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const params: Record<string, any> = {
            order: queryParams.order ?? "time",
            orderDirection: queryParams.orderDirection ?? "asc",
            isInternal: internal,
            cid: ContactID,
            clientIds: selectedClients.length ? selectedClients.join(",") : "",
            despatchViewIds: despatchViewIds
        };

        // Add date filter parameters - handle all options
        if (queryParams.dateCutoff) {
            params.dateCutoff = dayjs(queryParams.dateCutoff).format();
        }

        // Add start and end date parameters if present
        if (queryParams.startDate) {
            params.startDate = dayjs(queryParams.startDate).format();
        }

        if (queryParams.endDate) {
            params.endDate = dayjs(queryParams.endDate).format();
        }

        const response = await this.$http.get<IDispatchJob[]>("job", {
            params: params
        });

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
            order: "time",
            orderDirection: "asc",
        };

        // Create params object
        const params: Record<string, any> = {
            order: queryParams.order ?? defaultParams.order,
            orderDirection: queryParams.orderDirection ?? defaultParams.orderDirection,
            isInternal: internal,
            cid: ContactID,
            clientIds: selectedClients.join(","),
            despatchViewIds: despatchViewIds,
            'clearListEnvelope.minimumLatitude': selectedClearList.minimumLatitude,
            'clearListEnvelope.maximumLatitude': selectedClearList.maximumLatitude,
            'clearListEnvelope.minimumLongitude': selectedClearList.minimumLongitude,
            'clearListEnvelope.maximumLongitude': selectedClearList.maximumLongitude
        };

        const response = await this.$http.get<IDispatchJob[]>(
            'job/GetJobsByClearListEnvelope',
            { params: params }
        );

        return response.data;
    }

    async autocompleteAddressSearch(text: string) {
        const hereMapsConfig = await this.configService.getHereMapsConfig();

        const response = await this.$http({
            url: "https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json",
            method: "GET",
            params: {
                query: text,
                app_id: hereMapsConfig.appId,
                app_code: hereMapsConfig.appCode,
                country: this.isUsCustomer ? "USA" : "NZL",
                resultType: "areas,categories,chains,streets,localities,houseNumber",
                maxresults: 10
            }
        });

        return response.data;
    }

    async getGeoCodeInformation(item: Suggestion) {
        const hereMapsConfig = await this.configService.getHereMapsConfig();

        const response = await this.$http.get("https://geocoder.cit.api.here.com/6.2/geocode.json", {
            params: {
                app_id: hereMapsConfig.appId,
                app_code: hereMapsConfig.appCode,
                locationId: item.id
            }
        });

        return response.data;
    }

    async retrieveAddresses(lat: number, long: number) {
        const hereMapsConfig = await this.configService.getHereMapsConfig();

        const response = await this.$http.get("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
            params: {
                app_id: hereMapsConfig.appId,
                app_code: hereMapsConfig.appCode,
                mode: "retrieveAddresses",
                prox: lat.toString() + "," + long.toString() + "," + "250"
            }
        });

        return response.data;
    }

    async autocompleteSearch(
        searchTerm: string,
        url: string
    ): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>(url, {
            params: {
                searchTerm: searchTerm,
            },
        });

        return response.data;
    }

    async isFilesAttachedToJob(jobId: number) {
        const response = await this.$http.get<boolean>(
            `job/IsFilesAttachedToJob`, {
                params: {
                    jobId: jobId,
                },
            }
        );
        return response.data;
    }

    async getVehicleSizes(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>(
            `courier/GetVehicleSizes`
        );
        return response.data;
    }

    async updatePackages(jobId: number, parcels: ParcelDimensions[]) {
        try {
            const response = await this.$http.post("job/UpdateJobPackages", {
                jobId: jobId,
                parcels: parcels,
            });
            return response.data;
        } catch (error) {
            console.error("Error updating packages:", error);
            throw error;
        }
    }

    async getPriceBreakdown(jobId: number, isPrebook: boolean): Promise<PriceBreakdown[]> {
        const response = await this.$http.get<PriceBreakdown[]>(`job/GetPricingBreakdown`, {
            params: {
                jobId,
                isPrebook,
            },
        });
        return response.data;
    }

    async addPriceBreakdown(breakdown: PriceBreakdown) {
        try {
            const response = await this.$http.post<number>(
                'job/AddPriceComponent',
                breakdown,
                {
                    params: {
                        staffId: ContactID,
                        despatcherName: FirstName
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error("Error adding price component:", error);
            throw error;
        }
    }

    async updatePriceBreakdown(breakdown: PriceBreakdown) {
        try {
            await this.$http.post(
                'job/UpdatePriceComponent',
                breakdown,
                {
                    params: {
                        staffId: ContactID,
                        despatcherName: FirstName
                    }
                }
            );
        } catch (error) {
            console.error("Error updating price breakdown:", error);
            throw error;
        }
    }

    async deletePriceBreakdown(chargeId: number, jobId: number) {
        try {
            await this.$http.post(
                'job/DeletePriceComponent',
                null,
                {
                    params: {
                        chargeId: chargeId,
                        jobId: jobId,
                        staffId: ContactID,
                        despatcherName: FirstName
                    }
                }
            );
        } catch (error) {
            console.error("Error deleting price breakdown:", error);
            throw error;
        }
    }

    async getJobDeliveryPhotosAndSignature(
        jobId: number,
        year: number,
        month: number
    ) {
        const response = await this.$http.get<any>(
            '/Job/GetJobDeliveryPhotosAndSignature',
            {
                params: {
                    jobId: jobId,
                    year: year,
                    month: month
                }
            }
        );
        return response.data;
    }

    async getAllTasks(filters?: TaskTableFiltersRequest) {
        try {
            let params: any = {};

            if (filters) {
                if (filters.jobId) params.jobId = filters.jobId;
                if (filters.staffId) params.staffId = filters.staffId;
                if (filters.courierId) params.courierId = filters.courierId;
                if (filters.eventTypeId) params.eventTypeId = filters.eventTypeId;
                if (filters.searchText) params.searchText = filters.searchText;
                if (filters.date) params.date = filters.date;
                if (filters.showCompleted !== undefined) params.showCompleted = filters.showCompleted;
                if (filters.orderBy) params.orderBy = filters.orderBy;
                if (filters.orderDirection) params.orderDirection = filters.orderDirection;
                if (filters.startDate) params.startDate = filters.startDate;
                if (filters.endDate) params.endDate = filters.endDate;

                if (Object.keys(params).length > 0) {
                    console.log(`Query params:`, params);
                }
            }

            const response = await this.$http.get<TaskViewModel[]>('/Task/GetAllTasks', {
                params: params
            });

            return response.data;
        } catch (error) {
            console.error("Error fetching tasks:", error);
            return [];
        }
    }

    async updateJobReadStatus(jobId: number, hasBeenRead: boolean) {
        try {
            await this.$http.post(
                'job/UpdateJobReadStatus',
                null,
                {
                    params: {
                        jobId: jobId,
                        hasBeenRead: hasBeenRead
                    }
                }
            );
        } catch (error) {
            console.error("Error updating job read status:", error);
            throw error;
        }
    }

    async addStopToJob(
        jobId: number,
        pickUpAddress?: EditAddressDialogViewModel,
        deliveryAddress?: EditAddressDialogViewModel
    ): Promise<number> {
        try {
            const response = await this.$http.post<number>("job/AddStopToJob", {
                jobId,
                pickUpAddress,
                deliveryAddress,
            });

            return response.data;
        } catch (error) {
            console.error("Error updating packages:", error);
            throw error;
        }
    }

    private _prepareViewIdsForRequest(
        selectedAreas: DfrntPageViewModel[] | Suggestion[]
    ): number[] {
        return selectedAreas.map((area) => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}

export default DispatchCoreService;
