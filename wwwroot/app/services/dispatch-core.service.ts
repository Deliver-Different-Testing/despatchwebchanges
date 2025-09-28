import {IAppConfig} from "../interfaces/app-config.interface";
import {
    IAddressViewModel,
    IClearListViewModel,
    ClientItemsViewModel,
    IEditAddressDialogViewModel, IBulkReadUpdateRequest, IClearListEnvelope,
    IDispatchJob,
    IJob,
    ILateCallRequest,
    InternalStatus,
    IJobQueryParams,
    IParcelDimensions,
    PriceBreakdown,
    ISuggestion,
    VoidJobRequest, UpdateJobPackagesRequest, JobCreateViewModel,
} from "../interfaces/job.interface";
import {IPaginatedResponse} from "../interfaces/paginated-response.interface";
import {
    ActiveCourierViewModel,
    IAvailableCourierPosition,
    ITruckCourierStatus,
} from "../interfaces/courier.interface";
import {IEventGroupViewModel} from "../interfaces/event-group-view-model.interface";
import {ClearListEnvelopeViewModel, DfrntPageViewModel,} from "../interfaces/dfrnt-page-view-model.interface";
import {TaskTableFiltersRequest, TaskViewModel,} from "../components/task-dashboard/task-dashboard.interfaces";
import {JobProperty} from "../enums/job-property.enum";
import {UpdatePodDetailsRequest} from "../interfaces/requests.interfaces";
import {JobEventData} from "../components/dialogs/add-event-dialog/add-event-dialog.interfaces";
import {DeliveryJourneyViewModel} from "../components/common/task-history/task-history.interfaces";
import {formatDateForApi} from "../functions/formatDates";
import IInterCourierData from "../components/dialogs/inter-courier-charge-dialog/interfaces/IInterCourierData";
import {Is3PhotoInfo} from "../interfaces/aws.interfaces";

class DispatchCoreService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "$log",
        "$window",
        "$timeout",
        "APP_CONFIG"
    ];

    private readonly isUsCustomer: boolean;
    browserTimeZone: string;

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService,
        private $window: angular.IWindowService,
        private $timeout: angular.ITimeoutService,
        private appConfig: IAppConfig
    ) {
        this.isUsCustomer = this.appConfig.US_Customer;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    $get() {
        return this;
    }

    async getSelectedViews(userId: number, pageId: number): Promise<DfrntPageViewModel[]> {
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

    async getEventTypes(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("job/EventTypeList");
        return response.data;
    }

    async getEventGroups(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("task/GetEventGroups");
        return response.data;
    }

    async getEventTypeGroups(eventGroupId: number): Promise<IEventGroupViewModel[]> {
        const response = await this.$http.get<IEventGroupViewModel[]>(
            "task/GetEventTypeGroups", {
                params: {
                    eventGroupId,
                }
            }
        );
        return response.data;
    }

    async getActiveStaff(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("task/GetStaff");
        return response.data;
    }

    async isJobParent(jobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>(
            "job/IsJobParent", {
                params: {
                    jobId,
                }
            }
        );
        return response.data;
    }

    async addRestoreEvent(jobId: number): Promise<void> {
        await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobId,
                staffId: ContactID,
                despatcherName: FirstName,
            },
        });
    }

    async addFollowupEvent(jobId: number): Promise<any> {
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
    ): Promise<void> {
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
    ): Promise<void> {
        await this.$http.post("job/ReAllocate", null, {
            params: {
                courierId,
                dispId: dispatcherId,
                jobIds,
            },
        });
    }

    async setFirstJob(jobId: number, courierId: number): Promise<void> {
        await this.$http.post("job/SetFirstJob", null, {
            params: {
                jobId,
                courierId,
            },
        });
    }

    async truckCourierStatus(courierId: number): Promise<ITruckCourierStatus> {
        const response = await this.$http.get<ITruckCourierStatus>(
            `courier/TruckCourierStatus`, {
                params: {
                    courierId,
                },
            }
        );
        return response.data;
    }

    async validateSwapPOD(jobNumber: string): Promise<number> {
        const response = await this.$http.post<number>(
            `Job/ValidateSwapPOD`,
            null, {
                params: {
                    job: jobNumber,
                },
            }
        );

        return response.data;
    }

    async swapPOD(jobNumber1: string, jobNumber2: string): Promise<void> {
        await this.$http.post(
            `Job/SwapPOD`,
            null, {
                params: {
                    job1: jobNumber1,
                    job2: jobNumber2,
                },
            }
        );

    }

    async voidJob(jobId: number, voidSingleJobOnly: boolean, voidReason?: string): Promise<void> {
        const data: VoidJobRequest = {
            jobId,
            voidSingleJobOnly,
            voidReason
        }

        await this.$http.post(`job/Void`, data);
    }

    async restoreJobs(jobIds: number[]): Promise<void> {
        await this.$http.post(`job/RestoreJobs`, null, {
            params: {
                jobIds,
            }
        });
    }

    async restoreSplitJobs(jobIds: number[]): Promise<void> {
        await this.$http.post(`job/RestoreSplitJobs`, null, {
            params: {
                jobIds,
            }
        });
    }

    async reAssignJobs(jobIds: number[]): Promise<any> {
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

    async sendPOD(jobId: number, email: string): Promise<any> {
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

    async hasClientItemsAvailable(clientId: number, speedId: number): Promise<any> {
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

    async getJobDetail(jobId: number): Promise<any> {
        const response = await this.$http.get<IJob>(`job/Detail`, {
            params: {
                jobId,
            },
        });
        return response.data;
    }

    async getDispatchJobDetail(jobId: number): Promise<any> {
        const response = await this.$http.get<IDispatchJob>(`job/DispatchJobDetail`, {
            params: {
                jobId
            }
        });
        return response.data;
    }

    async getRecurringJobDetail(jobId: number): Promise<any> {
        const response = await this.$http.get<IJob>(
            `job/RecurringJobDetail`, {
                params: {
                    jobId,
                },
            }
        );
        return response.data;
    }

    async getRelatedJobs(parentId: number, clientId: number): Promise<any> {
        const response = await this.$http.get<ISuggestion[]>(
            `job/Related`, {
                params: {
                    parentId,
                    clientId,
                },
            }
        );
        return response.data;
    }

    async getJobsCurrent(courierId: number, done: boolean): Promise<any> {
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

    async getDriverLocations(selectedViews: DfrntPageViewModel[]): Promise<IClearListViewModel> {
        const filteredViews = selectedViews.filter((view) => view.selected);
        const despatchViewIds = filteredViews.map(view => view.id);

        const response = await this.$http.get<IClearListViewModel>(
            `courier`, {
                params: {
                    despatchViewIds,
                    isUsTenant: this.isUsCustomer,
                }
            }
        );
        return response.data;
    }

    async getDriverDestinationEnvelope(clearListId: number): Promise<ClearListEnvelopeViewModel> {
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

    async getActiveCouriers(): Promise<ActiveCourierViewModel[]> {
        const response = await this.$http.get<ActiveCourierViewModel[]>(
            "courier/active"
        );
        return response.data;
    }

    async getAllCouriers(): Promise<ActiveCourierViewModel[]> {
        const response = await this.$http.get<ActiveCourierViewModel[]>(
            "courier/AllActive"
        );
        return response.data;
    }

    async getClientContacts(contactId: number): Promise<any> {
        const response = await this.$http.get(
            `home/ClientContacts`, {
                params: {
                    contactId,
                },
            }
        );
        return response.data;
    }

    async getPotentialCouriers(jobId: number): Promise<any> {
        const response = await this.$http.get(
            `courier/PotentialCouriers`, {
                params: {
                    jobId
                }
            }
        );
        return response.data;
    }

    async getCourierById(courierId: number): Promise<any> {
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
    ): Promise<IAvailableCourierPosition[]> {
        const response = await this.$http.get<IAvailableCourierPosition[]>(
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
    
    async getSpeedList(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("job/SpeedList");
        return response.data;
    }

    async getContactList(clientId: number): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(
            `job/ContactList`, {
                params: {
                    clientId
                },
            }
        );
        return response.data;
    }

    async getLeaveList(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("job/LeaveList");
        return response.data;
    }

    async getInternalStatusList(): Promise<InternalStatus[]> {
        const response = await this.$http.get<InternalStatus[]>(
            "job/InternalStatusList"
        );
        return response.data;
    }

    async getStatusList(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("job/StatusList");
        return response.data;
    }

    async lateCall(lateCallRequest: ILateCallRequest): Promise<void> {
        const url = "job/LateCall";

        try {
            await this.$http.post(url, lateCallRequest, {
                headers: {"Content-Type": "application/json"},
            });
        } catch (error) {
            this.$log.error("Error in lateCall:", error);
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
    ): Promise<void> {
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

    async splitJob(jobId: number, despatcherName: string): Promise<void> {
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

    async finishSplitJobProcess(jobId: number, despatcherName: string): Promise<void> {
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

    async updatePODDetail(requestData: UpdatePodDetailsRequest): Promise<void> {
        await this.$http.post("job/UpdatePODDetails", requestData);
    }

    async reRateSplitJob(jobId: number): Promise<void> {
        await this.$http.post(`job/ReRateSplitJob`, null, {
            params: {
                jobId,
            }
        });
    }

    private async updateAddress(
        jobId: number,
        despatcherName: string,
        prebook: boolean,
        addressData: IAddressViewModel,
        addressType: 'pickup' | 'delivery'
    ): Promise<void> {
        try {
            const endpoint = this.getAddressEndpoint(prebook, addressType);
            this.$log.debug(`Using endpoint: ${endpoint}`);

            const requestBody = {
                jobId,
                despatcherName,
                address: addressData
            };

            this.$log.debug(`Address Update Request:`, requestBody);
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            this.$log.error(`Failed to update ${addressType} address:`, error);
            throw error; // Re-throw to allow the caller to handle if needed
        }
    }

    private getAddressEndpoint(prebook: boolean, addressType: 'pickup' | 'delivery'): string {
        const prefix = prebook ? 'Booking' : '';
        const suffix = addressType === 'pickup' ? 'PickupAddress' : 'DeliveryAddress';
        return `job/Update${prefix}${suffix}`;
    }

    async updateDeliveryAddress(
        jobId: number,
        despatcherName: string,
        prebook: boolean,
        addressData: IAddressViewModel
    ): Promise<void> {
        return this.updateAddress(jobId, despatcherName, prebook, addressData, 'delivery');
    }

    async updatePickupAddress(
        jobId: number,
        despatcherName: string,
        prebook: boolean,
        addressData: IAddressViewModel
    ): Promise<void> {
        return this.updateAddress(jobId, despatcherName, prebook, addressData, 'pickup');
    }

    async updateSplitJobAddress(
        jobId: number,
        toSuburbId: number,
        address: string,
        lat: number,
        lng: number
    ): Promise<void> {
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

    async updateJobDetail(
        jobId: number,
        field: JobProperty | string,
        value: string | Date | number | boolean,
        isRecurring: boolean
    ): Promise<any> {
        this.$log.debug("Starting updateJobDetail:", {
            jobId,
            field,
            initialValue: value,
            preBook: isRecurring,
        });

        if (value instanceof Date) {
            value = formatDateForApi(value);
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
            this.$log.debug("API response received:", {
                data: response.data,
            });
            return response.data;
        } catch (error) {
            this.$log.error("API request failed:", {
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
    ): Promise<void> {
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
                value = formatDateForApi(combined);
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
                value = formatDateForApi(value);
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
        queryParams: IJobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: ISuggestion[]
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = selectedAreas.map(area => area.id);

        const params: Record<string, any> = {
            order: queryParams.order ?? "time",
            orderDirection: queryParams.orderDirection ?? "asc",
            isInternal: internal,
            cid: ContactID,
            clientIds: selectedClients.length ? selectedClients.join(",") : "",
            despatchViewIds
        };

        // Add date filter parameters - handle all options
        if (queryParams.endDate) {
            params.dateCutoff = formatDateForApi(queryParams.endDate);
        }

        // Add start and end date parameters if present
        if (queryParams.startDate) {
            params.startDate = formatDateForApi(queryParams.startDate);
        }

        if (queryParams.endDate) {
            params.endDate = formatDateForApi(queryParams.endDate);
        }

        const response = await this.$http.get<IDispatchJob[]>("job", {
            params: params
        });

        return response.data;
    }

    async getClearListJobs(
        queryParams: IJobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearList: IClearListEnvelope
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = selectedAreas.map(view => view.id);

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
            despatchViewIds,
            'clearListEnvelope.minimumLatitude': selectedClearList.minimumLatitude,
            'clearListEnvelope.maximumLatitude': selectedClearList.maximumLatitude,
            'clearListEnvelope.minimumLongitude': selectedClearList.minimumLongitude,
            'clearListEnvelope.maximumLongitude': selectedClearList.maximumLongitude
        };

        const response = await this.$http.get<IDispatchJob[]>(
            'job/GetJobsByClearListEnvelope',
            {params: params}
        );

        return response.data;
    }

    async autocompleteSearch(
        searchTerm: string,
        url: string
    ): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(url, {
            params: {
                searchTerm: searchTerm,
            },
        });

        return response.data;
    }

    async isFilesAttachedToJob(jobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>(
            `job/IsFilesAttachedToJob`, {
                params: {
                    jobId: jobId,
                },
            }
        );
        return response.data;
    }

    async getVehicleSizes(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(
            `courier/GetVehicleSizes`
        );
        return response.data;
    }

    async updatePackages(jobId: number, parcels: IParcelDimensions[]): Promise<any> {
        try {
            const data: UpdateJobPackagesRequest = {
                jobId,
                parcels
            };
            
            const response = await this.$http.post("job/UpdateJobPackages", data);
            return response.data;
        } catch (error) {
            this.$log.error("Error updating packages:", error);
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

    async addPriceBreakdown(breakdown: PriceBreakdown): Promise<any> {
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
            this.$log.error("Error adding price component:", error);
            throw error;
        }
    }

    async updatePriceBreakdown(breakdown: PriceBreakdown): Promise<void> {
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
            this.$log.error("Error updating price breakdown:", error);
            throw error;
        }
    }

    async deletePriceBreakdown(chargeId: number, jobId: number): Promise<void> {
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
            this.$log.error("Error deleting price breakdown:", error);
            throw error;
        }
    }
    async getJobPickupPhotos(jobId: number, year: number, month: number): Promise<Is3PhotoInfo[]> {
        const response = await this.$http.get<Is3PhotoInfo[]>(
            '/Job/GetJobPickupPhotos',
            {
                params: {
                    jobId,
                    year,
                    month
                }
            }
        );

        return response.data;
    }
    
    async getJobDeliveryPhotosAndSignature(jobId: number, year: number, month: number): Promise<Is3PhotoInfo[]> {
        const response = await this.$http.get<Is3PhotoInfo[]>(
            '/Job/GetJobDeliveryPhotosAndSignature',
            {
                params: {
                    jobId,
                    year,
                    month
                }
            }
        );
        
        return response.data;
    }

    async getAllTasks(filters?: TaskTableFiltersRequest): Promise<TaskViewModel[]> {
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
                    this.$log.debug(`Query params:`, params);
                }
            }

            const response = await this.$http.get<TaskViewModel[]>('/Task/GetAllTasks', {
                params: params
            });

            return response.data;
        } catch (error) {
            this.$log.error("Error fetching tasks:", error);
            return [];
        }
    }

    async getDeliveryJourney(jobId: number): Promise<DeliveryJourneyViewModel[]> {
        const response = await this.$http.get<DeliveryJourneyViewModel[]>('/job/GetDeliveryJourney', {
            params: {
                jobId
            }
        });

        return response.data;
    }

    async updateJobReadStatus(jobId: number, hasBeenRead: boolean): Promise<void> {
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
            this.$log.error("Error updating job read status:", error);
            throw error;
        }
    }

    async addStopToJob(
        jobId: number,
        pickUpAddress?: IEditAddressDialogViewModel,
        deliveryAddress?: IEditAddressDialogViewModel
    ): Promise<number> {
        try {
            const response = await this.$http.post<number>("job/AddStopToJob", {
                jobId,
                pickUpAddress,
                deliveryAddress,
            });

            return response.data;
        } catch (error) {
            this.$log.error("Error updating packages:", error);
            throw error;
        }
    }

    async addStopToRecurringJob(
        jobId: number,
        pickUpAddress?: IEditAddressDialogViewModel,
        deliveryAddress?: IEditAddressDialogViewModel
    ): Promise<number> {
        try {
            const response = await this.$http.post<number>("job/AddStopToRecurringJob", {
                jobId,
                pickUpAddress,
                deliveryAddress,
            });

            return response.data;
        } catch (error) {
            this.$log.error("Error updating packages:", error);
            throw error;
        }
    }

    async restoreNationwideJob(jobId: number): Promise<void> {
        await this.$http.post("nationwideJob/RestoreJob", {
            jobId,
        });
    }

    async reSendJobs(jobIds: number[]): Promise<any> {
        const response = await this.$http.post(`job/ReSendSelected?jobIds=${jobIds}`, null);
        return response.data;
    }

    async exsalerateActivity(eventName: string, notes: string, clientId: number, jobNumber: string, despatcherName: string): Promise<void> {
        await this.$http.post(`job/ExsalerateActivity`,
            null, {
                params: {
                    eventName,
                    notes, clientId,
                    jobNumber,
                    despatcherName,
                }
            });
    }

    async addEvent(eventData: JobEventData): Promise<void> {
        await this.$http.post('job/addEvent', eventData);
    }

    async bulkUpdateReadStatus(jobIds: number[], shouldMarkAsRead: boolean): Promise<void> {
        const data: IBulkReadUpdateRequest = {
            jobIds,
            shouldMarkAsRead
        };

        await this.$http.post('job/BulkUpdateReadStatus', data);
    }

    async getBulkJobDetail(bulkJobId: number): Promise<IJob> {
        const response = await this.$http.get<IJob>(`/Job/BulkDetail`, {
            params: {
                bulkJobId
            }
        });
        return response.data;
    }
    
    async canAssignAgentToJob(agentJobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>(`/nationwideJob/CanAssignAgentToJob`, {
            params: {
                agentJobId
            }
        });
        
        return response.data;
    }
    
    async quickCreateJob(job: JobCreateViewModel): Promise<number> {
       const response = await this.$http.post<number>('/job/QuickCreateJob', job);
       return response.data;
    }
    
    async createInterCourierCharge(data: IInterCourierData) {
        await this.$http.post("job/InterCourierCharge", data);
    }

    async downloadFile(s3Key: string, fileName: string): Promise<void> {
        try {
            const endpoint = "/job/DownloadFile";

            const response: angular.IHttpResponse<Blob> = await this.$http.get<Blob>(endpoint, {
                params: {
                    key: s3Key
                },
                responseType: "blob",
                headers: {
                    'Accept': "application/octet-stream"
                }
            });

            // Log response for debugging
            this.$log.debug("Response received:", response);
            this.$log.debug("All headers:", response.headers());

            // Get content type - use application/octet-stream as generic fallback
            const contentType = response.headers("content-type") || "application/octet-stream";

            // Parse content disposition header
            const contentDisposition = response.headers("content-disposition");
            let filename = fileName;

            if (contentDisposition) {
                // Parse the filename from content-disposition
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    // Remove quotes if present
                    filename = matches[1].replace(/['"]/g, "");
                }
            }

            // Create and trigger download
            const blob = new Blob([response.data], {type: contentType});
            const url = this.$window.URL.createObjectURL(blob);

            const link = angular.element("<a></a>")[0] as HTMLAnchorElement;
            link.href = url;
            link.download = filename;
            link.style.display = "none";

            // Use angular.element for DOM manipulation
            document.body.append(link);
            link.click();

            // Cleanup
            this.$timeout(() => {
                angular.element(link).remove();
                this.$window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            this.$log.error("Download failed:", error);
            throw error;
        }
    }
}

export default DispatchCoreService;
