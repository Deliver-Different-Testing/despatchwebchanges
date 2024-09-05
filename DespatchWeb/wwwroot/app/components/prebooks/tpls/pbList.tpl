<div class="droppable-box" style="min-height:500px">
    <md-table-container>
        <table md-progress="promise" md-row-select md-table ng-model="selected">
            <thead md-head md-order="jobQuery.order">
            <tr md-row>
                <th md-column md-order-by="booked">Booked</th>
                <th md-column md-order-by="speed">Speed</th>
                <th md-column md-order-by="jobNo">Job</th>
                <th md-column md-order-by="client">Client</th>
                <th md-column md-order-by="from">From</th>
                <th md-column md-order-by="to">To</th>
                <th md-column md-order-by="code">Code</th>
                <th md-column>S</th>
                <th md-column>V</th>
            </tr>
            </thead>
            <tbody md-body>
            <tr data-courier="{{job.courier}}" data-jobNo="{{job.jobNo}}" data-jobid="{{job.id}}"
                md-row md-select="job"
                md-select-id="id" ng-click="selectJobDetail(job.id);"
                ng-repeat="job in pagedData">
                <td md-cell md-truncate>{{job.booked | date: "hh:mm"}}</td>
                <td md-cell md-truncate>{{job.speed}}</td>
                <td md-cell md-truncate>{{job.jobNo}}</td>
                <td action="clientColumnClick(event)" md-cell right-click>{{job.client}}</td>
                <td context-menu="setCurrentWorkMenu" md-cell>
                    <div title="{{job.fromAddress}}">{{job.fromAddress}}</div>
                </td>
                <td context-menu="setCurrentWorkMenu" md-cell>
                    <div title="{{job.toAddress}}">{{job.toAddress}}</div>
                </td>
                <td md-cell md-truncate>{{job.courier}}</td>
                <td md-cell md-truncate ng-click="sendPrebookJob(job.id);">
                    <md-icon class="material-symbols-outlined">send</md-icon>
                    <md-tooltip md-direction="bottom">Send</md-tooltip>
                </td>
                <td md-cell md-truncate ng-click="voidPrebookJob(job.id);">
                    <md-icon class="material-symbols-outlined">block</md-icon>
                    <md-tooltip md-direction="bottom">Void</md-tooltip>
                </td>
            </tr>
            </tbody>
        </table>
    </md-table-container>
</div>
