import ToastrService from "../../../services/toastr.service";
import {InternalStatus, IJob, EditAddressDialogViewModel} from "../../../interfaces/job.interface";
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

class JobDetailController extends BaseController {
    static $inject = [
        "$scope",
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "rateJobService",
        "moment",
        "$mdMenu",
        "selectDialogService",
        "editDateTimeDialogService",
        "editAddressDialogService",
        "priceBreakdownDialogService"
    ];

    job?: IJob;
    internalJob?: IJob;
    notes: JobNote[];
    selectedTab: number;
    allTabs: TabItem[];
    options: JobOptions;
    isPodViewerOpen: boolean = false;
    formattedPodPhotos: PodPhoto[] = [];
    selectedPhotoIndex: number = 0;
    showLeftScroll: boolean = false;
    showRightScroll: boolean = false;
    internalStatusList: InternalStatus[];
    onStatusChange?: (params: { $event: any }) => void;
    selectedStatusText?: string;
    private photosLoaded: boolean = false;
    private previousJobId?: number;

    constructor(
        private $scope: angular.IScope,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private rateJobService: any,
        private moment: any,
        private $mdMenu: angular.material.IMenuService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private priceBreakdownDialogService: PriceBreakdownDialogService
    ) {
        super();

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
        this.$scope.$watch(() => this.job, (newValue, oldValue) => {
            if (newValue && newValue !== oldValue) {
                this.internalJob = newValue;
                this.previousJobId = newValue.id;
                this._initializeJobData();

                if (newValue.completedTime) {
                    this._loadPodPhotos();
                }
            }
        });

        this.$scope.$watch(() => this.job, (newValue, oldValue) => {
            if (newValue && !angular.equals(newValue, oldValue)) {
                this.internalJob = angular.copy(newValue);
                this.previousJobId = newValue.id;
                this._initializeJobData();

                if (newValue.completedTime && !this.photosLoaded) {
                    this._loadPodPhotos();
                    this.photosLoaded = true;
                }
            }
        }, true);
    }

    $onInit() {
        console.log('$onInit called - job exists:', !!this.job);

        this.DispatchData.getInternalStatusList()
            .then((statusList: InternalStatus[]) => {
                this.internalStatusList = statusList;
                this._getSelectedStatusText();
            })
            .catch(error => {
                console.error("Error loading internal status list:", error);
            });

        // Initial job data setup if job is already available
        if (this.job) {
            this.internalJob = this.job;
            this.previousJobId = this.job.id;
            this._initializeJobData();

            if (this.job.completedTime) {
                this._loadPodPhotos();
            }
        }
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log('$onChanges called with changes:', changes);

        if (changes['job']) {
            console.log('Job changed:', changes['job'].currentValue);
            this.internalJob = changes['job'].currentValue;

            if (this.internalJob) {
                const jobIdChanged = !this.previousJobId || this.previousJobId !== this.internalJob.id;
                this.previousJobId = this.internalJob.id;

                this._initializeJobData();

                if (jobIdChanged) {
                    this.photosLoaded = false;
                }
            }
        }
    }

    $onDestroy() {
        console.log('$onDestroy called - cleaning up resources');

        const photoSection = angular.element('.pod-photo-section');
        if (photoSection) {
            photoSection.off('keydown', this._handleKeydown);
        }

        if (this.$scope) {
            this.$scope.$emit('cleanupRequested');
        }
    }

    private _loadPodPhotos() {
        if (!this.internalJob?.completedTime) {
            console.log('No POD time available for job');
            this.photosLoaded = true;
            return;
        }

        console.log(`Loading POD photos for job: ${this.internalJob.id}`);

        try {
            const completedTime = this.moment(this.internalJob?.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();

            console.log(`Getting POD photos for date: ${year}-${month}`);

            this.DispatchData.getJobDeliveryPhotosAndSignature(this.internalJob.id, year, month)
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
                                        timestamp: this.internalJob?.completedTime ?
                                            new Date(this.internalJob.completedTime).toLocaleString() : undefined,
                                        uploadedBy: this.internalJob?.courierData.courierName ?? 'Unknown',
                                        coordinates: {
                                            lat: this.internalJob?.deliveryAddress?.latitude ?? 0,
                                            lng: this.internalJob?.deliveryAddress?.longitude ?? 0
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
                    this.photosLoaded = true;

                    this._setupPhotoKeyboardNavigation();

                    if (this.$scope && this.$scope.$applyAsync) {
                        this.$scope.$applyAsync();
                    }
                })
                .catch((error: Error) => {
                    this.toastrService.showErrorToast('Failed to load POD photos');
                    console.error('Error loading POD photos:', error);

                    this.formattedPodPhotos = [];
                    this.photosLoaded = true;

                    if (this.$scope && this.$scope.$applyAsync) {
                        this.$scope.$applyAsync();
                    }
                });
        } catch (error) {
            this._handleError(error);
            this.formattedPodPhotos = [];
            this.photosLoaded = true;

            if (this.$scope && this.$scope.$applyAsync) {
                this.$scope.$applyAsync();
            }
        }
    }

    private _initializeJobData() {
        if (!this.internalJob) return;

        console.log('Initializing job data:', this.internalJob.id);

        this.notes = [];

        if (this.internalJob.internalNotes) {
            console.log('Processing internal notes:', this.internalJob.internalNotes);

            let internalNoteLines;
            if (this.internalJob.internalNotes.includes('\n')) {
                internalNoteLines = this.internalJob.internalNotes.split('\n');
            } else if (this.internalJob.internalNotes.includes('\r\n')) {
                internalNoteLines = this.internalJob.internalNotes.split('\r\n');
            } else {
                internalNoteLines = [this.internalJob.internalNotes];
            }

            internalNoteLines = internalNoteLines.filter(note => note.trim());

            console.log('Split internal notes into', internalNoteLines.length, 'lines:', internalNoteLines);

            internalNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding internal note ${index + 1}:`, trimmedNote);
                this.notes.push({
                    icon: 'note_stack', text: trimmedNote, type: 'internal'
                });
            });

            if (this.notes.length === 0 && this.internalJob.internalNotes.trim()) {
                console.log('Adding entire internal notes text as one note');
                this.notes.push({
                    icon: 'note_stack', text: this.internalJob.internalNotes.trim(), type: 'internal'
                });
            }
        } else {
            console.log('No internal notes found');
        }

        if (this.internalJob.conNote) {
            console.log('Processing consignment notes:', this.internalJob.conNote);

            let consignmentNoteLines;
            if (this.internalJob.conNote.includes('\n')) {
                consignmentNoteLines = this.internalJob.conNote.split('\n');
            } else if (this.internalJob.conNote.includes('\r\n')) {
                consignmentNoteLines = this.internalJob.conNote.split('\r\n');
            } else {
                consignmentNoteLines = [this.internalJob.conNote];
            }

            consignmentNoteLines = consignmentNoteLines.filter(note => note.trim());
            console.log('Split consignment notes into', consignmentNoteLines.length, 'lines:', consignmentNoteLines);

            consignmentNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding consignment note ${index + 1}:`, trimmedNote);
                this.notes.push({
                    icon: 'inventory_2', text: trimmedNote, type: 'consignment'
                });
            });

            if (consignmentNoteLines.length === 0 && this.internalJob.conNote.trim()) {
                this.notes.push({
                    icon: 'inventory_2', text: this.internalJob.conNote.trim(), type: 'consignment'
                });
            }
        } else {
            console.log('No con note found');
        }

        if (this.internalJob.clientNotes) {
            console.log('Processing client notes:', this.internalJob.clientNotes);

            let clientNoteLines;
            if (this.internalJob.clientNotes.includes('\n')) {
                clientNoteLines = this.internalJob.clientNotes.split('\n');
            } else if (this.internalJob.clientNotes.includes('\r\n')) {
                clientNoteLines = this.internalJob.clientNotes.split('\r\n');
            } else {
                clientNoteLines = [this.internalJob.clientNotes];
            }

            clientNoteLines = clientNoteLines.filter(note => note.trim());

            console.log('Split client notes into', clientNoteLines.length, 'lines:', clientNoteLines);

            clientNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding client note ${index + 1}:`, trimmedNote);
                this.notes.push({
                    icon: 'business', text: trimmedNote, type: 'client'
                });
            });

            if (clientNoteLines.length === 0 && this.internalJob.clientNotes.trim()) {
                this.notes.push({
                    icon: 'business', text: this.internalJob.clientNotes.trim(), type: 'client'
                });
            }
        } else {
            console.log('No client notes found');
        }

        console.log('Final notes array:', this.notes, 'Length:', this.notes.length);

        if (this.$scope && this.$scope.$applyAsync) {
            this.$scope.$applyAsync();
        }

        this._getSelectedStatusText();
    }

    getJobAddressIcon() {
        const icon = this.internalJob?.assignedFlight ? 'flight_takeoff' : 'pin_drop';
        console.log(`[getJobAddressIcon] Icon selected: ${icon}`);
        return icon || 'pin_drop';
    }

    async showNotesDialog($event: MouseEvent, job: IJob, title: string, fieldName: string) {
        try {
            await this.$mdDialog.show({
                controller: "AddNotesDialogController",
                controllerAs: "ctrl",
                template: require("../../dialogs/add-notes-dialog/add-notes-dialog.html"),
                parent: document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    id: "editField", fieldName: fieldName, title: title, job: job,
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
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
                parent: document.body,
                targetEvent: $event,
                template: require("../../dialogs/auto-complete-dialog/auto-complete-dialog.html"),
                clickOutsideToClose: true,
                fullscreen: false,
                locals: {
                    id: 'editField', fieldName, title, job, options, existingItem, showRerateOption
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
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
                             title: string, fieldName: string, dateTime?: Date) {
        try {
            const result = await this.editDateTimeDialogService.showEditTimeDialog($event, title, fieldName, dateTime);
            await this._processDateTimeUpdateResult(job, result)
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditDateAndTimeDialog($event: MouseEvent, job: IJob,
                             title: string, fieldName: string, dateTime?: Date) {
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

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        }
    }

    async showSelectDialog($event: MouseEvent, job: IJob, data: Array<any>,
                           fieldName: string, title: string, initialValue: string | null | number = null,
                           showCheckbox: boolean = false, checkboxLabel: string = "") {
        try {
            const result = await this.selectDialogService.showSelectDialog($event, data,
                fieldName, title, initialValue, showCheckbox, checkboxLabel);

            if (result) {
                if (fieldName === "DGClass") {
                    await this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);

                    if (job.dgDocumentation !== result.checkboxValue) {
                        await this.DispatchData.updateJobDetail(job.id, "DGDocumentation", result?.checkboxValue ?? false, job.charge, job.preBook);
                    }
                } else {
                    if (job.bulkJob) {
                        await this.DispatchData.updateBulkJobDetail(job.id, fieldName, result.value, job.charge, FirstName, ContactID);
                    } else {
                        await this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);
                    }
                }

                this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                await this._refreshJobDetails(job.id);
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async showEditDialog($event: MouseEvent, job: IJob, title: string,
                         placeholder: string, ariaLabel: string, initialValue: string | number | undefined, field: string) {
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

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    async showJobDimensionsDialog($event: MouseEvent, job: IJob) {
        await this.$mdDialog.show({
            controller: "EditParcelDimensionsDialogController",
            controllerAs: "ctrl",
            parent: document.body,
            targetEvent: $event,
            template: require("../../dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                jobId: job.id, parcels: job.parcelDimensions
            },
            bindToController: true
        });

        await this._refreshJobDetails(job.id);
    }

    async editLogTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog($event, job, "Log Time", "Time", job.time);
    }

    async editCompletedTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog($event, job, "POD Time", "CompletedTime", job.completedTime);
    }

    async editFollowUpTime($event: MouseEvent, job: IJob) {
        await this.showEditTimeDialog($event, job, "Follow Up Time", "FollowupTime", job.followupTime);
    }

    async editPuDate($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog($event, job, "Pick Up Time", "PuTime", job.puTime);
    }

    async editDeliverBy($event: MouseEvent, job: IJob) {
        await this.showEditDateAndTimeDialog($event, job, "Deliver By", "DeliverBy", job.deliverByTime);
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

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
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
            if (job.charge && typeof job.charge === 'string') {
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
                contactProperty: "FromContactName"
            }, to: {
                title: "Edit To Contact Name",
                placeholder: "To Contact Name...",
                fieldLabel: "to contact name",
                contactValue: job.deliverToContact,
                contactProperty: "DeliverToContact"
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
                phoneProperty: "FromContactPhone"
            }, to: {
                title: "Edit To Contact Phone",
                placeholder: "To Contact Phone...",
                fieldLabel: "to contact phone",
                phoneValue: job.toContactPhone,
                phoneProperty: "ToContactPhone"
            }
        };

        const phoneDetails = phoneMapping[contactType];

        if (!phoneDetails) {
            throw new Error(`[editJobContactPhone] Invalid contact type: ${contactType}`);
        }

        await this.showEditDialog($event, job, phoneDetails.title, phoneDetails.placeholder, phoneDetails.fieldLabel, phoneDetails.phoneValue, phoneDetails.phoneProperty);
    }

    async editPodName($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit POD Name", "POD Name...", "pod name", job.podName, "PodName");
    }

    async editRef($event: MouseEvent, job: IJob, isRefA: boolean) {
        if (isRefA) {
            await this.showEditDialog($event, job, "Edit RefA", "RefA...", "refa", job.refA, "RefA");
        } else {
            await this.showEditDialog($event, job, "Edit RefA", "RefB...", "refb", job.refB, "RefB");
        }
    }

    async editOurRef($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Our Reference", "Our Reference...", "our reference", job.ourRef, "OurRef");
    }

    async editJobWeight($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Weight", "Job Weight...", "job weight", job.weight, "Weight");
    }

    async editTrackingMobile($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Tracking Mobile", "Tracking Mobile...", "tracking mobile", job.trackingMobile, "TrackingMobile");
    }

    async editTrackingEmail($event: MouseEvent, job: IJob) {
        await this.showEditDialog($event, job, "Edit Tracking Email", "Tracking Email...", "tracking email", job.trackingEmail, "TrackingEmail");
    }

    async clientClick($event: MouseEvent, job: IJob) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientID, text: job.clientName
        }

        await this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", existingItem, true)
    }

    async courierClick($event: MouseEvent, job: IJob) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        await this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", null, false)
    }

    async contactClick($event: MouseEvent, job: IJob) {
        if (job.clientID === undefined) return;

        const pickContacts = await this.DispatchData.getContactList(job.clientID);
        await this.showSelectDialog($event, job, pickContacts, "ContactID", "Contact", job.contactName);
    }

    async speedClick($event: MouseEvent, job: IJob) {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "SpeedID", "Speed", job.speedName);
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
            await this.showSelectDialog($event, job, data, "JobTypeID", "Job Type", jobTypeDes);
            console.log('Select dialog completed successfully');
        } catch (error) {
            console.error('Error showing select dialog:', error);
            throw error;
        }
    }

    async sizeClick($event: MouseEvent, job: IJob) {
        const pickVehicleSizes = await this.DispatchData.getVehicleSizes();
        await this.showSelectDialog($event, job, pickVehicleSizes, "Size", "Size", job.size.text);
    }


    async dgClassClick($event: MouseEvent, job: IJob) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        await this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, true, "Has Documentation?");
    }


    async leaveClick($event: MouseEvent, job: IJob) {
        const pickLeaveList = await this.DispatchData.getLeaveList();
        await this.showSelectDialog($event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }


    async trackingMethodClick($event: MouseEvent, job: IJob) {
        const trackingArray = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });
        const trackingMethod = this.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog($event, job, trackingArray, "TrackingMethod", "Tracking Method", trackingMethod);
    }

    async statusClick($event: MouseEvent, job: IJob) {
        const statusList = await this.DispatchData.getStatusList();
        await this.showSelectDialog($event, job, statusList, "Status", "Status", job.statusName);
    }

    async updateField(reRate: boolean, job: IJob, callData: {
        call?: string;
        field: string;
        value: any;
        jobID: number;
    }) {
        try {
            if (reRate && !job.bulkJob) {
                const rate = await this.rateJobService.rateJob(job);

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

    async toggleJobProperty(job: IJob, property: string, useCharge: boolean = true) {
        console.log(`Toggle job property: ${property}`);
        const newValue = job ? !(property in job && job[property as keyof typeof job]) : false;
        console.log(`New value: ${newValue}`);
        const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);
        console.log(`Capitalized property: ${capitalizedProperty}`);

        const updateJob = async (rate: number) => {
            await this.DispatchData.updateJobDetail(job.id, capitalizedProperty, newValue, rate, job.preBook);
        };

        try {
            // Special handling for "reprice"
            if (property === "reprice") {
                const previousStatus = job.internalStatusId;

                const callData = {
                    call: "updateDetailField", field: "Reprice", value: newValue, jobID: job.id
                };

                // Update the reprice status
                await this.updateField(false, job, callData);

                if (newValue) {
                    const repriceStatusId = 4;
                    await this.DispatchData.updateJobDetail(job.id, "InternalStatusID", repriceStatusId, job.charge, job.preBook);
                } else if (previousStatus) {
                    await this.DispatchData.updateJobDetail(job.id, "InternalStatusID", previousStatus, job.charge, job.preBook);
                }
            }  // Special handling for "van"
            else if (property === "van") {
                const callData = {
                    call: "updateDetailField", field: "Van", value: newValue, jobID: job.id
                };

                await this.updateField(true, job, callData);
            } // Special handling for "vanOK"
            else if (property === "vanOK") {
                const callData = {
                    call: "updateDetailField", field: "VanOK", value: newValue, jobID: job.id
                };

                await this.updateField(true, job, callData);
            }
            // General handling for other properties
            else {
                // General toggle logic for other properties
                if (useCharge) {
                    await updateJob(this._extractNumericRate(job.charge));
                } else {
                    const rate = await this.rateJobService.rateJob(job);
                    await updateJob(this._extractNumericRate(rate));
                }
            }

            // Show success toast and refresh job details
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error(`Error toggling ${property}:`, error);
            this.toastrService.showErrorToast(`Failed to update ${property}. Please try again.`);
        }
    }

    async toggleProperty(job: IJob, property: string) {
        const propertiesUsingDefaultCharge = ["pedal", "truck", "direct", "attention", "return", "oneOff", "active", "void", "van", "vanOK", "done", "reprice"];
        const useCharge = propertiesUsingDefaultCharge.includes(property);
        await this.toggleJobProperty(job, property, useCharge);
    }

    async markJobAsDone(job: IJob) {
        try {
            if (job.completedTime == undefined) return;

            await this.DispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} marked as done successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            const message = "Failed to mark job as done. Please try again.";
            console.error(message);
            this.toastrService.showErrorToast(message);
        }
    }

    private async _refreshJobDetails(jobId: number) {
        try {
            console.log(`Refreshing job details for jobId: ${jobId}`);

            // Clear and trigger refresh
            this.internalJob = undefined;
            this.$scope.$emit('refreshJobRequested', jobId);

            console.log('Refresh request emitted to parent controller');
        } catch (error) {
            console.error("Error during refresh process:", error);
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }

    private _handleError(error: any) {
        if (error === undefined) {
            console.log("User closed dialog");
        } else {
            console.error(error);
            this.toastrService.showErrorToast();
        }
    }

    private _extractNumericRate(rate: string): number {
        return Number(rate.replace(/[^0-9.-]+/g, ""));
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
        if (!this.internalJob?.podPhotos) return;

        try {
            if (!this.internalJob?.podPhoto) {
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

            await this.DispatchData.sendPOD(this.internalJob.id, email);

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
        console.log('Current internalJob:', this.internalJob);

        console.log('Current internalStatusList:', this.internalStatusList);

        const selectedStatus = this.internalStatusList?.find(status =>
            status.id === this.internalJob?.internalStatusId
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
                "InternalStatusID",
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

            // Refresh label to show new status
            this._getSelectedStatusText();
        } catch (error) {
            console.error("Error updating internal status:", error);
        }
    }

    async showPricingBreakdown($event: MouseEvent, job: IJob) {
        try {
            await this.priceBreakdownDialogService.openPriceBreakdownDialog($event, job.id, job.preBook);
        } catch (error) {
            console.error("Error in displayPriceBreakdown:", error);
            this.toastrService.showErrorToast("An error occurred while fetching the price breakdown. Please try again.");
        }
    }
}

const JobDetailComponent: angular.IComponentOptions = {
    template: require("./job-details.template.html"),
    bindings: {
        job: "=",
        onStatusChange: "&"
    },
    controller: JobDetailController,
    controllerAs: "ctrl"
}
export default JobDetailComponent;
