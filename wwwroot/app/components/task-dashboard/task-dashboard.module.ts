import TaskDashboardComponent from "./task-dashboard.controller";
import TaskCalendarViewComponent from "./task-calendar-view/task-calendar-view.component";

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

taskDashboardModule
    .component("taskDashboardComponent", TaskDashboardComponent)
    .component("taskCalendarViewComponent", TaskCalendarViewComponent);

export default taskDashboardModule;