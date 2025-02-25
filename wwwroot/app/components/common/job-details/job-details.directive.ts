import app from "../../../app";
import angular from "angular";
import ToastrService from "../../../services/toastr.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import {Job} from "../../../interfaces/job.interface";
import {FirstName, ContactID} from "../../../contants";
import {JobNote, JobOptions, TabItem} from "./job-details.interfaces";
import "./job-details.styles.less";
import {PodPhoto} from "../pod-photo-viewer/pod-photo-viewer.interfaces";

class JobDetailController implements angular.IController {
    static $inject = ["$mdDialog", "toastrService", "DispatchData", "APP_CONFIG", "rateJobService"];

    private readonly isUsCustomer: boolean;
    public job?: Job;
    public internalJob?: Job;
    public notes: JobNote[];
    public selectedTab: number;
    public allTabs: TabItem[];
    public options: JobOptions;
    public isPodViewerOpen: boolean = false;
    public formattedPodPhotos: PodPhoto[] = [];
    public selectedPhotoIndex: number = 0;
    public showLeftScroll: boolean = false;
    public showRightScroll: boolean = false;

    constructor(private $mdDialog: angular.material.IDialogService,
                private toastrService: ToastrService,
                private dispatchData: any,
                APP_CONFIG: AppConfig,
                private rateJobService: any) {
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.job = undefined;
        this.internalJob = undefined;
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

        console.log('Job Details Controller loaded');
        this._updateTabsArray();
        this._initializeJobData();
    }

    private _updateTabsArray(): void {
        if (!this.internalJob) return;

        this.allTabs = [{
            id: this.internalJob.id,
            text: this.internalJob.jobNo,
            isMainJob: true
        }];

        if (this.internalJob.relatedJobs?.length) {
            this.allTabs = this.allTabs.concat(
                this.internalJob.relatedJobs.map(job => ({
                    id: job.id,
                    text: job.text,
                    isMainJob: false
                }))
            );
        }
    }

    async navigateTab(direction: 'prev' | 'next'): Promise<void> {
        if (!this.allTabs.length) return;

        let newIndex: number;
        if (direction === 'prev') {
            newIndex = this.selectedTab > 0 ? this.selectedTab - 1 : this.allTabs.length - 1;
        } else {
            newIndex = this.selectedTab < this.allTabs.length - 1 ? this.selectedTab + 1 : 0;
        }

        this.selectedTab = newIndex;
        await this._loadJobDetails(this.allTabs[newIndex].id);
    }

    public async onTabSelected(tabIndex: number): Promise<void> {
        const selectedTab = this.allTabs[tabIndex];
        if (!selectedTab) return;

        await this._loadJobDetails(selectedTab.id);
    }


    private async _loadJobDetails(jobId: number) {
        if (!jobId) {
            console.error('Invalid job ID');
            return;
        }

        try {
            // Store current tabs and selected index
            const currentTabs = [...this.allTabs];
            const currentIndex = this.selectedTab;

            // Load new job details
            const updatedJob = await this.dispatchData.getJobDetail(jobId);

            // If this is loading a related job, we need to preserve the original related jobs array
            if (!currentTabs[currentIndex].isMainJob && this.internalJob?.relatedJobs) {
                updatedJob.relatedJobs = this.internalJob.relatedJobs;
            }

            // Update the job
            this.internalJob = updatedJob;

            // Keep the tabs and selection state
            this.allTabs = currentTabs;
            this.selectedTab = currentIndex;
        } catch (error) {
            this.toastrService.showErrorToast("Failed to load job details");

            // Reset to main jon
            if (this.internalJob && this.internalJob.id) {
                await this._loadJobDetails(this.internalJob.id);
            }
        }
    }


    private _initializeJobData() {
        if (!this.internalJob) return;

        console.log('Initializing job data:', this.internalJob.id);

        const notes: JobNote[] = [];

        // Split internal notes by newline and add each as separate entry
        if (this.internalJob.internalNotes) {
            console.log('Processing internal notes:', this.internalJob.internalNotes);
            const internalNoteLines = this.internalJob.internalNotes.split(/\r?\n/).filter(note => note.trim());
            console.log('Split internal notes into', internalNoteLines.length, 'lines:', internalNoteLines);

            internalNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding internal note ${index + 1}:`, trimmedNote);
                notes.push({
                    icon: 'note_stack', text: trimmedNote, type: 'internal'
                });
            });
        } else {
            console.log('No internal notes found');
        }

        // Split contractor notes by newline and add each as separate entry
        if (this.internalJob.conNote) {
            console.log('Processing contractor notes:', this.internalJob.conNote);
            const contractorNoteLines = this.internalJob.conNote.split(/\r?\n/).filter(note => note.trim());
            console.log('Split contractor notes into', contractorNoteLines.length, 'lines:', contractorNoteLines);

            contractorNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding contractor note ${index + 1}:`, trimmedNote);
                notes.push({
                    icon: 'inventory_2', text: trimmedNote, type: 'contractor'
                });
            });
        } else {
            console.log('No con note found');
        }

        this.notes = notes;
        console.log('Final notes array:', this.notes);
    }

    public getJobAddressIcon() {
        const icon = this.internalJob?.assignedFlight ? 'flight_takeoff' : 'pin_drop';
        console.log(`[getJobAddressIcon] Icon selected: ${icon}`);
        return icon || 'pin_drop';
    }

    public async showNotesInfo() {
        this.toastrService.showWarningToast(`Notes are not available for this job`);
    }

    public async showNotesDialog($event: MouseEvent, job: Job, title: string, fieldName: string) {
        try {
            await this.$mdDialog.show({
                controller: "AddNotesDialogController",
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/add-notes-dialog/add-notes-dialog.html",
                parent: document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    id: "editField", fieldName: fieldName, title: title, job: job,
                },
                bindToController: true
            });

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    public async showAutocompleteDialog($event: MouseEvent, job: Job, url: string, placeholder: string,
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
                templateUrl: "app/components/dialogs/auto-complete-dialog/auto-complete-dialog.html",
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

    public async showEditTimeDialog($event: MouseEvent, job: Job,
                                    title: string, fieldName: string, time?: Date) {
        try {
            await this.$mdDialog.show({
                controller: "EditDateTimeDialogController",
                controllerAs: "ctrl",
                parent: document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job, title, fieldName, dateTime: time, id: "editForm", showDate: false, showTime: true
                },
                bindToController: true
            });

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    public async showSelectDialog($event: MouseEvent, job: Job, data: Array<any>,
                                  fieldName: string, title: string, initialValue: string | null | number = null,
                                  showCheckbox: boolean = false, checkboxLabel: string = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        try {
            await this.$mdDialog.show({
                controller: "SelectDialogController",
                controllerAs: "ctrl",
                parent: document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/select-dialog/select-dialog.html",
                clickOutsideToClose: true,
                fullscreen: false,
                locals: {
                    id: 'editField', fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    public async showEditDialog($event: MouseEvent, job: Job, title: string,
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
            // Get new value
            const result = await this.$mdDialog.show(prompt);

            // Update in backend
            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };
            await this.updateField(false, job, callData);

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    public async showAddressDialog($event: MouseEvent, job: Job, isDeliveryAddress: boolean) {
        const addressToUpdate = isDeliveryAddress ? job.deliveryAddress : job.pickupAddress;
        const pickSuburbs = await this.dispatchData.getSuburbList();

        return this.$mdDialog.show({
            controller: "EditAddressDialogController",
            controllerAs: "ctrl",
            parent: document.body,
            targetEvent: $event,
            templateUrl: "app/components/dialogs/edit-address-dialog/edit-address-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                addressDetails: addressToUpdate,
                suburbOptions: pickSuburbs,
                title: "Update Address and GPS",
                submitLabel: "Update",
            },
            bindToController: true
        });
    }

    public async showJobDimensionsDialog($event: MouseEvent, job: Job) {
        await this.$mdDialog.show({
            controller: "EditParcelDimensionsDialogController",
            controllerAs: "ctrl",
            parent: document.body,
            targetEvent: $event,
            templateUrl: "app/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                jobId: job.id, parcels: job.parcelDimensions
            },
            bindToController: true
        });

        // Refresh and update job details
        await this._refreshJobDetails(job.id);
    }

    public async showMissingInfoDialog($event: MouseEvent, job: Job) {
        let message = "";
        if (!job.completedTime) {
            message = "You must set completed time (POD Time) first";
        } else if (!job.podName) {
            message = "You must set POD Name first";
        }

        const confirm = this.$mdDialog.confirm()
            .title(message)
            .targetEvent($event)
            .ok("OK");

        await this.$mdDialog.show(confirm);
    }

    public async editLogTime($event: MouseEvent, job: Job) {
        await this.showEditTimeDialog($event, job, "Log Time", "Time", job.time);
    }

    public async editCompletedTime($event: MouseEvent, job: Job) {
        await this.showEditTimeDialog($event, job, "POD Time", "CompletedTime", job.completedTime);
    }

    public async updateAddress($event: MouseEvent, job: Job, field: string) {
        const isDeliveryAddress = field === "toAddress";

        try {
            const result = await this.showAddressDialog($event, job, isDeliveryAddress);
            return this._processAddressUpdate(job, result, isDeliveryAddress);
        } catch (error) {
            console.log("Error updating GPS:", error);
        }
    }

    private async _processAddressUpdate(job: Job, addressResult: any, isDeliveryAddress: boolean) {
        console.log(`isDeliveryAddress: ${isDeliveryAddress}`);

        // Update job by address format
        const updatedJob = this.isUsCustomer ? this._updateJobAddressUs(job, addressResult, isDeliveryAddress) : this._updateJobAddressNz(job, addressResult, isDeliveryAddress);

        try {
            await this.updateJobRateAndAddress(updatedJob, addressResult, isDeliveryAddress);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    private _updateJobAddressNz(job: Job, result: any, isDeliveryAddress: boolean) {
        const addressField = isDeliveryAddress ? "toAddress" : "from";
        const suburbIdField = isDeliveryAddress ? "toSuburbId" : "fromSuburbId";
        const suburbField = isDeliveryAddress ? "toSuburbName" : "fromSuburbName";

        job[addressField] = result.addressData.address;
        job[suburbIdField] = result.addressData.suburbId;
        job[suburbField] = result.addressData.suburbName;

        return job;
    }

    private _updateJobAddressUs(job: Job, addressResult: any, isDeliveryAddress: boolean) {
        const addressField = isDeliveryAddress ? "deliveryAddress" : "pickupAddress";
        console.log(`Address Field: ${addressField}`);

        job[addressField] = addressResult.addressData;
        return job;
    }

    private async updateJobRateAndAddress(job: Job, addressResult: any, isDeliveryAddress: boolean) {
        job.charge = await this.rateJobService.rateJob(job);
        const rate = Number(job.charge.replace(/[^0-9.-]+/g, ""));

        console.log(`Job Rate: ${rate}`);

        if (isDeliveryAddress) {
            await this.dispatchData.updateDeliveryAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        } else {
            await this.dispatchData.updatePickupAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        }
    }

    public async editJobContact($event: MouseEvent, job: Job, contactType: 'from' | 'to') {
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

    public async editJobContactPhone($event: MouseEvent, job: Job, contactType: 'from' | 'to') {
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

    public async editRef($event: MouseEvent, job: Job, isRefA: boolean) {
        if (isRefA) {
            await this.showEditDialog($event, job, "Edit RefA", "RefA...", "refa", job.refA, "RefA");
        } else {
            await this.showEditDialog($event, job, "Edit RefA", "RefB...", "refb", job.refB, "RefB");
        }
    }


    public async editOurRef($event: MouseEvent, job: Job) {
        await this.showEditDialog($event, job, "Edit Our Reference", "Our Reference...", "our reference", job.ourRef, "OurRef");
    }


    public async editJobWeight($event: MouseEvent, job: Job) {
        await this.showEditDialog($event, job, "Edit Weight", "Job Weight...", "job weight", job.weight, "Weight");
    }


    public async editTrackingMobile($event: MouseEvent, job: Job) {
        await this.showEditDialog($event, job, "Edit Tracking Mobile", "Tracking Mobile...", "tracking mobile", job.trackingMobile, "TrackingMobile");
    }


    public async editTrackingEmail($event: MouseEvent, job: Job) {
        await this.showEditDialog($event, job, "Edit Tracking Email", "Tracking Email...", "tracking email", job.trackingEmail, "TrackingEmail");
    }


    public async clientClick($event: MouseEvent, job: Job) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId, text: job.clientName
        }

        await this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", existingItem, true)
    }


    public async courierClick($event: MouseEvent, job: Job) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        await this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", null, false)
    }


    public async contactClick($event: MouseEvent, job: Job) {
        const pickContacts = await this.dispatchData.getContactList(job.clientId);
        await this.showSelectDialog($event, job, pickContacts, "ContactID", "Contact", job.contactName);
    }


    public async speedClick($event: MouseEvent, job: Job) {
        const pickSpeeds = await this.dispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "SpeedID", "Speed", job.speedName);
    }


    public async jobTypeClick($event: MouseEvent, job: Job) {
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
            throw error; // Re-throw to maintain original error handling
        }
    }


    public async sizeClick($event: MouseEvent, job: Job) {
        const pickVehicleSizes = await this.dispatchData.getVehicleSizes();
        await this.showSelectDialog($event, job, pickVehicleSizes, "Size", "Size", job.size.text);
    }


    public async dgClassClick($event: MouseEvent, job: Job) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        await this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, true, "Has Documentation?");
    }


    public async leaveClick($event: MouseEvent, job: Job) {
        const pickLeaveList = await this.dispatchData.getLeaveList();
        await this.showSelectDialog($event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }


    public async trackingMethodClick($event: MouseEvent, job: Job) {
        const trackingArray = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });
        const trackingMethod = this.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog($event, job, trackingArray, "TrackingMethod", "Tracking Method", trackingMethod);
    }


    public async statusClick($event: MouseEvent, job: Job) {
        const statusList = await this.dispatchData.getStatusList();
        await this.showSelectDialog($event, job, statusList, "Status", "Status", job.statusName);
    }

    public async updateField(reRate: boolean, job: Job, callData: {
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

                await this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
            } else {
                // Ensure rate is decimal
                const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
                if (isNaN(numericRate)) {
                    console.error("Failed to convert rate to a number");
                }

                if (job.bulkJob) {
                    await this.dispatchData.updateBulkJobDetail(job.id, callData.field, callData.value, numericRate, FirstName, ContactID);
                } else {
                    await this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
                }
            }
        } catch (error) {
            console.error("Error updating job:", error);
            this.toastrService.showErrorToast("Failed to update job. Please try again.");
            throw error;
        }
    }

    public getJobTypeDescription(jobTypeId?: number) {
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

    public hasDGDocs(job: Job) {
        if (job.dgClass) {
            return ((job.dgClass || 0) === 1) || ((job.dgDocumentation || false)) ? "Yes" : "No";
        } else {
            return "";
        }
    }

    public async toggleJobProperty(job: Job, property: string, useCharge: boolean = true) {
        const newValue = job ? !(property in job && job[property as keyof typeof job]) : false;
        const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);

        const updateJob = async (rate: number) => {
            await this.dispatchData.updateJobDetail(job.id, capitalizedProperty, newValue, rate, FirstName, ContactID, job.preBook);
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
                    await this.dispatchData.updateJobDetail(job.id, "InternalStatusID", repriceStatusId, job.charge, FirstName, ContactID, job.preBook);
                } else if (previousStatus) {
                    await this.dispatchData.updateJobDetail(job.id, "InternalStatusID", previousStatus, job.charge, FirstName, ContactID, job.preBook);
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

    public async toggleProperty(job: Job, property: string) {
        const propertiesUsingDefaultCharge = ["pedal", "truck", "direct", "attention", "return", "oneOff", "Active", "Void", "van", "vanOK", "done", "reprice"];
        const useCharge = propertiesUsingDefaultCharge.includes(property);
        await this.toggleJobProperty(job, property, useCharge);
    }

    public async markJobAsDone($event: MouseEvent, job: Job) {
        if (!job.completedTime || !job.podName) {
            try {
                await this.showMissingInfoDialog($event, job);
            } catch (error) {
                this._handleError(error);
                return;
            }
        }

        try {
            await this.dispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);

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
            this.internalJob = await this.dispatchData.getJobDetail(jobId);
        } catch (error) {
            console.error("Error refreshing job details:", error);
            this.toastrService.showErrorToast();
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

    public getTrackingMethod(trackingMethod?: number) {
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

    public setSelectedPhoto(index: number): void {
        this.selectedPhotoIndex = index;
    }

    public nextPhoto(): void {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % this.formattedPodPhotos.length;
    }

    public prevPhoto(): void {
        if (!this.formattedPodPhotos.length) return;
        this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + this.formattedPodPhotos.length) % this.formattedPodPhotos.length;
    }

    private handleKeydown = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'ArrowLeft') {
            this.prevPhoto();
        } else if (keyboardEvent.key === 'ArrowRight') {
            this.nextPhoto();
        }
    };

    public setupPhotoKeyboardNavigation(): void {
        const photoSection = document.querySelector('.pod-photo-section');
        if (!photoSection) return;

        photoSection.addEventListener('keydown', this.handleKeydown);
        photoSection.setAttribute('tabindex', '0');
    }


    private formatPodPhotos(): void {
        if(!this.internalJob?.podPhotos) return;

        console.log("Formatting POD photos");

        // Ensure formattedPodPhotos is always initialized as an array
        this.formattedPodPhotos = [];

        try {
            this.formattedPodPhotos = this.internalJob.podPhotos.map((base64Image, index) => ({
                url: `data:image/png;base64,${base64Image}`,
                timestamp: this.getPhotoTimestamp(index),
                uploadedBy: this.getPhotoUploader(index)
            }));

            console.log(`Formatted ${this.formattedPodPhotos.length} POD photos`);
        } catch (error) {
            console.error("Error formatting POD photos:", error);
        }

        // Ensure selectedPhotoIndex is within bounds
        if (this.selectedPhotoIndex >= this.formattedPodPhotos.length) {
            this.selectedPhotoIndex = 0;
        }
    }

    private getPhotoTimestamp(index: number): string {
        const now = new Date();
        const timestamp = new Date(now.getTime() - (index * 10 * 60 * 1000));
        return timestamp.toISOString();
    }

    private getPhotoUploader(index: number): string {
        const uploadedByOptions = ['Driver', 'Customer', 'Dispatcher', 'Admin'];
        return uploadedByOptions[index % uploadedByOptions.length];
    }

    public openPodViewer(index: number): void {
        this.selectedPhotoIndex = index;
        this.isPodViewerOpen = true;
    }

    public closePodViewer(): void {
        this.isPodViewerOpen = false;
    }

    public async sendPOD($event: MouseEvent): Promise<void> {
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

            await this.dispatchData.sendPOD(this.internalJob.id, email);

            await this.$mdDialog.show(this.$mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Email Sent')
                .textContent('POD email has been sent')
                .ok('OK'));

        } catch (error: any) {
            this._handleError(error);
        }
    }

    // Lifecycle hooks
    $onInit() {
        console.log('$onInit called - job exists:', !!this.job);
        if (this.job) {
            this.internalJob = this.job;
            this._initializeJobData();

            setTimeout(() => {
                this.formatPodPhotos();
                this.setupPhotoKeyboardNavigation();
            }, 100);
        }
    }

    $onChanges(changes: angular.IOnChangesObject): void {
        if (changes['job'] && !changes['job'].isFirstChange()) {
            this.formatPodPhotos();
        }
    }

    $onDestroy(): void {
        const photoSection = document.querySelector('.pod-photo-section');
        if (photoSection) {
            photoSection.removeEventListener('keydown', this.handleKeydown);
        }
    }
}

class JobDetailDirective implements angular.IDirective {
    restrict: 'E';
    templateUrl: string;
    scope: { job: string };
    controller: any;
    controllerAs: string;
    bindToController: boolean;

    constructor() {
        this.restrict = 'E';
        this.templateUrl = "app/components/common/job-details/job-details.template.html";
        this.scope = {
            job: "="
        };
        this.controller = JobDetailController;
        this.controllerAs = "ctrl";
        this.bindToController = true;
    }

    static factory(): angular.IDirectiveFactory {
        return () => new JobDetailDirective();
    }
}

app.directive("jobDetailWidget", JobDetailDirective.factory());
