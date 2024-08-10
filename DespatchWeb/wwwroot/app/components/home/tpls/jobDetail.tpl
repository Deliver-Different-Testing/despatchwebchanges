<md-content class="md-dense" id="jobDetail" ng-if="ctrl.jdSvc.currentJob && !ctrl.jdSvc.currentJob.preBook">
    <div class="fields">
        <div class="row row-no-padding row-out">
            <div class="col-md-6">
                <div class="row row-no-padding addresses">
                    <div class="col-md-6">
                        <div class="field">
                            <label>Client</label><i class="material-symbols-outlined small-icon"
                                                    ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                                    title="Change Client Code"
                                                    ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editClientCode($event, ctrl.jdSvc.currentJob)">edit</i>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"><a
                                    class="uline" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                    ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.clientClick($event, ctrl.jdSvc.currentJob)"
                                    src="#">{{ctrl.jdSvc.currentJob.client}}
                                {{ctrl.jdSvc.currentJob.clientName}}</a></div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.currentJob.pickUpLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="fromAddress"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.updateGPS($event, ctrl.jdSvc.currentJob, 'fromAddress')">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">From Address:</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.fromAddress}}
                            </div>
                        </div>
                        <div class="field" data-field="fromSuburb">
                            <label class="disabled">From Suburb:</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.fromSuburbName}}
                                {{ctrl.jdSvc.currentJob.fromPostCode}}
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editFromJobContact($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">From Contact:</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.fromContactName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editJobFromPhone($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">From Phone: </label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.fromContactNumber}}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Job #</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.jobNo}}
                            </div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.currentJob.deliveryLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="toAddress"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.updateGPS($event, ctrl.jdSvc.currentJob,'toAddress')">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">To Address:</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.toAddress}}
                            </div>
                        </div>
                        <div class="field" data-field="toSuburb">
                            <label class="disabled">To Suburb:</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.toSuburbName}}
                                {{ ctrl.jdSvc.currentJob.toPostCode
                                }}
                            </div>
                        </div>
                        <div class="field" data-field="toCity">
                            <label class="disabled">To City:</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.toCity}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editToJobContact($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">To Contact</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.deliverToContact}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editJobToPhone($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">To Phone</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.phone}}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="notes-add"></div>
                <div class="notes field">
                    <label>Notes</label>
                    <md-button class="md-fab md-raised md-mini" style="float: right;"
                               ng-click="ctrl.jdSvc.showNotesDialog($event, ctrl.jdSvc.currentJob, 'Notes','Note')">
                        <md-icon md-font-set="material-symbols-outlined">add_notes</md-icon>
                        <md-tooltip md-direction="bottom">Add New Note</md-tooltip>
                    </md-button>
                    <div class="value">
                        <pre>{{ctrl.jdSvc.currentJob.internalNotes}}</pre>
                    </div>
                </div>

            </div>
            <div class="col-md-6">
                <div class="row row-no-padding">
                    <div class="col-md-4">
                        <div class="field" ng-show="!ctrl.jdSvc.currentJob.bulkJob">
                            <label class="disabled">Status</label>
                            <div class="disabled value">{{ctrl.jdSvc.currentJob.statusName}}</div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.contactClick($event, ctrl.jdSvc.currentJob)"
                             ng-show="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Booked by Contact</label>&nbsp;<i
                                class="fa fa-info-circle" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                title="Show Client Contact List"
                                ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.getClientContactDetail($event, ctrl.jdSvc.currentJob)"></i>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.contactName}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="disabled">Logged-in Contact</label>
                            <div class="value" ng-class="disabled">{{ctrl.jdSvc.currentJob.loggedInContactName}}</div>
                        </div>
                        <div ng-show="name=='POD'" class="field">
                            <label ng-class="disabled">Source</label>
                            <div class="value" ng-class="disabled">{{ctrl.jdSvc.currentJob.source}}</div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.sizeClick($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Size</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.size.label}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editItems($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Items</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.items}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editJobWeight($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Weight</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.weight}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editRef($event, ctrl.jdSvc.currentJob, true)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Ref A</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.refA}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editRef($event, ctrl.jdSvc.currentJob, false)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Ref B</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.refB}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editOurRef($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Our Ref</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.ourRef}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.showNotesDialog($event, ctrl.jdSvc.currentJob, 'ContactNote','ContactNote')">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Con Note</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.conNote}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.trackingMethodClick($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Tracking Method</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getTrackingMethod(ctrl.jdSvc.currentJob.trackingMethod)}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editTrackingMobile($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Tracking Mobile</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.trackingMobile}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editTrackingEmail($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Tracking Email</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.trackingEmail}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.internalStatusClick($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Job FollowUp</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getInternalStatus(ctrl.jdSvc.currentJob.internalStatusID)}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.showNotesDialog($event, ctrl.jdSvc.currentJob, 'ConNote','Connote')"
                             ng-if="(name=='Nationwide' || name=='POD') && !ctrl.jdSvc.currentJob.bulkJob && ctrl.jdSvc.currentJob.hasNationwide">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Connote</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.conNote}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.currentJob.internalStatusID !=1
                             && ctrl.jdSvc.currentJob.internalStatusID !=4
                             && ctrl.jdSvc.editFollowUpTime($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked || ctrl.jdSvc.currentJob.internalStatusID ===1 || ctrl.jdSvc.currentJob.internalStatusID ===4 ? 'disabled' : ''">FollowUp
                                Time</label>
                            <div class="value"
                                 ng-class="ctrl.jdSvc.currentJob.locked || ctrl.jdSvc.currentJob.internalStatusID ===1 || ctrl.jdSvc.currentJob.internalStatusID ===4  ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.followupTime | date: "dd/MM/yyyy h:mm a"}}
                            </div>
                        </div>

                    </div>
                    <div class="col-md-4">
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.speedClick($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Speed</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.speedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.notifyClick($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Speed Notified</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.notifiedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.currentJob.direct && ctrl.jdSvc.acceptedClick($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Speed Accepted</label>
                            <div class="value"
                                 ng-class="ctrl.jdSvc.currentJob.direct && !ctrl.jdSvc.currentJob.locked ? '' : 'disabled'">
                                {{ctrl.jdSvc.currentJob.acceptedName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.jobTypeClick($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Job Type</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.getJobTypeDescription(ctrl.jdSvc.currentJob.jobType)}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Direct</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                <md-checkbox
                                        ng-click="ctrl.jdSvc.directClick(ctrl.jdSvc.currentJob)"
                                        ng-disabled="ctrl.jdSvc.currentJob.locked"
                                        ng-model="ctrl.jdSvc.currentJob.direct">
                                </md-checkbox>
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.leaveClick($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Leave Parcel</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.sigNotRequired || "Signature Required"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.undeliverableClick($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">UD status</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.udStatus}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'DGClass','DG Class',ctrl.jdSvc.currentJob.dgClass,ctrl.jdSvc.currentJob.id, 'select', options.detail.DGClass)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">DG# / Docs</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.dgClass}} /
                                {{ctrl.jdSvc.hasDGDocs(ctrl.jdSvc.currentJob)}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Courier</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                 ng-click="courierClick($event, job)">{{ctrl.jdSvc.currentJob.courierData.courier}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Courier Name</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.courierData.courierName}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Courier Mobile</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.courierData.courierMobile}}
                            </div>
                        </div>
                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Dispatcher Name</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.dispatcherName}}
                            </div>
                        </div>

                        <div class="field" ng-if="ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Run Name</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.runName}}
                            </div>
                        </div>
                        <div class="field">
                            <label class="disabled">Schedule Name</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.scheduleName}}</div>
                        </div>

                        <div class="field">
                            <label class="disabled">Run Name</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.runName}}</div>
                        </div>

                        <div class="field">
                            <label class="disabled">Run Order</label>
                            <div class="disabled" class="value">{{ctrl.jdSvc.currentJob.runOrder}}</div>
                        </div>

                    </div>
                    <div class="col-md-4">

                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editJobDate($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Date</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.date | date:
                                    "dd/MM/yyyy"}}
                            </div>
                        </div>

                        <div class="field">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Created Date</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.createdDate | date:
                                    "dd/MM/yyyy"}}
                            </div>
                        </div>

                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editLogTime($event, ctrl.jdSvc.currentJob)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Log time</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.time | date:
                                    "h:mm a"}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Dispatch time</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.dispatchTime
                            | date: "h:mm a"}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">PU time</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.puTime | date
                                    : "h:mm a"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editCompletedTime($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">POD Time</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.completedTime
                            | date: "h:mm a"}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editPodName($event, ctrl.jdSvc.currentJob)"
                             ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">POD Name</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.podName}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'Amount','Amount',ctrl.jdSvc.currentJob.charge,ctrl.jdSvc.currentJob.id)">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                   ng-if="!ctrl.jdSvc.currentJob.ratedManually">Charge</label>
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''"
                                   ng-if="ctrl.jdSvc.currentJob.ratedManually">Charge
                                (Manually Rated)</label>
                            <i class="fa fa-info-circle" title="Click for Price Breakdown"
                               ng-click="ctrl.jdSvc.displayPriceBreakdown($event, ctrl.jdSvc.currentJob)"></i>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.charge}}
                            </div>
                        </div>
                        <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                            <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Client notes</label>
                            <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                {{ctrl.jdSvc.currentJob.clientNotes}}
                            </div>
                        </div>

                        <!-- Checkbox flex view -->
                        <div class="resizeable-checkbox-container">
                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Van</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.vanClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.van">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Truck</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.truckClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.truck">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Pedal</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.pedalClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.pedal">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Attention</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.attentionClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.attention">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob" style="flex: 1;">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Van OK?</label>
                                <div class="value">
                                    <md-checkbox ng-click="ctrl.jdSvc.vanOkClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.vanOK">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="!ctrl.jdSvc.currentJob.bulkJob">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Reprice</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.repriceClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.reprice">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='POD'">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Void</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.voidClick(ctrl.jdSvc.currentJob)"
                                            ng-disabled="ctrl.jdSvc.currentJob.locked"
                                            ng-model="ctrl.jdSvc.currentJob.void">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='POD' && !ctrl.jdSvc.currentJob.bulkJob">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Done</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.doneClick($event, ctrl.jdSvc.currentJob)"
                                            ng-disabled="ctrl.jdSvc.currentJob.locked"
                                            ng-model="ctrl.jdSvc.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field" ng-if="name=='Nationwide' && !ctrl.jdSvc.currentJob.bulkJob">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Delivered</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.deliveredClick(ctrl.jdSvc.currentJob)"
                                            ng-disabled="ctrl.jdSvc.currentJob.locked"
                                            ng-model="ctrl.jdSvc.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>

                            <div class="field"
                                 ng-if="(name=='Nationwide' || name=='POD') && !ctrl.jdSvc.currentJob.bulkJob && ctrl.jdSvc.currentJob.hasNationwide">
                                <label ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">Airport Only</label>
                                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
                                    <md-checkbox ng-click="ctrl.jdSvc.airportOnlyClick(ctrl.jdSvc.currentJob)"
                                                 ng-disabled="ctrl.jdSvc.currentJob.locked"
                                                 ng-model="ctrl.jdSvc.currentJob.airportOnly">
                                    </md-checkbox>
                                </div>
                            </div>
                            <div class="field" ng-if="ctrl.jdSvc.currentJob.bulkJob">
                                <label ng-class="(ctrl.jdSvc.currentJob.jobRelationshipTypeID == 20 || ctrl.jdSvc.currentJob.done) ? 'disabled' : ''">Pushed
                                    To Live</label>
                                <div ng-class="(ctrl.jdSvc.currentJob.jobRelationshipTypeID == 20 || ctrl.jdSvc.currentJob.done) ? 'disabled' : ''"
                                     class="value">
                                    <md-checkbox
                                            ng-click="ctrl.jdSvc.pushToLive(ctrl.jdSvc.currentJob)"
                                            ng-disabled="(ctrl.jdSvc.currentJob.jobRelationshipTypeID == 20 || ctrl.jdSvc.currentJob.done)"
                                            ng-model="ctrl.jdSvc.currentJob.done">
                                    </md-checkbox>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div class="row row-no-padding row-out"
             ng-if="!ctrl.jdSvc.currentJob.bulkJob && ctrl.jdSvc.currentJob.podPhotos.length > 0">
            <md-button class="md-fab md-mini md-raised"
                       ng-click="sendPOD()"
                       style="position: absolute; right: 0; top: 0;">
                <md-icon md-font-set="material-symbols-outlined">package</md-icon>
                <md-tooltip md-direction="bottom">Send POD</md-tooltip>
            </md-button>
            <label>POD Info</label>
            <div class="row row-no-padding row-out">
                <!--<img ng-src="{{'data:image/png;base64,'+ctrl.jdSvc.currentJob.podPhoto}}" />-->
                <div id="intel-carousel-pod" class="carousel slide" data-interval="false">
                    <!-- Indicators -->
                    <ol class="carousel-indicators">
                        <li data-target="#intel-carousel-pod"
                            ng-repeat="img in ctrl.jdSvc.currentJob.podPhotos track by $index"
                            data-slide-to="{{$index}}" ng-class="{'active' :$index === 0}"></li>
                    </ol>

                    <!-- Wrapper for slides -->
                    <div class="carousel-inner" role="listbox">
                        <div class="item" data-jobindex="{{$index}}" ng-repeat="img in ctrl.jdSvc.currentJob.podPhotos"
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

        <div ng-if="!ctrl.jdSvc.currentJob.bulkJob">
            <div class="palletInfo" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">

                <div style="display: flex; justify-content: space-between;">
                    <label>Pallet Info</label>
                    <md-button
                            class="md-fab md-mini md-raised"
                            ng-click="ctrl.jdSvc.newPallet($event, ctrl.jdSvc.currentJob)"
                            ng-disabled="ctrl.jdSvc.currentJob.locked">
                        <md-icon md-font-set="material-symbols-outlined">box_add</md-icon>
                        <md-tooltip md-direction="bottom">Add Pallet</md-tooltip>
                    </md-button>
                </div>

                <div class="value" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">
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
                        <tr context-menu="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.palletMenu"
                            ng-click="!ctrl.jdSvc.currentJob.locked && ctrl.jdSvc.editPallet(pallet)"
                            ng-repeat="pallet in ctrl.jdSvc.currentJob.palletInfo">
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


        <div ng-if="!ctrl.jdSvc.currentJob.bulkJob && ctrl.jdSvc.currentJob.contactList">
            <div class="palletInfo" ng-class="ctrl.jdSvc.currentJob.locked ? 'disabled' : ''">

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
                    <tr ng-repeat="contact in ctrl.jdSvc.currentJob.contactList">
                        <td>{{contact.fullName}}</td>
                        <td>{{contact.jobTitle}}</td>
                        <td><a class="pointer:cursor" ng-href="tel:{{contact.directDial}}">{{contact.directDial}}</a>
                        </td>
                        <td><a class="pointer:cursor" ng-href="tel:{{contact.mobile}}">{{contact.mobile}}</a></td>
                        <td>{{contact.email}}</td>

                    </tr>
                    </tbody>
                </table>
            </div>

        </div>
    </div>
</md-content>

<div class="container-fluid" id="jobDetail" ng-if="ctrl.jdSvc.currentJob && ctrl.jdSvc.currentJob.preBook"
     style="padding:0">
    <div class="fields">
        <div class="row row-no-padding row-out">
            <div class="col-md-4">
                <div class="row row-no-padding addresses">
                    <div class="col-md-6">
                        <div class="field">
                            <label>Client</label><i class="fa fa-edit" title="Change Client Code"
                                                    ng-click="ctrl.jdSvc.editClientCode($event, ctrl.jdSvc.currentJob)"></i>

                            <div class="value"><a class="uline" src="#"
                                                  ng-click="ctrl.jdSvc.clientClick($event, ctrl.jdSvc.currentJob)">{{ctrl.jdSvc.currentJob.client}}
                                {{ctrl.jdSvc.currentJob.clientName}}</a></div>
                        </div>
                        <div class="field" ng-class="ctrl.jdSvc.currentJob.pickUpLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="fromAddress"
                             ng-click="ctrl.jdSvc.updateGPS(ctrl.jdSvc.currentJob, 'fromAddress')">
                            <label>From: {{ctrl.jdSvc.currentJob.from}} {{ctrl.jdSvc.currentJob.fromPostCode}}</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.fromAddress}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editFromJobContact($event, ctrl.jdSvc.currentJob)">
                            <label>From Contact:</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.fromContactName}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editJobFromPhone($event, ctrl.jdSvc.currentJob)">
                            <label>From Phone: </label>
                            <div class="value">{{ctrl.jdSvc.currentJob.fromContactNumber}}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="field">
                            <label>Job #</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.jobNo}}</div>
                        </div>

                        <div class="field" ng-class="ctrl.jdSvc.currentJob.deliveryLongitude ? '' : 'red'"
                             context-menu="detailAddressMenu" data-field="toAddress"
                             ng-click="ctrl.jdSvc.updateGPS(ctrl.jdSvc.currentJob,'toAddress')">
                            <label>To: {{ctrl.jdSvc.currentJob.to}} {{ctrl.jdSvc.currentJob.toPostCode}}</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.toAddress}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="ctrl.jdSvc.editToJobContact($event, ctrl.jdSvc.currentJob))">
                            <label>To Contact</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.deliverToContact}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editJobToPhone($event, ctrl.jdSvc.currentJob)">
                            <label>To Phone</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.phone}}</div>
                        </div>
                    </div>
                </div>

                <div class="notes-add"></div>
                <div class="notes field">
                    <label>Notes</label>
                    <md-button class="md-fab md-mini md-primary" style="float: right;"
                               ng-click="ctrl.jdSvc.showNotesDialog($event, ctrl.jdSvc.currentJob, 'Notes','Note')">
                        <md-icon md-font-set="material-symbols-outlined">add_notes</md-icon>
                        <md-tooltip md-direction="bottom">Add New Note</md-tooltip>
                    </md-button>
                    <div class="value">
                        <pre>{{ctrl.jdSvc.currentJob.internalNotes}}</pre>
                    </div>
                </div>

            </div>
            <div class="col-md-4">
                <div class="row row-no-padding">
                    <div class="col-md-6">
                        <div class="field" ng-click="ctrl.jdSvc.contactClick($event, ctrl.jdSvc.currentJob)"
                             ng-show="!ctrl.jdSvc.currentJob.bulkJob">
                            <label>Booked by Contact</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.contactName}}</div>
                        </div>
                        <div class="field">
                            <label ng-class="disabled">Logged-in Contact</label>
                            <div class="value" ng-class="disabled">{{ctrl.jdSvc.currentJob.loggedInContactName}}</div>
                        </div>
                        <div ng-show="name=='POD'" class="field">
                            <label ng-class="disabled">Source</label>
                            <div class="value" ng-class="disabled">{{ctrl.jdSvc.currentJob.source}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.sizeClick($event, ctrl.jdSvc.currentJob)">
                            <label>Size</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.size.label}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editItems($event, ctrl.jdSvc.currentJob)">
                            <label>Items</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.items}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editJobWeight($event, ctrl.jdSvc.currentJob)">
                            <label>Weight</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.weight}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editRef($event, ctrl.jdSvc.currentJob, true)">
                            <label>Ref A</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.refA}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editRef($event, ctrl.jdSvc.currentJob, false)">
                            <label>Ref B</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.refB}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editOurRef($event, ctrl.jdSvc.currentJob)">
                            <label>Our Ref</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.ourRef}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.trackingMethodClick($event, ctrl.jdSvc.currentJob)">
                            <label>Tracking Method</label>
                            <div class="value">{{ctrl.jdSvc.getTrackingMethod(ctrl.jdSvc.currentJob.trackingMethod)}}
                            </div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editTrackingMobile($event, ctrl.jdSvc.currentJob)">
                            <label>Tracking Mobile</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.trackingMobile}}</div>
                        </div>
                        <div class="field"
                             ng-click=" ctrl.jdSvc.editTrackingEmail($event, ctrl.jdSvc.currentJob)">
                            <label>Tracing Email</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.trackingEmail}}</div>
                        </div>

                        <br/>

                    </div>
                    <div class="col-md-6">

                        <div class="field" ng-click="ctrl.jdSvc.speedClick($event, ctrl.jdSvc.currentJob)">
                            <label>Speed</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.speedName}}</div>
                        </div>

                        <div class="field">
                            <label>Direct</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.preBookDirectClick(ctrl.jdSvc.currentJob)"
                                    ng-disabled="ctrl.jdSvc.currentJob.locked"
                                    ng-model="ctrl.jdSvc.currentJob.direct">
                            </md-checkbox>
                        </div>

                        <div class="field" ng-click="ctrl.jdSvc.leaveClick($event, ctrl.jdSvc.currentJob)">
                            <label>Leave Parcel</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.sigNotRequired || "Signature Required"}}</div>
                        </div>

                        <div class="field" ng-click="ctrl.jdSvc.dgClassClick($event, ctrl.jdSvc.currentJob)">
                            <label>DG# / Docs</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.dgClass}} /
                                {{ctrl.jdSvc.hasDGDocs(ctrl.jdSvc.currentJob)}}
                            </div>
                        </div>
                        <div class="field">
                            <label>Courier</label>
                            <div class="value" ng-click="ctrl.jdSvc.courierClick($event, ctrl.jdSvc.currentJob)">
                                {{ctrl.jdSvc.currentJob.courier}}
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
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'NextDue','Next Due',ctrl.jdSvc.currentJob.nextDue,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>Next Due</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.nextDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'LastDone','Last Done',ctrl.jdSvc.currentJob.lastDone,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>Last Done</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.lastDone | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field contact"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'InActiveBy','InActive By',ctrl.jdSvc.currentJob.inActiveBy,ctrl.jdSvc.currentJob.id)">
                            <label>InActive By</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.inActiveBy}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'InActiveDate','InActive Date',ctrl.jdSvc.currentJob.inActiveDate,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>InActive Date</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.inActiveDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'FirstDue','First Due',ctrl.jdSvc.currentJob.firstDue,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>First Due</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.firstDue | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'StopDate','Stop Date',ctrl.jdSvc.currentJob.stopDate,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>Stop Date</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.stopDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'RestartDate','Restart Date',ctrl.jdSvc.currentJob.restartDate,ctrl.jdSvc.currentJob.id, 'date')">
                            <label>Restart Date</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.restartDate | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field">
                            <label>One Off</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.oneOffClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.oneOff">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Active</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.activeClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.active">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Done</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.doneClick($event, ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.done">
                            </md-checkbox>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="field"
                             ng-click="ctrl.jdSvc.editJobDate($event, ctrl.jdSvc.currentJob)">
                            <label>Date</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.date | date: "dd/MM/yyyy"}}</div>
                        </div>
                        <div class="field"
                             ng-click="ctrl.jdSvc.editLogTime($event, ctrl.jdSvc.currentJob)">
                            <label>Log time</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.time | date: "h:mm a"}}</div>
                        </div>

                        <div class="field"
                             ng-click="ctrl.jdSvc.editDetailField(ctrl.jdSvc.currentJob, 'Amount','Amount',ctrl.jdSvc.currentJob.charge,ctrl.jdSvc.currentJob.id)">
                            <label ng-if="!ctrl.jdSvc.currentJob.ratedManually">Charge</label>
                            <label ng-if="ctrl.jdSvc.currentJob.ratedManually">Charge (Manually Rated)</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.charge}}</div>
                        </div>
                        <div class="field">
                            <label>Client notes</label>
                            <div class="value">{{ctrl.jdSvc.currentJob.clientNotes}}</div>
                        </div>
                        <div class="field">
                            <label>Van</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.vanClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.van">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Truck</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.truckClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.truck">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Pedal</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.pedalClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.pedal">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Attention</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.attentionClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.attention">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Return</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.preBookReturnClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.return">
                            </md-checkbox>
                        </div>
                        <div class="field">
                            <label>Reprice</label>
                            <md-checkbox
                                    ng-click="ctrl.jdSvc.repriceClick(ctrl.jdSvc.currentJob)"
                                    ng-model="ctrl.jdSvc.currentJob.reprice">
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
                    <img ng-src="{{ctrl.jdSvc.currentJob.pODPhoto}}" style="display: block; margin: auto;"/>

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
                            ng-repeat="pallet in ctrl.jdSvc.currentJob.palletInfo">
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

<div class="no-data" ng-if="!ctrl.jdSvc.currentJob && !currentCourier">
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
