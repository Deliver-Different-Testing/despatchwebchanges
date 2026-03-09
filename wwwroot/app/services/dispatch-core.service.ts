import {
    ClientItemsViewModel,
    IAddressViewModel,
    IBulkReadUpdateRequest,
    IClearListViewModel,
    IDispatchJob,
    IDispatchJobDto,
    IEditAddressDialogViewModel,
    IJobGroup,
    IJobGroupDto,
    IJobQueryParams,
    IJobQueryParamsDto,
    IJobSearchResult,
    IJobSearchResultDto,
    ILateCallRequest,
    IMultiSuggestion,
    InternalStatus,
    IParcelDimensions,
    ISimpleRepriceJobModel,
    ISuggestion,
    ITimeZoneSuggestion,
    JobCreateViewModelDto,
    UpdateBulkJobPackagesRequest,
    UpdateJobPackagesRequest,
    VoidBulkJobRequest,
    VoidJobRequest,
} from "../interfaces/job.interface";
import {IPaginatedResponse} from "../interfaces/paginated-response.interface";
import {
    ActiveCourierViewModel,
    IAvailableCourierPosition,
    IDriverWorkOverview,
    IPotentialCouriers,
    ITruckCourierStatus,
} from "../interfaces/courier.interface";
import {IEventGroupViewModel} from "../interfaces/event-group-view-model.interface";
import {DfrntPageViewModel,} from "../interfaces/dfrnt-page-view-model.interface";
import {ITask, ITaskDto, TaskTableFiltersRequest,} from "../interfaces/task.interfaces";
import {JobProperty} from "../enums/job-property.enum";
import {
    IAllocateJobsToCourierRequest,
    UpdatePodDetailsRequest
} from "../interfaces/requests.interfaces";
import {JobEventData} from "../react/interfaces";
import {IDeliveryJourney, IDeliveryJourneyDto} from "../react/components/common/task-history/TaskHistory.interfaces";
import {formatDateForApiWithTzs} from "../functions/formatDates";
import IDateFilterData from "../interfaces/date-filter-data.interface";
import IInterCourierData from "../components/dialogs/inter-courier-charge-dialog/interfaces/IInterCourierData";
import {Is3PhotoInfo} from "../interfaces/aws.interfaces";
import dayjs, {Dayjs} from "dayjs";
import {
    transformDeliveryJourneyDTO,
    transformDispatchJobDTO,
    transformJobGroupDTO,
    transformTaskDTO
} from "../functions/dtoMappings";
import {transformJobQueryParamsToDTO} from "../functions/toDtoMappings";
import {IAppConfig} from "../interfaces/app-config.interface";
import angular from 'angular';

class DispatchCoreService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "$window",
        "$timeout",
        "APP_CONFIG",
    ];

    private readonly isUsCustomer: boolean;

    constructor(
        private $http: angular.IHttpService,
        private $window: angular.IWindowService,
        private $timeout: angular.ITimeoutService,
        appConfig: IAppConfig,
    ) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    $get() {
        return this;
    }

    async getSelectedViews(pageId: number): Promise<DfrntPageViewModel[]> {
        const response = await this.$http.get<DfrntPageViewModel[]>(
            `home/GetPageViews`, {
                params: {
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

    async isBulkJobParent(bulkJobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>(
            "job/IsBulkJobParent", {
                params: {
                    bulkJobId,
                }
            }
        );
        return response.data;
    }

    async getRelatedJobsMultiSelectList(jobId: number, isArchived: boolean): Promise<IMultiSuggestion[]> {
        const response = await this.$http.get<IMultiSuggestion[]>(
            "job/GetRelatedJobsMultiSelectList", {
                params: {
                    jobId,
                    isArchived,
                }
            }
        );
        return response.data;
    }

    async addRestoreEvent(jobId: number): Promise<void> {
        await this.$http.post("job/AddRestoreEvent", null, {
            params: {
                jobId,
            },
        });
    }

    async addFollowupEvent(jobId: number): Promise<any> {
        const response = await this.$http.post("courier/AddFollowupEvent", null, {
            params: {
                jobId
            },
        });

        return response.data;
    }

    async allocateJobs(
        courierId: number,
        jobIds: number[]
    ): Promise<void> {
        await this.allocateJobsInternal("job/Allocate", courierId, jobIds);
    }

    async reAllocateJobs(
        courierId: number,
        jobIds: number[]
    ): Promise<void> {
        await this.allocateJobsInternal("job/ReAllocate", courierId, jobIds);
    }

    private async allocateJobsInternal(
        endpoint: string,
        courierId: number,
        jobIds: number[]
    ): Promise<void> {
        const data: IAllocateJobsToCourierRequest = {
            courierId,
            jobIds,
        };

        await this.$http.post(endpoint, data);
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

    async voidJob(jobId: number, voidSingleJobOnly: boolean, voidReason?: string, selectedJobIds?: number[]): Promise<void> {
        const data: VoidJobRequest = {
            jobId,
            voidSingleJobOnly,
            voidReason,
            selectedJobIds
        }

        await this.$http.post(`job/Void`, data);
    }

    async voidBulkJob(bulkJobId: number, voidSingleJobOnly: boolean, voidReason?: string, selectedJobIds?: number[]): Promise<void> {
        const data: VoidBulkJobRequest = {
            bulkJobId,
            voidSingleJobOnly,
            voidReason,
            selectedJobIds
        }

        await this.$http.post(`job/VoidBulkJob`, data);
    }

    async releaseBulkJob(bulkJobId: number): Promise<void> {
        await this.$http.post(`job/ReleaseBulkJob`, null, {
            params: {
                bulkJobId
            }
        });
    }

    async restoreJobs(jobIds: number[]): Promise<void> {
        await this.$http.post(`job/RestoreJobs`, {jobIds});
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

    async getJobDetail(jobId: number): Promise<IJobGroup> {
        const response = await this.$http.get<IJobGroupDto>(`job/Detail`, {
            params: {
                jobId,
            },
        });

        return transformJobGroupDTO(response.data, this.isUsCustomer);
    }

    async getDispatchJobDetail(jobId: number): Promise<IDispatchJob> {
        const response = await this.$http.get<IDispatchJobDto>(`job/DispatchJobDetail`, {
            params: {
                jobId
            }
        });

        return transformDispatchJobDTO(response.data);
    }

    async getRecurringJobDetail(jobId: number): Promise<IJobGroup> {
        const response = await this.$http.get<IJobGroupDto>(
            `job/RecurringJobDetail`, {
                params: {
                    jobId,
                },
            }
        );

        return transformJobGroupDTO(response.data, this.isUsCustomer);
    }

    async getJobsCurrent(courierId: number,
                         startDate: Dayjs,
                         endDate: Dayjs): Promise<IJobSearchResult> {
        const response = await this.$http.get<IJobSearchResultDto>(
            `job/GetCurrentWorkList`, {
                params: {
                    courierId,
                    startDate: formatDateForApiWithTzs(startDate),
                    endDate: formatDateForApiWithTzs(endDate),
                },
            }
        );

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
    }

    async getDriverLocations(
        selectedViews: DfrntPageViewModel[],
        dateFilterData?: IDateFilterData
    ): Promise<IClearListViewModel> {
        const filteredViews = selectedViews.filter((view) => view.selected);
        const despatchViewIds = filteredViews.map(view => view.id);

        const params: Record<string, any> = { despatchViewIds };
        if (dateFilterData) {
            params.startDate = formatDateForApiWithTzs(dateFilterData.startDate);
            params.endDate = formatDateForApiWithTzs(dateFilterData.endDate);
        }

        const response = await this.$http.get<IClearListViewModel>(
            `courier`, { params }
        );
        return response.data;
    }
    
    async getPotentialCouriers(jobId: number): Promise<IPotentialCouriers[]> {
        const response = await this.$http.get<IPotentialCouriers[]>(
            `courier/PotentialCouriers`, {
                params: {
                    jobId
                }
            }
        );

        return response.data;
    }

    async getCourierById(courierId: number): Promise<ActiveCourierViewModel> {
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
            await this.$http.post(url, lateCallRequest);
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

    async splitJob(
        jobId: number,
        meetingPointAddress: IAddressViewModel
    ): Promise<{ taskId: string }> {
        const data = {
            jobId,
            meetingPointAddress
        };

        const response = await this.$http.post<{ taskId: string }>(`job/splitJob`, data);
        return response.data;
    }

    async getSplitJobStatus(taskId: string): Promise<{ status: string; errorMessage: string | null }> {
        const response = await this.$http.get<{ status: string; errorMessage: string | null }>(`job/splitJobStatus`, {
            params: { taskId }
        });
        return response.data;
    }

    async updatePODDetail(data: UpdatePodDetailsRequest): Promise<void> {
        await this.$http.post("job/UpdatePODDetails", data);
    }

    private async updateAddress(
        jobId: number,
        prebook: boolean,
        addressData: IAddressViewModel,
        addressType: 'pickup' | 'delivery'
    ): Promise<void> {
        try {
            const endpoint = DispatchCoreService.getAddressEndpoint(prebook, addressType);
            console.debug(`Using endpoint: ${endpoint}`);

            const requestBody = {
                jobId,
                address: addressData
            };

            console.debug(`Address Update Request:`, requestBody);
            await this.$http.post(endpoint, requestBody);
        } catch (error) {
            console.error(`Failed to update ${addressType} address:`, error);
            throw error; // Re-throw to allow the caller to handle if needed
        }
    }

    private static getAddressEndpoint(prebook: boolean, addressType: 'pickup' | 'delivery'): string {
        const prefix = prebook ? 'Booking' : '';
        const suffix = addressType === 'pickup' ? 'PickupAddress' : 'DeliveryAddress';
        return `job/Update${prefix}${suffix}`;
    }

    async updateDeliveryAddress(
        jobId: number,
        prebook: boolean,
        addressData: IAddressViewModel
    ): Promise<void> {
        return this.updateAddress(jobId, prebook, addressData, 'delivery');
    }

    async updatePickupAddress(
        jobId: number,
        prebook: boolean,
        addressData: IAddressViewModel
    ): Promise<void> {
        return this.updateAddress(jobId, prebook, addressData, 'pickup');
    }

    async updateJobDetail(
        jobId: number,
        field: JobProperty | string,
        value: any,
        isRecurring: boolean,
        timezone?: string // For dates
    ): Promise<any> {
        console.debug("Starting updateJobDetail:", {
            jobId,
            field,
            initialValue: value,
            preBook: isRecurring,
        });

        // Handle time fields
        if (value instanceof Date || dayjs.isDayjs(value)) {
            value = formatDateForApiWithTzs(value, timezone);
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
            console.debug("API response received:", {
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
        field: JobProperty | string,
        value: any,
        timezone?: string // For dates
    ): Promise<void> {
        // Handle time fields
        if (value instanceof Date || dayjs.isDayjs(value)) {
            value = formatDateForApiWithTzs(value, timezone);
        }

        await this.$http.post(
            `job/UpdateBulkJob`,
            null, {
                params: {
                    bulkJobId,
                    field,
                    value
                }
            }
        );
    }

    async getJobsWithFilters(
        queryParams: IJobQueryParams,
        internal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        const params = this.buildJobParams(
            queryParams,
            internal,
            selectedAreas.map(area => area.id)
        );

        const response = await this.$http.get<IJobSearchResultDto>("job", {params});

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
    }

    async getClearListJobs(
        queryParams: IJobQueryParams,
        internal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearListId: number
    ): Promise<IJobSearchResult> {
        const params = this.buildJobParams(
            queryParams,
            internal,
            selectedAreas.map(view => view.id),
            {selectedClearListId}
        );

        const response = await this.$http.get<IJobSearchResultDto>(
            'job/GetJobsByClearListEnvelope',
            {params}
        );

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
    }

    private buildJobParams(
        queryParams: IJobQueryParams,
        internal: boolean,
        despatchViewIds: (string | number)[],
        additionalParams: Record<string, any> = {}
    ): Record<string, any> {
        const dtoParams: IJobQueryParamsDto = transformJobQueryParamsToDTO(queryParams);

        return {
            startDate: dtoParams.startDate,
            endDate: dtoParams.endDate,
            useTime: dtoParams.useTime,
            order: dtoParams.order ?? "time",
            orderDirection: dtoParams.orderDirection ?? "asc",
            isInternal: internal,
            page: dtoParams.page ?? 0,
            pageSize: dtoParams.pageSize ?? 50,
            searchText: dtoParams.searchText ?? "",
            statusFilter: dtoParams.statusFilter,
            despatchViewIds,
            ...additionalParams
        };
    }

    async autocompleteSearch(
        searchTerm: string,
        url: string
    ): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(url, {
            params: {
                searchTerm,
            },
        });

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
            console.error("Error updating packages:", error);
            throw error;
        }
    }

    async updateBulkJobPackages(bulkJobId: number, parcels: IParcelDimensions[]): Promise<any> {
        try {
            const data: UpdateBulkJobPackagesRequest = {
                bulkJobId,
                parcels
            };

            const response = await this.$http.post("job/UpdateBulkJobPackages", data);
            return response.data;
        } catch (error) {
            console.error("Error updating packages:", error);
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

    async getAllTasks(filters?: TaskTableFiltersRequest): Promise<ITask[]> {
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
                    console.debug(`Query params:`, params);
                }
            }

            const response = await this.$http.get<ITaskDto[]>('/Task/GetAllTasks', {
                params: params
            });

            return response.data.map(transformTaskDTO);
        } catch (error) {
            console.error("Error fetching tasks:", error);
            return [];
        }
    }

    async getDeliveryJourney(jobId: number): Promise<IDeliveryJourney[]> {
        const response = await this.$http.get<IDeliveryJourneyDto[]>('/job/GetDeliveryJourney', {
            params: {
                jobId
            }
        });

        return response.data.map(transformDeliveryJourneyDTO);
    }

    async updateJobReadStatus(jobId: number, hasBeenRead: boolean): Promise<void> {
        try {
            await this.$http.post(
                'job/UpdateJobReadStatus',
                null,
                {
                    params: {
                        jobId,
                        hasBeenRead
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
            console.error("Error updating packages:", error);
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

    async exsalerateActivity(eventName: string, notes: string, clientId: number, jobNumber: string): Promise<void> {
        await this.$http.post(`job/ExsalerateActivity`,
            null, {
                params: {
                    eventName,
                    notes,
                    clientId,
                    jobNumber
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

    async getBulkJobDetail(bulkJobId: number): Promise<IJobGroup> {
        const response = await this.$http.get<IJobGroupDto>(`/Job/BulkDetail`, {
            params: {
                bulkJobId
            }
        });

        return transformJobGroupDTO(response.data, this.isUsCustomer);
    }

    async canAssignAgentToJob(agentJobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>(`/nationwideJob/CanAssignAgentToJob`, {
            params: {
                agentJobId
            }
        });

        return response.data;
    }

    async quickCreateJob(job: JobCreateViewModelDto): Promise<number> {
        const response = await this.$http.post<number>('/job/QuickCreateJob', job);
        return response.data;
    }

    async createInterCourierCharge(data: IInterCourierData) {
        await this.$http.post("job/InterCourierCharge", data);
    }

    async downloadFile(s3Key: string, fileName: string): Promise<void> {
        // Basic client-side validation (defense in depth - backend must also validate)
        if (!s3Key || s3Key.includes('..') || s3Key.includes('\0')) {
            throw new Error('Invalid file key');
        }
        if (!fileName || fileName.includes('..') || fileName.includes('\0') || fileName.includes('/') || fileName.includes('\\')) {
            throw new Error('Invalid file name');
        }

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
            console.debug("Response received:", response);
            console.debug("All headers:", response.headers());

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
            console.error("Download failed:", error);
            throw error;
        }
    }

    async getTimeZoneOptions(): Promise<ITimeZoneSuggestion[]> {
        const response = await this.$http.get<ITimeZoneSuggestion[]>('job/GetTimeZoneOptions');
        return response.data;
    }

    async recalculateJobRate(jobId: number, isBooking: boolean): Promise<number> {
        const response = await this.$http.get<number>('job/RecalculateJobRate', {
            params: {jobId, isBooking}
        });
        return response.data;
    }

    async applyRecalculatedJobRate(jobId: number, isPrebook: boolean): Promise<void> {
        await this.$http.post('job/ApplyRecalculatedJobRate', null, {
            params: {jobId, isPrebook}
        });
    }

    async simpleRepriceJobManual(jobId: number, isPrebook: boolean, isBulk: boolean, newPrice: number) {
        const data: ISimpleRepriceJobModel = {jobId, isPrebook, isBulk, newPrice};
        console.log("SimpleRepriceJobManual", data);
        await this.$http.post("job/SimpleRepriceJobManual", data);
    }
    
    async repriceJobWithBaseAmount(jobId: number, isPrebook: boolean, baseAmount: number): Promise<number> {
        const response = await this.$http.post<number>('job/RepriceJobWithBaseAmount', {
            jobId,
            isPrebook,
            baseAmount
        });
        return response.data;
    }

    async getExactCourierMatch(courierCode: string): Promise<ISuggestion> {
        const response = await this.$http.get<ISuggestion>('courier/GetExactCourierByCode', {
            params: {
                courierCode
            }
        });
        return response.data;
    }

    async searchSpeedOptions(searchTerm: string): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>('job/SearchSpeedOptions', {
            params: {
                searchTerm
            }
        });
        return response.data;
    }  
    
    async getDriverWorkOverview(): Promise<IDriverWorkOverview[]> {
        const response = await this.$http.get<IDriverWorkOverview[]>('courier/GetDriverWorkOverview');
        return response.data;
    }

    getPodReportUrl(jobId: number): string {
        return `/job/PodReport?jobId=${jobId}`;
    }

    getPodSpreadsheetUrl(jobId: number): string {
        return `/job/PodSpreadsheet?jobId=${jobId}`;
    }
}

export default DispatchCoreService;
