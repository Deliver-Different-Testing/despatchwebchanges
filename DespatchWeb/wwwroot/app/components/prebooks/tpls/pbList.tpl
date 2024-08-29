<div class="droppable-box" style="min-height:500px">

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th ng-click="orderList('jobList', 'Booked')" scope="col">Booked <i class="fa fa-caret-down"
                                                                                    ng-show="sort.jobList =='booked'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-booked'"></i></th>
                <th ng-click="orderList('jobList', 'speed')" scope="col">Speed <i class="fa fa-caret-down"
                                                                                  ng-show="sort.jobList =='speed'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-speed'"></i></th>
                <th ng-click="orderList('jobList', 'jobNo')" scope="col">Job <i class="fa fa-caret-down"
                                                                                ng-show="sort.jobList =='jobNo'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-jobNo'"></i></th>
                <th ng-click="orderList('jobList', 'client')" scope="col">Client <i class="fa fa-caret-down"
                                                                                    ng-show="sort.jobList =='client'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-client'"></i></th>
                <th ng-click="orderList('jobList', 'from')" scope="col">From <i class="fa fa-caret-down"
                                                                                ng-show="sort.jobList =='from'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-from'"></i></th>
                <th ng-click="orderList('jobList', 'to')" scope="col">To <i class="fa fa-caret-down"
                                                                            ng-show="sort.jobList =='to'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-to'"></i></th>
                <th ng-click="orderList('jobList', 'code')" scope="col">Code <i class="fa fa-caret-down"
                                                                                ng-show="sort.jobList =='code'"></i><i
                        class="fa fa-caret-up" ng-show="sort.jobList =='d-code'"></i></th>
                <th>S</th>
                <th>V</th>


            </tr>
            </thead>
        </table>


    </div>

    <table class="table table-striped table-responsive table-rows" id="jobList" data-group="jobList">
        <thead class="thead-dark no select">

        </thead>
        <tbody>
        <tr class="droppable-row draggable-row clickable-row noselect"
            data-courier="{{job.courier}}" data-jobNo="{{job.jobNo}}"
            data-jobid="{{job.id}}" ng-mouseup="selectJobDetail(job.id);"
            ng-repeat="job in jobList | filter: box.searchBox">
            <td>{{job.booked | date: "hh:mm"}}</td>
            <td> {{job.speed}}</td>
            <td>{{job.jobNo}}</td>
            <td right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td context-menu="setCurrentWorkMenu">
                <div title="{{job.fromAddress}}">{{job.fromAddress}}</div>
            </td>
            <td context-menu="setCurrentWorkMenu">
                <div title="{{job.toAddress}}">{{job.toAddress}}</div>
            </td>
            <td>{{job.courier}}</td>
            <td ng-click="ctrl.sendPrebookJob(job.id);"><i class="material-symbols-outlined job-table-icon">send</i>
                <md-tooltip md-direction="bottom">Send</md-tooltip>

            </td>
            <td ng-click="ctrl.voidPrebookJob(job.id);"><i
                    class="material-symbols-outlined job-table-icon">block</i>
                <md-tooltip md-direction="bottom">Void</md-tooltip>
            </td>

        </tr>
        <tr>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
        </tr>
        </tbody>
        <tfoot>
        <tr>
            <td align="center" colspan="6">
            </td>
        </tr>
        </tfoot>
    </table>


</div>

<div class="loading">
    <div class="text">
        <md-progress-circular md-mode="indeterminate"></md-progress-circular>
        <span class="sr-only">Loading...</span>
    </div>
</div>

<script>
    angular.element(".box-content").on("scroll", function () {
        const newTop2 = angular.element(this).scrollTop();
        angular.element(this).find(".box-calculator").css({"top": newTop2});
    });
</script>
