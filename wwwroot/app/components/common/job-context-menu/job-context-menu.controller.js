"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextMenuDirective = void 0;
const contants_1 = require("../../../contants");
require("./job-context-menu.styles.less");
const bindAllMethods_1 = require("../../../bindAllMethods");
class ContextMenuController {
    constructor($scope, $document, $mdDialog, $mdMenu, toastrService, DispatchData, eventGroupDialogService, $timeout) {
        this.$scope = $scope;
        this.$document = $document;
        this.$mdDialog = $mdDialog;
        this.$mdMenu = $mdMenu;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.eventGroupDialogService = eventGroupDialogService;
        this.$timeout = $timeout;
        this.menuState = {
            visible: false,
            position: { top: 0, left: 0 },
            currentJob: null,
            eventGroups: []
        };
        this.hideMenu = () => {
            if (this.menuState.visible) {
                this.$timeout(() => {
                    this.menuState.visible = false;
                    this.$scope.$apply();
                });
            }
        };
        bindAllMethods_1.bindAllMethods(this);
        this.initEventGroups();
        this.setupDocumentClickHandler();
    }
    // Lifecycle hooks
    $onInit() {
        console.log('Context menu initialized');
    }
    $onDestroy() {
        // Clean up document click handler
        this.$document.off('click', this.hideMenu);
    }
    setupDocumentClickHandler() {
        this.$document.on('click', this.hideMenu);
    }
    initEventGroups() {
        this.DispatchData.getEventGroups()
            .then((groups) => {
            this.menuState.eventGroups = groups;
            console.log('Loaded event groups:', groups.length);
        })
            .catch((error) => {
            console.error('Failed to load event groups:', error);
        });
    }
    // Show the context menu at the given position
    showJobContextMenu($event, job) {
        $event.preventDefault();
        $event.stopPropagation();
        console.log('Showing context menu for job:', job.id);
        // Store the current job
        this.menuState.currentJob = job;
        // Set position
        this.menuState.position.left = $event.clientX + 'px';
        this.menuState.position.top = $event.clientY + 'px';
        // Show menu
        this.menuState.visible = true;
    }
    voidJobAction() {
        if (!this.menuState.currentJob)
            return;
        this.$mdDialog.show(this.$mdDialog
            .prompt()
            .title("Void Job")
            .textContent("Add Note")
            .placeholder("Note")
            .ariaLabel("Void job")
            .required(true)
            .ok("Void")
            .cancel("Cancel"))
            .then((note) => {
            const job = this.menuState.currentJob;
            if (!job)
                return;
            return this.DispatchData.addNote(job.id, note, contants_1.FirstName, false);
        })
            .then(() => {
            const job = this.menuState.currentJob;
            if (!job)
                return;
            return this.DispatchData.voidJob(job.id);
        })
            .then(() => {
            this.toastrService.showSuccessToast("Job voided successfully");
            this.onRefresh();
        })
            .catch((error) => {
            if (error) {
                console.error("Job void error:", error);
            }
        });
        this.hideMenu();
    }
    addEventOtherAction($event) {
        if (!this.menuState.currentJob)
            return;
        this.$mdDialog.show({
            controller: "AddEventDialogController",
            controllerAs: "ctrl",
            template: require("../../dialogs/add-event-dialog/add-event-dialog.html"),
            parent: document.body,
            targetEvent: $event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                job: this.menuState.currentJob,
                dispatcherName: contants_1.FirstName,
                contactId: contants_1.ContactID,
            },
            bindToController: true,
        });
        this.hideMenu();
    }
    selectEventGroup(eventGroupId) {
        if (!this.menuState.currentJob)
            return;
        this.eventGroupDialogService.openEventGroupDialog(eventGroupId, this.menuState.currentJob.id)
            .then(() => {
            this.onRefresh();
        })
            .catch((error) => {
            if (error) {
                console.error("Error in event group dialog:", error);
            }
        });
        this.hideMenu();
    }
    splitJobAction($event) {
        if (!this.menuState.currentJob)
            return;
        const job = this.menuState.currentJob;
        if (!job.allowSplit) {
            this.$mdDialog.show(this.$mdDialog
                .alert()
                .parent(document.body)
                .clickOutsideToClose(true)
                .title("Unable to split job")
                .textContent(`Can not split ${job.jobNo}.`)
                .ariaLabel("Alert")
                .ok("OK"));
            this.hideMenu();
            return;
        }
        this.$mdDialog.show(this.$mdDialog
            .confirm()
            .title("Split Job?")
            .textContent("Are you sure you wish to split this job?")
            .ariaLabel("Confirm")
            .targetEvent($event)
            .ok("Yes")
            .cancel("No"))
            .then(() => {
            return this.DispatchData.splitJob(job.id, contants_1.FirstName);
        })
            .then(() => {
            this.onSplitJob({ job: this.menuState.currentJob });
        })
            .catch((error) => {
            if (error) {
                console.error("Splitting job failed:", error);
            }
        });
        this.hideMenu();
    }
    setFirstJobAction() {
        if (!this.menuState.currentJob)
            return;
        const job = this.menuState.currentJob;
        this.$mdDialog.show(this.$mdDialog
            .confirm()
            .title("Set First Job?")
            .textContent("Are you sure you wish to set this as the First Job?")
            .ok("Yes")
            .cancel("No"))
            .then(() => {
            if (job.courierData && job.courierData.courierId) {
                return this.DispatchData.setFirstJob(job.id, job.courierData.courierId);
            }
            else {
                throw new Error("Missing courier data for job");
            }
        })
            .then(() => {
            this.toastrService.showSuccessToast("Job set as first job successfully");
            if (job.courierData && job.courierData.courierId) {
                this.onRefreshCourierJobs({ courierId: job.courierData.courierId });
            }
        })
            .catch((error) => {
            if (error) {
                console.error("Action cancelled or error occurred:", error);
            }
        });
        this.hideMenu();
    }
    // Callback functions to parent
    onRefresh() {
        if (this.$scope.onRefresh) {
            this.$scope.onRefresh();
        }
    }
    onSplitJob(params) {
        if (this.$scope.onSplitJob && params.job) {
            this.$scope.onSplitJob({ job: params.job });
        }
    }
    onRefreshCourierJobs(params) {
        if (this.$scope.onRefreshCourierJobs) {
            this.$scope.onRefreshCourierJobs({ courierId: params.courierId });
        }
    }
}
ContextMenuController.$inject = [
    "$scope",
    "$document",
    "$mdDialog",
    "$mdMenu",
    "toastrService",
    "DispatchData",
    "eventGroupDialogService",
    "$timeout"
];
class ContextMenuDirective {
    constructor() {
        this.restrict = 'E';
        this.template = require("./job-context-menu.template.html");
        this.scope = {
            onRefresh: '&',
            onSplitJob: '&',
            onRefreshCourierJobs: '&'
        };
        this.controller = ContextMenuController;
        this.controllerAs = 'ctrl';
        this.bindToController = true;
    }
    static factory() {
        return () => new ContextMenuDirective();
    }
}
exports.ContextMenuDirective = ContextMenuDirective;
