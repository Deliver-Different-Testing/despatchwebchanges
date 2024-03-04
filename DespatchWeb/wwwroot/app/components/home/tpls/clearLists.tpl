<div id="clearLists">
<div ng-show="!areaListCity" class="container-fluid ">
    <div class="row">
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.central.percentHeight}}%" >
                <div class="clearLists-list-title" ng-click="selectClearList(1, $event, 'central');">Central {{clearLists.central.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.central.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.central.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.central.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.other.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(8, $event, 'other');">Other {{clearLists.other.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.other.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.other.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.other.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.westMid.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(6, $event, 'west mid');">West Mid {{clearLists.westMid.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.shallowWest.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(9, $event, 'shallow west');">Shallow West {{clearLists.shallowWest.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.deepWest.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(5, $event, 'deep west');">Deep West {{clearLists.deepWest.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.eastMid.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(16, $event, 'east mid');">East Mid {{clearLists.eastMid.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table data-group="clear">
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))"data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" height="{{clearLists.shallowShore.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(7, $event, 'shallow shore');">Shallow Shore {{clearLists.shallowShore.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" height="{{clearLists.deepShore.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(18, $event, 'deep shore');">Deep Shore {{clearLists.deepShore.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div> 
            
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.mangere.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(17, $event, 'mangere');">Mangere {{clearLists.mangere.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.deepSouth.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(4, $event, 'deep south');">Deep South {{clearLists.deepSouth.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.deepEast.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(3, $event, 'deep east');">Deep East {{clearLists.deepEast.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

        </div>
    </div>
</div>

<div ng-show="areaListCity" class="container-fluid ">
    <div class="row">
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.city.percentHeight}}%" >
                <div class="clearLists-list-title"  ng-click="selectClearList(2, $event, 'city');">City {{clearLists.city.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.city.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" ng-repeat="courier in clearLists.city.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.city.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
           
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.parnell.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(12, $event, 'parnell');">Parnell {{clearLists.parnell.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
           
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.newMarket.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(13, $event, 'newmarket');">NewMarket {{clearLists.newMarket.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table data-group="clear">
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

           
            
        </div>
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.ponsonby.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(15, $event, 'ponsonby');">Ponsonby {{clearLists.ponsonby.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.eden.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(14, $event, 'eden terrace');">Eden Terrace {{clearLists.eden.totalRemaining}}</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.eden.top" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.eden.middle" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.eden.bottom" ng-if="((courier.courierNumber.indexOf('T') >= 0 && (truckMode=='On' || truckMode=='Only')) || (courier.courierNumber.indexOf('T') < 0 && truckMode !== 'Only'))" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
          

        </div>
    </div>
</div>

<div class="loading" style="display:none">
    <div class="text">
        <i class="fa fa-refresh fa-spin fa-3x fa-fw"></i>
        <span class="sr-only">Loading...</span>
    </div>
</div>
</div>