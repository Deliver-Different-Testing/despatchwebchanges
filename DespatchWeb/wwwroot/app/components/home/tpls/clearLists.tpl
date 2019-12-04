<div id="clearLists">
<div ng-show="!areaListCity" class="container-fluid ">
    <div class="row">
        <div class="col-xs-3">
            <div class="clearLists-list" height="{{clearLists.central.percentHeight}}%" >
                <div class="clearLists-list-title" ng-click="selectClearList(1, $event, 'central');">Central</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.central.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.central.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.central.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.other.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(8, $event, 'other');">Other</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.other.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.other.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.other.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(6, $event, 'west mid');">West Mid</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.westMid.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.shallowWest.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(9, $event, 'shallow west');">Shallow West</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.shallowWest.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" height="{{clearLists.deepWest.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(5, $event, 'deep west');">Deep West</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepWest.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(16, $event, 'east mid');">East Mid</div>
                <div class="clearLists-list-items">
                    <table data-group="clear">
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.eastMid.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" height="{{clearLists.shallowShore.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(7, $event, 'shallow shore');">Shallow Shore</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.shallowShore.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" height="{{clearLists.deepShore.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(18, $event, 'deep shore');">Deep Shore</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepShore.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(17, $event, 'mangere');">Mangere</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.mangere.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.deepSouth.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(4, $event, 'deep south');">Deep South</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepSouth.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.deepEast.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(3, $event, 'deep east');">Deep East</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.deepEast.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title"  ng-click="selectClearList(2, $event, 'city');">City</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.city.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.city.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.city.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(12, $event, 'parnell');">Parnell</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.parnell.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(13, $event, 'newmarket');">NewMarket</div>
                <div class="clearLists-list-items">
                    <table data-group="clear">
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.newMarket.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
                <div class="clearLists-list-title" ng-click="selectClearList(15, $event, 'ponsonby');">Ponsonby</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.ponsonby.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" height="{{clearLists.eden.percentHeight}}%">
                <div class="clearLists-list-title" ng-click="selectClearList(14, $event, 'eden terrace');">Eden Terrace</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.eden.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.eden.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.eden.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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