<div class="droppable-box" style="min-height:500px">
    <md-table-container>
        <table md-progress="preBookPromise" md-row-select md-table ng-model="selectedPreBookJobs">
            <thead md-head md-order="preBookQuery.order">
            <tr md-row>
                <th md-column md-order-by="booked"><span>Booked</span></th>
                <th md-column md-order-by="speed"><span>Speed</span></th>
                <th md-column md-order-by="jobNo"><span>Job</span></th>
                <th md-column md-order-by="client"><span>Client</span></th>
                <th md-column md-order-by="fromAddress"><span>From</span></th>
                <th md-column md-order-by="toAddress"><span>To</span></th>
                <th md-column md-order-by="courier"><span>Code</span></th>
                <th md-column><span>S</span></th>
                <th md-column><span>V</span></th>
            </tr>
            </thead>
            <tbody md-body>
            <tr md-row md-select="job" md-select-id="id" ng-mouseup="selectPreBookDetail(job.id)"
                ng-repeat="job in pbList | orderBy: preBookQuery.order">
                <td md-cell>{{job.booked | date: "HH:mm"}}</td>
                <td md-cell>{{job.speed}}</td>
                <td md-cell>{{job.jobNo}}</td>
                <td md-cell ng-click="clientColumnClick($event); $event.stopPropagation();">{{job.client}}</td>
                <td md-cell>
                    <div ng-click="setCurrentWorkMenu($event); $event.stopPropagation();" title="{{job.fromAddress}}">
                        {{job.fromAddress}}
                    </div>
                </td>
                <td md-cell>
                    <div ng-click="setCurrentWorkMenu($event); $event.stopPropagation();" title="{{job.toAddress}}">
                        {{job.toAddress}}
                    </div>
                </td>
                <td md-cell>{{job.courier}}</td>
                <td md-cell>
                    <md-button class="md-icon-button" ng-click="sendPrebookJob(job.id); $event.stopPropagation();"
                               title="Send">
                        <md-icon md-font-set="material-icons">send</md-icon>
                    </md-button>
                </td>
                <td md-cell>
                    <md-button class="md-icon-button" ng-click="voidPrebookJob(job.id); $event.stopPropagation();"
                               title="Void">
                        <md-icon md-font-set="material-icons">delete</md-icon>
                    </md-button>
                </td>
            </tr>
            </tbody>
        </table>
    </md-table-container>

    <md-table-pagination
            md-limit="preBookQuery.limit"
            md-limit-options="[5, 10, 25, 50]"
            md-on-paginate="preBookPageChanged"
            md-page="preBookQuery.page"
            md-page-select
            md-total="{{pbTotalCount}}">
    </md-table-pagination>
</div>
