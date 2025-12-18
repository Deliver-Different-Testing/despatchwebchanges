import TaskDashboardComponent from "./task-dashboard.controller";
import TaskCalendarViewComponent from "./task-calendar-view/task-calendar-view.component";
import TasksService from "../../services/tasks.service";
import {TaskHistoryComponent} from "../common/task-history/task-history.component";

const taskDashboardModule = angular.module('uDispatch.taskDashboard', [
    'ngMap',
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table',
    'ui.sortable',
    'angularResizable',
    'ui.bootstrap.contextMenu'
]);

// Components
taskDashboardModule
    .component("taskDashboardComponent", TaskDashboardComponent)
    .component("taskCalendarView", TaskCalendarViewComponent)
    .component("taskHistory", TaskHistoryComponent);

// Services
taskDashboardModule
    .service("tasksService", TasksService);

export default taskDashboardModule;