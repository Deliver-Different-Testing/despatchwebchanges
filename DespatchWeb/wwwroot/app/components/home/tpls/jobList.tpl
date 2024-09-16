<div class="table-container">
    <md-table-container>
        <table class="md-table" md-progress="promise" md-row-select md-table multiple ng-model="selected">
            <thead md-head md-on-reorder="ctrl.onReorder" md-order="ctrl.query.order">
            <tr md-row>
                <th class="md-date-cell" md-column md-order-by="time"><span>T</span></th>
                <th class="md-speed-cell" md-column md-order-by="speed"><span>Speed</span></th>
                <th md-column md-order-by="notify"><span>N</span></th>
                <th md-column md-order-by="vehicle"><span>V</span></th>
                <th class="md-job-cell" md-column md-order-by="jobNo"><span>Job</span></th>
                <th class="md-client-cell" md-column md-order-by="client"><span>Client</span></th>
                <th class="md-address-cell" md-column md-order-by="from"><span>From</span></th>
                <th class="md-address-cell" colspan="2" md-column md-order-by="to"><span>To</span></th>
                <th class="md-code-cell" md-column><span>Code</span></th>
                <th md-column md-order-by="remain"><span>Remain</span></th>
                <th class="md-speed-cell" md-column md-order-by="status"><span>S</span></th>
                <th class="md-speed-cell" md-column><span>LP</span></th>
                <th class="md-speed-cell" md-column><span>LD</span></th>
                <th class="md-speed-cell" md-column><span>R</span></th>
                <th class="md-speed-cell" md-column><span>RD</span></th>
            </tr>
            </thead>
            <tbody md-body>
            <tr data-courier="{{job.courier}}" data-index="{{$index}}" data-jobid="{{job.id}}" data-jobno="{{job.jobNo}}"
                md-row md-select="job" md-select-id="id"
                ng-click="handleRowClick($event, job)"
                ng-repeat="job in jobList | filter: query.filter">
                <td class="md-date-cell" md-cell>{{job.time | date: 'HH:mm'}}</td>
                <td class="md-speed-cell" md-cell>{{job.speed}}</td>
                <td md-cell>{{job.notify}}</td>
                <td md-cell>{{jobTableService.attention(job)}}</td>
                <td class="md-job-cell" md-cell>
                    <span ng-click="setEventsMenu($event)">{{job.jobNo}}</span>
                </td>
                <td class="md-client-cell" md-cell>
                <span class="client-box" ng-click="clientColumnClick($event, job)"
                      ng-style="jobTableService.getClientBoxStyle(job)">{{job.client}}</span>
                </td>
                <td class="md-address-cell" md-cell>
                    {{job.pickupAddress.addressLine5}}
                    <md-icon md-font-set="material-symbols-outlined" ng-if="!job.pickupAddress.longitude">warning
                    </md-icon>
                </td>
                <td class="md-address-cell" colspan="2" md-cell>
                    {{job.deliveryAddress.fullAddress}}
                    <md-icon md-font-set="material-symbols-outlined" ng-if="!job.deliveryAddress.longitude">warning
                    </md-icon>
                </td>
                <td class="md-code-cell" md-cell
                    ng-click="jobTableService.editField($event, job, 'courier', 'Courier Code')">
                    {{job.courier}}
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
</div>

<md-table-pagination md-limit="query.limit" md-limit-options="[5, 10, 15]"
                     md-on-paginate="onPaginate" md-page="query.page"
                     md-page-select md-total="{{jobList.length}}"></md-table-pagination>

<style>
    .table-container {
        width: 100%;
        overflow-x: auto;
        white-space: nowrap;
    }

    .md-table {
        min-width: 100%;
        table-layout: fixed;
    }

    .md-table th, .md-table td {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Adjust these widths based on your needs */
    .md-table .md-date-cell {
        width: 80px;
    }

    .md-table .md-speed-cell {
        width: 80px;
    }

    .md-table .md-job-cell {
        width: 100px;
    }

    .md-table .md-client-cell {
        width: 120px;
    }

    .md-table .md-address-cell {
        width: 200px;
    }

    .md-table .md-code-cell {
        width: 100px;
    }

    .md-table .md-status-cell {
        width: 80px;
    }
</style>
