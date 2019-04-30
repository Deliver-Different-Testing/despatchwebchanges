<div id="clearLists">
<div class="container-fluid ">
    <div class="row">
        <div class="col-xs-3">
            <div class="clearLists-list" data-height="{{clearLists.Central.percentHeight}}">
                <div class="clearLists-list-title">Central</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.Central.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.Central.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.Central.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" data-height="{{clearLists.Other.percentHeight}}">
                <div class="clearLists-list-title">Other</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.Other.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.Other.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.Other.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
            <div class="clearLists-list" data-height="{{clearLists.WestMid.percentHeight}}">
                <div class="clearLists-list-title">West Mid</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.WestMid.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.WestMid.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.WestMid.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" data-height="{{clearLists.ShallowWest.percentHeight}}">
                <div class="clearLists-list-title">Shallow West</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowWest.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowWest.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowWest.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="clearLists-list" data-height="{{clearLists.DeepWest.percentHeight}}">
                <div class="clearLists-list-title">Deep West</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.DeepWest.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.DeepWest.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.DeepWest.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
            <div class="clearLists-list" data-height="{{clearLists.EastMid.percentHeight}}">
                <div class="clearLists-list-title">East Mid</div>
                <div class="clearLists-list-items">
                    <table data-group="clear">
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.EastMid.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.EastMid.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.EastMid.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" data-height="{{clearLists.ShallowShore.percentHeight}}">
                <div class="clearLists-list-title">Shallow Shore</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowShore.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowShore.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.ShallowShore.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="clearLists-list" data-height="{{clearLists.DeepShore.percentHeight}}">
                <div class="clearLists-list-title">Deep Shore</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.DeepShore.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.DeepShore.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.DeepShore.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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
            <div class="clearLists-list" data-height="{{clearLists.Mangere.percentHeight}}">
                <div class="clearLists-list-title">Mangere</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.Mangere.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.Mangere.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.Mangere.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" data-height="{{clearLists.DeepSouth.percentHeight}}">
                <div class="clearLists-list-title">Deep South</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.DeepSouth.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.DeepSouth.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.DeepSouth.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="clearLists-list" data-height="{{clearLists.DeepEast.percentHeight}}">
                <div class="clearLists-list-title">Deep East</div>
                <div class="clearLists-list-items">
                    <table>
                        <tr class="clearLists-list-items-item clearLists-list-items-top droppable-row draggable-row" ng-repeat="courier in clearLists.DeepEast.top" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-middle droppable-row draggable-row" ng-repeat="courier in clearLists.DeepEast.middle" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
                            <td class="clearLists-list-items-item-number">{{courier.courierNumber}}</td>
                            <td>
                                <div class="clearLists-list-items-item-dest" ng-repeat="destination in courier.destinations">{{destination.label}}</div>
                            </td>
                        </tr>
                        <tr class="clearLists-list-items-item clearLists-list-items-bottom droppable-row draggable-row" ng-repeat="courier in clearLists.DeepEast.bottom" data-courier="{{courier.courierNumber}}" ng-click="selectCourier(courier.courierData)">
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