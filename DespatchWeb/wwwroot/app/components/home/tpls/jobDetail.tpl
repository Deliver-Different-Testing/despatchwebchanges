<div class="container-fluid" id="jobDetail" style="padding:0" ng-if="currentJob">
	<div class="fields">
		<div class="row row-no-padding row-out">
			<div class="col-md-6">
				<div class="row row-no-padding addresses">
					<div class="col-md-6">
						<div class="field">
							<label>Client</label><i  ng-class="currentJob.locked ? 'disabled' : ''" class="fa fa-edit" title="Change Client Code" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'ClientCode','Client Code',currentJob.client,currentJob.id)"></i>

							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><a  ng-class="currentJob.locked ? 'disabled' : ''" class="uline" src="#" ng-click="!currentJob.locked && jdSvc.clientClick(currentJob)">{{currentJob.client}}</a></div>
						</div>
						<div class="field" ng-class="currentJob.pickUpLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="fromAddress" ng-click="!currentJob.locked && jdSvc.updateGPS(currentJob, 'fromAddress')">
							<label ng-class="currentJob.locked ? 'disabled' : ''">From: {{currentJob.from}}</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.fromAddress}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'FromContactName','From Contact Name',currentJob.fromContactName,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">From Contact:</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.fromContactName}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field"ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'FromContactPhone','From Contact Phone',currentJob.fromContactNumber,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">From Phone:	</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.fromContactNumber}}</div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="field">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Job #</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.jobNo}}</div>
						</div>
						
						<div class="field" ng-class="currentJob.deliveryLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="toAddress" ng-click="!currentJob.locked && jdSvc.updateGPS(currentJob,'toAddress')">
							<label ng-class="currentJob.locked ? 'disabled' : ''">To: {{currentJob.to}}</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.toAddress}}</div>
						</div>
						<div class="field contact" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'ToContactName','To Contact Name',currentJob.deliverToContact,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">To Contact</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.deliverToContact}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'ToContactPhone','To Contact Phone',currentJob.phone,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">To Phone</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.phone}}</div>
						</div>
					</div>
				</div>
				<div class="notes-add"></div>
				<div class="notes field"  ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Notes','Note','',currentJob.id, 'textarea')">
					<label ng-class="currentJob.locked ? 'disabled' : ''">Notes</label>
					<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><pre>{{currentJob.internalNotes}}</pre></div>
				</div>

			</div>
			<div class="col-md-6">
				<div class="row row-no-padding">
					<div class="col-md-4">

						
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Size','Size',currentJob.size,currentJob.id, 'select', options.detail.size)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Size</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.size.label}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Items','Items',currentJob.items,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Items</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.items}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Weight','Weight',currentJob.weight,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Weight</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.weight}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'RefA','RefA',currentJob.refA,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Ref A</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.refA}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'RefB','RefB',currentJob.refB,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Ref B</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.refB}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'OurRef','OurRef',currentJob.ourRef,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Our Ref</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.ourRef}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'TrackingMethod','Tracking Method',currentJob.trackingMethod,currentJob.id, 'select', options.detail.tracking)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Tracking Method</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{jdSvc.getTrackingMethod(currentJob.trackingMethod)}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'TrackingMobile','Tracking Mobile',currentJob.trackingMobile,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Tracking Mobile</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.trackingMobile}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'TrackingEmail','Tracking Email',currentJob.trackingEmail,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Tracking Email</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.trackingEmail}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field"  ng-click="!currentJob.locked && jdSvc.internalStatusClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Job FollowUp</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{jdSvc.getInternalStatus(currentJob.internalStatusID)}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && !currentJob.internalStatusID ==1 && !currentJob.internalStatusID ==4 && jdSvc.editDetailField(currentJob, 'FollowupTime','FollowUp Time',currentJob.followupTime,currentJob.id,'datetime')">
							<label ng-class="currentJob.locked || currentJob.internalStatusID ===1 || currentJob.internalStatusID ===4 ? 'disabled' : ''">FollowUp Time</label>
							<div ng-class="currentJob.locked || currentJob.internalStatusID ===1 || currentJob.internalStatusID ===4  ? 'disabled' : ''" class="value">{{currentJob.followupTime | date : "dd/MM/yyyy h:mm a"}}</div>
						</div>

					</div>
					<div class="col-md-4">
						<div ng-if="currentJob.bulkJob" class="field">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Run Name</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.runName}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'PODName','POD Name',currentJob.podName,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">POD Name</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.podName}}</div>
						</div>
						<div class="field"  ng-click="!currentJob.locked && jdSvc.speedClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Speed</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.speed}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.notifyClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Speed Notified</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.notify}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.jobTypeClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Job Type</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{jdSvc.getJobTypeDescription(currentJob.jobType)}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Direct</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.directClick(currentJob)" ng-model="currentJob.direct"/></div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field"  ng-click="!currentJob.locked && currentJob.direct && jdSvc.acceptedClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Speed Accepted</label>
							<div ng-class="currentJob.direct && !currentJob.locked ? '' : 'disabled'" class="value" >{{currentJob.speedAccepted}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.leaveClick(currentJob)" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Leave Parcel</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.sigNotRequired || "Signature Required"}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.undeliverableClick(currentJob)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">UD status</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.udStatus}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'DGClass','DG Class',currentJob.dgClass,currentJob.id, 'select', options.detail.DGClass)">
							<label ng-class="currentJob.locked ? 'disabled' : ''">DG# / Docs</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.dgClass}} / {{jdSvc.hasDGDocs(currentJob)}} </div>
						</div>
						<div  class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Courier</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.courier}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Reprice</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.repriceClick(currentJob)" ng-model="currentJob.reprice"/></div>
						</div>
						<div class="field" ng-if="name=='POD'">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Void</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.voidClick(currentJob)" ng-model="currentJob.void"/></div>
						</div>
						<div class="field" ng-if="name=='POD' && !currentJob.bulkJob">	
							<label ng-class="currentJob.locked ? 'disabled' : ''">Done</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.doneClick(currentJob)" ng-model="currentJob.done"/></div>
						</div>
						<div class="field" ng-if="currentJob.bulkJob">	
							<label class="disabled">Pushed To Live</label>
							<div class="value disabled"><input type="checkbox" class="disabled" ng-model="currentJob.done"/></div>
						</div>
					</div>
					<div class="col-md-4">
						<div ng-if="!currentJob.bulkJob" class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'CompletedTime','Completed Time',currentJob.completedTime,currentJob.id,'time')">
							<label ng-class="currentJob.locked ? 'disabled' : ''">POD Time</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.completedTime | date : "h:mm a"}}</div>
						</div>
						
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Date','Date',currentJob.date,currentJob.id, 'date')">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Date</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.date | date : "dd/MM/yyyy"}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Time','Time',currentJob.time,currentJob.id,'time')">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Log time</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.time | date : "h:mm a"}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Dispatch time</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.dispatchTime | date : "h:mm a"}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field">
							<label ng-class="currentJob.locked ? 'disabled' : ''">PU time</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.puTime | date : "h:mm a"}}</div>
						</div>
						<div class="field" ng-click="!currentJob.locked && jdSvc.editDetailField(currentJob, 'Amount','Amount',currentJob.charge,currentJob.id)">
							<label ng-class="currentJob.locked ? 'disabled' : ''" ng-if="!currentJob.ratedManually">Charge</label>
							<label ng-class="currentJob.locked ? 'disabled' : ''" ng-if="currentJob.ratedManually">Charge (Manually Rated)</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.charge}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field">
							<label ng-class="currentJob.locked ? 'disabled' : ''">Client notes</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value">{{currentJob.clientNotes}}</div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Van</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.vanClick(currentJob)" ng-model="currentJob.van"/></div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Truck</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.truckClick(currentJob)" ng-model="currentJob.truck"/></div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Pedal</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.pedalClick(currentJob)" ng-model="currentJob.pedal"/></div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">Attention</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.attentionClick(currentJob)" ng-model="currentJob.attention"/></div>
						</div>
						<div ng-if="!currentJob.bulkJob" class="field" >
							<label ng-class="currentJob.locked ? 'disabled' : ''">VanOK?</label>
							<div ng-class="currentJob.locked ? 'disabled' : ''" class="value" class="value"><input type="checkbox" ng-class="currentJob.locked ? 'disabled' : ''" ng-click="!currentJob.locked && jdSvc.vanOkClick(currentJob)" ng-model="currentJob.vanOK"/></div>
						</div>
					</div>
				</div>
			</div>

		</div>
		<div ng-if="!currentJob.bulkJob" class="row row-no-padding row-out">
			<img ng-src="{{'data:image/png;base64,'+currentJob.podPhoto}}" />
		</div>
			<div ng-if="!currentJob.bulkJob">
				<div ng-class="currentJob.locked ? 'disabled' : ''" class="palletInfo">
					
					<label>Pallet Info</label>
					<div ng-class="currentJob.locked ? 'disabled' : ''"  class="btn btn-sml addPallet" ng-click="!currentJob.locked && jdSvc.newPallet()">Add Pallet</div>
					<div ng-class="currentJob.locked ? 'disabled' : ''"  class="value">
						<table class="table table-striped table-responsive">
							<thead>
								<tr class="pallet-table-head no select">
									<th>#</td>
									<th>W</td>
									<th>L</td>
									<th>D</td>
									<th>H</td>
									<th>PU</td>
									<th>DO</td>
									<th>DG Class</td>
									<th>Notes</td>
								</tr>
							</thead>
							<tbody>
								<tr ng-repeat="pallet in currentJob.palletInfo" context-menu="!currentJob.locked && jdSvc.palletMenu" ng-click="!currentJob.locked && jdSvc.editPallet(pallet)">
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

<!--<div ng-if="currentCourier" style="height: 100%;">
	<div class="overlay-map-fix"></div>
	<div id="map_canvas" style="width:100%;height:100%;"></div>

	<script src="app/components/home/map.js?v=1.3"></script>

</div>
-->
<div class="no-data" ng-if="!currentJob && !currentCourier">
    <div class="text">Please select a job or courier</div>
</div>


<div class="loading">
    <div class="text">
        <i class="fa fa-refresh fa-spin fa-3x fa-fw"></i>
        <span class="sr-only">Loading...</span>
    </div>
</div>

<div style="display:none">
{"ID":1,"Time":"9:30","Direct":"","JobNo":"AP68E","Speed":"Eco","Notify":"","Vehicle":"Car","Client":"UCL Ailsa Perkins","From":"Papatoetoe","To":"Ellerslie","ToAddress":"Ailsa Perkins, 28 Michaels Avenue","CourierNum":21,"Remain":55,"Status":"C","LP":"","LD":"","ContactName":"Ailsa","Phone":"","SpeedAccepted":"Eco","Size":"Car","Weight":"","Items":1,"RefA":"Personal","RefB":"","OurRef":"L664E","SigNotRequired":"Callout","Charge":"$5.81","Date":"11/04/2018","DispatchTime":"01/01/1900 10:04:00 AM","PUTime":"","ClientNotes":"","InternalNotes":"","PalletNums":"","Length":"","Height":"","Depth":"","TailLift PU":"","TailLiftDO":"","DGClass":"","Notes":""}
</div>