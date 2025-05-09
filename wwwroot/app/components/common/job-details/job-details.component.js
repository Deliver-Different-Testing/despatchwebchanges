"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobDetailComponent = void 0;
const contants_1 = require("../../../contants");
require("./job-details.styles.less");
const bindAllMethods_1 = require("../../../bindAllMethods");
class JobDetailController {
    constructor($scope, $mdDialog, toastrService, DispatchData, APP_CONFIG, rateJobService, moment, $mdMenu, $timeout, selectDialogService, editDateTimeDialogService) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.rateJobService = rateJobService;
        this.moment = moment;
        this.$mdMenu = $mdMenu;
        this.$timeout = $timeout;
        this.selectDialogService = selectDialogService;
        this.editDateTimeDialogService = editDateTimeDialogService;
        this.isPodViewerOpen = false;
        this.formattedPodPhotos = [];
        this.selectedPhotoIndex = 0;
        this.showLeftScroll = false;
        this.showRightScroll = false;
        this.photosLoaded = false;
        this._handleKeydown = (event) => {
            const keyboardEvent = event;
            if (keyboardEvent.key === 'ArrowLeft') {
                this.prevPhoto();
            }
            else if (keyboardEvent.key === 'ArrowRight') {
                this.nextPhoto();
            }
        };
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.notes = [];
        this.selectedTab = 0;
        this.allTabs = [];
        bindAllMethods_1.bindAllMethods(this);
        this.options = {
            detail: {
                size: [
                    { id: 1, label: "Bike" },
                    { id: 2, label: "Car" },
                    { id: 3, label: "Van" },
                    { id: 4, label: "Truck" },
                    { id: 5, label: "Scooter" }
                ],
                tracking: [
                    { id: 1, label: "Email" },
                    { id: 2, label: "Mobile" },
                    { id: 3, label: "Email & Mobile" }
                ],
                DGClass: Array.from({ length: 10 }, (_, i) => ({
                    id: i,
                    label: i.toString()
                }))
            }
        };
        this.internalStatusList = [];
        $scope.$watch(() => this.job, (newValue, oldValue) => {
            if (newValue && newValue !== oldValue) {
                this.internalJob = newValue;
                this.previousJobId = newValue.id;
                this._initializeJobData();
                if (newValue.completedTime) {
                    this._loadPodPhotos();
                }
            }
        });
    }
    $onInit() {
        console.log('$onInit called - job exists:', !!this.job);
        this.DispatchData.getInternalStatusList()
            .then((statusList) => {
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
    $onChanges(changes) {
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
    $doCheck() {
        if (this.internalJob && !this.photosLoaded) {
            if (this.internalJob.completedTime) {
                this.$timeout(() => {
                    if (!this.photosLoaded) {
                        this._loadPodPhotos();
                        this.photosLoaded = true;
                    }
                }, 0);
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
    _loadPodPhotos() {
        var _a, _b;
        if (!((_a = this.internalJob) === null || _a === void 0 ? void 0 : _a.completedTime)) {
            console.log('No POD time available for job');
            this.photosLoaded = true;
            return;
        }
        console.log(`Loading POD photos for job: ${this.internalJob.id}`);
        try {
            const completedTime = this.moment((_b = this.internalJob) === null || _b === void 0 ? void 0 : _b.completedTime);
            const month = completedTime.month() + 1;
            const year = completedTime.year();
            console.log(`Getting POD photos for date: ${year}-${month}`);
            this.DispatchData.getJobDeliveryPhotosAndSignature(this.internalJob.id, year, month)
                .then((photosData) => {
                if (!photosData || photosData.length === 0) {
                    console.log('No POD photos returned from server');
                    this.formattedPodPhotos = [];
                }
                else {
                    console.log('Raw photos data received, count:', photosData.length);
                    this.formattedPodPhotos = photosData
                        .map((photoData, index) => {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                        try {
                            const podPhoto = {
                                url: photoData,
                                timestamp: ((_a = this.internalJob) === null || _a === void 0 ? void 0 : _a.completedTime) ?
                                    new Date(this.internalJob.completedTime).toLocaleString() : undefined,
                                uploadedBy: (_c = (_b = this.internalJob) === null || _b === void 0 ? void 0 : _b.courierData.courierName) !== null && _c !== void 0 ? _c : 'Unknown',
                                coordinates: {
                                    lat: (_f = (_e = (_d = this.internalJob) === null || _d === void 0 ? void 0 : _d.deliveryAddress) === null || _e === void 0 ? void 0 : _e.latitude) !== null && _f !== void 0 ? _f : 0,
                                    lng: (_j = (_h = (_g = this.internalJob) === null || _g === void 0 ? void 0 : _g.deliveryAddress) === null || _h === void 0 ? void 0 : _h.longitude) !== null && _j !== void 0 ? _j : 0
                                }
                            };
                            return podPhoto;
                        }
                        catch (e) {
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
                .catch((error) => {
                this.toastrService.showErrorToast('Failed to load POD photos');
                console.error('Error loading POD photos:', error);
                this.formattedPodPhotos = [];
                this.photosLoaded = true;
                if (this.$scope && this.$scope.$applyAsync) {
                    this.$scope.$applyAsync();
                }
            });
        }
        catch (error) {
            this._handleError(error);
            this.formattedPodPhotos = [];
            this.photosLoaded = true;
            if (this.$scope && this.$scope.$applyAsync) {
                this.$scope.$applyAsync();
            }
        }
    }
    _initializeJobData() {
        if (!this.internalJob)
            return;
        console.log('Initializing job data:', this.internalJob.id);
        this.notes = [];
        if (this.internalJob.internalNotes) {
            console.log('Processing internal notes:', this.internalJob.internalNotes);
            let internalNoteLines;
            if (this.internalJob.internalNotes.includes('\n')) {
                internalNoteLines = this.internalJob.internalNotes.split('\n');
            }
            else if (this.internalJob.internalNotes.includes('\r\n')) {
                internalNoteLines = this.internalJob.internalNotes.split('\r\n');
            }
            else {
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
        }
        else {
            console.log('No internal notes found');
        }
        if (this.internalJob.conNote) {
            console.log('Processing consignment notes:', this.internalJob.conNote);
            let consignmentNoteLines;
            if (this.internalJob.conNote.includes('\n')) {
                consignmentNoteLines = this.internalJob.conNote.split('\n');
            }
            else if (this.internalJob.conNote.includes('\r\n')) {
                consignmentNoteLines = this.internalJob.conNote.split('\r\n');
            }
            else {
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
        }
        else {
            console.log('No con note found');
        }
        if (this.internalJob.clientNotes) {
            console.log('Processing client notes:', this.internalJob.clientNotes);
            let clientNoteLines;
            if (this.internalJob.clientNotes.includes('\n')) {
                clientNoteLines = this.internalJob.clientNotes.split('\n');
            }
            else if (this.internalJob.clientNotes.includes('\r\n')) {
                clientNoteLines = this.internalJob.clientNotes.split('\r\n');
            }
            else {
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
        }
        else {
            console.log('No client notes found');
        }
        console.log('Final notes array:', this.notes, 'Length:', this.notes.length);
        if (this.$scope && this.$scope.$applyAsync) {
            this.$scope.$applyAsync();
        }
        this._getSelectedStatusText();
    }
    getJobAddressIcon() {
        var _a;
        const icon = ((_a = this.internalJob) === null || _a === void 0 ? void 0 : _a.assignedFlight) ? 'flight_takeoff' : 'pin_drop';
        console.log(`[getJobAddressIcon] Icon selected: ${icon}`);
        return icon || 'pin_drop';
    }
    showNotesDialog($event, job, title, fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.$mdDialog.show({
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
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    showAutocompleteDialog($event, job, url, placeholder, fieldName, title, existingItem, showRerateOption) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                placeholder, minimumInputLength: 3, searchUrl: url
            };
            try {
                yield this.$mdDialog.show({
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
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    showEditTimeDialog($event, job, title, fieldName, dateTime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.editDateTimeDialogService.showEditTimeDialog($event, title, fieldName, dateTime);
                yield this._processDateTimeUpdateResult(job, result);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    showEditDateDialog($event, job, title, fieldName, dateTime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.editDateTimeDialogService.showEditTimeDialog($event, title, fieldName, dateTime);
                yield this._processDateTimeUpdateResult(job, result);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    _processDateTimeUpdateResult(job, result) {
        return __awaiter(this, void 0, void 0, function* () {
            if (result) {
                if (job.bulkJob) {
                    yield this.DispatchData.updateBulkJobDetail(job.id, result.fieldName, result.formattedDateTime, job.charge, contants_1.FirstName, contants_1.ContactID);
                }
                else {
                    yield this.DispatchData.updateJobDetail(job.id, result.fieldName, result.formattedDateTime, job.charge, job.preBook);
                }
                this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                yield this._refreshJobDetails(job.id);
            }
        });
    }
    showSelectDialog($event, job, data, fieldName, title, initialValue = null, showCheckbox = false, checkboxLabel = "") {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.selectDialogService.showSelectDialog($event, data, fieldName, title, initialValue, showCheckbox, checkboxLabel);
                if (result) {
                    if (fieldName === "DGClass") {
                        yield this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);
                        if (job.dgDocumentation !== result.checkboxValue) {
                            yield this.DispatchData.updateJobDetail(job.id, "DGDocumentation", (_a = result === null || result === void 0 ? void 0 : result.checkboxValue) !== null && _a !== void 0 ? _a : false, job.charge, job.preBook);
                        }
                    }
                    else {
                        if (job.bulkJob) {
                            yield this.DispatchData.updateBulkJobDetail(job.id, fieldName, result.value, job.charge, contants_1.FirstName, contants_1.ContactID);
                        }
                        else {
                            yield this.DispatchData.updateJobDetail(job.id, fieldName, result.value, job.charge, job.preBook);
                        }
                    }
                    this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                    yield this._refreshJobDetails(job.id);
                }
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    showEditDialog($event, job, title, placeholder, ariaLabel, initialValue, field) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const result = yield this.$mdDialog.show(prompt);
                const callData = {
                    "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
                };
                yield this.updateField(false, job, callData);
                this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    showAddressDialog($event, job, isDeliveryAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const addressToUpdate = isDeliveryAddress ? job.deliveryAddress : job.pickupAddress;
            const pickSuburbs = yield this.DispatchData.getSuburbList();
            return this.$mdDialog.show({
                controller: "EditAddressDialogController",
                controllerAs: "ctrl",
                parent: document.body,
                targetEvent: $event,
                template: require("../../dialogs/edit-address-dialog/edit-address-dialog.html"),
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
        });
    }
    showJobDimensionsDialog($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog.show({
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
            yield this._refreshJobDetails(job.id);
        });
    }
    editLogTime($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditTimeDialog($event, job, "Log Time", "Time", job.time);
        });
    }
    editCompletedTime($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditTimeDialog($event, job, "POD Time", "CompletedTime", job.completedTime);
        });
    }
    editFollowUpTime($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditTimeDialog($event, job, "Follow Up Time", "FollowupTime", job.followupTime);
        });
    }
    editDueDate($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!job.preBook) {
                this.toastrService.showWarningToast("Due Date can only be edited on pre-booked jobs. Change not applied");
                return;
            }
            yield this.showEditDateDialog($event, job, "Due Date", "DueDate", job.firstDue);
        });
    }
    updateAddress($event, job, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const isDeliveryAddress = field === "toAddress";
            try {
                const result = yield this.showAddressDialog($event, job, isDeliveryAddress);
                return this._processAddressUpdate(job, result, isDeliveryAddress);
            }
            catch (error) {
                console.log("Error updating GPS:", error);
            }
        });
    }
    _processAddressUpdate(job, addressResult, isDeliveryAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`isDeliveryAddress: ${isDeliveryAddress}`);
            // Update job by address format
            const updatedJob = this.isUsCustomer ? this._updateJobAddressUs(job, addressResult, isDeliveryAddress) : this._updateJobAddressNz(job, addressResult, isDeliveryAddress);
            try {
                yield this._updateJobRateAndAddress(updatedJob, addressResult, isDeliveryAddress);
                this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    _updateJobAddressNz(job, result, isDeliveryAddress) {
        const addressField = isDeliveryAddress ? "toAddress" : "from";
        const suburbIdField = isDeliveryAddress ? "toSuburbId" : "fromSuburbId";
        const suburbField = isDeliveryAddress ? "toSuburbName" : "fromSuburbName";
        job[addressField] = result.addressData.address;
        job[suburbIdField] = result.addressData.suburbId;
        job[suburbField] = result.addressData.suburbName;
        return job;
    }
    _updateJobAddressUs(job, addressResult, isDeliveryAddress) {
        const addressField = isDeliveryAddress ? "deliveryAddress" : "pickupAddress";
        console.log(`Address Field: ${addressField}`);
        job[addressField] = addressResult.addressData;
        return job;
    }
    _updateJobRateAndAddress(job, addressResult, isDeliveryAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            job.charge = yield this.rateJobService.rateJob(job);
            const rate = Number(job.charge.replace(/[^0-9.-]+/g, ""));
            console.log(`Job Rate: ${rate}`);
            if (isDeliveryAddress) {
                yield this.DispatchData.updateDeliveryAddress(job.id, rate, contants_1.FirstName, job.preBook, addressResult.addressData);
            }
            else {
                yield this.DispatchData.updatePickupAddress(job.id, rate, contants_1.FirstName, job.preBook, addressResult.addressData);
            }
        });
    }
    editJobContact($event, job, contactType) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield this.showEditDialog($event, job, contactDetails.title, contactDetails.placeholder, contactDetails.fieldLabel, contactDetails.contactValue, contactDetails.contactProperty);
        });
    }
    editJobContactPhone($event, job, contactType) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield this.showEditDialog($event, job, phoneDetails.title, phoneDetails.placeholder, phoneDetails.fieldLabel, phoneDetails.phoneValue, phoneDetails.phoneProperty);
        });
    }
    editRef($event, job, isRefA) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isRefA) {
                yield this.showEditDialog($event, job, "Edit RefA", "RefA...", "refa", job.refA, "RefA");
            }
            else {
                yield this.showEditDialog($event, job, "Edit RefA", "RefB...", "refb", job.refB, "RefB");
            }
        });
    }
    editOurRef($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditDialog($event, job, "Edit Our Reference", "Our Reference...", "our reference", job.ourRef, "OurRef");
        });
    }
    editJobWeight($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditDialog($event, job, "Edit Weight", "Job Weight...", "job weight", job.weight, "Weight");
        });
    }
    editTrackingMobile($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditDialog($event, job, "Edit Tracking Mobile", "Tracking Mobile...", "tracking mobile", job.trackingMobile, "TrackingMobile");
        });
    }
    editTrackingEmail($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.showEditDialog($event, job, "Edit Tracking Email", "Tracking Email...", "tracking email", job.trackingEmail, "TrackingEmail");
        });
    }
    clientClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "/home/ActiveClients";
            const placeholder = "Start typing to enter new client...";
            const existingItem = {
                id: job.clientId, text: job.clientName
            };
            yield this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", existingItem, true);
        });
    }
    courierClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "/courier/AllActiveSearch";
            const placeholder = "Start typing to search courier...";
            yield this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", null, false);
        });
    }
    contactClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (job.clientId === undefined)
                return;
            const pickContacts = yield this.DispatchData.getContactList(job.clientId);
            yield this.showSelectDialog($event, job, pickContacts, "ContactID", "Contact", job.contactName);
        });
    }
    speedClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const pickSpeeds = yield this.DispatchData.getSpeedList();
            yield this.showSelectDialog($event, job, pickSpeeds, "SpeedID", "Speed", job.speedName);
        });
    }
    jobTypeClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield this.showSelectDialog($event, job, data, "JobTypeID", "Job Type", jobTypeDes);
                console.log('Select dialog completed successfully');
            }
            catch (error) {
                console.error('Error showing select dialog:', error);
                throw error;
            }
        });
    }
    sizeClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const pickVehicleSizes = yield this.DispatchData.getVehicleSizes();
            yield this.showSelectDialog($event, job, pickVehicleSizes, "Size", "Size", job.size.text);
        });
    }
    dgClassClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            let dgClassOptions = [];
            for (let i = 1; i <= 9; i++) {
                dgClassOptions.push({ id: i, text: i.toString() });
            }
            const initialValue = !job.dgClass ? null : job.dgClass;
            yield this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, true, "Has Documentation?");
        });
    }
    leaveClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const pickLeaveList = yield this.DispatchData.getLeaveList();
            yield this.showSelectDialog($event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
        });
    }
    trackingMethodClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const trackingArray = this.options.detail.tracking.map(item => {
                return {
                    id: item.id, text: item.label
                };
            });
            const trackingMethod = this.getTrackingMethod(job.trackingMethod);
            yield this.showSelectDialog($event, job, trackingArray, "TrackingMethod", "Tracking Method", trackingMethod);
        });
    }
    statusClick($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            const statusList = yield this.DispatchData.getStatusList();
            yield this.showSelectDialog($event, job, statusList, "Status", "Status", job.statusName);
        });
    }
    updateField(reRate, job, callData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (reRate && !job.bulkJob) {
                    const rate = yield this.rateJobService.rateJob(job);
                    // Ensure rate is decimal
                    const numericRate = parseFloat(rate.replace(/[^\d.-]/g, ""));
                    if (isNaN(numericRate)) {
                        console.error("Failed to convert rate to a number:", rate);
                    }
                    yield this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, job.preBook);
                }
                else {
                    // Ensure rate is decimal
                    const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
                    if (isNaN(numericRate)) {
                        console.error("Failed to convert rate to a number");
                    }
                    if (job.bulkJob) {
                        yield this.DispatchData.updateBulkJobDetail(job.id, callData.field, callData.value, numericRate, contants_1.FirstName, contants_1.ContactID);
                    }
                    else {
                        yield this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, job.preBook);
                    }
                }
            }
            catch (error) {
                console.error("Error updating job:", error);
                this.toastrService.showErrorToast("Failed to update job. Please try again.");
                throw error;
            }
        });
    }
    getJobTypeDescription(jobTypeId) {
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
    hasDGDocs(job) {
        if (job.dgClass) {
            return ((job.dgClass || 0) === 1) || ((job.dgDocumentation || false)) ? "Yes" : "No";
        }
        else {
            return "";
        }
    }
    toggleJobProperty(job, property, useCharge = true) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Toggle job property: ${property}`);
            const newValue = job ? !(property in job && job[property]) : false;
            console.log(`New value: ${newValue}`);
            const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);
            console.log(`Capitalized property: ${capitalizedProperty}`);
            const updateJob = (rate) => __awaiter(this, void 0, void 0, function* () {
                yield this.DispatchData.updateJobDetail(job.id, capitalizedProperty, newValue, rate, job.preBook);
            });
            try {
                // Special handling for "reprice"
                if (property === "reprice") {
                    const previousStatus = job.internalStatusId;
                    const callData = {
                        call: "updateDetailField", field: "Reprice", value: newValue, jobID: job.id
                    };
                    // Update the reprice status
                    yield this.updateField(false, job, callData);
                    if (newValue) {
                        const repriceStatusId = 4;
                        yield this.DispatchData.updateJobDetail(job.id, "InternalStatusID", repriceStatusId, job.charge, job.preBook);
                    }
                    else if (previousStatus) {
                        yield this.DispatchData.updateJobDetail(job.id, "InternalStatusID", previousStatus, job.charge, job.preBook);
                    }
                } // Special handling for "van"
                else if (property === "van") {
                    const callData = {
                        call: "updateDetailField", field: "Van", value: newValue, jobID: job.id
                    };
                    yield this.updateField(true, job, callData);
                } // Special handling for "vanOK"
                else if (property === "vanOK") {
                    const callData = {
                        call: "updateDetailField", field: "VanOK", value: newValue, jobID: job.id
                    };
                    yield this.updateField(true, job, callData);
                }
                // General handling for other properties
                else {
                    // General toggle logic for other properties
                    if (useCharge) {
                        yield updateJob(this._extractNumericRate(job.charge));
                    }
                    else {
                        const rate = yield this.rateJobService.rateJob(job);
                        yield updateJob(this._extractNumericRate(rate));
                    }
                }
                // Show success toast and refresh job details
                this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                console.error(`Error toggling ${property}:`, error);
                this.toastrService.showErrorToast(`Failed to update ${property}. Please try again.`);
            }
        });
    }
    toggleProperty(job, property) {
        return __awaiter(this, void 0, void 0, function* () {
            const propertiesUsingDefaultCharge = ["pedal", "truck", "direct", "attention", "return", "oneOff", "active", "void", "van", "vanOK", "done", "reprice"];
            const useCharge = propertiesUsingDefaultCharge.includes(property);
            yield this.toggleJobProperty(job, property, useCharge);
        });
    }
    markJobAsDone(job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (job.completedTime == undefined)
                    return;
                yield this.DispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);
                this.toastrService.showSuccessToast(`Job ${job.jobNo} marked as done successfully`);
                yield this._refreshJobDetails(job.id);
            }
            catch (error) {
                const message = "Failed to mark job as done. Please try again.";
                console.error(message);
                this.toastrService.showErrorToast(message);
            }
        });
    }
    _refreshJobDetails(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Refreshing job details for jobId: ${jobId}`);
                // Clear and trigger refresh
                this.internalJob = undefined;
                this.$scope.$emit('refreshJobRequested', jobId);
                console.log('Refresh request emitted to parent controller');
            }
            catch (error) {
                console.error("Error during refresh process:", error);
                this.toastrService.showErrorToast("Failed to refresh job details");
            }
        });
    }
    _handleError(error) {
        if (error === undefined) {
            console.log("User closed dialog");
        }
        else {
            console.error(error);
            this.toastrService.showErrorToast();
        }
    }
    _extractNumericRate(rate) {
        return Number(rate.replace(/[^0-9.-]+/g, ""));
    }
    getTrackingMethod(trackingMethod) {
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
    setSelectedPhoto(index) {
        this.selectedPhotoIndex = index;
    }
    nextPhoto() {
        if (!this.formattedPodPhotos.length)
            return;
        this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % this.formattedPodPhotos.length;
    }
    prevPhoto() {
        if (!this.formattedPodPhotos.length)
            return;
        this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + this.formattedPodPhotos.length) % this.formattedPodPhotos.length;
    }
    _setupPhotoKeyboardNavigation() {
        const photoSection = angular.element('.pod-photo-section');
        if (photoSection.length) {
            photoSection.off('keydown', this._handleKeydown);
            photoSection.on('keydown', this._handleKeydown);
            photoSection.attr('tabindex', '0');
        }
    }
    openPodViewer(index) {
        this.selectedPhotoIndex = index;
        this.isPodViewerOpen = true;
    }
    closePodViewer() {
        this.isPodViewerOpen = false;
    }
    sendPOD($event) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!((_a = this.internalJob) === null || _a === void 0 ? void 0 : _a.podPhotos))
                return;
            try {
                if (!((_b = this.internalJob) === null || _b === void 0 ? void 0 : _b.podPhoto)) {
                    yield this.$mdDialog.show(this.$mdDialog.alert()
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
                const email = yield this.$mdDialog.show(confirm);
                yield this.DispatchData.sendPOD(this.internalJob.id, email);
                yield this.$mdDialog.show(this.$mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Email Sent')
                    .textContent('POD email has been sent')
                    .ok('OK'));
            }
            catch (error) {
                this._handleError(error);
            }
        });
    }
    _getSelectedStatusText() {
        var _a;
        console.log('getSelectedStatusText() called');
        const defaultText = 'Stage';
        console.log('Current internalJob:', this.internalJob);
        console.log('Current internalStatusList:', this.internalStatusList);
        const selectedStatus = (_a = this.internalStatusList) === null || _a === void 0 ? void 0 : _a.find(status => { var _a; return status.id === ((_a = this.internalJob) === null || _a === void 0 ? void 0 : _a.internalStatusId); });
        console.log('Found selectedStatus:', selectedStatus);
        this.selectedStatusText = selectedStatus ? selectedStatus.text : defaultText;
        console.log('Set selectedStatusText to:', this.selectedStatusText);
    }
    setInternalStatus(internalStatusId, job) {
        return __awaiter(this, void 0, void 0, function* () {
            this.$mdMenu.hide();
            const previousStatusId = job.internalStatusId;
            try {
                yield this.DispatchData.updateJobDetail(job.id, "InternalStatusID", internalStatusId, job.charge, false);
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
            }
            catch (error) {
                console.error("Error updating internal status:", error);
            }
        });
    }
    showPricingBreakdown($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Fetching price breakdown data for job:", job.id);
                const data = yield this.DispatchData.getPriceBreakdown(job.id);
                console.log("Received price breakdown data:", data);
                console.log("Formatting price breakdown");
                const formattedBreakdown = this._formatPriceBreakDown(data);
                console.log("Formatted breakdown:", formattedBreakdown);
                console.log("Showing dialog with formatted breakdown");
                const dialog = this.$mdDialog.alert()
                    .parent(document.body)
                    .clickOutsideToClose(true)
                    .title("Charge Information")
                    .targetEvent($event)
                    .htmlContent(formattedBreakdown)
                    .ariaLabel("price breakdown")
                    .ok("OK");
                yield this.$mdDialog.show(dialog);
                console.log("Dialog closed successfully");
            }
            catch (error) {
                console.error("Error in displayPriceBreakdown:", error);
                this.toastrService.showErrorToast("An error occurred while fetching the price breakdown. Please try again.");
            }
        });
    }
    _formatPriceBreakDown(data) {
        let breakdownString = "";
        let total = 0;
        data.forEach(item => {
            breakdownString += `${item.name}: $${item.amount.toFixed(2)}<br>`;
            total += item.amount;
        });
        breakdownString += `<br>Total: $${total.toFixed(2)}`;
        return breakdownString;
    }
}
JobDetailController.$inject = [
    "$scope",
    "$mdDialog",
    "toastrService",
    "DispatchData",
    "APP_CONFIG",
    "rateJobService",
    "moment",
    "$mdMenu",
    "$timeout",
    "selectDialogService",
    "editDateTimeDialogService"
];
exports.JobDetailComponent = {
    template: require("./job-details.template.html"),
    bindings: {
        job: "=",
        onStatusChange: "&"
    },
    controller: JobDetailController,
    controllerAs: "ctrl"
};
