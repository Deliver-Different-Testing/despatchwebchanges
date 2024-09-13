<md-table-container>
    <table class="md-table" md-progress="promise" md-row-select md-table multiple ng-model="selected">
        <thead md-head md-on-reorder="onReorder" md-order="query.order">
        <!-- ... (header remains the same) ... -->
        </thead>
        <tbody md-body>
        <tr md-row md-select="job" md-select-id="id" ng-repeat="job in jobList | filter: query.filter">
            <td class="md-date-cell" md-cell>{{job.time | date: 'HH:mm'}}</td>
            <td class="md-speed-cell" md-cell ng-click="jobTableService.editField($event, job, 'speed', 'Set speed')">
                <span ng-class="{'md-placeholder': !job.speed}">{{job.speed || 'Set speed'}}</span>
            </td>
            <td md-cell ng-click="jobTableService.editField($event, job, 'notify', 'Set notify')">
                <span ng-class="{'md-placeholder': !job.notify}">{{job.notify || 'Set notify'}}</span>
            </td>
            <td md-cell>
                {{jobTableService.attention(job)}}
            </td>
            <td class="md-job-cell" md-cell>
                <span ng-click="setEventsMenu($event)">{{job.jobNo}}</span>
            </td>
            <td class="md-client-cell" md-cell>
                <span class="client-box" ng-click="clientColumnClick($event, job)"
                      ng-style="jobTableService.getClientBoxStyle(job)">{{job.client}}</span>
            </td>
            <td class="md-address-cell" md-cell ng-click="jobTableService.editField($event, job, 'from', 'Set from')">
                <span ng-class="{'md-placeholder': !job.from}">
                    {{job.from || 'Set from'}}
                    <md-icon md-font-set="material-symbols-outlined" ng-if="!job.pickUpLongitude">warning</md-icon>
                </span>
            </td>
            <td class="md-address-cell" colspan="2" md-cell ng-click="jobTableService.editTo($event, job)">
                <span ng-class="{'md-placeholder': !job.to}">
                    {{job.to}} {{job.toAddress || 'Set to'}}
                    <md-icon md-font-set="material-symbols-outlined" ng-if="!job.deliveryLongitude">warning</md-icon>
                </span>
            </td>
            <td class="md-code-cell" md-cell ng-click="jobTableService.editField($event, job, 'courier', 'Set code')">
                <span ng-class="{'md-placeholder': !job.courier}">{{job.courier || 'Set code'}}</span>
            </td>
            <td md-cell ng-class="{'highlight': job.remain < 0}">
                {{job.remain}}
            </td>
            <td class="md-status-cell" md-cell>
                <span ng-class="job.status">{{job.status}}</span>
            </td>
            <td md-cell ng-click="jobTableService.editField($event, job, 'lp', 'LP', 'number')">
                <span ng-class="{'md-placeholder': !job.lp}">{{job.lp || 'LP'}}</span>
            </td>
            <td md-cell ng-click="jobTableService.editField($event, job, 'ld', 'LD', 'number')">
                <span ng-class="{'md-placeholder': !job.ld}">{{job.ld || 'LD'}}</span>
            </td>
            <td md-cell>
                <md-button class="md-icon-button" ng-click="restoreJobs()" ng-if="job.courier !== null">
                    <md-icon md-font-set="material-symbols-outlined">undo</md-icon>
                </md-button>
            </td>
            <td md-cell>
                <md-button class="md-icon-button" ng-click="reAllocateJobs()" ng-if="job.courier !== null">
                    <md-icon md-font-set="material-symbols-outlined">repeat</md-icon>
                </md-button>
            </td>
        </tr>
        </tbody>
    </table>
</md-table-container>

<md-table-pagination md-limit="query.limit" md-limit-options="[5, 10, 15]"
                     md-on-paginate="onPaginate" md-page="query.page"
                     md-page-select md-total="{{jobList.length}}"></md-table-pagination>
