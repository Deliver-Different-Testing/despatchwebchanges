<md-content class="md-dense" id="jobDetail" ng-if="currentJob">
    <div class="fields">
        <div class="row row-no-padding row-out">
            <div class="col-md-4">
                <div class="row row-no-padding addresses">
                    <div class="col-md-6">
                        <div class="field">
                            <label>Client</label><i class="fa fa-edit"
                                                    ng-click="jdSvc.editDetailField(currentJob, 'ClientCode','Client Code',currentJob.client,currentJob.id)"
                                                    title="Change Client Code"></i>

                            <div class="value"><a class="uline" ng-click="jdSvc.clientClick(currentJob)"
                                                  src="#">{{currentJob.client}}
                                {{currentJob.clientName}}</a></div>
                        </div>
                        <div class="field" context-menu="detailAddressMenu"
                             data-field="fromAddress" ng-class="currentJob.pickUpLongitude ? '' : 'red'"
                             ng-click="jdSvc.updateGPS($event, currentJob, 'fromAddress')">
                            <label>From Address:</label>
                            <div class="value">{{currentJob.fromAddress}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'FromContactName','From Contact Name',currentJob.fromContactName,currentJob.id)">
                            <label>From Contact:</label>
                            <div class="value">{{currentJob.fromContactName}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'FromContactPhone','From Contact Phone',currentJob.fromContactNumber,currentJob.id)">
                            <label>From Phone: </label>
                            <div class="value">{{currentJob.fromContactNumber}}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="field">
                            <label>Job #</label>
                            <div class="value">{{currentJob.jobNo}}</div>
                        </div>

                        <div class="field" context-menu="detailAddressMenu"
                             data-field="toAddress" ng-class="currentJob.deliveryLongitude ? '' : 'red'"
                             ng-click="jdSvc.updateGPS($event, currentJob,'toAddress')">
                            <label>To Address:</label>
                            <div class="value">{{currentJob.toAddress}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="jdSvc.editDetailField(currentJob, 'ToContactName','To Contact Name',currentJob.deliverToContact,currentJob.id)">
                            <label>To Contact</label>
                            <div class="value">{{currentJob.deliverToContact}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'ToContactPhone','To Contact Phone',currentJob.phone,currentJob.id)">
                            <label>To Phone</label>
                            <div class="value">{{currentJob.phone}}</div>
                        </div>
                    </div>
                </div>

                <div class="notes-add"></div>
                <div class="notes field">
                    <label>Notes</label>
                    <md-button class="md-fab md-raised md-mini"
                               ng-click="jdSvc.editDetailField(currentJob, 'Notes','Note','',currentJob.id, 'textarea')"
                               style="float: right;">
                        <md-icon md-font-set="material-symbols-outlined">add_notes</md-icon>
                    </md-button>
                    <div class="value">
                        <pre>{{currentJob.internalNotes}}</pre>
                    </div>
                </div>

            </div>
            <div class="col-md-4">
                <div class="row row-no-padding">
                    <div class="col-md-6">
                        <div class="field" ng-click="jdSvc.contactClick(currentJob)">
                            <label>Booked by Contact</label>
                            <div class="value">{{currentJob.contactName}}</div>
                        </div>
                        <div class="field">
                            <label ng-class="disabled">Logged-in Contact</label>
                            <div class="value" ng-class="disabled">{{currentJob.loggedInContactName}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Size','Size',currentJob.size,currentJob.id, 'select', options.detail.size)">
                            <label>Size</label>
                            <div class="value">{{currentJob.size.label}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Items','Items',currentJob.items,currentJob.id)">
                            <label>Items</label>
                            <div class="value">{{currentJob.items}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Weight','Weight',currentJob.weight,currentJob.id)">
                            <label>Weight</label>
                            <div class="value">{{currentJob.weight}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'RefA','RefA',currentJob.refA,currentJob.id)">
                            <label>Ref A</label>
                            <div class="value">{{currentJob.refA}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'RefB','RefB',currentJob.refB,currentJob.id)">
                            <label>Ref B</label>
                            <div class="value">{{currentJob.refB}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'OurRef','OurRef',currentJob.ourRef,currentJob.id)">
                            <label>Our Ref</label>
                            <div class="value">{{currentJob.ourRef}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'TrackingMethod','Tracking Method',currentJob.trackingMethod,currentJob.id, 'select', options.detail.tracking)">
                            <label>Tracking Method</label>
                            <div class="value">{{jdSvc.getTrackingMethod(currentJob.trackingMethod)}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'TrackingMobile','Tracking Mobile',currentJob.trackingMobile,currentJob.id)">
                            <label>Tracking Mobile</label>
                            <div class="value">{{currentJob.trackingMobile}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'TrackingEmail','Tracking Email',currentJob.trackingEmail,currentJob.id)">
                            <label>Tracing Email</label>
                            <div class="value">{{currentJob.trackingEmail}}</div>
                        </div>

                        <br/>

                    </div>
                    <div class="col-md-6">
                        <div class="field" ng-click="jdSvc.speedClick($event, currentJob)">
                            <label ng-class="currentJob.locked ? 'disabled' : ''">Speed</label>
                            <div class="value" ng-class="currentJob.locked ? 'disabled' : ''">{{currentJob.speedName}}
                            </div>
                        </div>

                        <div class="field">
                            <label ng-class="currentJob.locked ? 'disabled' : ''">Direct</label>
                            <div class="value" ng-class="currentJob.locked ? 'disabled' : ''">
                                <md-checkbox
                                        ng-click="jdSvc.directClick(currentJob)"
                                        ng-disabled="currentJob.locked"
                                        ng-model="currentJob.direct">
                                </md-checkbox>
                            </div>
                        </div>

                        <div class="field" ng-click="!currentJob.locked && jdSvc.leaveClick($event, currentJob)">
                            <label ng-class="currentJob.locked ? 'disabled' : ''">Leave Parcel</label>
                            <div class="value" ng-class="currentJob.locked ? 'disabled' : ''">
                                {{currentJob.sigNotRequired || "Signature Required"}}
                            </div>
                        </div>

                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'DGClass','DG Class',currentJob.dgClass,currentJob.id, 'select', options.detail.DGClass)"
                             ng-if="!currentJob.bulkJob">
                            <label ng-class="currentJob.locked ? 'disabled' : ''">DG# / Docs</label>
                            <div class="value" ng-class="currentJob.locked ? 'disabled' : ''">{{currentJob.dgClass}} /
                                {{jdSvc.hasDGDocs(currentJob)}}
                            </div>
                        </div>

                        <div class="field">
                            <label>Courier</label>
                            <div class="value" ng-click="jdSvc.courierClick(currentJob)">{{currentJob.courier}}
                            </div>
                        </div>

                        <div class="field" ng-class="jdSvc.combos.frequency.length > 0 ? '' : 'red'">
                            <b>Frequency:</b>&nbsp;<i class="fa fa-exclamation"
                                                      ng-if="jdSvc.combos.frequency.length === 0"></i> <br/>
                            <i><span ng-repeat="item in jdSvc.combos.frequency">{{item.label}}  </span></i>
                            <div class="multi-element" events="jdSvc.combos.frequencyEvents"
                                 extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}"
                                 ng-dropdown-multiselect=""
                                 options="jdSvc.pickFrequency" selected-model="jdSvc.combos.frequency"></div>
                        </div>

                        <div class="field" ng-class="jdSvc.combos.days.length > 0 ? '' : 'red'">
                            <b>Days:</b>&nbsp;<i class="fa fa-exclamation"
                                                 ng-if="jdSvc.combos.days.length === 0"></i><br/>
                            <i><span ng-repeat="item in jdSvc.combos.days">{{item.label}}  </span></i>
                            <div class="multi-element" events="jdSvc.combos.daysEvents"
                                 extra-settings="{showUncheckAll:false, closeOnSelect:true, closeOnDeselect:true}"
                                 ng-dropdown-multiselect=""
                                 options="jdSvc.pickDays" selected-model="jdSvc.combos.days"></div>
                        </div>

                        <div class="field" ng-class="jdSvc.combos.holidays.length > 0 ? '' : 'red'">
                            <b>Holidays:</b>&nbsp;<i class="fa fa-exclamation"
                                                     ng-if="jdSvc.combos.holidays.length === 0"></i><br/>
                            <i><span ng-repeat="item in jdSvc.combos.holidays">{{item.label}}  </span></i>
                            <div class="multi-element" events="jdSvc.combos.holidaysEvents"
                                 extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}"
                                 ng-dropdown-multiselect=""
                                 options="jdSvc.pickHolidays" selected-model="jdSvc.combos.holidays"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="row row-no-padding">
                    <div class="col-md-6">
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'NextDue','Next Due',currentJob.nextDue,currentJob.id, 'date')">
                            <label>Next Due</label>
                            <div class="value">{{currentJob.nextDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'LastDone','Last Done',currentJob.lastDone,currentJob.id, 'date')">
                            <label>Last Done</label>
                            <div class="value">{{currentJob.lastDone | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="jdSvc.editDetailField(currentJob, 'InActiveBy','InActive By',currentJob.inActiveBy,currentJob.id)">
                            <label>InActive By</label>
                            <div class="value">{{currentJob.inActiveBy}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'InActiveDate','InActive Date',currentJob.inActiveDate,currentJob.id, 'date')">
                            <label>InActive Date</label>
                            <div class="value">{{currentJob.inActiveDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'FirstDue','First Due',currentJob.firstDue,currentJob.id, 'date')">
                            <label>First Due</label>
                            <div class="value">{{currentJob.firstDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'StopDate','Stop Date',currentJob.stopDate,currentJob.id, 'date')">
                            <label>Stop Date</label>
                            <div class="value">{{currentJob.stopDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'RestartDate','Restart Date',currentJob.restartDate,currentJob.id, 'date')">
                            <label>Restart Date</label>
                            <div class="value">{{currentJob.restartDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field">
                            <label>One Off</label>
                            <md-checkbox
                                    ng-click="jdSvc.oneOffClick(currentJob)"
                                    ng-model="currentJob.oneOff">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Active</label>
                            <md-checkbox
                                    ng-click="jdSvc.activeClick(currentJob)"
                                    ng-model="currentJob.active">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Done</label>
                            <md-checkbox
                                    ng-click="jdSvc.doneClick($event, currentJob)"
                                    ng-model="currentJob.done">
                            </md-checkbox>
                        </div>
                    </div>
                    <div class="col-md-6">


                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Date','Date',currentJob.date,currentJob.id, 'date')">
                            <label>Date</label>
                            <div class="value">{{currentJob.date | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Time','Time',currentJob.time,currentJob.id,'time')">
                            <label>Log time</label>
                            <div class="value">{{currentJob.time | date: "h:mm a"}}</div>
                        </div>

                        <div class="field"
                             ng-click="jdSvc.editDetailField(currentJob, 'Amount','Amount',currentJob.charge,currentJob.id)">
                            <label ng-if="!currentJob.ratedManually">Charge</label>
                            <label ng-if="currentJob.ratedManually">Charge (Manually Rated)</label>
                            <div class="value">{{currentJob.charge}}</div>
                        </div>
                        <div class="field">
                            <label>Client notes</label>
                            <div class="value">{{currentJob.clientNotes}}</div>
                        </div>
                        <div class="field">
                            <label>Van</label>
                            <md-checkbox
                                    ng-click="jdSvc.vanClick(currentJob)"
                                    ng-model="currentJob.van">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Truck</label>
                            <md-checkbox
                                    ng-click="jdSvc.truckClick(currentJob)"
                                    ng-model="currentJob.truck">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Pedal</label>
                            <md-checkbox
                                    ng-click="jdSvc.pedalClick(currentJob)"
                                    ng-model="currentJob.pedal">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Attention</label>
                            <md-checkbox
                                    ng-click="jdSvc.attentionClick(currentJob)"
                                    ng-model="currentJob.attention">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Return</label>
                            <md-checkbox
                                    ng-click="jdSvc.preBookReturnClick(currentJob)"
                                    ng-model="currentJob.return">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Reprice</label>
                            <md-checkbox
                                    ng-click="jdSvc.repriceClick(currentJob)"
                                    ng-model="currentJob.reprice">
                            </md-checkbox>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div>
            <div class="palletInfo">

                <label>Pallet Info</label>
                <md-button
                        class="md-fab md-mini md-raised"
                        ng-click="jdSvc.newPallet()"
                        ng-disabled="!currentJob.locked">
                    <md-icon md-font-set="material-symbols-outlined">box_add</md-icon>
                    <md-tooltip md-direction="bottom">Add Pallet</md-tooltip>
                </md-button>

                <div class="value">
                    <table class="table table-striped table-responsive">
                        <thead>
                        <tr class="pallet-table-head no select">
                            <td>#</td>
                            <td>W</td>
                            <td>L</td>
                            <td>D</td>
                            <td>H</td>
                            <td>PU</td>
                            <td>DO</td>
                            <td>DG Class</td>
                            <td>Notes</td>
                        </tr>
                        </thead>
                        <tbody>
                        <tr context-menu="jdSvc.palletMenu"
                            ng-click="jdSvc.editPallet($event, jdSvc.currentJob, pallet)"
                            ng-repeat="pallet in currentJob.palletInfo">
                            <td>{{pallet.quantity}}</td>
                            <td>{{pallet.weight}}</td>
                            <td>{{pallet.length}}</td>
                            <td>{{pallet.depth}}</td>
                            <td>{{pallet.height}}</td>
                            <td>{{pallet.pu}}</td>
                            <td>{{pallet.do}}</td>
                            <td>{{pallet.DGClass}}</td>
                            <td>{{pallet.notes}}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>


    </div>
</md-content>

<div class="no-data" ng-if="!currentJob && !currentCourier">
    <div class="text">Please select a job or courier</div>
</div>

<div class="loading">
    <div class="text">
        <md-progress-circular md-mode="indeterminate"></md-progress-circular>
        <span class="sr-only">Loading...</span>
    </div>
</div>

<div style="display:none">
    {"ID":1,"Time":"9:30","Direct":"","JobNo":"AP68E","Speed":"Eco","Notify":"","Vehicle":"Car","Client":"UCL Ailsa
    Perkins","From":"Papatoetoe","To":"Ellerslie","ToAddress":"Ailsa Perkins, 28 Michaels
    Avenue","CourierNum":21,"Remain":55,"Status":"C","LP":"","LD":"","ContactName":"Ailsa","Phone":"","SpeedAccepted":"Eco","Size":"Car","Weight":"","Items":1,"RefA":"Personal","RefB":"","OurRef":"L664E","SigNotRequired":"Callout","Charge":"$5.81","Date":"11/04/2018","DispatchTime":"01/01/1900
    10:04:00
    AM","PUTime":"","ClientNotes":"","InternalNotes":"","PalletNums":"","Length":"","Height":"","Depth":"","TailLift
    PU":"","TailLiftDO":"","DGClass":"","Notes":""}
</div>
