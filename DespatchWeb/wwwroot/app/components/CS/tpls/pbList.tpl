<div class="droppable-box" style="min-height:500px">
    <md-table-container>
        <table md-progress="preBookPromise" md-row-select md-table ng-model="selectedPreBookJobs">
            <thead md-head md-order="preBookQuery.order">
            <tr md-row>
                <th class="md-date-cell" md-column md-order-by="booked"><span>Booked</span></th>
                <th class="md-speed-cell" md-column md-order-by="speed"><span>Speed</span></th>
                <th class="md-job-cell" md-column md-order-by="jobNo"><span>Job</span></th>
                <th class="md-client-cell" md-column md-order-by="client"><span>Client</span></th>
                <th class="md-address-cell" md-column md-order-by="fromAddress"><span>From</span></th>
                <th class="md-address-cell" md-column md-order-by="toAddress"><span>To</span></th>
                <th class="md-code-cell" md-column md-order-by="courier"><span>Code</span></th>
                <th class="md-speed-cell" md-column><span>S</span></th>
                <th class="md-speed-cell" md-column><span>V</span></th>
            </tr>
            </thead>
            <tbody md-body>
            <tr md-row md-select="job" md-select-id="id" ng-mouseup="selectPreBookDetail(job.id)"
                ng-repeat="job in pbList | orderBy: preBookQuery.order">
                <td class="md-date-cell" md-cell>{{job.booked | date: "HH:mm"}}</td>
                <td class="md-speed-cell" md-cell>{{job.speed}}</td>
                <td class="md-job-cell" md-cell>{{job.jobNo}}</td>
                <td class="md-client-cell" md-cell>{{job.client}}</td>
                <td class="md-address-cell" md-cell>
                    {{job.fromAddress}}
                </td>
                <td class="md-address-cell" md-cell>
                    {{job.toAddress}}
                </td>
                <td class="md-code-cell" md-cell>{{job.courier}}</td>
                <td class="md-speed-cell" md-cell>
                    <md-button class="md-icon-button" ng-click="sendPrebookJob(job.id)"
                               title="Send">
                        <md-tooltip md-direction="bottom">Send</md-tooltip>
                        <md-icon md-font-set="material-symbols-outlined">send</md-icon>
                    </md-button>
                </td>
                <td class="md-speed-cell" md-cell>
                    <md-button class="md-icon-button" ng-click="voidPrebookJob(job.id)"
                               title="Void">
                        <md-tooltip md-direction="bottom">Delete</md-tooltip>
                        <md-icon md-font-set="material-symbols-outlined">delete</md-icon>
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
