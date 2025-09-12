import ToastrService from "../../../services/toastr.service";
import {
    IEditAddressDialogViewModel,
    IDispatchJob,
    IJob,
    InternalStatus,
    JobGroup,
    ISuggestion,
} from "../../../interfaces/job.interface";
import {ContactID, FirstName} from "../../../contants";
import {CallData, JobOptions, TabItem} from "./job-details.interfaces";
import {PodPhoto} from "../pod-photo-viewer/pod-photo-viewer.interfaces";
import DispatchCoreService from "../../../services/dispatch-core.service";
import "./job-details.styles.less";
import {SelectDialogService} from "../../dialogs/select-dialog/select-dialog.service";
import {EditDateTimeDialogService} from "../../dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {EditAddressDialogService} from "../../dialogs/edit-address-dialog/edit-address-dialog.service";
import PriceBreakdownDialogService from "../../dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import BaseController from "../../base-controller";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {JobStatus} from "../../../enums/job-status.enum";
import EditParcelDimensionsDialogService
    from "../../dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.service";
import {IJobReadChanged} from "../../../interfaces/event-interfaces";
import {JobProperty} from "../../../enums/job-property.enum";
import {DaysOfWeek} from "../../../enums/days-of-week.enum";
import AutoCompleteDialogService from "../../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import JobFileUploadDialogService from "../../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import {FileUploadType} from "../../../enums/file-upload-type.enum";
import sortRelatedJobs from "../../../functions/sortRelatedJobs";
import {UpdatePodDetailsRequest} from "../../../interfaces/requests.interfaces";
import dayjs from "dayjs";
import JobInternalStatusEnum from "../../../enums/job-internal-status.enum";
import VoidJobConfirmationDialogService
    from "../../dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";
import {formatFullDate} from "../../../functions/formatDates";

class JobDetailController extends BaseController {
    static $inject = [
        "$scope",
        "$log",
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "selectDialogService",
        "editDateTimeDialogService",
        "editAddressDialogService",
        "priceBreakdownDialogService",
        "APP_CONFIG",
        "editParcelDimensionsDialogService",
        "$rootScope",
        "$timeout",
        "$interval",
        "autoCompleteDialogService",
        "jobFileUploadDialogService",
        "voidJobConfirmationDialogService",
    ];

    private static readonly FIELD_VISIBILITY_KEY = `jobDetail_fieldVisibility_${ContactID}`;
    private static readonly VIEW_DENSITY_KEY = `jobDetail_viewDensity_${ContactID}`;

    readonly isRecurringJob: boolean = false;
    readonly isBulkJob: boolean = false;
    readonly isUsCustomer: boolean = false;
    jobId?: number;
    job?: IJob;
    selectedTab: number;
    allTabs: TabItem[];
    options: JobOptions;
    isPodViewerOpen: boolean = false;
    formattedPodPhotos: PodPhoto[] = [];
    selectedPhotoIndex: number = 0;
    internalStatusList: InternalStatus[];
    isLoading: boolean = false;
    distance?: number;
    selectedTabIndex: number = 0;
    processingTabChange: boolean = false;
    timeZone: string;
    jobGroups: JobGroup[] = [];
    selectedRelatedJob?: JobGroup;
    selectedSubJobIndex: number = 0;
    jobAddressIcon: string = "pin_drop";
    viewDensity: 'normal' | 'dense' | 'ultradense' = 'normal';

    isEditMode: boolean = false;
    fieldVisibility: { [key: string]: boolean } = {};
    defaultFieldVisibility: { [key: string]: boolean } = {};

    constructor(
        $scope: angular.IScope,
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private priceBreakdownDialogService: PriceBreakdownDialogService,
        appConfig: IAppConfig,
        private editParcelDimensionsDialogService: EditParcelDimensionsDialogService,
        private $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private jobFileUploadDialogService: JobFileUploadDialogService,
        private voidJobConfirmationDialogService: VoidJobConfirmationDialogService
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.timeZone = TimeZone;

        this.selectedTab = 0;
        this.allTabs = [];

        this.options = {
            detail: {
                size: [
                    {id: 1, label: "Bike"},
                    {id: 2, label: "Car"},
                    {id: 3, label: "Van"},
                    {id: 4, label: "Truck"},
                    {id: 5, label: "Scooter"},
                ],
                tracking: [
                    {id: 1, label: "Email"},
                    {id: 2, label: "Mobile"},
                    {id: 3, label: "Email & Mobile"},
                ],
                DGClass: Array.from({length: 10}, (_, i) => ({
                    id: i,
                    label: i.toString(),
                })),
            },
        };

        this.internalStatusList = [];
    }

    $onInit(): void {
        this.$log.debug("$onInit called - jobId:", this.jobId);

        this.DispatchData.getInternalStatusList()
            .then((statusList: InternalStatus[]) => {
                this.internalStatusList = statusList;
            })
            .catch((error) => {
                this.$log.error("Error loading internal status list:", error);
            });

        if (this.jobId) {
            this.loadJobData(this.jobId);
        }

        // Apply UI tweaks
        this.loadViewDensity();
        this.initializeFieldVisibility();

        this.applyScope();
    }

    private initializeFieldVisibility(): void {
        // Define default visibility for all fields
        this.defaultFieldVisibility = {
            // Main section visibility toggles
            additionalInfo: true,
            deliveryDetails: true,
            clientInformation: true,
            bookedBy: true,
            jobDetails: true,
            packageDetails: true,

            // Individual field visibility within sections
            // Delivery Details section fields
            dispatcherName: true,
            courierName: true,
            courierMobile: true,
            scheduleName: true,

            // Job Details section fields
            speedName: true,
            jobTypeDescription: true,
            sizeText: true,
            refA: true,
            refB: true,
            ourRef: true,
            conNote: true, // AWB field

            // Client Information section fields
            client: true,

            // Booked By section fields
            loggedInContactName: true,
            fromContactName: true,
            fromContactNumber: true,

            // Additional fields that might be used
            pricing: true,
            booked: true,
            startTime: true,
            puTime: true,
            deliverBy: true,
            dispatch: true,
            podName: true,
            podTime: true,
            followUp: true,
            clientName: true,
            pickupLocation: true,
            deliveryLocation: true,
            totalMiles: true,
            dimensions: true,
            weight: true,
            dgDocs: true,
            leaveParcel: true,
            tracking: true,
            mobile: true,
            email: true,
            checkboxes: true
        };

        // Load from localStorage or use defaults
        this.fieldVisibility = this.loadFieldVisibilityFromStorage();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        this.$log.debug("$onChanges called with changes:", changes);

        if (changes["jobId"]) {
            this.$log.debug("jobId changed:", changes["jobId"].currentValue);

            if (changes["jobId"].currentValue) {
                return this.loadJobData(changes["jobId"].currentValue);
            } else {
                this.job = undefined;
            }
        }
    }

    $onDestroy(): void {
        super.$onDestroy();
        this.$log.debug("$onDestroy called - cleaning up resources");

        this.formattedPodPhotos?.forEach(photo => {
            if (photo?.url) {
                URL.revokeObjectURL(photo.url);
            }
        });

        const photoSection = angular.element(".pod-photo-section");
        if (photoSection) {
            photoSection.off("keydown", this.handleKeydown);
        }
    }

    async switchToRelatedJob(index: number): Promise<void> {
        if (this.processingTabChange) {
            return;
        }

        this.processingTabChange = true;
        this.$log.debug(`Switching to tab ${index}`);

        try {
            if (!this.job || !this.jobGroups || this.jobGroups.length <= index) {
                console.warn(
                    `Invalid related job data for index ${index}`
                );
                return;
            }

            const targetJobGroup = this.jobGroups[index];
            const targetJob = targetJobGroup.job;

            if (targetJob && targetJob.id && targetJob.id !== this.jobId) {
                this.$log.debug(
                    `Loading related job: ${targetJob.id} (${targetJob.text})`
                );

                this.selectedTabIndex = index;
                this.jobId = targetJob.id;

                await this.loadJobData(targetJob.id);

                this.selectedRelatedJob = targetJobGroup;
                this.selectedSubJobIndex = -1;
            } else {
                this.$log.debug(
                    `Already on the selected job or invalid job data`
                );
            }
        } finally {
            this.processingTabChange = false;
            this.$rootScope.$broadcast("jobChanged", this.job);
        }
    }

    private async loadJobData(jobId: number): Promise<void> {
        if (!jobId) return;

        this.isLoading = true;

        try {
            if (this.isBulkJob) {
                this.job = await this.DispatchData.getBulkJobDetail(jobId);
            } else if (this.isRecurringJob) {
                this.job = await this.DispatchData.getRecurringJobDetail(jobId);
            } else {
                this.job = await this.DispatchData.getJobDetail(jobId);
            }

            this.initializeJobData();
            if (!this.job) {
                this.$log.debug("No job data returned from server");
                return;
            }

            if (this.job?.relatedJobs?.length > 0) {
                this.setupRelatedJobs(jobId);
            } else {
                this.selectedRelatedJob = undefined;
                this.selectedSubJobIndex = -1;
                this.selectedTabIndex = 0;
                this.jobGroups = [];
            }

            this.applyScope();

            if (this.job.completedTime && !this.isRecurringJob) {
                await this.loadPodPhotos();
            }
        } catch (error) {
            this.$log.error("Error loading job data:", error);
            this.toastrService.showErrorToast("Failed to load job details");
        } finally {
            this.isLoading = false;
        }
    }

    private setupRelatedJobs(jobId: number): void {
        if (!this.job) return;

        this.jobGroups = sortRelatedJobs(this.job.relatedJobs);
        const {tabIndex, subJobIndex} = this.findJobInGroups(jobId);

        if (tabIndex !== -1) {
            this.$log.debug(`Setting selectedTabIndex to ${tabIndex}, subJobIndex to ${subJobIndex}`);
            this.selectedTabIndex = tabIndex;
            this.selectedRelatedJob = this.jobGroups[tabIndex];
            this.selectedSubJobIndex = subJobIndex;

            if (subJobIndex !== -1) {
                this.$log.debug(`Current job is a subjob at index ${subJobIndex}`);
            }
        } else {
            this.selectedTabIndex = 0;
            this.selectedRelatedJob = this.jobGroups[0];
            this.selectedSubJobIndex = -1;
        }
    }

    private findJobInGroups(jobId: number): { tabIndex: number, subJobIndex: number } {
        const currentJobIndex = this.jobGroups.findIndex(
            (relatedJob) => relatedJob.job.id === jobId
        );

        if (currentJobIndex !== -1) {
            return {tabIndex: currentJobIndex, subJobIndex: -1};
        }

        for (let i = 0; i < this.jobGroups.length; i++) {
            const subJobIndex = this.jobGroups[i].subJobs.findIndex(
                (subJob) => subJob.id === jobId
            );
            if (subJobIndex !== -1) {
                return {tabIndex: i, subJobIndex};
            }
        }

        return {tabIndex: -1, subJobIndex: -1};
    }

    getConnectionTime(firstSegment: any, secondSegment: any): string {
        if (!firstSegment || !secondSegment) return "";

        // Calculate time difference in minutes
        const firstArrival = dayjs(firstSegment.arrivalTime);
        const secondDeparture = dayjs(secondSegment.departureTime);
        const diffMinutes = secondDeparture.diff(firstArrival, "minutes");

        // Format as hours and minutes
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours > 0) {
            return hours + "h " + (mins < 10 ? "0" + mins : mins) + "m";
        } else {
            return mins + "m";
        }
    }

    private async loadPodPhotos(): Promise<void> {
        if (!this.job?.completedTime) {
            this.$log.debug("No POD time available for job");
            return;
        }

        this.$log.debug(`Loading POD photos for job: ${this.job.id}`);

        try {
            const completedTime = dayjs(this.job?.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();

            this.$log.debug(`Getting POD photos for Job ${this.job.jobNo} : for date: ${year}-${month}`);

            const photosData: any = await this.DispatchData.getJobDeliveryPhotosAndSignature(
                this.job.id,
                year,
                month
            );

            if (!photosData || photosData.length === 0) {
                this.$log.debug("No POD photos returned from server");
                this.formattedPodPhotos = [];
            } else {
                this.$log.debug("Raw photos data received, count:", photosData.length);

                this.formattedPodPhotos = photosData.map(
                    (photoData: string, index: number) => {
                        try {
                            const podPhoto: PodPhoto = {
                                url: photoData,
                                timestamp: this.job?.completedTime
                                    ? formatFullDate(this.job.completedTime)
                                    : undefined,
                                uploadedBy: this.job?.courierData?.courierName ?? "Unknown",
                                coordinates: {
                                    lat: this.job?.deliveryAddress?.latitude ?? 0,
                                    lng: this.job?.deliveryAddress?.longitude ?? 0,
                                },
                            };

                            return podPhoto;
                        } catch (error) {
                            this.$log.error(`Error processing photo ${index}:`, error);
                            return null;
                        }
                    }
                );
            }

            this.$log.debug(
                `Successfully processed ${this.formattedPodPhotos.length} POD photos`
            );

            this.selectedPhotoIndex = 0;
            this.setupPhotoKeyboardNavigation();
        } catch (error) {
            this.toastrService.showErrorToast("Failed to load POD photos");
            this.$log.error("Error loading POD photos:", error);
            this.formattedPodPhotos = [];
            this.handleError(error);
        }
    }

    private initializeJobData(): void {
        if (!this.job) return;

        this.$log.debug("Initializing job data:", this.job.id);

        this.jobAddressIcon = this.job?.assignedFlight ? "flight_takeoff" : "pin_drop";

        if (typeof this.job.daysOfWeek === "number" && this.job.daysOfWeek > 0) {
            this.$log.debug("Original daysOfWeek bitmap value:", this.job.daysOfWeek);

            const daysArray = [];
            const dayValues = [
                DaysOfWeek.Monday,
                DaysOfWeek.Tuesday,
                DaysOfWeek.Wednesday,
                DaysOfWeek.Thursday,
                DaysOfWeek.Friday,
                DaysOfWeek.Saturday,
                DaysOfWeek.Sunday,
            ];

            for (const dayValue of dayValues) {
                if (this.job.daysOfWeek && dayValue) {
                    daysArray.push(dayValue);
                }
            }

            this.$log.debug("Converted daysOfWeek to array:", daysArray);

            this.job.daysOfWeek = daysArray as any;
        }

        if (this.job.holidayDeliveryOption) {
            this.job.holidayDeliveryOption = Number(this.job.holidayDeliveryOption);
            this.$log.debug(
                "Set holiday delivery option to:",
                this.job.holidayDeliveryOption
            );
        }

        if (this.job.frequency) {
            this.job.frequency = Number(this.job.frequency);
            this.$log.debug("Set frequency to:", this.job.frequency);
        }
    }

    async showAutocompleteDialog(
        $event: MouseEvent,
        job: IJob,
        url: string,
        placeholder: string,
        field: JobProperty,
        title: string,
        existingItem: any,
        showRerateOption: boolean
    ): Promise<void> {
        try {
            const result =
                await this.autoCompleteDialogService.showAutocompleteDialog(
                    $event,
                    url,
                    placeholder,
                    field,
                    title,
                    existingItem,
                    showRerateOption
                );
            const callData: CallData = {
                field,
                value: result.id,
                jobID: job.id,
            };

            await this.updateField(job, callData);
            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.handleError(error);
        }
    }

    async showEditTimeDialog(
        $event: MouseEvent,
        job: IJob,
        title: string,
        fieldName: JobProperty,
        dateTime?: Date,
        timezone?: ISuggestion
    ): Promise<void> {
        try {
            const result = await this.editDateTimeDialogService.showEditTimeDialog(
                $event,
                title,
                fieldName,
                dateTime,
                timezone
            );
            await this.processDateTimeUpdateResult(job, result);
        } catch (error) {
            this.handleError(error);
        }
    }

    async showEditDateDialog(
        $event: MouseEvent,
        job: IJob,
        title: string,
        field: JobProperty,
        dateTime?: Date,
        timezone?: ISuggestion
    ): Promise<void> {
        try {
            const result = await this.editDateTimeDialogService.showEditDateDialog(
                $event,
                title,
                field,
                dateTime,
                timezone
            );
            await this.processDateTimeUpdateResult(job, result);
        } catch (error) {
            this.handleError(error);
        }
    }

    async showEditDateAndTimeDialog(
        $event: MouseEvent,
        job: IJob,
        title: string,
        fieldName: JobProperty,
        dateTime?: Date,
        timezone?: ISuggestion
    ): Promise<void> {
        try {
            const result =
                await this.editDateTimeDialogService.showEditDateAndTimeDialog(
                    $event,
                    title,
                    fieldName,
                    dateTime,
                    timezone
                );
            await this.processDateTimeUpdateResult(job, result);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async processDateTimeUpdateResult(
        job: IJob,
        result: IDialogDateTimeResult
    ): Promise<void> {
        if (result) {
            if (job.bulkJob) {
                await this.DispatchData.updateBulkJobDetail(
                    job.id,
                    result.fieldName,
                    result.value,
                    job.charge,
                    FirstName,
                    ContactID
                );
            } else {
                await this.DispatchData.updateJobDetail(
                    job.id,
                    result.fieldName,
                    result.value,
                    job.preBook
                );
            }

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this.refreshJobDetails(job.id);
        }
    }

    async showSelectDialog(
        $event: MouseEvent,
        job: IJob,
        data: Array<any>,
        fieldName: JobProperty,
        title: string,
        initialValue: string | null | number = null,
        showCheckbox: boolean = false,
        checkboxLabel: string = ""
    ): Promise<void> {
        try {
            const result = await this.selectDialogService.showSelectDialog(
                $event,
                data,
                fieldName,
                title,
                initialValue,
                showCheckbox,
                checkboxLabel
            );

            if (result) {
                if (fieldName === JobProperty.DGClass) {
                    await this.DispatchData.updateJobDetail(
                        job.id,
                        fieldName,
                        result.value,
                        job.preBook
                    );

                    if (job.dgDocumentation !== result.checkboxValue) {
                        await this.DispatchData.updateJobDetail(
                            job.id,
                            JobProperty.DGDocumentation,
                            result?.checkboxValue ?? false,
                            job.preBook
                        );
                    }
                } else {
                    if (job.bulkJob) {
                        await this.DispatchData.updateBulkJobDetail(
                            job.id,
                            fieldName,
                            result.value,
                            job.charge,
                            FirstName,
                            ContactID
                        );
                    } else {
                        await this.DispatchData.updateJobDetail(
                            job.id,
                            fieldName,
                            result.value,
                            job.preBook
                        );
                    }
                }

                this.toastrService.showSuccessToast(`${job.jobNo} updated`);
                await this.refreshJobDetails(job.id);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    async showEditDialog(
        $event: MouseEvent,
        job: IJob,
        title: string,
        placeholder: string,
        ariaLabel: string,
        initialValue: string | number | undefined,
        field: JobProperty
    ): Promise<void> {
        const formattedValue = initialValue ? initialValue.toString() : "";

        const prompt = this.$mdDialog
            .prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(formattedValue)
            .targetEvent($event)
            .required(true)
            .ok("Save")
            .cancel("Cancel");

        const result = await this.$mdDialog.show(prompt);

        const callData: CallData = {
            field,
            value: result,
            jobID: job.id,
        };
        await this.updateField(job, callData);

        this.toastrService.showSuccessToast(`${job.jobNo} updated`);
        await this.refreshJobDetails(job.id);
    }

    async showJobDimensionsDialog($event: MouseEvent, job: IJob): Promise<void> {
        await this.editParcelDimensionsDialogService.showJobDimensionsDialog(
            $event,
            job
        );
        await this.refreshJobDetails(job.id);
    }

    async editStartTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog(
            $event,
            job,
            "Start Time",
            JobProperty.Time,
            job.time,
            job.pickUpTimeZone
        );
    }

    async editCompletedTime($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "POD Time",
            JobProperty.CompletedTime,
            job.completedTime,
            job.deliveryTimeZone
        );

        // Begin a job-done process
        if (this.job === undefined) return;
        await this.markJobAsDone($event, this.job);
    }

    async editFollowUpTime($event: MouseEvent, job: IJob): Promise<void> {
        if (job.locked || job.internalStatusId === JobInternalStatusEnum.NewJobs
            || job.internalStatusId === JobInternalStatusEnum.Reprice) {
            // Can't edit follow-up time
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Cannot Edit Follow-up Time')
                    .textContent('The follow-up time cannot be edited for jobs that are locked, have New Jobs status, or require repricing.')
                    .ariaLabel('Follow-up Time Edit Restriction')
                    .ok('Understood')
                    .targetEvent($event)
            );

            return;
        }

        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "Follow Up Time",
            JobProperty.FollowupTime,
            job.followupTime,
            job.deliveryTimeZone
        );
    }

    async editPuDate($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "Pick Up Time",
            JobProperty.PuTime,
            job.puTime,
            job.pickUpTimeZone
        );
    }

    async editDeliverBy($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "Deliver By",
            JobProperty.DeliverBy,
            job.deliverByTime,
            job.deliveryTimeZone
        );
    }

    async editBookedDate($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateDialog(
            $event,
            job,
            "Booked Date",
            JobProperty.BookedTime,
            job.createdDate
        );
    }

    async editFirstDueDate($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateDialog(
            $event,
            job,
            "First Due",
            JobProperty.FirstDue,
            job.firstDue
        );
    }

    async editStopDate($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateDialog(
            $event,
            job,
            "Stop Date",
            JobProperty.StopDate,
            job.stopDate
        );
    }

    async editRestartDate($event: MouseEvent, job: IJob): Promise<void> {
        await this.showEditDateDialog(
            $event,
            job,
            "Restart Date",
            JobProperty.RestartDate,
            job.restartDate
        );
    }

    async updateAddress($event: MouseEvent, job: IJob, field: string): Promise<void> {
        const isDeliveryAddress = field === "toAddress";
        const existingAddress = isDeliveryAddress
            ? job.deliveryAddress
            : job.pickupAddress;

        try {
            const newAddress =
                await this.editAddressDialogService.openEditAddressDialog(
                    existingAddress,
                    $event
                );
            if (!newAddress) {
                this.$log.debug("User closed dialog");
                return;
            }

            await this.processAddressUpdate(job, newAddress, isDeliveryAddress);
        } catch (error) {
            if (!error) {
                this.$log.debug("User closed dialog");
                return;
            }

            this.$log.error("Error updating GPS:", error);
        } finally {
            this.applyScope();
        }
    }

    private async processAddressUpdate(
        job: IJob,
        newAddress: IEditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ): Promise<void> {
        try {
            this.$log.debug(`isDeliveryAddress: ${isDeliveryAddress}`);

            await this.updateJobRateAndAddress(
                job,
                newAddress,
                isDeliveryAddress
            );

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.handleError(error);
        }
    }

    private updateJobAddressUs(
        job: IJob,
        newAddress: IEditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ): IJob {
        const addressField = isDeliveryAddress
            ? "deliveryAddress"
            : "pickupAddress";
        this.$log.debug(`Address Field: ${addressField}`);

        job[addressField] = newAddress;
        return job;
    }

    private async updateJobRateAndAddress(
        job: IJob,
        addressResult: IEditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ): Promise<void> {
        try {
            if (isDeliveryAddress) {
                await this.DispatchData.updateDeliveryAddress(
                    job.id,
                    FirstName,
                    job.preBook,
                    addressResult
                );
            } else {
                await this.DispatchData.updatePickupAddress(
                    job.id,
                    FirstName,
                    job.preBook,
                    addressResult
                );
            }
        } catch (error) {
            this.$log.error("Error updating job rate and address:", error);
            throw error;
        }
    }

    async editJobContact(
        $event: MouseEvent,
        job: IJob,
        contactType: "from" | "to"
    ): Promise<void> {
        const contactMapping = {
            from: {
                title: "Edit From Contact Name",
                placeholder: "From Contact Name...",
                fieldLabel: "from contact name",
                contactValue: job.fromContactName,
                contactProperty: JobProperty.FromContactName,
            },
            to: {
                title: "Edit To Contact Name",
                placeholder: "To Contact Name...",
                fieldLabel: "to contact name",
                contactValue: job.deliverToContact,
                contactProperty: JobProperty.ToContactName,
            },
        };

        const contactDetails = contactMapping[contactType];

        if (!contactDetails) {
            throw new Error(`[editJobContact] Invalid contact type: ${contactType}`);
        }

        try {
            await this.showEditDialog(
                $event,
                job,
                contactDetails.title,
                contactDetails.placeholder,
                contactDetails.fieldLabel,
                contactDetails.contactValue,
                contactDetails.contactProperty
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editJobContactPhone(
        $event: MouseEvent,
        job: IJob,
        contactType: "from" | "to"
    ): Promise<void> {
        const phoneMapping = {
            from: {
                title: "Edit From Contact Phone",
                placeholder: "From Contact Phone...",
                fieldLabel: "from contact phone",
                phoneValue: job.fromContactNumber,
                phoneProperty: JobProperty.FromContactPhone,
            },
            to: {
                title: "Edit To Contact Phone",
                placeholder: "To Contact Phone...",
                fieldLabel: "to contact phone",
                phoneValue: job.toContactPhone,
                phoneProperty: JobProperty.ToContactPhone,
            },
        };

        const phoneDetails = phoneMapping[contactType];

        if (!phoneDetails) {
            throw new Error(
                `[editJobContactPhone] Invalid contact type: ${contactType}`
            );
        }

        try {
            await this.showEditDialog(
                $event,
                job,
                phoneDetails.title,
                phoneDetails.placeholder,
                phoneDetails.fieldLabel,
                phoneDetails.phoneValue,
                phoneDetails.phoneProperty
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editPodName($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit POD Name",
                "POD Name...",
                "pod name",
                job.podName,
                JobProperty.PodName
            );

            // Begin job done process
            const refreshedJob = this.job;
            if (!refreshedJob) return;
            await this.markJobAsDone($event, refreshedJob);
        } catch (error) {
            this.handleError(error);
        }
    }

    async editRef($event: MouseEvent, job: IJob, isRefA: boolean): Promise<void> {
        try {
            if (isRefA) {
                await this.showEditDialog(
                    $event,
                    job,
                    "Edit RefA",
                    "RefA...",
                    "refa",
                    job.refA,
                    JobProperty.RefA
                );
            } else {
                await this.showEditDialog(
                    $event,
                    job,
                    "Edit RefA",
                    "RefB...",
                    "refb",
                    job.refB,
                    JobProperty.RefB
                );
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    async editOurRef($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit Our Reference",
                "Our Reference...",
                "our reference",
                job.ourRef,
                JobProperty.OurRef
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editConNote($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit AWB",
                "AWB...",
                "awb",
                job.conNote,
                JobProperty.ConNote
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editJobWeight($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit Weight",
                "Job Weight...",
                "job weight",
                job.weight,
                JobProperty.Weight
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editTrackingMobile($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit Tracking Mobile",
                "Tracking Mobile...",
                "tracking mobile",
                job.trackingMobile,
                JobProperty.TrackingMobile
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async editTrackingEmail($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit Tracking Email",
                "Tracking Email...",
                "tracking email",
                job.trackingEmail,
                JobProperty.TrackingEmail
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async clientClick($event: MouseEvent, job: IJob): Promise<void> {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId,
            text: job.clientName,
        };

        await this.showAutocompleteDialog(
            $event,
            job,
            url,
            placeholder,
            JobProperty.ClientID,
            "Client",
            existingItem,
            true
        );
    }

    async courierClick($event: MouseEvent, job: IJob): Promise<void> {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        await this.showAutocompleteDialog(
            $event,
            job,
            url,
            placeholder,
            JobProperty.CourierID,
            "Courier",
            null,
            false
        );
    }

    async contactClick($event: MouseEvent, job: IJob): Promise<void> {
        if (!job.clientId) return;

        const pickContacts = await this.DispatchData.getContactList(job.clientId);
        await this.showSelectDialog(
            $event,
            job,
            pickContacts,
            JobProperty.FromContactName,
            "From Contact Name",
            job.fromContactName
        );
    }

    async speedClick($event: MouseEvent, job: IJob): Promise<void> {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog(
            $event,
            job,
            pickSpeeds,
            JobProperty.SpeedID,
            "Speed",
            job.speedName
        );
    }

    async inActiveByClick($event: MouseEvent, job: IJob): Promise<void> {
        const activeStaff = await this.DispatchData.getActiveStaff();
        await this.showSelectDialog(
            $event,
            job,
            activeStaff,
            JobProperty.InActiveDate,
            "InActive By",
            job.inActiveBy?.text ?? ""
        );
    }

    async jobTypeClick($event: MouseEvent, job: IJob): Promise<void> {
        this.$log.debug("jobTypeClick initiated", {
            eventType: $event.type,
            jobId: job.id,
            currentJobType: job.jobType,
        });

        const data = [
            {
                id: 1,
                text: "Pickup",
            },
            {
                id: 2,
                text: "Delivery",
            },
            {
                id: 3,
                text: "3rd-Party",
            },
        ];

        this.$log.debug("Showing select dialog", {
            jobId: job.id,
            jobTypeDes: job.jobTypeDescription,
            availableOptions: data.length,
        });

        try {
            await this.showSelectDialog(
                $event,
                job,
                data,
                JobProperty.AcceptedJobTypeID,
                "Job Type",
                job.jobTypeDescription
            );
            this.$log.debug("Select dialog completed}");
        } catch (error) {
            this.$log.error("Error showing select dialog:", error);
            throw error;
        }
    }

    async sizeClick($event: MouseEvent, job: IJob): Promise<void> {
        const pickVehicleSizes = await this.DispatchData.getVehicleSizes();
        await this.showSelectDialog(
            $event,
            job,
            pickVehicleSizes,
            JobProperty.Size,
            "Size",
            job.size.text
        );
    }

    async dgClassClick($event: MouseEvent, job: IJob): Promise<void> {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        await this.showSelectDialog(
            $event,
            job,
            dgClassOptions,
            JobProperty.DGClass,
            "DG Class",
            initialValue,
            true,
            "Has Documentation?"
        );
    }

    async leaveClick($event: MouseEvent, job: IJob): Promise<void> {
        const pickLeaveList = await this.DispatchData.getLeaveList();
        await this.showSelectDialog(
            $event,
            job,
            pickLeaveList,
            JobProperty.DeliverToLeaveID,
            "Leave Parcel",
            job.sigNotRequired || "Signature Required"
        );
    }

    async trackingMethodClick($event: MouseEvent, job: IJob): Promise<void> {
        const trackingArray: ISuggestion[] = this.options.detail.tracking.map(
            (item) => {
                return {
                    id: item.id,
                    text: item.label,
                };
            }
        );
        const trackingMethod = JobDetailController.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog(
            $event,
            job,
            trackingArray,
            JobProperty.TrackingMethod,
            "Tracking Method",
            trackingMethod
        );
    }

    async statusClick($event: MouseEvent, job: IJob): Promise<void> {
        const statusList = await this.DispatchData.getStatusList();
        await this.showSelectDialog(
            $event,
            job,
            statusList,
            JobProperty.Status,
            "Status",
            job.statusName
        );
    }

    private showLoading(): void {
        this.isLoading = true;
    }

    private hideLoading() {
        this.isLoading = false;
    }

    async updateField(job: IJob, callData: CallData): Promise<void> {
        this.showLoading();

        try {
            // Ensure rate is decimal
            const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
            if (isNaN(numericRate)) {
                this.$log.error("Failed to convert rate to a number");
            }

            if (job.bulkJob) {
                await this.DispatchData.updateBulkJobDetail(
                    job.id,
                    callData.field,
                    callData.value,
                    numericRate,
                    FirstName,
                    ContactID
                );
            } else {
                await this.DispatchData.updateJobDetail(
                    callData.jobID,
                    callData.field,
                    callData.value,
                    job.preBook
                );
            }
        } catch (error) {
            this.$log.error("Error updating job:", error);
            this.toastrService.showErrorToast(
                "Failed to update job. Please try again."
            );
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    static hasDGDocs(job: IJob): "Yes" | "No" | string {
        if (job.dgClass) {
            return (job.dgClass || 0) === 1 || job.dgDocumentation || false
                ? "Yes"
                : "No";
        } else {
            return "";
        }
    }

    async toggleJobProperty(
        job: IJob,
        property: JobProperty,
        value: boolean,
        useCharge: boolean = true
    ): Promise<void> {
        this.$log.debug(
            `[JobDetailsComponentController] Start toggleJobProperty - property: ${property}, useCharge: ${useCharge}`
        );

        if (!job || !job.id) {
            this.$log.debug(`[JobDetailsComponentController] Error: Invalid job data`);
            this.toastrService.showErrorToast(`Cannot update: Invalid job data`);
            return;
        }

        try {
            const newValue = !value;
            this.$log.debug(
                `[JobDetailsComponentController] Toggling ${property} for job ${
                    job.jobNo || job.id
                } from ${!newValue} to ${newValue}`
            );

            const callData: CallData = {
                field: property,
                value: newValue,
                jobID: job.id,
            };

            this.$log.debug(
                `[JobDetailsComponentController] Calling updateField with data:`,
                callData
            );

            await this.updateField(job, callData);

            if (property === JobProperty.Reprice && newValue) {
                this.$log.debug(
                    `[JobDetailsComponentController] Special handling for reprice - updating internal status`
                );
                const repriceStatusId = 4;
                await this.DispatchData.updateJobDetail(
                    job.id,
                    JobProperty.InternalStatusID,
                    repriceStatusId,
                    job.preBook
                );
            }

            this.$log.debug(
                `[JobDetailsComponentController] Update successful for ${property}`
            );
            this.toastrService.showSuccessToast(`${job.jobNo} updated`);

            this.$log.debug(
                `[JobDetailsComponentController] Refreshing job details for ID: ${job.id}`
            );
            await this.refreshJobDetails(job.id);

            this.$log.debug(
                `[JobDetailsComponentController] Toggle operation completed for ${property}`
            );
        } catch (error) {
            this.$log.error(
                `[JobDetailsComponentController] Error toggling ${property}:`,
                error
            );
            this.toastrService.showErrorToast(
                `Failed to update ${property}. Please try again.`
            );
        }
    }

    async toggleProperty(job: IJob, property: JobProperty, value: boolean): Promise<void> {
        this.$log.debug(
            `[JobDetailsComponentController] Toggling property '${property}' for job ${
                job?.jobNo || job?.id || "unknown"
            }`
        );

        const propertiesUsingDefaultCharge = [
            "pedal",
            "truck",
            "direct",
            "return",
            "oneOff",
            "active",
            "void",
            "van",
            "vanOK",
            "reprice",
        ];

        const useCharge = propertiesUsingDefaultCharge.includes(property);
        this.$log.debug(
            `[JobDetailsComponentController] Using default charge: ${useCharge}`
        );

        await this.toggleJobProperty(job, property, value, useCharge);

        this.$log.debug(
            `[JobDetailsComponentController] Property '${property}' toggle completed`
        );
    }

    async markJobAsDone($event: MouseEvent, job: IJob): Promise<void> {
        try {
            let completedTime: string | undefined;
            if (job.completedTime === undefined) {
                const result =
                    await this.editDateTimeDialogService.showEditDateAndTimeDialog(
                        $event,
                        "POD Time",
                        JobProperty.CompletedTime,
                        job.completedTime,
                        job.deliveryTimeZone
                    );

                if (result.value === undefined) {
                    this.toastrService.showWarningToast("A POD time needs to be provided to close this job.");
                    return;
                }

                completedTime = result.value;
            }

            let podName: string | undefined;
            if (!job.podName) {
                const prompt = this.$mdDialog
                    .prompt()
                    .title("POD Name")
                    .placeholder("POD Name..")
                    .ariaLabel("pod name")
                    .initialValue(job.podName ?? "")
                    .targetEvent($event)
                    .required(true)
                    .ok("Complete Job")
                    .cancel("Cancel");

                podName = await this.$mdDialog.show(prompt);
                if (podName === undefined) {
                    this.toastrService.showWarningToast("A POD name needs to be provided to close this job.");
                    return;
                }
            }

            try {
                await this.jobFileUploadDialogService.openJobFileUploadDialog(
                    $event,
                    job,
                    FileUploadType.POD
                );
            } catch (error) {
                if (error !== undefined) {
                    this.toastrService.showErrorToast(
                        "Oops an error occurred uploading POD photos."
                    );

                    return;
                }
            }

            this.$log.debug("[JobDetailsComponentController] Marking job as done]");

            const requestData: UpdatePodDetailsRequest = {
                jobId: job.id,
                jobStatus: JobStatus.Completed.toString(),
                podName: podName ?? '',
                podTime: completedTime ?? dayjs(job.completedTime).format('YYYY-MM-DD HH:mm')
            }

            await this.DispatchData.updatePODDetail(requestData);

            this.toastrService.showSuccessToast(`${job.jobNo} Completed`);
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async refreshJobDetails(jobId: number): Promise<void> {
        try {
            this.$log.debug(`Refreshing job details for jobId: ${jobId}`);
            this.isLoading = true;

            await this.loadJobData(jobId);

            this.$log.debug("Job data refreshed");
        } catch (error) {
            this.isLoading = false;
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }

    private handleError(error: any): void {
        if (!error) {
            this.$log.debug("User closed dialog");
        } else {
            this.$log.error("Error: ", error);
            this.toastrService.showErrorToast();
        }
    }

    static getTrackingMethod(trackingMethod?: number): string {
        switch (trackingMethod || 0) {
            case 1:
                return "Email";
            case 2:
                return "Mobile";
            case 3:
                return "Email & Mobile";
            default:
                return "";
        }
    }

    setSelectedPhoto(index: number): void {
        this.selectedPhotoIndex = index;
    }

    nextPhoto(): void {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex =
            (this.selectedPhotoIndex + 1) % this.formattedPodPhotos.length;
    }

    prevPhoto(): void {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex =
            (this.selectedPhotoIndex - 1 + this.formattedPodPhotos.length) %
            this.formattedPodPhotos.length;
    }

    private handleKeydown: (event: Event) => void = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === "ArrowLeft") {
            this.prevPhoto();
        } else if (keyboardEvent.key === "ArrowRight") {
            this.nextPhoto();
        }
    };

    private setupPhotoKeyboardNavigation(): void {
        const photoSection = angular.element(".pod-photo-section");

        if (photoSection.length) {
            photoSection.off("keydown", this.handleKeydown);
            photoSection.on("keydown", this.handleKeydown);
            photoSection.attr("tabindex", "0");
        }
    }

    openPodViewer(index: number): void {
        this.selectedPhotoIndex = index;
        this.isPodViewerOpen = true;
    }

    closePodViewer(): void {
        this.isPodViewerOpen = false;
    }

    async sendPOD($event: MouseEvent): Promise<void> {
        if (!this.job?.podPhotos) return;

        try {
            if (!this.job?.podPhoto) {
                await this.$mdDialog.show(
                    this.$mdDialog
                        .alert()
                        .clickOutsideToClose(true)
                        .title("No Photo")
                        .textContent("Sorry no photo for this job.")
                        .ok("OK")
                );
                this.$log.debug("Alert closed.");
                return;
            }

            const confirm = this.$mdDialog
                .prompt()
                .title("Email the photo POD")
                .textContent("Please enter an email address to send the POD.")
                .placeholder("Email Address")
                .ariaLabel("Email Address")
                .targetEvent($event)
                .required(true)
                .ok("Send")
                .cancel("Cancel");

            const email = await this.$mdDialog.show(confirm);

            await this.DispatchData.sendPOD(this.job.id, email);

            await this.$mdDialog.show(
                this.$mdDialog
                    .alert()
                    .clickOutsideToClose(true)
                    .title("Email Sent")
                    .textContent("POD email has been sent")
                    .ok("OK")
            );
        } catch (error: any) {
            this.handleError(error);
        }
    }

    async showPricingBreakdown($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.priceBreakdownDialogService.openPriceBreakdownDialog(
                $event,
                job.id,
                job.preBook
            );
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.$log.error("Error in displayPriceBreakdown:", error);
            this.toastrService.showErrorToast(
                "An error occurred while fetching the price breakdown. Please try again."
            );
        }
    }

    async toggleReadStatus(job: IJob): Promise<void> {
        if (!job || !job.id) {
            this.toastrService.showErrorToast("Cannot update job: Invalid job data");
            return;
        }

        // Determine the new status (opposite of current)
        const newReadStatus = !job.readTrackerInfo?.hasBeenRead;
        const actionText = newReadStatus ? "read" : "unread";

        this.$log.debug(
            `Marking job ${job.jobNo} as ${actionText}`
        );

        try {
            this.showLoading();

            // Update the job's read status in the database
            await this.DispatchData.updateJobReadStatus(job.id, newReadStatus);

            // Update the local job object
            if (!job.readTrackerInfo) {
                job.readTrackerInfo = {
                    hasBeenRead: newReadStatus,
                    readBy: newReadStatus ? FirstName : "",
                    readDate: newReadStatus ? new Date() : null,
                };
            } else {
                job.readTrackerInfo.hasBeenRead = newReadStatus;

                if (newReadStatus) {
                    // Update reader info when marking as read
                    job.readTrackerInfo.readBy = FirstName;
                    job.readTrackerInfo.readDate = new Date();
                } else {
                    // Clear reader info when marking as unread
                    job.readTrackerInfo.readBy = "";
                    job.readTrackerInfo.readDate = null;
                }
            }

            this.toastrService.showSuccessToast(
                `Job ${job.jobNo} marked as ${actionText}`
            );
        } catch (error) {
            this.$log.error(`Error marking job as ${actionText}:`, error);
            this.toastrService.showErrorToast(
                `Failed to mark job as ${actionText}. Please try again.`
            );
        } finally {
            const data: IJobReadChanged = {
                jobId: job?.id ?? 0,
                isRead: job.readTrackerInfo.hasBeenRead,
            };

            this.$rootScope.$broadcast("jobReadChanged", data);
            this.hideLoading();
        }
    }

    isJobRead(job: IJob): boolean {
        return job?.readTrackerInfo?.hasBeenRead || false;
    }

    async updateDaysOfWeek(job: IJob): Promise<void> {
        this.$log.debug("Updating days of week from array:", job.daysOfWeek);

        let daysValue = 0;
        if (Array.isArray(job.daysOfWeek)) {
            job.daysOfWeek.forEach((day: number) => {
                daysValue |= day;
            });
        } else if (typeof job.daysOfWeek === "number") {
            daysValue = job.daysOfWeek;
        }

        this.$log.debug("Days bitmask value calculated:", daysValue);

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.DaysOfWeek,
                daysValue,
                job.preBook
            );

            this.toastrService.showSuccessToast(`${job.jobNo} days updated`);
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.$log.error("Error updating days of week:", error);
            this.handleError(error);
        }
    }

    async updateFrequency(job: IJob): Promise<void> {
        if (!job.frequency) return;

        const frequencyValue = Number(job.frequency);
        this.$log.debug("Updating frequency to:", frequencyValue);

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.Frequency,
                frequencyValue,
                job.preBook
            );

            this.toastrService.showSuccessToast(`${job.jobNo} frequency updated`);
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.$log.error("Error updating frequency:", error);
            this.handleError(error);
        }
    }

    async updateHolidayDeliveryOption(job: IJob): Promise<void> {
        if (!job.holidayDeliveryOption) return;

        const holidayOptionValue = Number(job.holidayDeliveryOption);
        this.$log.debug("Updating holiday delivery option to:", holidayOptionValue);

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.HolidayDelivery,
                holidayOptionValue,
                job.preBook
            );

            this.toastrService.showSuccessToast(
                `${job.jobNo} holiday delivery option updated`
            );
            await this.refreshJobDetails(job.id);
        } catch (error) {
            this.$log.error("Error updating holiday delivery option:", error);
            this.handleError(error);
        }
    }

    async openPodUploadDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.jobFileUploadDialogService.openJobFileUploadDialog(
            $event,
            job,
            FileUploadType.POD
        );
    }

    async loadSubJobData(relatedJobIndex: number) {
        this.selectedRelatedJob = this.jobGroups[relatedJobIndex];

        this.selectedSubJobIndex = 0;

        if (
            this.selectedRelatedJob &&
            this.selectedRelatedJob.subJobs &&
            this.selectedRelatedJob.subJobs.length > 0
        ) {
            await this.loadSubJobDetails(0);
        }
    }

    async switchToSubJob(subJobIndex: number): Promise<void> {
        if (subJobIndex === this.selectedSubJobIndex) return;

        this.selectedSubJobIndex = subJobIndex;

        await this.loadSubJobDetails(subJobIndex);
        this.applyScope();
    }

    private async loadSubJobDetails(subJobIndex: number): Promise<void> {
        if (
            !this.selectedRelatedJob ||
            !this.selectedRelatedJob.subJobs ||
            subJobIndex >= this.selectedRelatedJob.subJobs.length ||
            subJobIndex < 0
        ) {
            console.warn(
                "Invalid subjob index or no subjobs available"
            );
            return;
        }

        const subJob = this.selectedRelatedJob.subJobs[subJobIndex];

        try {
            this.isLoading = true;
            this.$log.debug(
                `Loading subjob details for ID: ${subJob.id}`
            );

            // Load the subj ob details from the server
            const jobDetails = await this.DispatchData.getJobDetail(subJob.id);

            // Preserve the original related jobs data
            const originalRelatedJobs = this.job?.relatedJobs;
            const originalJobGroups = this.jobGroups;
            const originalSelectedRelatedJob = this.selectedRelatedJob;
            const originalSelectedTabIndex = this.selectedTabIndex;

            // Update the job with the subj ob details
            this.job = jobDetails;

            // Restore the preserved data
            if (originalRelatedJobs) {
                if (!this.job) {
                    this.$log.error("Failed to load subjob details");
                    return;
                }

                this.job.relatedJobs = originalRelatedJobs;
                this.jobGroups = originalJobGroups;
                this.selectedRelatedJob = originalSelectedRelatedJob;
                this.selectedTabIndex = originalSelectedTabIndex;
            }

            this.initializeJobData();

            // Broadcast the subj ob change
            this.$rootScope.$broadcast("subJobChanged", this.job);

            this.$log.debug(
                `Successfully loaded subjob: ${subJob.id}`
            );
        } catch (error) {
            this.$log.error(
                `Error loading subjob details:`,
                error
            );
            this.toastrService.showErrorToast("Failed to load subjob details");
        } finally {
            this.isLoading = false;
            this.applyScope();
        }
    }

    async updateActive(job: IJob): Promise<void> {
        try {
            const newValue = !job.active;

            if (this.job) this.job.active = newValue;

            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.Active,
                newValue,
                true
            );
        } catch (error) {
            this.$log.error("Error updating active:", error);
            this.handleError(error);
        }
    }

    async updateVoid($event: MouseEvent, job: IJob): Promise<void> {
        try {
            const newVoidValue = !job.void;

            if (newVoidValue) {
                await this.voidJobConfirmationDialogService.showVoidConfirmationDialog($event, job);
            } else {
                await this.DispatchData.updateJobDetail(
                    job.id,
                    JobProperty.Void,
                    newVoidValue,
                    job.preBook
                );
            }
        } catch (error) {
            this.$log.error("Error updating void:", error);
            this.handleError(error);
        }
    }

    getTotalPalletQuantity(): number {
        if (!this.job || !this.job.palletInfo) return 0;
        return this.job.palletInfo.reduce((sum, pallet) => sum + (pallet.quantity || 0), 0);
    }

    getTotalPalletWeight(): number {
        if (!this.job || !this.job.palletInfo) return 0;
        return this.job.palletInfo.reduce((sum, pallet) => sum + (pallet.weight || 0), 0);
    }

    getTotalPalletVolume(): number {
        if (!this.job || !this.job.palletInfo) return 0;
        return this.job.palletInfo.reduce((sum, pallet) => {
            const length = pallet.length || 0;
            const depth = pallet.depth || 0;
            const height = pallet.height || 0;
            return sum + (length * depth * height * (pallet.quantity || 1));
        }, 0);
    }

    private loadFieldVisibilityFromStorage(): { [key: string]: boolean } {
        try {
            const stored = localStorage.getItem(JobDetailController.FIELD_VISIBILITY_KEY);
            if (stored) {
                const parsedVisibility = JSON.parse(stored);
                // Merge with defaults to ensure all fields are present
                return {...this.defaultFieldVisibility, ...parsedVisibility};
            }
        } catch (error) {
            this.$log.warn('Failed to load field visibility from localStorage:', error);
        }

        // Return a copy of defaults if no stored data or error
        return {...this.defaultFieldVisibility};
    }

    private saveFieldVisibilityToStorage(): void {
        try {
            localStorage.setItem(
                JobDetailController.FIELD_VISIBILITY_KEY,
                JSON.stringify(this.fieldVisibility)
            );
        } catch (error) {
            this.$log.warn('Failed to save field visibility to localStorage:', error);
        }
    }

    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
    }

    toggleFieldVisibility(fieldKey: string): void {
        this.fieldVisibility[fieldKey] = !this.fieldVisibility[fieldKey];
        this.saveFieldVisibilityToStorage();
    }

    resetFieldVisibility(): void {
        this.fieldVisibility = {...this.defaultFieldVisibility};
        this.saveFieldVisibilityToStorage();
        this.toastrService.showSuccessToast("Default Job Detail layout restored");
    }

    isFieldVisible(fieldKey: string): boolean {
        return this.fieldVisibility[fieldKey];
    }

    loadViewDensity(): void {
        try {
            const stored = localStorage.getItem(JobDetailController.VIEW_DENSITY_KEY);
            if (stored && ['normal', 'dense', 'ultradense'].includes(stored)) {
                this.viewDensity = stored as 'normal' | 'dense' | 'ultradense';
            }
        } catch (error) {
            this.$log.warn('Failed to load view density from localStorage:', error);
        }
    }

    saveViewDensity(): void {
        try {
            localStorage.setItem(JobDetailController.VIEW_DENSITY_KEY, this.viewDensity);
        } catch (error) {
            this.$log.warn('Failed to save view density to localStorage:', error);
        }
    }

    toggleViewDensity(): void {
        switch (this.viewDensity) {
            case 'normal':
                this.viewDensity = 'dense';
                break;
            case 'dense':
                this.viewDensity = 'normal';
                break;
        }
        this.saveViewDensity();
    }

    isDenseView(): boolean {
        return this.viewDensity === 'dense';
    }

    isUltraDenseView(): boolean {
        return this.viewDensity === 'ultradense';
    }
}

const JobDetailComponent: angular.IComponentOptions = {
    template: require("./job-details.template.html"),
    bindings: {
        jobId: "<",
        appPage: "<",
        onStatusChange: "&",
        isRecurringJob: "<",
        isBulkJob: "<",
    },
    controller: JobDetailController,
    controllerAs: "ctrl",
};
export default JobDetailComponent;
