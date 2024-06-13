<div class="gatherForm" id="{{gather.form.id}}" ng-if="gather.form.tpl != 'multi'">
    <div class="gatherFields">
        <div class="gatherTitle">{{gather.form.title}}</div>
        <div ng-repeat="field in gather.form.fields" class="gatherField" style="display:inline-block; {{field.cssExtras}}">
          <div ng-switch="field.type">
            <div ng-switch-default>
              <input type="text" placeholder="{{field.label}}" name="{{field.name}}" id="gather-{{field.name}}" maxLength="{{field.maxLength}}" ng-model="field.value" class="form-control focusMe" />
            </div>
            <div ng-switch-when="textarea">
              <textarea placeholder="{{field.label}}" name="{{field.name}}" id="gather-{{field.name}}" ng-model="field.value" class="form-control focusMe"></textarea>
            </div>
            <div ng-switch-when="sms">
              <textarea maxlength="160" placeholder="{{field.label}}" name="{{field.name}}" id="gather-{{field.name}}" ng-model="field.value" class="form-control focusMe"></textarea>
            </div>
            <div ng-switch-when="time">
               <input type="time" placeholder="{{field.label}}" name="{{field.name}}" id="gather-{{field.name}}" ng-model="field.value" class="form-control focusMe" />
            </div>
            <div ng-switch-when="date">
               <input type="date" placeholder="{{field.label}}" name="{{field.name}}" id="gather-{{field.name}}" ng-model="field.value" class="form-control focusMe" />
            </div>
            <div ng-switch-when="checkbox" style="background-color:lightgray">
                <input type="checkbox" id="gather-{{field.name}}" name="{{field.name}}" ng-model="field.value" class="form-control" style="width:20px;height:20px;background-color:lightgray;font-size:21px;display:inline-block;">
                <label for="{{field.name}}">{{field.label}}</label>
            </div>
            <div ng-switch-when="select">

               <select name="{{field.name}}" id="gather-{{field.name}}" ng-options="option as option.label for option in field.options track by option.id" ng-model="field.value" class="form-control focusMe">
               </select>

            </div>
            <div ng-switch-when="select2">

               <select name="{{field.name}}" id="gather-{{field.name}}" placeholder="{{field.label}}"  ng-model="field.value" class="form-control focusMe">
               </select>

            </div>
            <div ng-switch-when="fromdatepicker">
              <div pickadate ng-model="pickDateService.from_date"></div>
            </div>
            <div ng-switch-when="todatepicker">
              <div pickadate ng-model="pickDateService.to_date"></div>
            </div>
          </div>

        </div>

        <md-button class="gatherSubmit md-primary md-raised" ng-click="gather.submit()">{{gather.form.submitValue}}</md-button>
        <md-button class="md-warn md-raised" ng-click="gather.cancel()">Cancel</md-button>
    </div>



</div>
