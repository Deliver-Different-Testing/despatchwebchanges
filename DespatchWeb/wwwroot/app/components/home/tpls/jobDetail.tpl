<div class="container-fluid" id="jobDetail" style="padding:0" ng-if="currentJob">
	<div class="fields">
		<div class="row row-no-padding row-out">
			<div class="col-md-6">
				<div class="row row-no-padding addresses">
					<div class="col-md-6">
						<div class="field">
							<label>Client</label>
							<div class="value"><a class="uline" src="#" ng-click="">{{currentJob.Client}}</a></div>
						</div>
						<div class="field" ng-class="currentJob.PickUpLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="FromAddress" ng-click="editDetailField('FromAddress','From Address',currentJob.FromAddress,currentJob.ID,'textarea')">
							<label>From: {{currentJob.From}}</label>
							<div class="value">{{currentJob.FromAddress}}</div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="field contact">
							<label>Contact</label>
							<div class="value">{{currentJob.ContactName}}</div>
						</div>
						<div class="field" ng-class="currentJob.DeliveryLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="ToAddress" ng-click="editDetailField('ToAddress','To Address',currentJob.ToAddress,currentJob.ID,'textarea')">
							<label>To: {{currentJob.To}}</label>
							<div class="value">{{currentJob.ToAddress}}</div>
						</div>
					</div>
				</div>
				<div class="notes-add"></div>
				<div class="notes field" ng-click="editDetailField('InternalNotes','Notes',currentJob.InternalNotes,currentJob.ID,'textarea')">
					<label>Notes</label>
					<div class="value"><pre>{{currentJob.InternalNotes}}</pre></div>
				</div>

			</div>
			<div class="col-md-6">
				<div class="row row-no-padding">
					<div class="col-md-4">

						<div class="field" ng-click="editDetailField('Phone','Phone Number',currentJob.Phone,currentJob.ID)">
							<label>Phone</label>
							<div class="value">{{currentJob.Phone}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Size','Size',currentJob.Size,currentJob.ID, 'select', options.detail.size)">
							<label>Size</label>
							<div class="value">{{currentJob.Size.label}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Items','Items',currentJob.Items,currentJob.ID)">
							<label>Items</label>
							<div class="value">{{currentJob.Items}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Weight','Weight',currentJob.Weight,currentJob.ID)">
							<label>Weight</label>
							<div class="value">{{currentJob.Weight}}</div>
						</div>
						<div class="field" ng-click="editDetailField('RefA','Ref A',currentJob.RefA,currentJob.ID)">
							<label>Ref A</label>
							<div class="value">{{currentJob.RefA}}</div>
						</div>
						<div class="field" ng-click="editDetailField('RefB','Ref B',currentJob.RefB,currentJob.ID)">
							<label>Ref B</label>
							<div class="value">{{currentJob.RefB}}</div>
						</div>
						<div class="field" ng-click="editDetailField('OurRef','Our Ref',currentJob.OurRef,currentJob.ID)">
							<label>Our Ref</label>
							<div class="value">{{currentJob.OurRef}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Event','Event',currentJob.Event,currentJob.ID)">
							<label>Event</label>
							<div class="value">{{currentJob.Event}}</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="field" ng-click="editDetailField('PodName','POD Name',currentJob.PodName,currentJob.ID)">
							<label>POD Name</label>
							<div class="value">{{currentJob.PodName}}</div>
						</div>
						<div class="field" ng-click="editDetailField('SpeedAccepted','Speed Accepted',currentJob.SpeedAccepted,currentJob.ID)">
							<label>Speed Accepted</label>
							<div class="value">{{currentJob.SpeedAccepted}}</div>
						</div>
						<div class="field" ng-click="editDetailField('SpeedNofitied','Speed Nofitied',currentJob.SpeedNofitied,currentJob.ID)">
							<label>Speed Notified</label>
							<div class="value">{{currentJob.SpeedNofitied}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Direct','Direct',currentJob.Direct,currentJob.ID)">
							<label>Direct</label>
							<div class="value">{{currentJob.Direct}}</div>
						</div>
						<div class="field" ng-click="editDetailField('SigNotRequired','Signature Not Required',currentJob.SigNotRequired,currentJob.ID)">
							<label>Sig not req</label>
							<div class="value">{{currentJob.SigNotRequired}}</div>
						</div>
						<div class="field" ng-click="editDetailField('UDStatus','UD Status',currentJob.UDStatus,currentJob.ID)">
							<label>UD status</label>
							<div class="value">{{currentJob.UDStatus}}</div>
						</div>
						<div class="field" ng-click="editDetailField('DGClass','DG Class',currentJob.DGClass,currentJob.ID)">
							<label>DG #         Docs</label>
							<div class="value">{{currentJob.DGClass}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Courier','Courier',currentJob.Courier,currentJob.ID)">
							<label>Courier</label>
							<div class="value">{{currentJob.Courier}}</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="field" ng-click="editDetailField('PodTime','POD Time',currentJob.PodTime,currentJob.ID,'time')">
							<label>POD Time</label>
							<div class="value">{{currentJob.PodTime | date : "h:mm a"}}</div>
						</div>
						<div class="field" ng-click="editDetailField('JobNo','Job Number',currentJob.JobNo,currentJob.ID)">
							<label>Job #</label>
							<div class="value">{{currentJob.JobNo}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Date','Date',currentJob.Date,currentJob.ID, 'date')">
							<label>Date</label>
							<div class="value">{{currentJob.Date | date : "dd/MM/yyyy"}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Time','Time',currentJob.Time,currentJob.ID,'time')">
							<label>Log time</label>
							<div class="value">{{currentJob.Time | date : "h:mm a"}}</div>
						</div>
						<div class="field" ng-click="editDetailField('DispatchTime','Dispatch Time',currentJob.DispatchTime,currentJob.ID,'time')">
							<label>Dispatch time</label>
							<div class="value">{{currentJob.DispatchTime | date : "h:mm a"}}</div>
						</div>
						<div class="field" ng-click="editDetailField('PU','PU',currentJob.PU,currentJob.ID)">
							<label>PU time</label>
							<div class="value">{{currentJob.PU}}</div>
						</div>
						<div class="field" ng-click="editDetailField('Charge','Charge',currentJob.Charge,currentJob.ID)">
							<label>Charge</label>
							<div class="value">{{currentJob.Charge}}</div>
						</div>
						<div class="field" ng-click="editDetailField('ClientNotes','Client Notes',currentJob.ClientNotes,currentJob.ID, 'textarea')">
							<label>Client notes</label>
							<div class="value">{{currentJob.ClientNotes}}</div>
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
								<tr ng-repeat="pallet in currentJob.PalletInfo" context-menu="palletMenu" ng-click="editPallet(pallet)">
									<td>{{pallet.Quantity}}</td>
									<td>{{pallet.Weight}}</td>
									<td>{{pallet.Length}}</td>
									<td>{{pallet.Depth}}</td>
									<td>{{pallet.Height}}</td>
									<td>{{pallet.PU}}</td>
									<td>{{pallet.DO}}</td>
									<td>{{pallet.DGClass}}</td>
									<td>{{pallet.Notes}}</td>
								</tr>
							</tbody>
						</table>
					</div>

				</div>
			</div>


	</div>
</div>

<div ng-if="currentCourier" style="height: 100%;">
	<div class="overlay-map-fix"></div>
	<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d18042.219705093252!2d174.80882121707236!3d-36.92755660674388!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x88d0fdf8f51b1d11!2sUrgent+Couriers!5e0!3m2!1sen!2snz!4v1523407620949" width="100%" height="100%" frameborder="0" style="border:0" allowfullscreen></iframe>

</div>

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