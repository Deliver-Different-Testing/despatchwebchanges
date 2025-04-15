import ToastrService from "../../../services/toastr.service";
import {EditAddressDialogViewModel, IJob, InternalStatus, Suggestion} from "../../../interfaces/job.interface";
import {ContactID, FirstName} from "../../../contants";
import {JobNote, JobOptions, TabItem} from "./job-details.interfaces";
import {PodPhoto} from "../pod-photo-viewer/pod-photo-viewer.interfaces";
import DispatchCoreService from "../../../services/dispatch-core.service";
import "./job-details.styles.less";
import {SelectDialogService} from "../../dialogs/select-dialog/select-dialog.service";
import {EditDateTimeDialogService} from "../../dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {EditAddressDialogService} from "../../dialogs/edit-address-dialog/edit-address-dialog.service";
import PriceBreakdownDialogService from "../../dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import BaseController from "../../base-controller";
import moment from "moment";
import {AppPages} from "../../../enums/app-pages.enum";
import {AppConfig} from "../../../interfaces/app-config.interface";
import {JobStatus} from "../../../enums/job-status.enum";
import EditParcelDimensionsDialogService
    from "../../dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.service";
import {IJobReadChanged} from "../../../interfaces/event-interfaces";
import {JobProperty} from "../../../enums/job-property.enum";

class JobDetailController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "rateJobService",
        "$mdMenu",
        "selectDialogService",
        "editDateTimeDialogService",
        "editAddressDialogService",
        "priceBreakdownDialogService",
        "$document",
        "APP_CONFIG",
        "editParcelDimensionsDialogService",
        "$rootScope"
    ];

    readonly appPage: AppPages = AppPages.Dispatch;
    readonly isUsCustomer: boolean = false;
    jobId?: number;
    job?: IJob;
    notes: JobNote[];
    selectedTab: number;
    allTabs: TabItem[];
    options: JobOptions;
    isPodViewerOpen: boolean = false;
    formattedPodPhotos: PodPhoto[] = [];
    selectedPhotoIndex: number = 0;
    internalStatusList: InternalStatus[];
    onStatusChange?: (params: { $event: any }) => void;
    selectedStatusText?: string;
    isLoading: boolean = false;
    showStageDropdown: boolean = false;
    distance?: number;
    selectedTabIndex: number = 0;
    processingTabChange: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private rateJobService: any,
        private $mdMenu: angular.material.IMenuService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private priceBreakdownDialogService: PriceBreakdownDialogService,
        private $document: angular.IDocumentService,
        APP_CONFIG: AppConfig,
        private editParcelDimensionsDialogService: EditParcelDimensionsDialogService,
        private $rootScope: angular.IRootScopeService,
    ) {
        super();

        this.isUsCustomer = APP_CONFIG.US_Customer;

        this.notes = [];
        this.selectedTab = 0;
        this.allTabs = [];

        this.options = {
            detail: {
                size: [
                    {id: 1, label: "Bike"},
                    {id: 2, label: "Car"},
                    {id: 3, label: "Van"},
                    {id: 4, label: "Truck"},
                    {id: 5, label: "Scooter"}
                ],
                tracking: [
                    {id: 1, label: "Email"},
                    {id: 2, label: "Mobile"},
                    {id: 3, label: "Email & Mobile"}
                ],
                DGClass: Array.from({length: 10}, (_, i) => ({
                    id: i,
                    label: i.toString()
                }))
            }
        };

        this.internalStatusList = [];
    }

    $onInit() {
        console.log('$onInit called - jobId:', this.jobId);

        this.DispatchData.getInternalStatusList()
            .then((statusList: InternalStatus[]) => {
                this.internalStatusList = statusList;
            })
            .catch(error => {
                console.error("Error loading internal status list:", error);
            });

        if (this.jobId) {
            return this._loadJobData(this.jobId);
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log('$onChanges called with changes:', changes);

        if (changes['jobId']) {
            console.log('jobId changed:', changes['jobId'].currentValue);

            if (changes['jobId'].currentValue) {
                return this._loadJobData(changes['jobId'].currentValue);
            } else {
                this.job = undefined;
            }
        }

        if (changes['appPage']) {
            this.showStageDropdown = changes['appPage'].currentValue == AppPages.Domestic;
        }
    }

    $onDestroy() {
        console.log('$onDestroy called - cleaning up resources');

        const photoSection = angular.element('.pod-photo-section');
        if (photoSection) {
            photoSection.off('keydown', this._handleKeydown);
        }
    }

    async switchToRelatedJob(index: number) {
        if (this.processingTabChange) {
            return;
        }

        this.processingTabChange = true;
        console.log(`[JobDetailController] Switching to tab ${index}`);

        try {
            if (!this.job || !this.job.relatedJobs || this.job.relatedJobs.length <= index) {
                console.warn(`[JobDetailController] Invalid related job data for index ${index}`);
                return;
            }

            const targetJob = this.job.relatedJobs[index];

            if (targetJob && targetJob.id && targetJob.id !== this.jobId) {
                console.log(`[JobDetailController] Loading related job: ${targetJob.id} (${targetJob.text})`);

                this.selectedTabIndex = index;

                this.jobId = targetJob.id;
                await this._loadJobData(targetJob.id);
            } else {
                console.log(`[JobDetailController] Already on the selected job or invalid job data`);
            }
        } finally {
            this.processingTabChange = false;
            this.$rootScope.$broadcast('jobChanged', ` for Job ${this.job?.jobNo}`);
        }
    }

    private async _loadJobData(jobId: number) {
        if (!jobId) return;

        this.isLoading = true;

        try {
            const jobData = await this.DispatchData.getJobDetail(jobId);
            this.job = jobData;

            this._initializeJobData();

            if (this.job.relatedJobs && this.job.relatedJobs.length > 0) {
                const currentJobIndex = this.job.relatedJobs.findIndex(
                    relatedJob => relatedJob.id === jobId
                );

                if (currentJobIndex !== -1) {
                    console.log(`[JobDetailController] Setting selectedTabIndex to ${currentJobIndex}`);
                    this.selectedTabIndex = currentJobIndex;
                }
            }

            if (jobData.completedTime) {
                this._loadPodPhotos();
            }

            this.isLoading = false;
        } catch (error) {
            console.error("Error loading job data:", error);
            this.toastrService.showErrorToast("Failed to load job details");
            this.isLoading = false;
        }
    }

    private _loadPodPhotos() {
        if (!this.job?.completedTime) {
            console.log('No POD time available for job');
            return;
        }

        console.log(`Loading POD photos for job: ${this.job.id}`);

        try {
            const completedTime = moment(this.job?.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();

            console.log(`Getting POD photos for date: ${year}-${month}`);

            this.DispatchData.getJobDeliveryPhotosAndSignature(this.job.id, year, month)
                .then((photosData: any) => {
                    if (!photosData || photosData.length === 0) {
                        console.log('No POD photos returned from server');
                        this.formattedPodPhotos = [];
                    } else {
                        console.log('Raw photos data received, count:', photosData.length);

                        this.formattedPodPhotos = photosData
                            .map((photoData: string, index: number) => {
                                try {
                                    const podPhoto: PodPhoto = {
                                        url: photoData,
                                        timestamp: this.job?.completedTime ?
                                            new Date(this.job.completedTime).toLocaleString() : undefined,
                                        uploadedBy: this.job?.courierData.courierName ?? 'Unknown',
                                        coordinates: {
                                            lat: this.job?.deliveryAddress?.latitude ?? 0,
                                            lng: this.job?.deliveryAddress?.longitude ?? 0
                                        }
                                    };

                                    return podPhoto;
                                } catch (e) {
                                    console.error(`Error processing photo ${index}:`, e);
                                    return null;
                                }
                            });
                    }

                    console.log(`Successfully processed ${this.formattedPodPhotos.length} POD photos`);

                    this.selectedPhotoIndex = 0;
                    this._setupPhotoKeyboardNavigation();
                })
                .catch((error: Error) => {
                    this.toastrService.showErrorToast('Failed to load POD photos');
                    console.error('Error loading POD photos:', error);

                    this.formattedPodPhotos = [];
                });
        } catch (error) {
            this._handleError(error);
            this.formattedPodPhotos = [];
        }
    }

    private _initializeJobData() {
        if (!this.job) return;

        console.log('Initializing job data:', this.job.id);
        this._getSelectedStatusText();
    }

    getJobAddressIcon() {
        const icon = this.job?.assignedFlight ? 'flight_takeoff' : 'pin_drop';
        console.log(`[getJobAddressIcon] Icon selected: ${icon}`);
        return icon || 'pin_drop';
    }

    async showAutocompleteDialog($event: MouseEvent, job: IJob, url: string, placeholder: string,
                                 fieldName: string, title: string, existingItem: any, showRerateOption: boolean) {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        try {
            await this.$mdDialog.show({
                controller: "AutoCompleteDialogController",
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                targetEvent: $event,
                template: require("../../dialogs/auto-complete-dialog/auto-complete-dialog.html"),
                clickOutsideToClose: true,
                fullscreen: false,
                locals: {
                    id: 'editField', fieldName, title, job, options, existingItem, showRerateOption
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditTimeDialog($event: MouseEvent, job: IJob,
                             title: string, fieldName: string, dateTime?: Date) {
        try {
            const result = await this.editDateTimeDialogService.showEditTimeDialog($event, title, fieldName, dateTime);
            await this._processDateTimeUpdateResult(job, result)
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditDateDialog($event: MouseEvent, job: IJob,
                             title: string, field: JobProperty, dateTime?: Date) {
        try {
            const result = await this.editDateTimeDialogService.showEditDateDialog($event, title, field, dateTime);
            await this._processDateTimeUpdateResult(job, result)
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditDateAndTimeDialog($event: MouseEvent, job: IJob,
                                    title: string, fieldName: JobProperty, dateTime?: Date) {
        try {
            const result = await this.editDateTimeDialogService.showEditDateAndTimeDialog($event, title, fieldName, dateTime);
            await this._processDateTimeUpdateResult(job, result)
        } catch (error) {
            this._handleError(error);
        }
    }

    private async _processDateTimeUpdateResult(job: IJob, result: IDialogDateTimeResult) {
        if (result) {
            if (job.bulkJob) {
                await this.DispatchData.updateBulkJobDetail(
                    job.id,
                    result.fieldName,
                    result.formattedDateTime,
                    job.charge,
                    FirstName,
                    ContactID
                );
            } else {
                await this.DispatchData.updateJobDetail(
                    job.id,
                    result.fieldName,
                    result.formattedDateTime,
                    job.charge,
                    job.preBook
                );
            }

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this._refreshJobDetails(job.id);
        }
    }

    async showSelectDialog($event: MouseEvent, job: IJob, data: Array<any>,
                           fieldName: JobProperty, title: string, initialValue: string | null | number = null,
                           showCheckbox: boolean = false, checkboxLabel: string = "") {
        try {
            const result = await this.selectDialogService.showSelectDialog($event, data,
                fieldName, title, initialValue, showCheckbox, checkboxLabel);

            if (result) {
                if (fieldName === JobProperty.DGClass) {
                    await this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);

                    if (job.dgDocumentation !== result.checkboxValue) {
                        await this.DispatchData.updateJobDetail(job.id, JobProperty.DGDocumentation, result?.checkboxValue ?? false, job.charge, job.preBook);
                    }
                } else {
                    if (job.bulkJob) {
                        await this.DispatchData.updateBulkJobDetail(job.id, fieldName, result.value, job.charge, FirstName, ContactID);
                    } else {
                        await this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);
                    }
                }

                this.toastrService.showSuccessToast(`${job.jobNo} updated`);
                await this._refreshJobDetails(job.id);
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditDialog($event: MouseEvent, job: IJob, title: string,
                         placeholder: string, ariaLabel: string, initialValue: string | number | undefined, field: JobProperty) {
        const formatedValue = initialValue ? initialValue.toString() : "";

        const prompt = this.$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(formatedValue)
            .targetEvent($event)
            .required(true)
            .ok("Save")
            .cancel("Cancel");

        try {
            const result = await this.$mdDialog.show(prompt);

            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };
            await this.updateField(false, job, callData);

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    async showJobDimensionsDialog($event: MouseEvent, job: IJob) {
        await this.editParcelDimensionsDialogService.showJobDimensionsDialog($event, job);
        await this._refreshJobDetails(job.id);
    }

    async editStartTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog($event, job, "Start Time", "Time", job.time);
    }

    async editCompletedTime($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog($event, job, "POD Time", JobProperty.CompletedTime, job.completedTime);

        // Begin job done process
        const refreshedJob = this.job;
        if (!refreshedJob) return;
        await this.markJobAsDone($event, refreshedJob);
    }

    async editFollowUpTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog($event, job, "Follow Up Time", "FollowupTime", job.followupTime);
    }

    async editPuDate($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog($event, job, "Pick Up Time", JobProperty.PuTime, job.puTime);
    }

    async editDeliverBy($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog($event, job, "Deliver By", JobProperty.DeliverBy, job.deliverByTime);
    }

    async editBookedDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog($event, job, "Booked Date", JobProperty.BookedTime, job.createdDate);
    }

    async editFirstDueDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog($event, job, "First Due", JobProperty.FirstDue, job.firstDue);
    }

    async editStopDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog($event, job, "Stop Date", JobProperty.StopDate, job.stopDate);
    }

   async editRestartDate($event: MouseEvent, job: IJob) {
        await this.showEditDateDialog($event, job, "Restart Date", JobProperty.RestartDate, job.restartDate);
    }

    async updateAddress($event: MouseEvent, job: IJob, field: string) {
        const isDeliveryAddress = field === "toAddress";
        const existingAddress = isDeliveryAddress ? job.deliveryAddress : job.pickupAddress;

        try {
            const newAddress = await this.editAddressDialogService.openEditAddressDialog($event, existingAddress);
            if (!newAddress) {
                return; // User closed dialog
            }

            await this._processAddressUpdate(job, newAddress, isDeliveryAddress);
        } catch (error) {
            console.log("Error updating GPS:", error);
        }
    }

    private async _processAddressUpdate(job: IJob, newAddress: EditAddressDialogViewModel, isDeliveryAddress: boolean) {
        console.log(`isDeliveryAddress: ${isDeliveryAddress}`);

        // Update job by address format
        const updatedJob = this._updateJobAddressUs(job, newAddress, isDeliveryAddress);

        try {
            await this._updateJobRateAndAddress(updatedJob, newAddress, isDeliveryAddress);

            this.toastrService.showSuccessToast(`${job.jobNo} updated`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    private _updateJobAddressUs(job: IJob, newAddress: EditAddressDialogViewModel, isDeliveryAddress: boolean) {
        const addressField = isDeliveryAddress ? "deliveryAddress" : "pickupAddress";
        console.log(`Address Field: ${addressField}`);

        job[addressField] = newAddress;
        return job;
    }

    private async _updateJobRateAndAddress(job: IJob, addressResult: EditAddressDialogViewModel, isDeliveryAddress: boolean) {
        try {
            job.charge = await this.rateJobService.rateJob(job);

            let rate = 0;
            if (job.charge) {
                rate = Number(job.charge.replace(/[^0-9.-]+/g, ""));
                console.log(`Job Rate: ${rate}`);
            } else {
                console.warn("Job charge is undefined or not a string", job.charge);
            }

            if (isDeliveryAddress) {
                await this.DispatchData.updateDeliveryAddress(job.id, rate, FirstName, job.preBook, addressResult);
            } else {
                await this.DispatchData.updatePickupAddress(job.id, rate, FirstName, job.preBook, addressResult);
            }
        } catch (error) {
            console.error("Error updating job rate and address:", error);
            throw error;
        }
    }

    async editJobContact($event: MouseEvent, job: IJob, contactType: 'from' | 'to') {
        const contactMapping = {
            from: {
                title: "Edit From Contact Name",
                placeholder: "From Contact Name...",
                fieldLabel: "from contact name",
                contactValue: job.fromContactName,
                contactProperty: JobProperty.FromContactName
            }, to: {
                title: "Edit To Contact Name",
                placeholder: "To Contact Name...",
                fieldLabel: "to contact name",
                contactValue: job.deliverToContact,
                contactProperty: JobProperty.DeliverToContact
            }
        };

        const contactDetails = contactMapping[contactType];

        if (!contactDetails) {
            throw new Error(`[editJobContact] Invalid contact type: ${contactType}`);
        }

        await this.showEditDialog($event, job, contactDetails.title, contactDetails.placeholder, contactDetails.fieldLabel, contactDetails.contactValue, contactDetails.contactProperty);
    }

    async editJobContactPhone($event: MouseEvent, job: IJob, contactType: 'from' | 'to') {
        const phoneMapping = {
            from: {
                title: "Edit From Contact Phone",
                placeholder: "From Contact Phone...",
                fieldLabel: "from contact phone",
                phoneValue: job.fromContactNumber,
                phoneProperty: JobProperty.FromContactPhone
            }, to: {
                title: "Edit To Contact Phone",
                placeholder: "To Contact Phone...",
                fieldLabel: "to contact phone",
                phoneValue: job.toContactPhone,
                phoneProperty: JobProperty.ToContactPhone
            }
        };

        const phoneDetails = phoneMapping[contactType];

        if (!phoneDetails) {
            throw new Error(`[editJobContactPhone] Invalid contact type: ${contactType}`);
        }

        await this.showEditDialog($event, job, phoneDetails.title, phoneDetails.placeholder, phoneDetails.fieldLabel, phoneDetails.phoneValue, phoneDetails.phoneProperty);
    }

    async editPodName($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit POD Name", "POD Name...", "pod name", job.podName, JobProperty.PodName);

        // Begin job done process
        const refreshedJob = this.job;
        if (!refreshedJob) return;
        await this.markJobAsDone($event, refreshedJob);
    }

    async editRef($event: MouseEvent, job: IJob, isRefA: boolean) {
        if (isRefA) {
            await this.showEditDialog($event, job, "Edit RefA", "RefA...", "refa", job.refA, JobProperty.RefA);
        } else {
            await this.showEditDialog($event, job, "Edit RefA", "RefB...", "refb", job.refB, JobProperty.RefB);
        }
    }

    async editOurRef($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Our Reference", "Our Reference...", "our reference", job.ourRef, JobProperty.OurRef);
    }

    async editJobWeight($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Weight", "Job Weight...", "job weight", job.weight, JobProperty.Weight);
    }

    async editTrackingMobile($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Tracking Mobile", "Tracking Mobile...", "tracking mobile", job.trackingMobile, JobProperty.TrackingMobile);
    }

    async editTrackingEmail($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Tracking Email", "Tracking Email...", "tracking email", job.trackingEmail, JobProperty.TrackingEmail);
    }

    async clientClick($event: MouseEvent, job: IJob) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId, text: job.clientName
        }

        await this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", existingItem, true)
    }

    async courierClick($event: MouseEvent, job: IJob) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        await this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", null, false)
    }

    async contactClick($event: MouseEvent, job: IJob) {
        if (job.clientId === undefined) return;

        const pickContacts = await this.DispatchData.getContactList(job.clientId);
        await this.showSelectDialog($event, job, pickContacts, JobProperty.ContactID, "Contact", job.contactName);
    }

    async speedClick($event: MouseEvent, job: IJob) {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, JobProperty.SpeedID, "Speed", job.speedName);
    }

    async inActiveByClick($event: MouseEvent, job: IJob) {
        const activeStaff = await this.DispatchData.getActiveStaff();
        await this.showSelectDialog($event, job, activeStaff, JobProperty.InActiveDate, "InActive By", job.inActiveBy?.text ?? '');
    }

    async jobTypeClick($event: MouseEvent, job: IJob) {
        console.log('jobTypeClick initiated', {
            eventType: $event.type, jobId: job.id, currentJobType: job.jobType
        });

        const data = [{
            id: 1, text: "Pickup"
        }, {
            id: 2, text: "Delivery"
        }, {
            id: 3, text: "3rd-Party"
        }];

        const jobTypeDes = this.getJobTypeDescription(job.jobType);
        console.log('Showing select dialog', {
            jobId: job.id, jobTypeDes, availableOptions: data.length
        });

        try {
            await this.showSelectDialog($event, job, data, JobProperty.AcceptedJobTypeID, "Job Type", jobTypeDes);
            console.log('Select dialog completed}');
        } catch (error) {
            console.error('Error showing select dialog:', error);
            throw error;
        }
    }

    async sizeClick($event: MouseEvent, job: IJob) {
        const pickVehicleSizes = await this.DispatchData.getVehicleSizes();
        await this.showSelectDialog($event, job, pickVehicleSizes, JobProperty.Size, "Size", job.size.text);
    }


    async dgClassClick($event: MouseEvent, job: IJob) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        await this.showSelectDialog($event, job, dgClassOptions, JobProperty.DGClass, "DG Class", initialValue, true, "Has Documentation?");
    }


    async leaveClick($event: MouseEvent, job: IJob) {
        const pickLeaveList = await this.DispatchData.getLeaveList();
        await this.showSelectDialog($event, job, pickLeaveList, JobProperty.DeliverToLeaveID, "Leave Parcel", job.sigNotRequired || "Signature Required");
    }


    async trackingMethodClick($event: MouseEvent, job: IJob) {
        const trackingArray: Suggestion[] = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });
        const trackingMethod = this.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog($event, job, trackingArray, JobProperty.TrackingMethod, "Tracking Method", trackingMethod);
    }

    async statusClick($event: MouseEvent, job: IJob) {
        const statusList = await this.DispatchData.getStatusList();
        await this.showSelectDialog($event, job, statusList, JobProperty.Status, "Status", job.statusName);
    }

    private _showLoading() {
        this.isLoading = true;
    }

    private _hideLoading() {
        this.isLoading = false;
    }

    async updateField(reRate: boolean, job: IJob, callData: {
        call?: string;
        field: JobProperty;
        value: any;
        jobID: number;
    }) {
        this._showLoading();

        try {
            if (reRate && !job.bulkJob) {
                const rate = job.charge;

                // Ensure rate is decimal
                const numericRate = parseFloat(rate.replace(/[^\d.-]/g, ""));
                if (isNaN(numericRate)) {
                    console.error("Failed to convert rate to a number:", rate);
                }

                await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, job.preBook);
            } else {
                // Ensure rate is decimal
                const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
                if (isNaN(numericRate)) {
                    console.error("Failed to convert rate to a number");
                }

                if (job.bulkJob) {
                    await this.DispatchData.updateBulkJobDetail(job.id, callData.field, callData.value, numericRate, FirstName, ContactID);
                } else {
                    await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, job.preBook);
                }
            }
        } catch (error) {
            console.error("Error updating job:", error);
            this.toastrService.showErrorToast("Failed to update job. Please try again.");
            throw error;
        } finally {
            this._hideLoading();
        }
    }

    getJobTypeDescription(jobTypeId?: number) {
        console.log(`Getting job type description for jobTypeId: ${jobTypeId}`);
        const description = (() => {
            switch (jobTypeId || 1) {
                case 1:
                    return "Pickup";
                case 2:
                    return "Delivery";
                case 3:
                    return "3rd-Party";
                default:
                    console.warn(`Unknown jobTypeId: ${jobTypeId}, defaulting to "Pickup"`);
                    return "Pickup";
            }
        })();

        console.log(`Resolved job type description: ${description}`);
        return description;
    }

    hasDGDocs(job: IJob) {
        if (job.dgClass) {
            return ((job.dgClass || 0) === 1) || ((job.dgDocumentation || false)) ? "Yes" : "No";
        } else {
            return "";
        }
    }

    async toggleJobProperty(job: IJob, property: JobProperty, value: boolean, useCharge: boolean = true) {
        console.log(`[JobDetailsComponentController] Start toggleJobProperty - property: ${property}, useCharge: ${useCharge}`);

        if (!job || !job.id) {
            console.log(`[JobDetailsComponentController] Error: Invalid job data`);
            this.toastrService.showErrorToast(`Cannot update: Invalid job data`);
            return;
        }

        try {
            const newValue = !value;
            console.log(`[JobDetailsComponentController] Toggling ${property} for job ${job.jobNo || job.id} from ${!newValue} to ${newValue}`);

            const callData = {
                call: "updateDetailField",
                field: property,
                value: newValue,
                jobID: job.id
            };

            console.log(`[JobDetailsComponentController] Calling updateField with data:`, callData);

            await this.updateField(useCharge, job, callData);

            if (property === JobProperty.Reprice && newValue) {
                console.log(`[JobDetailsComponentController] Special handling for reprice - updating internal status`);
                const repriceStatusId = 4;
                await this.DispatchData.updateJobDetail(job.id, JobProperty.InternalStatusID, repriceStatusId,
                    this._extractNumericRate(job.charge), job.preBook);
            }

            console.log(`[JobDetailsComponentController] Update successful for ${property}`);
            this.toastrService.showSuccessToast(`${job.jobNo} updated`);

            console.log(`[JobDetailsComponentController] Refreshing job details for ID: ${job.id}`);
            await this._refreshJobDetails(job.id);

            console.log(`[JobDetailsComponentController] Toggle operation completed for ${property}`);
        } catch (error) {
            console.error(`[JobDetailsComponentController] Error toggling ${property}:`, error);
            this.toastrService.showErrorToast(`Failed to update ${property}. Please try again.`);
        }
    }

    async toggleProperty(job: IJob, property: JobProperty, value: boolean) {
        console.log(`[JobDetailsComponentController] Toggling property '${property}' for job ${job?.jobNo || job?.id || 'unknown'}`);

        const propertiesUsingDefaultCharge = [
            "pedal", "truck", "direct",
            "return", "oneOff", "active", "void",
            "van", "vanOK", "reprice"
        ];

        const useCharge = propertiesUsingDefaultCharge.includes(property);
        console.log(`[JobDetailsComponentController] Using default charge: ${useCharge}`);

        await this.toggleJobProperty(job, property, value, useCharge);

        console.log(`[JobDetailsComponentController] Property '${property}' toggle completed`);
    }

    async markJobAsDone($event: MouseEvent, job: IJob) {
        try {
            if (!job.completedTime) {
                const result = await this.editDateTimeDialogService.showEditDateAndTimeDialog(
                    $event,
                    "Completed Time",
                    "CompletedTime",
                    job.completedTime);

                job.completedTime = result.value;
            }

            if (!job.podName) {
                const prompt = this.$mdDialog.prompt()
                    .title("POD Name")
                    .placeholder("POD Name..")
                    .ariaLabel("pod name")
                    .initialValue(job.podName ?? '')
                    .targetEvent($event)
                    .required(true)
                    .ok("Complete Job")
                    .cancel("Cancel");

                job.podName = await this.$mdDialog.show(prompt);
            }

            console.log("[JobDetailsComponentController] Marking job as done]")
            await this.DispatchData.updatePODDetail(job.id, JobStatus.Completed, job.podName, job.completedTime);

            this.toastrService.showSuccessToast(`${job.jobNo} Completed`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error("Error marking job as done:", error);
            this.toastrService.showErrorToast("Failed to mark job as done. Please try again.");
        }
    }

    private async _refreshJobDetails(jobId: number) {
        try {
            console.log(`Refreshing job details for jobId: ${jobId}`);
            this.isLoading = true;

            await this._loadJobData(jobId);

            console.log('Job data refreshed');
        } catch (error) {
            this.isLoading = false;
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }

    private _handleError(error: any) {
        if (error === undefined) {
            console.log("User closed dialog");
        } else {
            this.toastrService.showErrorToast();
        }
    }

    private _extractNumericRate(rate: string | number | undefined | null): number {
        if (!rate) {
            console.log(`[JobDetailsComponentController] Warning: Rate is ${rate}, returning default 0`);
            return 0;
        }

        if (typeof rate === 'number') return rate;

        const numericString = rate.replace(/[^0-9.]/g, '');
        return numericString ? parseFloat(numericString) : 0;
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
        this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % this.formattedPodPhotos.length;
    }

    prevPhoto() {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + this.formattedPodPhotos.length) % this.formattedPodPhotos.length;
    }

    private _handleKeydown = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'ArrowLeft') {
            this.prevPhoto();
        } else if (keyboardEvent.key === 'ArrowRight') {
            this.nextPhoto();
        }
    };

    private _setupPhotoKeyboardNavigation() {
        const photoSection = angular.element('.pod-photo-section');

        if (photoSection.length) {
            photoSection.off('keydown', this._handleKeydown);

            photoSection.on('keydown', this._handleKeydown);
            photoSection.attr('tabindex', '0');
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
                await this.$mdDialog.show(this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Photo')
                    .textContent('Sorry no photo for this job.')
                    .ok('OK'));
                console.log("Alert closed.");
                return;
            }

            const confirm = this.$mdDialog.prompt()
                .title('Email the photo POD')
                .textContent('Please enter an email address to send the POD.')
                .placeholder('Email Address')
                .ariaLabel('Email Address')
                .targetEvent($event)
                .required(true)
                .ok('Send')
                .cancel('Cancel');

            const email = await this.$mdDialog.show(confirm);

            await this.DispatchData.sendPOD(this.job.id, email);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Email Sent')
                .textContent('POD email has been sent')
                .ok('OK'));

        } catch (error: any) {
            this._handleError(error);
        }
    }

    private _getSelectedStatusText() {
        console.log('getSelectedStatusText() called');
        const defaultText = 'Stage';
        console.log('Current job:', this.job);

        console.log('Current internalStatusList:', this.internalStatusList);

        const selectedStatus = this.internalStatusList?.find(status =>
            status.id === this.job?.internalStatusId
        );
        console.log('Found selectedStatus:', selectedStatus);

        this.selectedStatusText = selectedStatus ? selectedStatus.text : defaultText;
        console.log('Set selectedStatusText to:', this.selectedStatusText);
    }

    async setInternalStatus(internalStatusId: number, job: IJob) {
        this.$mdMenu.hide();
        const previousStatusId = job.internalStatusId;

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.InternalStatusID,
                internalStatusId,
                job.charge,
                false
            );

            if (this.onStatusChange) {
                this.onStatusChange({
                    $event: {
                        previousStatusId,
                        newStatusId: internalStatusId,
                        jobId: job.id
                    }
                });
            }

            this._getSelectedStatusText();
        } catch (error) {
            console.error("Error updating internal status:", error);
        }
    }

    async showPricingBreakdown($event: MouseEvent, job: IJob) {
        try {
            await this.priceBreakdownDialogService.openPriceBreakdownDialog($event, job.id, job.preBook);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error("Error in displayPriceBreakdown:", error);
            this.toastrService.showErrorToast("An error occurred while fetching the price breakdown. Please try again.");
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

        console.log(`[JobDetailController] Marking job ${job.jobNo} as ${actionText}`);

        try {
            this._showLoading();

            // Update the job's read status in the database
            await this.DispatchData.updateJobReadStatus(job.id, newReadStatus);

            // Update the local job object
            if (!job.readTrackerInfo) {
                job.readTrackerInfo = {
                    hasBeenRead: newReadStatus,
                    readBy: newReadStatus ? FirstName : "",
                    readDate: newReadStatus ? new Date() : null
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

            this.toastrService.showSuccessToast(`Job ${job.jobNo} marked as ${actionText}`);
        } catch (error) {
            console.error(`Error marking job as ${actionText}:`, error);
            this.toastrService.showErrorToast(`Failed to mark job as ${actionText}. Please try again.`);
        } finally {
            const data: IJobReadChanged = {
                jobId: job?.id ?? 0,
                isRead: job.readTrackerInfo.hasBeenRead
            };

            this.$rootScope.$broadcast('jobReadChanged', data);
            this._hideLoading();
        }
    }

    isJobRead(job: IJob): boolean {
        return job?.readTrackerInfo?.hasBeenRead || false;
    }

    async updateDaysOfWeek(job: IJob) {
        console.log('Updating days of week:', job.daysOfWeek);

        // Calculate bitmask value from the array of selected days
        let daysValue = 0;
        if (Array.isArray(job.daysOfWeek)) {
            job.daysOfWeek.forEach(day => {
                daysValue |= day;
            });
        } else if (typeof job.daysOfWeek === 'number') {
            daysValue = job.daysOfWeek;
        }

        console.log('Days bitmask value:', daysValue);

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.DaysOfWeek,
                daysValue.toString(),
                job.charge,
                job.preBook
            );

            this.toastrService.showSuccessToast(`${job.jobNo} days updated`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error('Error updating days of week:', error);
            this._handleError(error);
        }
    }

    async updateFrequency(job: IJob) {
        if(!job.frequency) return;
        console.log('Updating frequency:', job.frequency);

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.Frequency,
                job.frequency?.toString(),
                job.charge,
                job.preBook
            );

            this.toastrService.showSuccessToast(`${job.jobNo} frequency updated`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error('Error updating frequency:', error);
            this._handleError(error);
        }
    }
}

const JobDetailComponent: angular.IComponentOptions = {
    template: require("./job-details.template.html"),
    bindings: {
        jobId: "<",
        appPage: "<",
        onStatusChange: "&"
    },
    controller: JobDetailController,
    controllerAs: "ctrl"
}
export default JobDetailComponent;
