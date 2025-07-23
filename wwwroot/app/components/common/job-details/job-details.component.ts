import ToastrService from "../../../services/toastr.service";
import {
    EditAddressDialogViewModel,
    IDispatchJob,
    IJob,
    InternalStatus,
    JobGroup,
    Suggestion,
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
import {AppConfig} from "../../../interfaces/app-config.interface";
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

class JobDetailController extends BaseController {
    static $inject = [
        "$scope",
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
        "$filter",
        "autoCompleteDialogService",
        "jobFileUploadDialogService",
    ];

    readonly isRecurringJob: boolean = false;
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

    constructor(
        $scope: angular.IScope,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private priceBreakdownDialogService: PriceBreakdownDialogService,
        appConfig: AppConfig,
        private editParcelDimensionsDialogService: EditParcelDimensionsDialogService,
        private $rootScope: angular.IRootScopeService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $filter: angular.IFilterService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private jobFileUploadDialogService: JobFileUploadDialogService
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

    $onInit() {
        console.log("$onInit called - jobId:", this.jobId);

        this.DispatchData.getInternalStatusList()
            .then((statusList: InternalStatus[]) => {
                this.internalStatusList = statusList;
            })
            .catch((error) => {
                console.error("Error loading internal status list:", error);
            });

        if (this.jobId) {
            return this.loadJobData(this.jobId);
        }

        this.applyScope();
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

    $onDestroy() {
        super.$onDestroy();
        console.log("$onDestroy called - cleaning up resources");

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

    async switchToRelatedJob(index: number) {
        if (this.processingTabChange) {
            return;
        }

        this.processingTabChange = true;
        console.log(`Switching to tab ${index}`);

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
                console.log(
                    `Loading related job: ${targetJob.id} (${targetJob.text})`
                );

                this.selectedTabIndex = index;
                this.jobId = targetJob.id;

                // Load the main job data from the selected job group
                await this.loadJobData(targetJob.id);

                // Set the selected related job to the current job group
                this.selectedRelatedJob = targetJobGroup;

                // Important: Reset subjob index but don't autoload a subjob
                this.selectedSubJobIndex = -1;
            } else {
                console.log(
                    `Already on the selected job or invalid job data`
                );
            }
        } finally {
            this.processingTabChange = false;
            this.$rootScope.$broadcast("jobChanged", this.job);
        }
    }

    private async loadJobData(jobId: number) {
        if (!jobId) return;

        this.isLoading = true;

        try {
            this.job = this.isRecurringJob
                ? await this.DispatchData.getRecurringJobDetail(jobId)
                : await this.DispatchData.getJobDetail(jobId);

            this.initializeJobData();

            if (this.job?.relatedJobs?.length > 0) {
                this.setupRelatedJobs(jobId);
            } else {
                this.selectedRelatedJob = undefined;
                this.selectedSubJobIndex = -1;
                this.selectedTabIndex = 0;
                this.jobGroups = [];
            }

            this.triggerDigestCycle();

            if (this.job.completedTime && !this.isRecurringJob) {
                this.loadPodPhotos();
            }
        } catch (error) {
            console.error("Error loading job data:", error);
            this.toastrService.showErrorToast("Failed to load job details");
        } finally {
            this.isLoading = false;
        }
    }

    private setupRelatedJobs(jobId: number) {
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

    private loadPodPhotos() {
        if (!this.job?.completedTime) {
            console.log("No POD time available for job");
            return;
        }

        console.log(`Loading POD photos for job: ${this.job.id}`);

        try {
            const completedTime = dayjs(this.job?.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();

            console.log(`Getting POD photos for date: ${year}-${month}`);

            this.DispatchData.getJobDeliveryPhotosAndSignature(
                this.job.id,
                year,
                month
            )
                .then((photosData: any) => {
                    if (!photosData || photosData.length === 0) {
                        console.log("No POD photos returned from server");
                        this.formattedPodPhotos = [];
                    } else {
                        console.log("Raw photos data received, count:", photosData.length);

                        this.formattedPodPhotos = photosData.map(
                            (photoData: string, index: number) => {
                                try {
                                    const podPhoto: PodPhoto = {
                                        url: photoData,
                                        timestamp: this.job?.completedTime
                                            ? dayjs(this.job.completedTime).format(
                                                "MM/DD/YYYY HH:mm"
                                            )
                                            : undefined,
                                        uploadedBy: this.job?.courierData?.courierName ?? "Unknown",
                                        coordinates: {
                                            lat: this.job?.deliveryAddress?.latitude ?? 0,
                                            lng: this.job?.deliveryAddress?.longitude ?? 0,
                                        },
                                    };

                                    return podPhoto;
                                } catch (e) {
                                    console.error(`Error processing photo ${index}:`, e);
                                    return null;
                                }
                            }
                        );
                    }

                    console.log(
                        `Successfully processed ${this.formattedPodPhotos.length} POD photos`
                    );

                    this.selectedPhotoIndex = 0;
                    this.setupPhotoKeyboardNavigation();
                })
                .catch((error: Error) => {
                    this.toastrService.showErrorToast("Failed to load POD photos");
                    console.error("Error loading POD photos:", error);

                    this.formattedPodPhotos = [];
                });
        } catch (error) {
            this.handleError(error);
            this.formattedPodPhotos = [];
        }
    }

    private initializeJobData() {
        if (!this.job) return;

        console.log("Initializing job data:", this.job.id);

        this.jobAddressIcon = this.job?.assignedFlight ? "flight_takeoff" : "pin_drop";

        if (typeof this.job.daysOfWeek === "number" && this.job.daysOfWeek > 0) {
            console.log("Original daysOfWeek bitmap value:", this.job.daysOfWeek);

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
                if (this.job.daysOfWeek & dayValue) {
                    daysArray.push(dayValue);
                }
            }

            console.log("Converted daysOfWeek to array:", daysArray);

            this.job.daysOfWeek = daysArray as any;
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
    ) {
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
        timezone?: Suggestion
    ) {
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
        timezone?: Suggestion
    ) {
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
        timezone?: Suggestion
    ) {
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
    ) {
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
                    job.preBook,
                    result.selectedTimeZoneId
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
    ) {
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
    ) {
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

    async showJobDimensionsDialog($event: MouseEvent, job: IJob) {
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

    async editCompletedTime($event: MouseEvent, job: IJob) {
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

    async editFollowUpTime($event: MouseEvent, job: IJob) {
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

    async editPuDate($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "Pick Up Time",
            JobProperty.PuTime,
            job.puTime,
            job.pickUpTimeZone
        );
    }

    async editDeliverBy($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog(
            $event,
            job,
            "Deliver By",
            JobProperty.DeliverBy,
            job.deliverByTime,
            job.deliveryTimeZone
        );
    }

    async editBookedDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog(
            $event,
            job,
            "Booked Date",
            JobProperty.BookedTime,
            job.createdDate
        );
    }

    async editFirstDueDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog(
            $event,
            job,
            "First Due",
            JobProperty.FirstDue,
            job.firstDue
        );
    }

    async editStopDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog(
            $event,
            job,
            "Stop Date",
            JobProperty.StopDate,
            job.stopDate
        );
    }

    async editRestartDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog(
            $event,
            job,
            "Restart Date",
            JobProperty.RestartDate,
            job.restartDate
        );
    }

    async updateAddress($event: MouseEvent, job: IJob, field: string) {
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
                return; // User closed dialog
            }

            await this.processAddressUpdate(job, newAddress, isDeliveryAddress);
        } catch (error) {
            console.log("Error updating GPS:", error);
        }
    }

    private async processAddressUpdate(
        job: IJob,
        newAddress: EditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ) {
        console.log(`isDeliveryAddress: ${isDeliveryAddress}`);

        // Update job by address format
        const updatedJob = this.updateJobAddressUs(
            job,
            newAddress,
            isDeliveryAddress
        );

        try {
            await this.updateJobRateAndAddress(
                updatedJob,
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
        newAddress: EditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ) {
        const addressField = isDeliveryAddress
            ? "deliveryAddress"
            : "pickupAddress";
        console.log(`Address Field: ${addressField}`);

        job[addressField] = newAddress;
        return job;
    }

    private async updateJobRateAndAddress(
        job: IJob,
        addressResult: EditAddressDialogViewModel,
        isDeliveryAddress: boolean
    ) {
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
            console.error("Error updating job rate and address:", error);
            throw error;
        }
    }

    async editJobContact(
        $event: MouseEvent,
        job: IJob,
        contactType: "from" | "to"
    ) {
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
    ) {
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

    async editPodName($event: MouseEvent, job: IJob) {
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

    async editRef($event: MouseEvent, job: IJob, isRefA: boolean) {
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

    async editOurRef($event: MouseEvent, job: IJob) {
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

    async editConNote($event: MouseEvent, job: IJob) {
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

    async editJobWeight($event: MouseEvent, job: IJob) {
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

    async editTrackingMobile($event: MouseEvent, job: IJob) {
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

    async editTrackingEmail($event: MouseEvent, job: IJob) {
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

    async clientClick($event: MouseEvent, job: IJob) {
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

    async courierClick($event: MouseEvent, job: IJob) {
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

    async contactClick($event: MouseEvent, job: IJob) {
        if (job.clientId === undefined) return;

        const pickContacts = await this.DispatchData.getContactList(job.clientId);
        await this.showSelectDialog(
            $event,
            job,
            pickContacts,
            JobProperty.ContactID,
            "Contact",
            job.contactName
        );
    }

    async speedClick($event: MouseEvent, job: IJob) {
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

    async inActiveByClick($event: MouseEvent, job: IJob) {
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

    async jobTypeClick($event: MouseEvent, job: IJob) {
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

    async sizeClick($event: MouseEvent, job: IJob) {
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

    async dgClassClick($event: MouseEvent, job: IJob) {
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

    async leaveClick($event: MouseEvent, job: IJob) {
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

    async trackingMethodClick($event: MouseEvent, job: IJob) {
        const trackingArray: Suggestion[] = this.options.detail.tracking.map(
            (item) => {
                return {
                    id: item.id,
                    text: item.label,
                };
            }
        );
        const trackingMethod = this.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog(
            $event,
            job,
            trackingArray,
            JobProperty.TrackingMethod,
            "Tracking Method",
            trackingMethod
        );
    }

    async statusClick($event: MouseEvent, job: IJob) {
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

    private showLoading() {
        this.isLoading = true;
    }

    private hideLoading() {
        this.isLoading = false;
    }

    async updateField(job: IJob, callData: CallData) {
        this.showLoading();

        try {
            // Ensure rate is decimal
            const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
            if (isNaN(numericRate)) {
                console.error("Failed to convert rate to a number");
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
            console.error("Error updating job:", error);
            this.toastrService.showErrorToast(
                "Failed to update job. Please try again."
            );
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    hasDGDocs(job: IJob) {
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
    ) {
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

    async toggleProperty(job: IJob, property: JobProperty, value: boolean) {
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

    async markJobAsDone($event: MouseEvent, job: IJob) {
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

    private async refreshJobDetails(jobId: number) {
        try {
            console.log(`Refreshing job details for jobId: ${jobId}`);
            this.isLoading = true;

            await this.loadJobData(jobId);

            console.log("Job data refreshed");
        } catch (error) {
            this.isLoading = false;
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }

    private handleError(error: any) {
        if (!error) {
            console.log("User closed dialog");
        } else {
            this.toastrService.showErrorToast();
        }
    }

    getTrackingMethod(trackingMethod?: number) {
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

    setSelectedPhoto(index: number) {
        this.selectedPhotoIndex = index;
    }

    nextPhoto() {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex =
            (this.selectedPhotoIndex + 1) % this.formattedPodPhotos.length;
    }

    prevPhoto() {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex =
            (this.selectedPhotoIndex - 1 + this.formattedPodPhotos.length) %
            this.formattedPodPhotos.length;
    }

    private handleKeydown = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === "ArrowLeft") {
            this.prevPhoto();
        } else if (keyboardEvent.key === "ArrowRight") {
            this.nextPhoto();
        }
    };

    private setupPhotoKeyboardNavigation() {
        const photoSection = angular.element(".pod-photo-section");

        if (photoSection.length) {
            photoSection.off("keydown", this.handleKeydown);

            photoSection.on("keydown", this.handleKeydown);
            photoSection.attr("tabindex", "0");
        }
    }

    openPodViewer(index: number) {
        this.selectedPhotoIndex = index;
        this.isPodViewerOpen = true;
    }

    closePodViewer() {
        this.isPodViewerOpen = false;
    }

    async sendPOD($event: MouseEvent) {
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

    async showPricingBreakdown($event: MouseEvent, job: IJob) {
        try {
            await this.priceBreakdownDialogService.openPriceBreakdownDialog(
                $event,
                job.id,
                job.preBook
            );
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

    async updateDaysOfWeek(job: IJob) {
        console.log("Updating days of week from array:", job.daysOfWeek);

        let daysValue = 0;
        if (Array.isArray(job.daysOfWeek)) {
            job.daysOfWeek.forEach((day: number) => {
                daysValue |= day;
            });
        } else if (typeof job.daysOfWeek === "number") {
            daysValue = job.daysOfWeek;
        }

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

    async updateFrequency(job: IJob) {
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

    private triggerDigestCycle() {
        console.log("[_triggerDigestCycle] Forcing UI update");
        try {
            if (!this.$rootScope.$$phase) {
                this.$rootScope.$applyAsync();
            } else {
                this.registerTimeout(() => {
                    if (!this.$rootScope.$$phase) {
                        this.$rootScope.$applyAsync();
                    }
                }, 0);
            }
        } catch (e) {
            console.error("[_triggerDigestCycle] Error triggering digest cycle:", e);
        }
    }

    async updateHolidayDeliveryOption(job: IJob) {
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

    formatTimeWindow(
        isPickup: boolean,
        baseTime?: Date,
        windowMins?: number
    ): string {
        if (!baseTime) {
            return "N/A";
        }

        // Get the formatted timezone using the filter
        let timezone: string;
        if (isPickup) {
            timezone = this.job?.pickUpTimeZone?.text ?? TimeZone;
        } else {
            timezone = this.job?.deliveryTimeZone?.text ?? TimeZone;
        }

        const timezoneShort =
            this.$filter<(timezone: string) => string>("timezoneShort")(timezone);
        const timezoneDisplay = timezoneShort ? ` (${timezoneShort})` : "";

        const baseTimeFormatted = dayjs(baseTime).format("MM/DD HH:mm");

        if (!windowMins || windowMins <= 0) {
            return baseTimeFormatted + timezoneDisplay;
        }

        const endTime = dayjs(baseTime).add(windowMins, "minutes");

        if (dayjs(baseTime).format("MM/DD") === endTime.format("MM/DD")) {
            return `${baseTimeFormatted} - ${endTime.format(
                "HH:mm"
            )}${timezoneDisplay}`;
        } else {
            return `${baseTimeFormatted} - ${endTime.format(
                "MM/DD HH:mm"
            )}${timezoneDisplay}`;
        }
    }

    getPickupTimeWindow(): string {
        return this.formatTimeWindow(
            true,
            this.job?.puTime,
            this.job?.pickUpWindowMins
        );
    }

    getDeliveryTimeWindow(): string {
        return this.formatTimeWindow(
            false,
            this.job?.deliverByTime,
            this.job?.deliverByWindowMins
        );
    }

    async openPodUploadDialog($event: MouseEvent, job: IDispatchJob) {
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

    async switchToSubJob(subJobIndex: number) {
        if (subJobIndex === this.selectedSubJobIndex) return;

        this.selectedSubJobIndex = subJobIndex;

        await this.loadSubJobDetails(subJobIndex);
        this.triggerDigestCycle();
    }

    private async loadSubJobDetails(subJobIndex: number) {
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

            // Load the subjob details from the server
            const jobDetails = await this.DispatchData.getJobDetail(subJob.id);

            // Preserve the original related jobs data
            const originalRelatedJobs = this.job?.relatedJobs;
            const originalJobGroups = this.jobGroups;
            const originalSelectedRelatedJob = this.selectedRelatedJob;
            const originalSelectedTabIndex = this.selectedTabIndex;

            // Update the job with the subjob details
            this.job = jobDetails;

            // Restore the preserved data
            if (originalRelatedJobs) {
                this.job.relatedJobs = originalRelatedJobs;
                this.jobGroups = originalJobGroups;
                this.selectedRelatedJob = originalSelectedRelatedJob;
                this.selectedTabIndex = originalSelectedTabIndex;
            }

            this.initializeJobData();

            // Broadcast the subjob change
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
            this.triggerDigestCycle();
        }
    }
    
    async updateActive(job: IJob) {
        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.Active,
                job.active ?? false,
                true,
            );
        } catch (error) {
            console.error("Error updating active:", error);
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
    },
    controller: JobDetailController,
    controllerAs: "ctrl",
};
export default JobDetailComponent;
