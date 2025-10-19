import ToastrService from "../../../services/toastr.service";
import {
    IDispatchJob,
    IEditAddressDialogViewModel,
    IJob,
    InternalStatus,
    ISuggestion,
    JobGroup,
} from "../../../interfaces/job.interface";
import {ContactID, FirstName} from "../../../contants";
import {CallData, TabItem} from "./job-details.interfaces";
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
import {DaysOfWeek, DaysOfWeekHelpers} from "../../../enums/days-of-week.enum";
import AutoCompleteDialogService from "../../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import JobFileUploadDialogService from "../../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import {FileUploadType} from "../../../enums/file-upload-type.enum";
import sortRelatedJobs from "../../../functions/sortRelatedJobs";
import {UpdatePodDetailsRequest} from "../../../interfaces/requests.interfaces";
import dayjs, {Dayjs} from "dayjs";
import JobInternalStatusEnum from "../../../enums/job-internal-status.enum";
import VoidJobConfirmationDialogService
    from "../../dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";
import {displayLongDate} from "../../../functions/formatDates";
import JobPhotoType from "../../../enums/job-photo-type.enum";
import {IFlightSegment} from "../../Nationwide/nationwide.interfaces";
import PodPhotoType from "../../../enums/podPhotoType";

class JobDetailController extends BaseController {
    static $inject = [
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
        "$scope",
        "autoCompleteDialogService",
        "jobFileUploadDialogService",
        "voidJobConfirmationDialogService",
    ];

    private readonly FIELD_VISIBILITY_KEY = `jobDetail_fieldVisibility_${ContactID}`;
    private readonly VIEW_DENSITY_KEY = `jobDetail_viewDensity_${ContactID}`;

    onJobUpdate?: () => Promise<void>;

    readonly isRecurringJob: boolean = false;
    readonly isBulkJob: boolean = false;
    readonly isUsCustomer: boolean = false;
    jobId?: number;
    job?: IJob;
    selectedTab: number;
    allTabs: TabItem[];
    isPodViewerOpen: boolean = false;
    selectedPhotoIndex: number = 0;
    internalStatusList: InternalStatus[];
    isLoading: boolean = false;
    distance?: number;
    selectedTabIndex: number = 0;
    timeZone: string;
    jobGroups: JobGroup[] = [];
    selectedRelatedJob?: JobGroup;
    selectedSubJobIndex: number = 0;
    jobAddressIcon: string = "pin_drop";
    viewDensity: 'normal' | 'dense' | 'ultradense' = 'normal';
    trackingOptions: ISuggestion[];

    // Days of the week (recurring)
    daysOfWeekArray: DaysOfWeek[] = [];
    readonly dayOptions = DaysOfWeekHelpers.allDays.map(day => ({
        value: day,
        label: DaysOfWeekHelpers.dayLabels[day]
    }));

    // Photos
    formattedPodPhotos: PodPhoto[] = [];
    formattedPickupPhotos: PodPhoto[] = [];
    imageOnlyPodPhotos: PodPhoto[] = [];
    imageOnlyPickupPhotos: PodPhoto[] = [];

    isEditMode: boolean = false;
    fieldVisibility: { [key: string]: boolean } = {};
    defaultFieldVisibility: { [key: string]: boolean } = {};

    constructor(
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
        $scope: angular.IScope,
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

        this.trackingOptions = [
            {id: 1, text: "Email"},
            {id: 2, text: "Mobile"},
            {id: 3, text: "Email & Mobile"},
        ];

        this.internalStatusList = [];
    }

    $onInit(): void {
        console.log("$onInit called - jobId:", this.jobId);

        // Load data in parallel
        const statusListPromise = this.DispatchData.getInternalStatusList();
        const jobDataPromise = this.jobId ? this.loadJobData(this.jobId) : Promise.resolve();

        Promise.all([statusListPromise, jobDataPromise])
            .then(([statusList]) => {
                this.internalStatusList = statusList;

                if (this.jobId) {
                    console.log("Job data loaded successfully");
                }
            })
            .catch((error) => {
                console.error("Error during initialization:", error);
            });

        // Apply UI tweaks
        this.setupUI();
    }

    private setupUI(): void {
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
            notifiedSpeed: true,
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
            bookingSource: true,

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
            checkboxes: true,
            truckOptions: true
        };

        // Load from localStorage or use defaults
        this.fieldVisibility = this.loadFieldVisibilityFromStorage();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log("$onChanges called with changes:", changes);

        if (changes["jobId"]) {
            console.log("jobId changed:", changes["jobId"].currentValue);

            if (changes["jobId"].currentValue) {
                return this.loadJobData(changes["jobId"].currentValue);
            } else {
                this.job = undefined;
            }
        }
    }

    $onDestroy(): void {
        super.$onDestroy();
        console.log("$onDestroy called - cleaning up resources");

        // Clean up delivery photos
        this.formattedPodPhotos?.forEach(photo => {
            if (photo?.url) {
                URL.revokeObjectURL(photo.url);
            }
        });

        // Clean up pickup photos
        this.formattedPickupPhotos?.forEach(photo => {
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
        const previousJobId = this.jobId;
        console.log(`Switching to tab ${index}`);

        try {
            if (!this.job || !this.jobGroups || this.jobGroups.length <= index) {
                console.warn(`Invalid related job data for index ${index}`);
                return;
            }

            const targetJobGroup = this.jobGroups[index];
            const targetJob = targetJobGroup.job;

            if (targetJob && targetJob.id && targetJob.id !== this.jobId) {
                console.log(`Loading related job: ${targetJob.id} (${targetJob.text})`);

                // Preserve the original related jobs data
                const originalRelatedJobs = this.job.relatedJobs;
                const originalJobGroups = this.jobGroups;

                this.selectedTabIndex = index;
                this.jobId = targetJob.id;

                await this.loadJobData(targetJob.id);

                // Restore the preserved data
                if (originalRelatedJobs && this.job) {
                    this.job.relatedJobs = originalRelatedJobs;
                    this.jobGroups = originalJobGroups;
                }

                this.selectedRelatedJob = targetJobGroup;
                this.selectedSubJobIndex = -1;

                if (previousJobId !== this.jobId) {
                    this.$rootScope.$broadcast("jobChanged", this.job);
                }
            } else {
                console.log(`Already on the selected job or invalid job data`);
            }
        } finally {
            this.applyScope();
        }
    }

    private async loadJobData(jobId: number): Promise<void> {
        if (!jobId) {
            console.log("No job ID provided");
            return;
        }

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
                console.log("No job data returned from server");
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
            console.error("Error loading job data:", error);
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
            console.log(`Setting selectedTabIndex to ${tabIndex}, subJobIndex to ${subJobIndex}`);
            this.selectedTabIndex = tabIndex;
            this.selectedRelatedJob = this.jobGroups[tabIndex];
            this.selectedSubJobIndex = subJobIndex;

            if (subJobIndex !== -1) {
                console.log(`Current job is a subjob at index ${subJobIndex}`);
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

    getConnectionTime(firstSegment: IFlightSegment, secondSegment: IFlightSegment): string {
        if (!firstSegment || !secondSegment) return "";

        // Calculate time difference in minutes
        const diffMinutes = secondSegment.departureTime.diff(firstSegment.arrivalTime, "minutes");

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
            console.log("No POD time available for job");
            return;
        }

        console.log(`Loading POD and pickup photos for job: ${this.job.id}`);

        try {
            const completedTime = dayjs(this.job?.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();

            // Load delivery photos
            const deliveryPhotosData: any = await this.DispatchData.getJobDeliveryPhotosAndSignature(
                this.job.id,
                year,
                month
            );

            // Load pickup photos
            const pickupPhotosData: any = await this.DispatchData.getJobPickupPhotos(
                this.job.id,
                year,
                month
            );

            // Process delivery photos
            this.formattedPodPhotos = this.processPhotoData(deliveryPhotosData, JobPhotoType.Delivery);
            this.imageOnlyPodPhotos = this.formattedPodPhotos.filter(photo => this.isImageFile(photo));

            // Process pickup photos
            this.formattedPickupPhotos = this.processPhotoData(pickupPhotosData, JobPhotoType.Pickup);
            this.imageOnlyPickupPhotos = this.formattedPickupPhotos.filter(photo => this.isImageFile(photo));

            console.log(
                `Successfully processed ${this.formattedPodPhotos.length} delivery photos and ${this.formattedPickupPhotos.length} pickup photos`
            );

            this.selectedPhotoIndex = 0;
            this.setupPhotoKeyboardNavigation();
        } catch (error) {
            this.toastrService.showErrorToast("Failed to load POD/pickup photos");
            console.error("Error loading photos:", error);
            this.formattedPodPhotos = [];
            this.formattedPickupPhotos = [];
            this.handleError(error);
        }
    }

    private processPhotoData(photosData: any, photoType: JobPhotoType): PodPhoto[] {
        if (!photosData || photosData.length === 0) {
            return [];
        }

        return photosData.map((photoData: any, index: number) => {
            try {
                // New format with S3 metadata
                const podPhoto: PodPhoto = {
                    url: photoData.data ? `data:image/png;base64,${photoData.data}` : '',
                    timestamp: this.job?.completedTime
                        ? displayLongDate(this.job.completedTime)
                        : undefined,
                    uploadedBy: this.job?.courierData?.courierName ?? "Unknown",
                    coordinates: {
                        lat: photoType === JobPhotoType.Delivery
                            ? (this.job?.deliveryAddress?.latitude ?? 0)
                            : (this.job?.pickupAddress?.latitude ?? 0),
                        lng: photoType === JobPhotoType.Delivery
                            ? (this.job?.deliveryAddress?.longitude ?? 0)
                            : (this.job?.pickupAddress?.longitude ?? 0),
                    },
                    contentType: photoData.contentType,
                    fileName: photoData.fileName,
                    s3Key: photoData.s3Key
                };

                return podPhoto;
            } catch (error) {
                console.error(`Error processing ${photoType} photo ${index}:`, error);
                return null;
            }
        }).filter((photo: null) => photo !== null);
    }

    private initializeJobData(): void {
        if (!this.job) return;

        console.log("Initializing job data:", this.job.id);

        this.jobAddressIcon = this.job?.assignedFlight ? "flight_takeoff" : "pin_drop";

        if (typeof this.job.daysOfWeek === "number") {
            this.daysOfWeekArray = DaysOfWeekHelpers.bitwiseToArray(this.job.daysOfWeek);
            console.log("Initialized daysOfWeekArray from bitmap:", this.daysOfWeekArray);
        }

        if (this.job.holidayDeliveryOption) {
            this.job.holidayDeliveryOption = Number(this.job.holidayDeliveryOption);
            console.log(
                "Set holiday delivery option to:",
                this.job.holidayDeliveryOption
            );
        }

        if (this.job.frequency) {
            this.job.frequency = Number(this.job.frequency);
            console.log("Set frequency to:", this.job.frequency);
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
        dateTime?: Dayjs,
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
            return undefined;
        }
    }

    async showEditDateDialog(
        $event: MouseEvent,
        job: IJob,
        title: string,
        field: JobProperty,
        dateTime?: Dayjs,
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
        dateTime?: Dayjs,
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
                    result.timezone
                );
            } else {
                await this.DispatchData.updateJobDetail(
                    job.id,
                    result.fieldName,
                    result.value,
                    job.preBook,
                    result.timezone
                );
            }

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this.refreshJobDetails(job.id);
        }
    }

    async showSelectDialog(
        $event: MouseEvent,
        job: IJob,
        data: ISuggestion[],
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
                            job.charge
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
        if (!this.job) {
            this.toastrService.showWarningToast("Unable to mark job as done");
            return;
        }

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
                console.log("User closed dialog");
                return;
            }

            await this.processAddressUpdate(job, newAddress, isDeliveryAddress);
        } catch (error) {
            if (!error) {
                console.log("User closed dialog");
                return;
            }

            console.error("Error updating GPS:", error);
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
            console.log(`isDeliveryAddress: ${isDeliveryAddress}`);

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

    private async updateJobRateAndAddress(
        job: IJob,
        addressResult: IEditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ): Promise<void> {
        try {
            if (isDeliveryAddress) {
                await this.DispatchData.updateDeliveryAddress(
                    job.id,
                    job.preBook,
                    addressResult
                );
            } else {
                await this.DispatchData.updatePickupAddress(
                    job.id,
                    job.preBook,
                    addressResult
                );
            }
        } catch (error) {
            console.error("Error updating job rate and address:", error);
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

            // Begin job-done process
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
        console.log("jobTypeClick initiated", {
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

        console.log("Showing select dialog", {
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
            console.log("Select dialog completed}");
        } catch (error) {
            console.error("Error showing select dialog:", error);
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
        const trackingMethod = JobDetailController.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog(
            $event,
            job,
            this.trackingOptions,
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
            if (isNaN(job.charge)) {
                console.error("Failed to convert rate to a number");
            }

            if (job.bulkJob) {
                await this.DispatchData.updateBulkJobDetail(
                    job.id,
                    callData.field,
                    callData.value,
                    job.charge
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
            console.error("Error updating job:", error);
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
        console.log(
            `[JobDetailsComponentController] Start toggleJobProperty - property: ${property}, useCharge: ${useCharge}`
        );

        if (!job || !job.id) {
            console.log(`[JobDetailsComponentController] Error: Invalid job data`);
            this.toastrService.showErrorToast(`Cannot update: Invalid job data`);
            return;
        }

        try {
            const newValue = !value;
            console.log(
                `[JobDetailsComponentController] Toggling ${property} for job ${
                    job.jobNo || job.id
                } from ${!newValue} to ${newValue}`
            );

            const callData: CallData = {
                field: property,
                value: newValue,
                jobID: job.id,
            };

            console.log(
                `[JobDetailsComponentController] Calling updateField with data:`,
                callData
            );

            await this.updateField(job, callData);

            if (property === JobProperty.Reprice && newValue) {
                console.log(
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

            console.log(
                `[JobDetailsComponentController] Update successful for ${property}`
            );
            this.toastrService.showSuccessToast(`${job.jobNo} updated`);

            console.log(
                `[JobDetailsComponentController] Refreshing job details for ID: ${job.id}`
            );
            await this.refreshJobDetails(job.id);

            console.log(
                `[JobDetailsComponentController] Toggle operation completed for ${property}`
            );
        } catch (error) {
            console.error(
                `[JobDetailsComponentController] Error toggling ${property}:`,
                error
            );
            this.toastrService.showErrorToast(
                `Failed to update ${property}. Please try again.`
            );
        }
    }

    async toggleProperty(job: IJob, property: JobProperty, value: boolean): Promise<void> {
        console.log(
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
        console.log(
            `[JobDetailsComponentController] Using default charge: ${useCharge}`
        );

        await this.toggleJobProperty(job, property, value, useCharge);

        console.log(
            `[JobDetailsComponentController] Property '${property}' toggle completed`
        );
    }

    async markJobAsDone($event: MouseEvent, job: IJob): Promise<void> {
        try {
            let completedTime: string | undefined;
            if (job.completedTime === undefined || job.completedTime === null) {
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

            console.log("[JobDetailsComponentController] Marking job as done]");

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
            console.log(`Refreshing job details for jobId: ${jobId}`);
            this.isLoading = true;

            await this.loadJobData(jobId);

            // Notify parent to refresh the job list
            if (this.onJobUpdate) {
                await this.onJobUpdate();
            }

            console.log("Job data refreshed");
        } catch (error) {
            this.isLoading = false;
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }

    private handleError(error: any): void {
        if (!error) {
            console.log("User closed dialog");
        } else {
            console.error("Error: ", error);
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

    async openPodViewer(index: number, photoType: PodPhotoType = PodPhotoType.Delivery): Promise<void> {
        const photos = photoType === PodPhotoType.Pickup ? this.formattedPickupPhotos : this.formattedPodPhotos;
        const photo = photos[index];

        if (this.isImageFile(photo)) {
            this.selectedPhotoIndex = index;
            this.isPodViewerOpen = true;
        } else {
            // For non-image files, download them instead
            await this.downloadFile(photo);
        }
    }

    private async downloadFile(photo: PodPhoto): Promise<void> {
        if (!photo || !photo.s3Key) return;

        try {
            await this.DispatchData.downloadFile(photo.s3Key, photo.fileName || 'file.png');
            this.toastrService.showSuccessToast("File downloaded successfully");
        } catch (error) {
            console.error('Error downloading file:', error);
            this.toastrService.showErrorToast('Failed to download file');
        }
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
                console.log("Alert closed.");
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
            if (job.bulkJob) {
                this.toastrService.showWarningToast("Price breakdown is not currently available for scheduled jobs.");
                return;
            }

            const newAmount = await this.priceBreakdownDialogService.openPriceBreakdownDialog(
                $event,
                job.id,
                job.preBook
            );

            if (!newAmount || !this.job) return;
            this.job.charge = newAmount;
            await this.refreshJobDetails(job.id);
        } catch (error) {
            console.error("Error in displayPriceBreakdown:", error);
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

        console.log(
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
            console.error(`Error marking job as ${actionText}:`, error);
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
        console.log("Updating days of week from array:", this.daysOfWeekArray);

        const daysValue = DaysOfWeekHelpers.arrayToBitwise(this.daysOfWeekArray);
        console.log("Days bitmask value calculated:", daysValue);

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
            console.error("Error updating days of week:", error);
            this.handleError(error);
        }
    }

    async updateFrequency(job: IJob): Promise<void> {
        if (!job.frequency) return;

        const frequencyValue = Number(job.frequency);
        console.log("Updating frequency to:", frequencyValue);

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
            console.error("Error updating frequency:", error);
            this.handleError(error);
        }
    }

    async updateHolidayDeliveryOption(job: IJob): Promise<void> {
        if (!job.holidayDeliveryOption) return;

        const holidayOptionValue = Number(job.holidayDeliveryOption);
        console.log("Updating holiday delivery option to:", holidayOptionValue);

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
            console.error("Error updating holiday delivery option:", error);
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
            console.log(
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
                    console.error("Failed to load subjob details");
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

            console.log(
                `Successfully loaded subjob: ${subJob.id}`
            );
        } catch (error) {
            console.error(
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
            console.error("Error updating active:", error);
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
            console.error("Error updating void:", error);
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
            const stored = localStorage.getItem(this.FIELD_VISIBILITY_KEY);
            if (stored) {
                const parsedVisibility = JSON.parse(stored);
                // Merge with defaults to ensure all fields are present
                return {...this.defaultFieldVisibility, ...parsedVisibility};
            }
        } catch (error) {
            console.warn('Failed to load field visibility from localStorage:', error);
        }

        // Return a copy of defaults if no stored data or error
        return {...this.defaultFieldVisibility};
    }

    private saveFieldVisibilityToStorage(): void {
        try {
            localStorage.setItem(
                this.FIELD_VISIBILITY_KEY,
                JSON.stringify(this.fieldVisibility)
            );
        } catch (error) {
            console.warn('Failed to save field visibility to localStorage:', error);
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
            const stored = localStorage.getItem(this.VIEW_DENSITY_KEY);
            if (stored && ['normal', 'dense', 'ultradense'].includes(stored)) {
                this.viewDensity = stored as 'normal' | 'dense' | 'ultradense';
            }
        } catch (error) {
            console.warn('Failed to load view density from localStorage:', error);
        }
    }

    saveViewDensity(): void {
        try {
            localStorage.setItem(this.VIEW_DENSITY_KEY, this.viewDensity);
        } catch (error) {
            console.warn('Failed to save view density to localStorage:', error);
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

    isPdfFile(photo: any): boolean {
        if (!photo) return false;

        // Check if the photo object has a contentType property
        if (photo.contentType) {
            return photo.contentType === 'application/pdf';
        }

        // Check if filename has .pdf extension
        if (photo.fileName) {
            return photo.fileName.toLowerCase().endsWith('.pdf');
        }

        // Check if the s3Key indicates it's a PDF
        if (photo.s3Key) {
            return photo.s3Key.toLowerCase().endsWith('.pdf');
        }

        return false;
    }

    showItemNotEditableToaster(item: string): void {
        this.toastrService.showInfoToast(`${item} is not editable`);
    }

    isImageFile(photo: any): boolean {
        if (!photo) return false;

        // Check if the photo object has a contentType property
        if (photo.contentType) {
            return photo.contentType.startsWith('image/');
        }

        // Check if filename has image extension
        if (photo.fileName) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
            return imageExtensions.some(ext =>
                photo.fileName.toLowerCase().endsWith(ext)
            );
        }

        // Check if the s3Key indicates it's an image
        if (photo.s3Key) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
            return imageExtensions.some(ext =>
                photo.s3Key.toLowerCase().endsWith(ext)
            );
        }

        return false;
    }

    async editCustomJobName($event: MouseEvent, job: IJob): Promise<void> {
        try {
            await this.showEditDialog(
                $event,
                job,
                "Edit Job Name",
                "Job Name...",
                "job name",
                job.customJobName,
                JobProperty.CustomJobName
            );
        } catch (error) {
            this.handleError(error);
        }
    }
    
    async onTailLiftPickupClick(job: IJob): Promise<void> {
        if(this.job?.tailLiftPu == true && this.job.parcelDimensions.length === 0) {
            this.toastrService.showWarningToast("Please enter the parcels for this job before proceeding.");
            return;
        } 
        
        try {
            if(this.job?.bulkJob) {
                this.toastrService.showWarningToast("Tail Lift Pickup is not currently available for scheduled jobs.");
            } else {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.TailLiftPu, !job.tailLiftPu, job.preBook)
            }
        } catch (error) {
            this.handleError(error);
        }
    } 
    
    async onTailLiftDropOffClick(job: IJob): Promise<void> {
        if(this.job?.tailLiftPu == true && this.job.parcelDimensions.length === 0) {
            this.toastrService.showWarningToast("Please enter the parcels for this job before proceeding.");
            return;
        } 
        
        try {
            if(this.job?.bulkJob) {
                this.toastrService.showWarningToast("Tail Lift Drop-off is not currently available for scheduled jobs.");
            } else {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.TailLiftDo, !job.tailLiftDo, job.preBook)
            }
        } catch (error) {
            this.handleError(error);
        }
    }
    
    async onDeliverToPrivateResChanged(job: IJob): Promise<void> {
        try {
            job.deliverToPrivateRes = job.deliverToPrivateResString === "residential";
        
            if(this.job?.bulkJob) {
                this.toastrService.showWarningToast("Deliver to Private Residential is not currently available for scheduled jobs.");
            } else {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.DeliverToPrivateRes, job.deliverToPrivateRes, job.preBook)
            }
        } catch(error) {
            this.handleError(error);       
        }
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
        isEditMode: "<",
        onJobUpdate: "&"
    },
    controller: JobDetailController,
    controllerAs: "ctrl",
};
export default JobDetailComponent;
