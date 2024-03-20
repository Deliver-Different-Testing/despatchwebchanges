<div class="container-fluid" id="jobDetail" style="padding:0" ng-if="currentJob">
	<div class="fields">
		<div class="row row-no-padding row-out">
			<div class="col-md-4">
				<div class="row row-no-padding addresses">
					<div class="col-md-6">
						<div class="field">
							<label>Client</label><i class="fa fa-edit" title="Change Client Code" ng-click="jdSvc.editDetailField(currentJob, 'ClientCode','Client Code',currentJob.client,currentJob.id)"></i>

							<div class="value"><a class="uline" src="#" ng-click="jdSvc.clientClick(currentJob)">{{currentJob.client}} {{currentJob.clientName}}</a></div>
						</div>
						<div class="field" ng-class="currentJob.pickUpLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="fromAddress" ng-click="jdSvc.updateGPS(currentJob, 'fromAddress')">
							<label>From: {{currentJob.from}}</label>
							<div class="value">{{currentJob.fromAddress}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'FromContactName','From Contact Name',currentJob.fromContactName,currentJob.id)">
							<label>From Contact:</label>
							<div class="value">{{currentJob.fromContactName}}</div>
						</div>
						<div class="field"ng-click="jdSvc.editDetailField(currentJob, 'FromContactPhone','From Contact Phone',currentJob.fromContactNumber,currentJob.id)">
							<label>From Phone:	</label>
							<div class="value">{{currentJob.fromContactNumber}}</div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="field">
							<label>Job #</label>
							<div class="value">{{currentJob.jobNo}}</div>
						</div>
						
						<div class="field" ng-class="currentJob.deliveryLongitude ? '' : 'red'" context-menu="detailAddressMenu" data-field="toAddress" ng-click="jdSvc.updateGPS(currentJob,'toAddress')">
							<label>To: {{currentJob.to}}</label>
							<div class="value">{{currentJob.toAddress}}</div>
						</div>
						<div class="field contact" ng-click="jdSvc.editDetailField(currentJob, 'ToContactName','To Contact Name',currentJob.deliverToContact,currentJob.id)">
							<label>To Contact</label>
							<div class="value">{{currentJob.deliverToContact}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'ToContactPhone','To Contact Phone',currentJob.phone,currentJob.id)">
							<label>To Phone</label>
							<div class="value">{{currentJob.phone}}</div>
						</div>
					</div>
				</div>
				<div class="notes-add"></div>
				<div class="notes field"  ng-click="jdSvc.editDetailField(currentJob, 'Notes','Note','',currentJob.id, 'textarea')">
					<label>Notes</label>
					<div class="value"><pre>{{currentJob.internalNotes}}</pre></div>
				</div>

			</div>
			<div class="col-md-4">
				<div class="row row-no-padding">
					<div class="col-md-6">
						<div  class="field"  ng-click="jdSvc.contactClick(currentJob)">
							<label>Booked by Contact</label>
							<div class="value">{{currentJob.contactName}}</div>
						</div>
						<div class="field">
							<label ng-class="disabled">Logged-in Contact</label>
							<div ng-class="disabled" class="value">{{currentJob.loggedInContactName}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Size','Size',currentJob.size,currentJob.id, 'select', options.detail.size)">
							<label>Size</label>
							<div class="value">{{currentJob.size.label}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Items','Items',currentJob.items,currentJob.id)">
							<label>Items</label>
							<div class="value">{{currentJob.items}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Weight','Weight',currentJob.weight,currentJob.id)">
							<label>Weight</label>
							<div class="value">{{currentJob.weight}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'RefA','RefA',currentJob.refA,currentJob.id)">
							<label>Ref A</label>
							<div class="value">{{currentJob.refA}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'RefB','RefB',currentJob.refB,currentJob.id)">
							<label>Ref B</label>
							<div class="value">{{currentJob.refB}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'OurRef','OurRef',currentJob.ourRef,currentJob.id)">
							<label>Our Ref</label>
							<div class="value">{{currentJob.ourRef}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'TrackingMethod','Tracking Method',currentJob.trackingMethod,currentJob.id, 'select', options.detail.tracking)">
							<label>Tracking Method</label>
							<div class="value">{{jdSvc.getTrackingMethod(currentJob.trackingMethod)}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'TrackingMobile','Tracking Mobile',currentJob.trackingMobile,currentJob.id)">
							<label>Tracking Mobile</label>
							<div class="value">{{currentJob.trackingMobile}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'TrackingEmail','Tracking Email',currentJob.trackingEmail,currentJob.id)">
							<label>Tracing Email</label>
							<div class="value">{{currentJob.trackingEmail}}</div>
						</div>
					
				<br />

					</div>
					<div class="col-md-6">
						
						<div class="field"  ng-click="jdSvc.speedClick(currentJob)">
							<label>Speed</label>
							<div class="value">{{currentJob.speedName}}</div>
						</div>
						
						<div class="field" >
							<label>Direct</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.preBookDirectClick(currentJob)" ng-model="currentJob.direct"/></div>
						</div>
						
						<div class="field" ng-click="jdSvc.leaveClick(currentJob)" >
							<label>Leave Parcel</label>
							<div class="value">{{currentJob.sigNotRequired || "Signature Required"}}</div>
						</div>
						
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'DGClass','DG Class',currentJob.dgClass,currentJob.id, 'select', options.detail.DGClass)">
							<label>DG# / Docs</label>
							<div class="value">{{currentJob.dgClass}} / {{jdSvc.hasDGDocs(currentJob)}} </div>
						</div>
						<div class="field" >
							<label>Courier</label>
							<div class="value" ng-click="jdSvc.courierClick(currentJob)">{{currentJob.courier}}</div>
						</div>
							<div class="field" ng-class="jdSvc.combos.frequency.length > 0 ? '' : 'red'">
							<b>Frequency:</b>&nbsp;<i ng-if="jdSvc.combos.frequency.length === 0" class="fa fa-exclamation"></i> <br />
							<i><span ng-repeat="item in jdSvc.combos.frequency">{{item.label}}  </span></i>
							<div class="multi-element" ng-dropdown-multiselect="" options="jdSvc.pickFrequency"  extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}" events="jdSvc.combos.frequencyEvents" selected-model="jdSvc.combos.frequency"></div>
						</div>
						<div class="field" ng-class="jdSvc.combos.days.length > 0 ? '' : 'red'">
							<b>Days:</b>&nbsp;<i ng-if="jdSvc.combos.days.length === 0" class="fa fa-exclamation"></i><br />
							<i><span ng-repeat="item in jdSvc.combos.days">{{item.label}}  </span></i>
							<div class="multi-element" ng-dropdown-multiselect="" options="jdSvc.pickDays" extra-settings="{showUncheckAll:false, closeOnSelect:true, closeOnDeselect:true}"  events="jdSvc.combos.daysEvents" selected-model="jdSvc.combos.days"></div>
						</div>
						<div class="field" ng-class="jdSvc.combos.holidays.length > 0 ? '' : 'red'">
							<b>Holidays:</b>&nbsp;<i ng-if="jdSvc.combos.holidays.length === 0" class="fa fa-exclamation"></i><br />
							<i><span ng-repeat="item in jdSvc.combos.holidays">{{item.label}}  </span></i>
							<div class="multi-element" ng-dropdown-multiselect="" options="jdSvc.pickHolidays" extra-settings="{selectionLimit:1, showUncheckAll:false, closeOnSelect:true}"  events="jdSvc.combos.holidaysEvents" selected-model="jdSvc.combos.holidays"></div>
						</div>
					</div>
					
				</div>
			</div>
			<div class="col-md-4">
				<div class="row row-no-padding">
					<div class="col-md-6">
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'NextDue','Next Due',currentJob.nextDue,currentJob.id, 'date')">
								<label>Next Due</label>
								<div class="value">{{currentJob.nextDue | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'LastDone','Last Done',currentJob.lastDone,currentJob.id, 'date')">
								<label>Last Done</label>
								<div class="value">{{currentJob.lastDone | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field contact" ng-click="jdSvc.editDetailField(currentJob, 'InActiveBy','InActive By',currentJob.inActiveBy,currentJob.id)">
								<label>InActive By</label>
								<div class="value">{{currentJob.inActiveBy}}</div>
							</div>
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'InActiveDate','InActive Date',currentJob.inActiveDate,currentJob.id, 'date')">
								<label>InActive Date</label>	
								<div class="value">{{currentJob.inActiveDate | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'FirstDue','First Due',currentJob.firstDue,currentJob.id, 'date')">
								<label>First Due</label>
								<div class="value">{{currentJob.firstDue | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'StopDate','Stop Date',currentJob.stopDate,currentJob.id, 'date')">
								<label>Stop Date</label>
								<div class="value">{{currentJob.stopDate | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'RestartDate','Restart Date',currentJob.restartDate,currentJob.id, 'date')">
								<label>Restart Date</label>
								<div class="value">{{currentJob.restartDate | date: "dd/MM/yyyy"}}</div>
							</div>
							<div class="field" >
								<label>One Off</label>
								<div class="value"><input type="checkbox" ng-click="jdSvc.oneOffClick(currentJob)" ng-model="currentJob.oneOff"/></div>
							</div>
							<div class="field" >
								<label>Active</label>
								<div class="value"><input type="checkbox" ng-click="jdSvc.activeClick(currentJob)" ng-model="currentJob.active"/></div>
							</div>
							<div class="field" >
								<label>Done</label>
								<div class="value"><input type="checkbox" ng-click="jdSvc.doneClick(currentJob)" ng-model="currentJob.done"/></div>
							</div>
					</div>
					<div class="col-md-6">
						
						
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Date','Date',currentJob.date,currentJob.id, 'date')">
							<label>Date</label>
							<div class="value">{{currentJob.date | date : "dd/MM/yyyy"}}</div>
						</div>
						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Time','Time',currentJob.time,currentJob.id,'time')">
							<label>Log time</label>
							<div class="value">{{currentJob.time | date : "h:mm a"}}</div>
						</div>

						<div class="field" ng-click="jdSvc.editDetailField(currentJob, 'Amount','Amount',currentJob.charge,currentJob.id)">
							<label ng-if="!currentJob.ratedManually">Charge</label>
							<label ng-if="currentJob.ratedManually">Charge (Manually Rated)</label>
							<div class="value">{{currentJob.charge}}</div>
						</div>
						<div class="field">
							<label>Client notes</label>
							<div class="value">{{currentJob.clientNotes}}</div>
						</div>
						<div class="field" >
							<label>Van</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.vanClick(currentJob)" ng-model="currentJob.van"/></div>
						</div>
						<div class="field" >
							<label>Truck</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.truckClick(currentJob)" ng-model="currentJob.truck"/></div>
						</div>
						<div class="field" >
							<label>Pedal</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.pedalClick(currentJob)" ng-model="currentJob.pedal"/></div>
						</div>
						<div class="field" >
							<label>Attention</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.attentionClick(currentJob)" ng-model="currentJob.attention"/></div>
						</div>
						<div class="field" >
							<label>Return</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.preBookReturnClick(currentJob)" ng-model="currentJob.return"/></div>
						</div>
						<div class="field" >
							<label>Reprice</label>
							<div class="value"><input type="checkbox" ng-click="jdSvc.repriceClick(currentJob)" ng-model="currentJob.reprice"/></div>
						</div>
					</div>
				</div>
			</div>

		</div>
		
			<div>
				<div class="palletInfo">
					
					<label>Pallet Info</label>
					<div class="btn btn-sml addPallet" ng-click="jdSvc.newPallet()">Add Pallet</div>
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
								<tr ng-repeat="pallet in currentJob.palletInfo" context-menu="jdSvc.palletMenu" ng-click="jdSvc.editPallet(pallet)">
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