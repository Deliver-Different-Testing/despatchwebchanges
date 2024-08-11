    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th ng-click="orderList('jobList','time')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                          ng-show="sort.jobList == 'time'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-time'">arrow_drop_up</i>T
                </th>
                <th ng-click="orderList('jobList', 'speed')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                            ng-show="sort.jobList == 'speed'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-speed'">arrow_drop_up</i>Speed
                </th>
                <th ng-click="orderList('jobList','notify')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                            ng-show="sort.jobList == 'notify'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-notify'">arrow_drop_up</i>N
                </th>
                <th ng-click="orderList('jobList','vehicle')" scope="col"><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'vehicle'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-vehicle'">arrow_drop_up</i>V
                </th>
                <th ng-click="orderList('jobList','jobNo')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                           ng-show="sort.jobList == 'jobNo'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-jobNo'">arrow_drop_up</i>Job
                </th>
                <th ng-click="orderList('jobList','client')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                            ng-show="sort.jobList == 'client'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-client'">arrow_drop_up</i>Client
                </th>
                <th ng-click="orderList('jobList','from')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                          ng-show="sort.jobList == 'from'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-from'">arrow_drop_up</i>From
                </th>
                <th colspan="2" ng-click="orderList('jobList','to')" scope="col"><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'to'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon" ng-show="sort.jobList == 'd-to'">arrow_drop_up</i>To
                </th>

                <th></th>
                <th ng-click="orderList('jobList','remain')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                            ng-show="sort.jobList == 'remain'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-remain'">arrow_drop_up</i>Remain
                </th>
                <th ng-click="orderList('jobList','status')" scope="col"><i class="material-symbols-outlined small-icon"
                                                                            ng-show="sort.jobList == 'status'">arrow_drop_down</i><i
                        class="material-symbols-outlined small-icon"
                        ng-show="sort.jobList == 'd-status'">arrow_drop_up</i>S
                </th>
                <th></th>
                <th></th>
                <th>R</th>
                <th>RD</th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table  table-responsive table-rows" id="jobList" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" data-allowDispatch="{{job.allowDispatch}}"
            data-courier="{{job.courier}}" data-index="{{$index}}" data-jobid="{{job.id}}"
            data-jobno="{{job.jobNo}}" ng-class="jobClass(job)"
            ng-mouseup="job.courier == null ? selectJob(job): selectJob(job)"
            ng-repeat="job in jobList | filter: box.searchBox">
            <td>{{job.time | date: "HH:mm"}}</td>
            <td action="ctrl.speedColumnClick($event, job)" right-click>{{job.speed}}</td>
            <td action="ctrl.notifyColumnClick($event, job)" ng-if="job.courierData.courierID === null" right-click>
                {{job.notify}}
            </td>
            <td ng-if="job.courierData.courierID !== null">{{job.notify}}</td>
            <td>
                <div style="width:25px; white-space:nowrap; overflow-x:hidden;" title="{{attention(job)}}">
                    {{attention(job)}}
                </div>
            </td>
            <td context-menu="setEventsMenu">{{job.jobNo}}</td>
            <td action="ctrl.clientColumnClick($event, job)" right-click>{{job.client}}</td>
            <td action="ctrl.fromColumnClick(event, job)" right-click
                style="width:50px; white-space:nowrap; overflow-x:hidden;">
                {{job.from}} <i class="material-symbols-outlined small-icon"
                                ng-if="!job.pickUpLongitude">exclamation</i></td>
            <td colspan="2" title="{{job.toAddress}}">
                <div action="ctrl.toColumnClick($event, job)" right-click
                     style="width:450px; white-space:nowrap; overflow-x:hidden;"
                     title="{{job.toAddress}}"><i class="material-symbols-outlined small-icon"
                                                  ng-if="!job.deliveryLongitude">exclamation</i>{{job.to}}
                    {{job.toAddress}}
                </div>
            </td>
            <!--<td><div style="width:280px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}">{{job.toAddress}}</div></td>	-->
            <td><input class="dispatchField" ng-keydown="$event.keyCode === 13 && ctrl.dispatchJobs(job.courier, job)"
                       ng-model="job.courier"
                       ng-readonly="job.courierData.courierID !== null"
                       ng-style="getJobStyle(job.courierData.courierID !== null)"
                       placeholder="" type="text"/></td>
            <td><span ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
            <td><input type="text" /*right-click action="latePickColumnClick(event)"*/ class="lateCallField"
                ng-focus="selectAllContent($event)" ng-mouseup="$event.preventDefault();" ng-model="job.lp"
                ng-keydown="$event.keyCode === 13 && latePickup(job.lp, job, $this)" placeholder="LP" />
            </td>
            <td><input class="lateCallField" ng-focus="ctrl.selectAllContent($event)" ng-keydown="$event.keyCode === 13 && ctrl.lateDelivery(job.ld, job, this)"
                       ng-model="job.ld" ng-mouseup="$event.preventDefault();"
                       placeholder="LD" type="text"/>
            </td>
            <td class="selectjob" ng-click="ctrl.selectForDispatch(job); $event.stopPropagation();"
                style="display:none"
                title="placeholder selector"></td>
            <td ng-click="job.courier == null || ctrl.restoreJobs();" title="Restore">
                <i class="material-symbols-outlined small-icon" ng-if="job.courier !== null">undo</i></td>
            <td ng-click="job.courier == null || ctrl.reAllocateJobs();" title="ReDispatch">
                <i class="material-symbols-outlined small-icon" ng-if="job.courier !== null">repeat</i></td>

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
            <td colspan="2">
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div style="width:12px;"></div>
            </td>
            <td>
                <div style="width:12px;"></div>
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
    </table>


    <div class="loading">
        <div class="text">
            <md-progress-circular md-mode="indeterminate"></md-progress-circular>
            <span class="sr-only">Loading...</span>
        </div>
    </div>

<script>
    angular.element(".box-content").on("scroll", function () {
        const newTop = angular.element(this).scrollTop();
        angular.element(this).find(".table-headings").css({"top": newTop});
    });
</script>
