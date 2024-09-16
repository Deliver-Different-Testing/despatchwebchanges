<div id="clearLists">
    <div class="container-fluid">
        <div class="row">
            <div class="col-xs-3" ng-repeat="column in clearLists.columns">
                <div class="clearLists-list" ng-repeat="area in column.areas"
                     ng-style="{'height': area.percentHeight + '%'}">
                    <div class="clearLists-list-title" ng-click="selectClearList(area.id, $event, area.name);">
                        {{area.name}} {{area.totalRemaining}}
                    </div>
                    <div class="clearLists-list-items">
                        <table>
                            <tr class="clearLists-list-items-item"
                                data-courier="{{courier.courierNumber}}"
                                ng-class="{'clearLists-list-items-top': $first, 'clearLists-list-items-middle': !$first && !$last, 'clearLists-list-items-bottom': $last}"
                                ng-click="selectCourier(courier.courierData)"
                                ng-if="(courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only')"
                                ng-repeat="courier in area.couriers">
                                <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                                <td>
                                    <div class="clearLists-list-items-item-dest"
                                         ng-repeat="destination in courier.destinations">
                                        {{destination.label}}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="loading">
        <div class="text">
            <md-progress-circular md-mode="indeterminate"></md-progress-circular>
            <span class="sr-only">Loading...</span>
        </div>
    </div>
</div>
