<div class="container-fluid" id="jobDetail" style="padding:0" ng-if="currentJob">
	<div class="fields">
		<div class="row row-no-padding row-out">
			<div class="col-md-6">
				<div class="row row-no-padding addresses">
					<div class="col-md-6">
						<div class="field">
							<label>Client</label>
							<div class="value"><a class="uline" src="#" ng-click="">{{currentJob.client}}</a></div>
						</div>
						<div class="field" ng-class="currentJob.pickUpLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="fromAddress" ng-click="updateGPS('fromAddress')">
							<label>From: {{currentJob.from}}</label>
							<div class="value">{{currentJob.fromAddress}}</div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="field contact">
							<label>Contact</label>
							<div class="value">{{currentJob.contactName}}</div>
						</div>
						<div class="field" ng-class="currentJob.deliveryLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="toAddress" ng-click="updateGPS('toAddress')">
							<label>To: {{currentJob.to}}</label>
							<div class="value">{{currentJob.toAddress}}</div>
						</div>
					</div>
				</div>
				<div class="notes-add"></div>
				<div class="notes field"  ng-click="editDetailField('Notes','Note','',currentJob.id, 'textarea')">
					<label>Notes</label>
					<div class="value"><pre>{{currentJob.internalNotes}}</pre></div>
				</div>

			</div>
			<div class="col-md-6">
				<div class="row row-no-padding">
					<div class="col-md-4">

						<div class="field" >
							<label>Phone</label>
							<div class="value">{{currentJob.phone}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Size','Size',currentJob.size,currentJob.id, 'select', options.detail.size)">
							<label>Size</label>
							<div class="value">{{currentJob.size.label}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Items','Items',currentJob.items,currentJob.id)">
							<label>Items</label>
							<div class="value">{{currentJob.items}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Weight','Weight',currentJob.weight,currentJob.id)">
							<label>Weight</label>
							<div class="value">{{currentJob.weight}}</div>
						</div>
						<div class="field" >
							<label>Ref A</label>
							<div class="value">{{currentJob.refA}}</div>
						</div>
						<div class="field" >
							<label>Ref B</label>
							<div class="value">{{currentJob.refB}}</div>
						</div>
						<div class="field" >
							<label>Our Ref</label>
							<div class="value">{{currentJob.ourRef}}</div>
						</div>
						<div class="field" >
							<label>Event</label>
							<div class="value">{{currentJob.event}}</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="field">
							<label>POD Name</label>
							<div class="value">{{currentJob.podName}}</div>
						</div>
						<div class="field" >
							<label>Speed Accepted</label>
							<div class="value">{{currentJob.speedAccepted}}</div>
						</div>
						<div class="field" >
							<label>Speed Notified</label>
							<div class="value">{{currentJob.speedNofitied}}</div>
						</div>
						<div class="field" >
							<label>Direct</label>
							<div class="value">{{currentJob.direct}}</div>
						</div>
						<div class="field" >
							<label>Sig not req</label>
							<div class="value">{{currentJob.sigNotRequired}}</div>
						</div>
						<div class="field" >
							<label>UD status</label>
							<div class="value">{{currentJob.UDStatus}}</div>
						</div>
						<div class="field" >
							<label>DG #         Docs</label>
							<div class="value">{{currentJob.DGClass}}</div>
						</div>
						<div class="field" >
							<label>Courier</label>
							<div class="value">{{currentJob.courier}}</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="field" >
							<label>POD Time</label>
							<div class="value">{{currentJob.podTime | date : "h:mm a"}}</div>
						</div>
						<div class="field">
							<label>Job #</label>
							<div class="value">{{currentJob.jobNo}}</div>
						</div>
						<div class="field" <!--ng-click="editDetailField('Date','Date',currentJob.date,currentJob.id, 'date')-->">
							<label>Date</label>
							<div class="value">{{currentJob.date | date : "dd/MM/yyyy"}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Time','Time',currentJob.time,currentJob.id,'time')">
							<label>Log time</label>
							<div class="value">{{currentJob.time | date : "h:mm a"}}</div>
						</div>
						<div class="field">
							<label>Dispatch time</label>
							<div class="value">{{currentJob.dispatchTime | date : "h:mm a"}}</div>
						</div>
						<div class="field">
							<label>PU time</label>
							<div class="value">{{currentJob.puTime | date : "h:mm a"}}</div>
						</div>
						<div class="field">
							<label>Charge</label>
							<div class="value">{{currentJob.charge}}</div>
						</div>
						<div class="field">
							<label>Client notes</label>
							<div class="value">{{currentJob.clientNotes}}</div>
						</div>
					</div>
				</div>
			</div>

		</div>

			<div>
				<div class="palletInfo">
					
					<label>Pallet Info</label>
					<div class="btn btn-sml addPallet" ng-click="newPallet()">Add Pallet</div>
					<div class="value">
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
								<tr ng-repeat="pallet in currentJob.palletInfo" context-menu="palletMenu" ng-click="editPallet(pallet)">
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