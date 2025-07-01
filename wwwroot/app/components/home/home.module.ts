import HomeComponent from "./home.controller";
import JobsListComponent from "../common/job-list/job-list.component";
import TasksService from "../../services/tasks.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import InterCourierChargeDialogController
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.controller";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {TaskItemComponent} from "../common/task-item-component/task-item.component";
import {
    FeatureInDevelopmentDialogService
} from "../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";

const homeModule = angular.module('uDispatch.home', [
    'ngMap',
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'ngSanitize',
    'md.data.table',
    'ui.sortable',
    'ui.bootstrap',
    'ui.bootstrap.pagination',
    'ui.bootstrap.contextMenu',
    'cfp.hotkeys',
    'angularResizable',
    'ng-mfb',
    'ngFileUpload',
    'hereMapTracking.services',
    'hereMapTracking.components',
    'fixed.table.header',
    'ngMaterialDatePicker'
]);

// Register components
homeModule
    .component("homeComponent", HomeComponent)
    .component("jobsList", JobsListComponent)
    .component("taskItemComponent", TaskItemComponent);

// Register services
homeModule
    .service("tasksService", TasksService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("interCourierChargeDialogService", InterCourierChargeDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService);

homeModule
    .controller("InterCourierChargeDialog", InterCourierChargeDialogController);

export default homeModule;