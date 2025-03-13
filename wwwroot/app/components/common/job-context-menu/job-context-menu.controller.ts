import app from "../../../app";
import {Job, Suggestion} from "../../../interfaces/job.interface";
import {ContactID, FirstName} from "../../../contants";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {IContextMenuScope, MenuState} from "./job-context-menu.interfaces";
import {EventGroupDialogService} from "../../dialogs/event-group-dialog/event-group-dialog.service";
import "./job-context-menu.styles.less";

class ContextMenuController implements angular.IController {
    static $inject = [
        "$scope",
        "$document",
        "$mdDialog",
        "$mdMenu",
        "toastrService",
        "DispatchData",
        "eventGroupDialogService",
        "$timeout"
    ];

    private menuState: MenuState = {
        visible: false,
        position: {top: 0, left: 0},
        currentJob: null,
        eventGroups: []
    };

    constructor(
        private $scope: IContextMenuScope,
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        public $mdMenu: angular.material.IMenuService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private eventGroupDialogService: EventGroupDialogService,
        private $timeout: angular.ITimeoutService
    ) {
        this.bindFunctions();
        this.initEventGroups();
        this.setupDocumentClickHandler();
    }

    private bindFunctions() {
        // Lifecycle hooks
        this.$onInit = this.$onInit.bind(this);
        this.$onDestroy = this.$onDestroy.bind(this);

        // Setup and initialization
        this.setupDocumentClickHandler = this.setupDocumentClickHandler.bind(this);
        this.initEventGroups = this.initEventGroups.bind(this);

        // Menu functions
        this.showJobContextMenu = this.showJobContextMenu.bind(this);
        this.hideMenu = this.hideMenu.bind(this);

        // Action functions
        this.voidJobAction = this.voidJobAction.bind(this);
        this.addEventOtherAction = this.addEventOtherAction.bind(this);
        this.selectEventGroup = this.selectEventGroup.bind(this);
        this.splitJobAction = this.splitJobAction.bind(this);
        this.setFirstJobAction = this.setFirstJobAction.bind(this);

        // Callback functions
        this.onRefresh = this.onRefresh.bind(this);
        this.onSplitJob = this.onSplitJob.bind(this);
        this.onRefreshCourierJobs = this.onRefreshCourierJobs.bind(this);
    }

    // Lifecycle hooks
    $onInit() {
        console.log('Context menu initialized');
    }

    $onDestroy() {
        // Clean up document click handler
        this.$document.off('click', this.hideMenu);
    }

    private setupDocumentClickHandler() {
        this.$document.on('click', this.hideMenu);
    }

    private initEventGroups() {
        this.DispatchData.getEventGroups()
            .then((groups: Suggestion[]) => {
                this.menuState.eventGroups = groups;
                console.log('Loaded event groups:', groups.length);
            })
            .catch((error: Error) => {
                console.error('Failed to load event groups:', error);
            });
    }

    // Show the context menu at the given position
    showJobContextMenu($event: MouseEvent, job: Job) {
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

    hideMenu = (): void => {
        if (this.menuState.visible) {
            this.$timeout(() => {
                this.menuState.visible = false;
                this.$scope.$apply();
            });
        }
    }

    voidJobAction() {
        if (!this.menuState.currentJob) return;

        this.$mdDialog.show(
            this.$mdDialog
                .prompt()
                .title("Void Job")
                .textContent("Add Note")
                .placeholder("Note")
                .ariaLabel("Void job")
                .required(true)
                .ok("Void")
                .cancel("Cancel")
        )
            .then((note: string) => {
                const job = this.menuState.currentJob;
                if (!job) return;

                return this.DispatchData.addNote(job.id, note, FirstName, false);
            })
            .then(() => {
                const job = this.menuState.currentJob;
                if (!job) return;

                return this.DispatchData.voidJob(job.id);
            })
            .then(() => {
                this.toastrService.showSuccessToast("Job voided successfully");
                this.onRefresh();
            })
            .catch((error: any) => {
                if (error) {
                    console.error("Job void error:", error);
                }
            });

        this.hideMenu();
    }

    addEventOtherAction($event: MouseEvent) {
        if (!this.menuState.currentJob) return;

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
                dispatcherName: FirstName,
                contactId: ContactID,
            },
            bindToController: true,
        });

        this.hideMenu();
    }

    selectEventGroup(eventGroupId: number) {
        if (!this.menuState.currentJob) return;

        this.eventGroupDialogService.openEventGroupDialog(
            eventGroupId,
            this.menuState.currentJob.id
        )
            .then(() => {
                this.onRefresh();
            })
            .catch((error: any) => {
                if (error) {
                    console.error("Error in event group dialog:", error);
                }
            });

        this.hideMenu();
    }

    splitJobAction($event: MouseEvent) {
        if (!this.menuState.currentJob) return;
        const job = this.menuState.currentJob;

        if (!job.allowSplit) {
            this.$mdDialog.show(
                this.$mdDialog
                    .alert()
                    .parent(document.body)
                    .clickOutsideToClose(true)
                    .title("Unable to split job")
                    .textContent(`Can not split ${job.jobNo}.`)
                    .ariaLabel("Alert")
                    .ok("OK")
            );
            this.hideMenu();
            return;
        }

        this.$mdDialog.show(
            this.$mdDialog
                .confirm()
                .title("Split Job?")
                .textContent("Are you sure you wish to split this job?")
                .ariaLabel("Confirm")
                .targetEvent($event)
                .ok("Yes")
                .cancel("No")
        )
            .then(() => {
                return this.DispatchData.splitJob(job.id, FirstName);
            })
            .then(() => {
                this.onSplitJob({job: this.menuState.currentJob});
            })
            .catch((error: any) => {
                if (error) {
                    console.error("Splitting job failed:", error);
                }
            });

        this.hideMenu();
    }

    setFirstJobAction() {
        if (!this.menuState.currentJob) return;
        const job = this.menuState.currentJob;

        this.$mdDialog.show(
            this.$mdDialog
                .confirm()
                .title("Set First Job?")
                .textContent("Are you sure you wish to set this as the First Job?")
                .ok("Yes")
                .cancel("No")
        )
            .then(() => {
                if (job.courierData && job.courierData.courierId) {
                    return this.DispatchData.setFirstJob(job.id, job.courierData.courierId);
                } else {
                    throw new Error("Missing courier data for job");
                }
            })
            .then(() => {
                this.toastrService.showSuccessToast("Job set as first job successfully");

                if (job.courierData && job.courierData.courierId) {
                    this.onRefreshCourierJobs({courierId: job.courierData.courierId});
                }
            })
            .catch((error: any) => {
                if (error) {
                    console.error("Action cancelled or error occurred:", error);
                }
            });

        this.hideMenu();
    }

    // Callback functions to parent
    private onRefresh() {
        if (this.$scope.onRefresh) {
            this.$scope.onRefresh();
        }
    }

    private onSplitJob(params: { job: Job | null }) {
        if (this.$scope.onSplitJob && params.job) {
            this.$scope.onSplitJob({job: params.job});
        }
    }

    private onRefreshCourierJobs(params: { courierId: number }) {
        if (this.$scope.onRefreshCourierJobs) {
            this.$scope.onRefreshCourierJobs({courierId: params.courierId});
        }
    }
}

class ContextMenuDirective implements angular.IDirective {
    restrict: 'E';
    template: string;
    scope: any;
    controller: any;
    controllerAs: string;
    bindToController: boolean;

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

    static factory(): angular.IDirectiveFactory {
        return () => new ContextMenuDirective();
    }
}

// Register directives
app.directive("contextMenu", ContextMenuDirective.factory());
