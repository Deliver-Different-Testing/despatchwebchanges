<md-content class="md-dense" id="jobDetail" ng-if="ctrl.currentJob && !ctrl.currentJob.preBook">
    <div class="fields">
        <div class="row row-no-padding row-out">
            <div class="col-md-6">
                <div class="row row-no-padding addresses">
                    <div class="col-md-6">
                        <div class="field">
                            <label>Client</label><i class="material-symbols-outlined small-icon"
                                                    ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                                    title="Change Client Code"
                                                    ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editClientCode($event, ctrl.currentJob)">edit</i>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''"><a
                                    class="uline" ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                    ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.clientClick($event, ctrl.currentJob)"
                                    src="#">{{ctrl.currentJob.client}}
                                {{ctrl.currentJob.clientName}}</a></div>
                        </div>
                        <div class="field" ng-class="ctrl.currentJob.pickUpLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="fromAddress"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.updateGPS($event, ctrl.currentJob, 'fromAddress')">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">From Address:</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.fromAddress}}
                            </div>
                        </div>
                        <div class="field" data-field="fromSuburb">
                            <label class="disabled">From Suburb:</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.fromSuburbName}}
                                {{ctrl.currentJob.fromPostCode}}
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editFromJobContact($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">From Contact:</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.fromContactName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editJobFromPhone($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">From Phone: </label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.fromContactNumber}}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Job #</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.jobNo}}
                            </div>
                        </div>
                        <div class="field" ng-class="ctrl.currentJob.deliveryLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="toAddress"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.updateGPS($event, ctrl.currentJob,'toAddress')">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">To Address:</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.toAddress}}
                            </div>
                        </div>
                        <div class="field" data-field="toSuburb">
                            <label class="disabled">To Suburb:</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.toSuburbName}}
                                {{ ctrl.currentJob.toPostCode
                                }}
                            </div>
                        </div>
                        <div class="field" data-field="toCity">
                            <label class="disabled">To City:</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.toCity}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editToJobContact($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">To Contact</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.deliverToContact}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editJobToPhone($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">To Phone</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.phone}}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="notes-add"></div>
                <div class="notes field">
                    <label>Notes</label>
                    <md-button class="md-fab md-raised md-mini" style="float: right;"
                               ng-click="ctrl.jdSvc.showNotesDialog($event, ctrl.currentJob, 'Notes','Note')">
                        <md-icon md-font-set="material-symbols-outlined">add_notes</md-icon>
                        <md-tooltip md-direction="bottom">Add New Note</md-tooltip>
                    </md-button>
                    <div class="value">
                        <pre>{{ctrl.currentJob.internalNotes}}</pre>
                    </div>
                </div>

            </div>
            <div class="col-md-6">
                <div class="row row-no-padding">
                    <div class="col-md-4">
                        <div class="field" ng-show="!ctrl.currentJob.bulkJob">
                            <label class="disabled">Status</label>
                            <div class="disabled value">{{ctrl.currentJob.statusName}}</div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.contactClick(ctrl.currentJob)"
                             ng-show="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Booked by Contact</label>&nbsp;<i
                                class="fa fa-info-circle" ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                title="Show Client Contact List"
                                ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.getClientContactDetail($event, ctrl.currentJob)"></i>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.contactName}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="disabled">Logged-in Contact</label>
                            <div class="value" ng-class="disabled">{{ctrl.currentJob.loggedInContactName}}</div>
                        </div>
                        <div ng-show="name=='POD'" class="field">
                            <label ng-class="disabled">Source</label>
                            <div class="value" ng-class="disabled">{{ctrl.currentJob.source}}</div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Size','Size',ctrl.currentJob.size,ctrl.currentJob.id, 'select', options.detail.size)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Size</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.size.label}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Items','Items',ctrl.currentJob.items,ctrl.currentJob.id)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Items</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.items}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editJobWeight($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Weight</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.weight}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editRef($event, ctrl.currentJob, true)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Ref A</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.refA}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editRef($event, ctrl.currentJob, false)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Ref B</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.refB}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editOurRef($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Our Ref</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.ourRef}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'ContactNote','ContactNote',ctrl.currentJob.contactNote,ctrl.currentJob.id)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Con Note</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.conNote}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.trackingMethodClick($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Tracking Method</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getTrackingMethod(ctrl.currentJob.trackingMethod)}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editTrackingMobile($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Tracking Mobile</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.trackingMobile}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editTrackingEmail($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Tracking Email</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.trackingEmail}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.internalStatusClick($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Job FollowUp</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getInternalStatus(ctrl.currentJob.internalStatusID)}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'ConNote','Connote',ctrl.currentJob.conNote,ctrl.currentJob.id)"
                             ng-if="(name=='Nationwide' || name=='POD') && !ctrl.currentJob.bulkJob && ctrl.currentJob.hasNationwide">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Connote</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.conNote}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.currentJob.internalStatusID !=1 && ctrl.currentJob.internalStatusID !=4 && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'FollowupTime','FollowUp Time',ctrl.currentJob.followupTime,ctrl.currentJob.id,'datetime')"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked || ctrl.currentJob.internalStatusID ===1 || ctrl.currentJob.internalStatusID ===4 ? 'disabled' : ''">FollowUp
                                Time</label>
                            <div class="value"
                                 ng-class="ctrl.currentJob.locked || ctrl.currentJob.internalStatusID ===1 || ctrl.currentJob.internalStatusID ===4  ? 'disabled' : ''">
                                {{ctrl.currentJob.followupTime | date: "dd/MM/yyyy h:mm a"}}
                            </div>
                        </div>

                    </div>
                    <div class="col-md-4">
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.speedClick($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Speed</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.speedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.notifyClick($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Speed Notified</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.notifiedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.currentJob.direct && ctrl.jdSvc.acceptedClick($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Speed Accepted</label>
                            <div class="value"
                                 ng-class="ctrl.currentJob.direct && !ctrl.currentJob.locked ? '' : 'disabled'">
                                {{ctrl.currentJob.acceptedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.jobTypeClick($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Job Type</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getJobTypeDescription(ctrl.currentJob.jobType)}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Direct</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                <md-checkbox
                                        ng-click="ctrl.jdSvc.directClick(ctrl.currentJob)"
                                        ng-disabled="ctrl.currentJob.locked"
                                        ng-model="ctrl.currentJob.direct">
                                </md-checkbox>
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.leaveClick($event, ctrl.currentJob)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Leave Parcel</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.sigNotRequired || "Signature Required"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.undeliverableClick($event, ctrl.currentJob)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">UD status</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.udStatus}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'DGClass','DG Class',ctrl.currentJob.dgClass,ctrl.currentJob.id, 'select', options.detail.DGClass)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">DG# / Docs</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.dgClass}} /
                                {{ctrl.jdSvc.hasDGDocs(ctrl.currentJob)}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Courier</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                 ng-click="courierClick($event, job)">{{ctrl.currentJob.courierData.courier}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Courier Name</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.courierData.courierName}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Courier Mobile</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.courierData.courierMobile}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Dispatcher Name</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.dispatcherName}}
                            </div>
                        </div>

                        <div class="field" ng-if="ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Run Name</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.runName}}
                            </div>
                        </div>
                        <div class="field">
                            <label class="disabled">Schedule Name</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.scheduleName}}</div>
                        </div>

                        <div class="field">
                            <label class="disabled">Run Name</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.runName}}</div>
                        </div>

                        <div class="field">
                            <label class="disabled">Run Order</label>
                            <div class="disabled" class="value">{{ctrl.currentJob.runOrder}}</div>
                        </div>

                    </div>
                    <div class="col-md-4">

                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Date','Date',ctrl.currentJob.date,ctrl.currentJob.id, 'date')">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Date</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.date | date:
                                    "dd/MM/yyyy"}}
                            </div>
                        </div>

                        <div class="field">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Created Date</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.createdDate | date:
                                    "dd/MM/yyyy"}}
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Time','Time',ctrl.currentJob.time,ctrl.currentJob.id,'time')">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Log time</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.time | date:
                                    "h:mm a"}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Dispatch time</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.dispatchTime
                            | date: "h:mm a"}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">PU time</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.puTime | date
                                    : "h:mm a"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'CompletedTime','Completed Time',ctrl.currentJob.completedTime,ctrl.currentJob.id,'time')"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">POD Time</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.completedTime
                            | date: "h:mm a"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'PODName','POD Name',ctrl.currentJob.podName,ctrl.currentJob.id)"
                             ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">POD Name</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.podName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Amount','Amount',ctrl.currentJob.charge,ctrl.currentJob.id)">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                   ng-if="!ctrl.currentJob.ratedManually">Charge</label>
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''"
                                   ng-if="ctrl.currentJob.ratedManually">Charge
                                (Manually Rated)</label>
                            <i class="fa fa-info-circle" title="Click for Price Breakdown"
                               ng-click="ctrl.jdSvc.displayPriceBreakdown($event, ctrl.currentJob)"></i>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.charge}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.currentJob.bulkJob">
                            <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Client notes</label>
                            <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.currentJob.clientNotes}}
                            </div>
                        </div>

                        <!-- Checkbox flex view -->
                        <div class="resizeable-checkbox-container">
                            <div class="field" ng-if="!ctrl.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Van</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.vanClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.van">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Truck</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.truckClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.truck">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Pedal</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.pedalClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.pedal">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Attention</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.attentionClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.attention">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Van OK?</label>
                                <div class="value">
                                    <md-checkbox ng-click="ctrl.jdSvc.vanOkClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.vanOK">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="!ctrl.currentJob.bulkJob">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Reprice</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.repriceClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.reprice">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='POD'">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Void</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.voidClick(ctrl.currentJob)"
                                            ng-disabled="ctrl.currentJob.locked"
                                            ng-model="ctrl.currentJob.void">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='POD' && !ctrl.currentJob.bulkJob">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Done</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.doneClick($event, ctrl.currentJob)"
                                            ng-disabled="ctrl.currentJob.locked"
                                            ng-model="ctrl.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='Nationwide' && !ctrl.currentJob.bulkJob">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Delivered</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.deliveredClick(ctrl.currentJob)"
                                            ng-disabled="ctrl.currentJob.locked"
                                            ng-model="ctrl.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field"
                                 ng-if="(name=='Nationwide' || name=='POD') && !ctrl.currentJob.bulkJob && ctrl.currentJob.hasNationwide">
                                <label ng-class="ctrl.currentJob.locked ? 'disabled' : ''">Airport Only</label>
                                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.airportOnlyClick(ctrl.currentJob)"
                                                 ng-disabled="ctrl.currentJob.locked"
                                                 ng-model="ctrl.currentJob.airportOnly">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="ctrl.currentJob.bulkJob">
                                <label ng-class="(ctrl.currentJob.jobRelationshipTypeID == 20 || ctrl.currentJob.done) ? 'disabled' : ''">Pushed
                                    To Live</label>
                                <div ng-class="(ctrl.currentJob.jobRelationshipTypeID == 20 || ctrl.currentJob.done) ? 'disabled' : ''"
                                     class="value">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.pushToLive(ctrl.currentJob)"
                                            ng-disabled="(ctrl.currentJob.jobRelationshipTypeID == 20 || ctrl.currentJob.done)"
                                            ng-model="ctrl.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div class="row row-no-padding row-out"
             ng-if="!ctrl.currentJob.bulkJob && ctrl.currentJob.podPhotos.length > 0">
            <md-button class="md-fab md-mini md-raised"
                       ng-click="sendPOD()"
                       style="position: absolute; right: 0; top: 0;">
                <md-icon md-font-set="material-symbols-outlined">package</md-icon>
                <md-tooltip md-direction="bottom">Send POD</md-tooltip>
            </md-button>
            <label>POD Info</label>
            <div class="row row-no-padding row-out">
                <!--<img ng-src="{{'data:image/png;base64,'+ctrl.currentJob.podPhoto}}" />-->
                <div id="intel-carousel-pod" class="carousel slide" data-interval="false">
                    <!-- Indicators -->
                    <ol class="carousel-indicators">
                        <li data-target="#intel-carousel-pod"
                            ng-repeat="img in ctrl.currentJob.podPhotos track by $index"
                            data-slide-to="{{$index}}" ng-class="{'active' :$index === 0}"></li>
                    </ol>

                    <!-- Wrapper for slides -->
                    <div class="carousel-inner" role="listbox">
                        <div class="item" data-jobindex="{{$index}}" ng-repeat="img in ctrl.currentJob.podPhotos"
                             ng-class="{'active' :$index === 0}">

                            <div style="text-align:center">
                                <img ng-src="{{'data:image/png;base64,'+img}}" style="max-height: 600px;"/>
                            </div>


                        </div>
                    </div>

                    <!-- Controls -->
                    <a class="left carousel-control"
                       ng-href="{{name=='POD' ? '/CS/#intel-carousel-pod':'#intel-carousel-pod'}}" role="button"
                       data-slide="prev">
                        <span class="glyphicon glyphicon-chevron-left" aria-hidden="true"></span>
                        <span class="sr-only">Previous</span>
                    </a>
                    <a class="right carousel-control"
                       ng-href="{{name=='POD' ? '/CS/#intel-carousel-pod':'#intel-carousel-pod'}}" role="button"
                       data-slide="next">
                        <span class="glyphicon glyphicon-chevron-right" aria-hidden="true"></span>
                        <span class="sr-only">Next</span>
                    </a>
                </div>
            </div>
        </div>

        <div ng-if="!ctrl.currentJob.bulkJob">
            <div class="palletInfo" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">

                <div style="display: flex; justify-content: space-between;">
                    <label>Pallet Info</label>
                    <md-button
                            class="md-fab md-mini md-raised"
                            ng-click="ctrl.jdSvc.newPallet($event, ctrl.currentJob)"
                            ng-disabled="ctrl.currentJob.locked">
                        <md-icon md-font-set="material-symbols-outlined">box_add</md-icon>
                        <md-tooltip md-direction="bottom">Add Pallet</md-tooltip>
                    </md-button>
                </div>

                <div class="value" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">
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
                        <tr context-menu="!ctrl.currentJob.locked && ctrl.jdSvc.palletMenu"
                            ng-click="!ctrl.currentJob.locked && ctrl.jdSvc.editPallet(pallet)"
                            ng-repeat="pallet in ctrl.currentJob.palletInfo">
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


        <div ng-if="!ctrl.currentJob.bulkJob && ctrl.currentJob.contactList">
            <div class="palletInfo" ng-class="ctrl.currentJob.locked ? 'disabled' : ''">

                <label>Client Contact Info</label>

                <table class="table table-striped table-responsive">
                    <thead>
                    <tr class="pallet-table-head no select">
                        <td>Name</td>
                        <td>Title</td>
                        <td>Direct Dial</td>
                        <td>Mobile</td>
                        <td>Email</td>
                    </tr>
                    </thead>
                    <tbody>
                    <tr ng-repeat="contact in ctrl.currentJob.contactList">
                        <td>{{contact.fullName}}</td>
                        <td>{{contact.jobTitle}}</td>
                        <td><a class="pointer:cursor" ng-href="tel:{{contact.directDial}}">{{contact.directDial}}<a/>
                        </td>
                        <td><a class="pointer:cursor" ng-href="tel:{{contact.mobile}}">{{contact.mobile}}<a/></td>
                        <td>{{contact.email}}</td>

                    </tr>
                    </tbody>
                </table>
            </div>

        </div>
    </div>
</md-content>

<div class="container-fluid" id="jobDetail" ng-if="ctrl.currentJob && ctrl.currentJob.preBook" style="padding:0">
    <div class="fields">
        <div class="row row-no-padding row-out">
            <div class="col-md-4">
                <div class="row row-no-padding addresses">
                    <div class="col-md-6">
                        <div class="field">
                            <label>Client</label><i class="fa fa-edit" title="Change Client Code"
                                                    ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'ClientCode','Client Code',ctrl.currentJob.client,ctrl.currentJob.id)"></i>

                            <div class="value"><a class="uline" src="#"
                                                  ng-click="ctrl.jdSvc.clientClick($event, ctrl.currentJob)">{{ctrl.currentJob.client}}
                                {{ctrl.currentJob.clientName}}</a></div>
                        </div>
                        <div class="field" ng-class="ctrl.currentJob.pickUpLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="fromAddress"
                             ng-click="ctrl.jdSvc.updateGPS(ctrl.currentJob, 'fromAddress')">
                            <label>From: {{ctrl.currentJob.from}} {{ctrl.currentJob.fromPostCode}}</label>
                            <div class="value">{{ctrl.currentJob.fromAddress}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'FromContactName','From Contact Name',ctrl.currentJob.fromContactName,ctrl.currentJob.id)">
                            <label>From Contact:</label>
                            <div class="value">{{ctrl.currentJob.fromContactName}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'FromContactPhone','From Contact Phone',ctrl.currentJob.fromContactNumber,ctrl.currentJob.id)">
                            <label>From Phone: </label>
                            <div class="value">{{ctrl.currentJob.fromContactNumber}}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="field">
                            <label>Job #</label>
                            <div class="value">{{ctrl.currentJob.jobNo}}</div>
                        </div>

                        <div class="field" ng-class="ctrl.currentJob.deliveryLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="toAddress"
                             ng-click="ctrl.jdSvc.updateGPS(ctrl.currentJob,'toAddress')">
                            <label>To: {{ctrl.currentJob.to}} {{ctrl.currentJob.toPostCode}}</label>
                            <div class="value">{{ctrl.currentJob.toAddress}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'ToContactName','To Contact Name',ctrl.currentJob.deliverToContact,ctrl.currentJob.id)">
                            <label>To Contact</label>
                            <div class="value">{{ctrl.currentJob.deliverToContact}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'ToContactPhone','To Contact Phone',ctrl.currentJob.phone,ctrl.currentJob.id)">
                            <label>To Phone</label>
                            <div class="value">{{ctrl.currentJob.phone}}</div>
                        </div>
                    </div>
                </div>

                <div class="notes-add"></div>
                <div class="notes field">
                    <label>Notes</label>
                    <md-button class="md-fab md-mini md-primary" style="float: right;"
                               ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Notes','Note','',ctrl.currentJob.id, 'textarea')">
                        <md-icon md-font-set="material-symbols-outlined">add_notes</md-icon>
                        <md-tooltip md-direction="bottom">Add New Note</md-tooltip>
                    </md-button>
                    <div class="value">
                        <pre>{{ctrl.currentJob.internalNotes}}</pre>
                    </div>
                </div>

            </div>
            <div class="col-md-4">
                <div class="row row-no-padding">
                    <div class="col-md-6">
                        <div class="field" ng-click="ctrl.jdSvc.contactClick($event, ctrl.currentJob)"
                             ng-show="!ctrl.currentJob.bulkJob">
                            <label>Booked by Contact</label>
                            <div class="value">{{ctrl.currentJob.contactName}}</div>
                        </div>
                        <div class="field">
                            <label ng-class="disabled">Logged-in Contact</label>
                            <div class="value" ng-class="disabled">{{ctrl.currentJob.loggedInContactName}}</div>
                        </div>
                        <div ng-show="name=='POD'" class="field">
                            <label ng-class="disabled">Source</label>
                            <div class="value" ng-class="disabled">{{ctrl.currentJob.source}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.sizeClick($event, ctrl.currentJob)">
                            <label>Size</label>
                            <div class="value">{{ctrl.currentJob.size.label}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Items','Items',ctrl.currentJob.items,ctrl.currentJob.id)">
                            <label>Items</label>
                            <div class="value">{{ctrl.currentJob.items}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Weight','Weight',ctrl.currentJob.weight,ctrl.currentJob.id)">
                            <label>Weight</label>
                            <div class="value">{{ctrl.currentJob.weight}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'RefA','RefA',ctrl.currentJob.refA,ctrl.currentJob.id)">
                            <label>Ref A</label>
                            <div class="value">{{ctrl.currentJob.refA}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'RefB','RefB',ctrl.currentJob.refB,ctrl.currentJob.id)">
                            <label>Ref B</label>
                            <div class="value">{{ctrl.currentJob.refB}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'OurRef','OurRef',ctrl.currentJob.ourRef,ctrl.currentJob.id)">
                            <label>Our Ref</label>
                            <div class="value">{{ctrl.currentJob.ourRef}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.trackingMethodClick($event, ctrl.currentJob)">
                            <label>Tracking Method</label>
                            <div class="value">{{ctrl.jdSvc.getTrackingMethod(ctrl.currentJob.trackingMethod)}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'TrackingMobile','Tracking Mobile',ctrl.currentJob.trackingMobile,ctrl.currentJob.id)">
                            <label>Tracking Mobile</label>
                            <div class="value">{{ctrl.currentJob.trackingMobile}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'TrackingEmail','Tracking Email',ctrl.currentJob.trackingEmail,ctrl.currentJob.id)">
                            <label>Tracing Email</label>
                            <div class="value">{{ctrl.currentJob.trackingEmail}}</div>
                        </div>

                        <br/>

                    </div>
                    <div class="col-md-6">

                        <div class="field" ng-click="ctrl.jdSvc.speedClick($event, ctrl.currentJob)">
                            <label>Speed</label>
                            <div class="value">{{ctrl.currentJob.speedName}}</div>
                        </div>

                        <div class="field">
                            <label>Direct</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.preBookDirectClick(ctrl.currentJob)"
                                    ng-disabled="ctrl.currentJob.locked"
                                    ng-model="ctrl.currentJob.direct">
                            </md-checkbox>
                        </div>

                        <div class="field" ng-click="ctrl.jdSvc.leaveClick($event, ctrl.currentJob)">
                            <label>Leave Parcel</label>
                            <div class="value">{{ctrl.currentJob.sigNotRequired || "Signature Required"}}</div>
                        </div>

                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'DGClass','DG Class',ctrl.currentJob.dgClass,ctrl.currentJob.id, 'select', options.detail.DGClass)">
                            <label>DG# / Docs</label>
                            <div class="value">{{ctrl.currentJob.dgClass}} / {{ctrl.jdSvc.hasDGDocs(ctrl.currentJob)}}
                            </div>
                        </div>
                        <div class="field">
                            <label>Courier</label>
                            <div class="value" ng-click="ctrl.jdSvc.courierClick($event, ctrl.currentJob)">
                                {{ctrl.currentJob.courier}}
                            </div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.combos.frequency.length > 0 ? '' : 'red'">
                            <b>Frequency:</b>&nbsp;<i ng-if="ctrl.jdSvc.combos.frequency.length === 0"
                                                      class="fa fa-exclamation"></i> <br/>
                            <i><span ng-repeat="item in ctrl.jdSvc.combos.frequency">{{item.label}}  </span></i>
                            <div class="multi-element" events="ctrl.jdSvc.combos.frequencyEvents"
                                 ng-dropdown-multiselect=""
                                 extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}"
                                 options="ctrl.jdSvc.pickFrequency"
                                 selected-model="ctrl.jdSvc.combos.frequency"></div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.combos.days.length > 0 ? '' : 'red'">
                            <b>Days:</b>&nbsp;<i ng-if="ctrl.jdSvc.combos.days.length === 0"
                                                 class="fa fa-exclamation"></i><br/>
                            <i><span ng-repeat="item in ctrl.jdSvc.combos.days">{{item.label}}  </span></i>
                            <div class="multi-element" events="ctrl.jdSvc.combos.daysEvents" ng-dropdown-multiselect=""
                                 extra-settings="{showUncheckAll:false, closeOnSelect:true, closeOnDeselect:true}"
                                 option="ctrl.jdSvc.pickDays" selected-model="ctrl.jdSvc.combos.days"></div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.combos.holidays.length > 0 ? '' : 'red'">
                            <b>Holidays:</b>&nbsp;<i ng-if="ctrl.jdSvc.combos.holidays.length === 0"
                                                     class="fa fa-exclamation"></i><br/>
                            <i><span ng-repeat="item in ctrl.jdSvc.combos.holidays">{{item.label}}  </span></i>
                            <div class="multi-element" events="ctrl.jdSvc.combos.holidaysEvents"
                                 ng-dropdown-multiselect=""
                                 extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}"
                                 options="ctrl.jdSvc.pickHolidays"
                                 selected-model="ctrl.jdSvc.combos.holidays"></div>
                        </div>
                    </div>

                </div>
            </div>
            <div class="col-md-4">
                <div class="row row-no-padding">
                    <div class="col-md-6">
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'NextDue','Next Due',ctrl.currentJob.nextDue,ctrl.currentJob.id, 'date')">
                            <label>Next Due</label>
                            <div class="value">{{ctrl.currentJob.nextDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'LastDone','Last Done',ctrl.currentJob.lastDone,ctrl.currentJob.id, 'date')">
                            <label>Last Done</label>
                            <div class="value">{{ctrl.currentJob.lastDone | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'InActiveBy','InActive By',ctrl.currentJob.inActiveBy,ctrl.currentJob.id)">
                            <label>InActive By</label>
                            <div class="value">{{ctrl.currentJob.inActiveBy}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'InActiveDate','InActive Date',ctrl.currentJob.inActiveDate,ctrl.currentJob.id, 'date')">
                            <label>InActive Date</label>
                            <div class="value">{{ctrl.currentJob.inActiveDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'FirstDue','First Due',ctrl.currentJob.firstDue,ctrl.currentJob.id, 'date')">
                            <label>First Due</label>
                            <div class="value">{{ctrl.currentJob.firstDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'StopDate','Stop Date',ctrl.currentJob.stopDate,ctrl.currentJob.id, 'date')">
                            <label>Stop Date</label>
                            <div class="value">{{ctrl.currentJob.stopDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'RestartDate','Restart Date',ctrl.currentJob.restartDate,ctrl.currentJob.id, 'date')">
                            <label>Restart Date</label>
                            <div class="value">{{ctrl.currentJob.restartDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field">
                            <label>One Off</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.oneOffClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.oneOff">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Active</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.activeClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.active">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Done</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.doneClick($event, ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.done">
                            </md-checkbox>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Date','Date',ctrl.currentJob.date,ctrl.currentJob.id, 'date')">
                            <label>Date</label>
                            <div class="value">{{ctrl.currentJob.date | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Time','Time',ctrl.currentJob.time,ctrl.currentJob.id,'time')">
                            <label>Log time</label>
                            <div class="value">{{ctrl.currentJob.time | date: "h:mm a"}}</div>
                        </div>

                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.currentJob, 'Amount','Amount',ctrl.currentJob.charge,ctrl.currentJob.id)">
                            <label ng-if="!ctrl.currentJob.ratedManually">Charge</label>
                            <label ng-if="ctrl.currentJob.ratedManually">Charge (Manually Rated)</label>
                            <div class="value">{{ctrl.currentJob.charge}}</div>
                        </div>
                        <div class="field">
                            <label>Client notes</label>
                            <div class="value">{{ctrl.currentJob.clientNotes}}</div>
                        </div>
                        <div class="field">
                            <label>Van</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.vanClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.van">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Truck</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.truckClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.truck">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Pedal</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.pedalClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.pedal">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Attention</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.attentionClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.attention">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Return</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.preBookReturnClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.return">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Reprice</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.repriceClick(ctrl.currentJob)"
                                    ng-model="ctrl.currentJob.reprice">
                            </md-checkbox>
                        </div>


                    </div>
                </div>
            </div>

        </div>

        <div>
            <div class="palletInfo">
                <md-button class="md-fab md-mini md-raised"
                           ng-click="sendPOD()"
                           style="position: absolute; right: 0; top: 0;">
                    <md-icon md-font-set="material-symbols-outlined">package</md-icon>
                    <md-tooltip md-direction="bottom">Send POD</md-tooltip>
                </md-button>

                <div>
                    <img ng-src="{{ctrl.currentJob.pODPhoto}}" style="display: block; margin: auto;"/>

                    <a ng-click="currentIndex=currentIndex-1<0?images.length-1:currentIndex-1;"
                       style="position: absolute; left: 0;">Prev</a>
                    <a ng-click="currentIndex=(currentIndex+1)%images.length;" style="position: absolute; right: 0;">Next</a>
                </div>

                <label>Pallet Info</label>
                <md-button class="md-fab md-mini md-raised" ng-click="ctrl.jdSvc.newPallet()">
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
                        <tr context-menu="ctrl.jdSvc.palletMenu" ng-click="ctrl.jdSvc.editPallet(pallet)"
                            ng-repeat="pallet in ctrl.currentJob.palletInfo">
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
</div>

<div class="no-data" ng-if="!ctrl.currentJob && !currentCourier">
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
