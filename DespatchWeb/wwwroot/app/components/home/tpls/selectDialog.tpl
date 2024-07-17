<md-dialog aria-label="{{ title }}" id="{{ id }}">
    <form ng-cloak>
        <md-toolbar>
            <div class="md-toolbar-tools">
                <h2>Edit {{ title }}</h2>
                <span flex></span>
                <md-button class="md-icon-button" ng-click="cancel()">
                    <md-icon md-font-set="material-symbols-outlined" aria-label="Close dialog">
                        close
                    </md-icon>
                </md-button>
            </div>
        </md-toolbar>

        <md-dialog-content ng-cloak>
            <div class="md-dialog-content">
                <p>
                    Search for your desired {{ title }} below
                </p>
                <md-select ng-model="field.value" placeholder="{{ field.options.placeholder }}" aria-label="Select an option">
                    <md-option ng-repeat="item in field.options.items" ng-value="item">
                        {{ item.text }}
                    </md-option>
                </md-select>
            </div>
        </md-dialog-content>

        <md-dialog-actions layout="row" layout-align="center center">
            <md-button class="md-raised md-primary" ng-click="submit(field.value)">
                <md-icon md-font-set="material-symbols-outlined">save</md-icon>
                Update Field
            </md-button>
        </md-dialog-actions>
    </form>
</md-dialog>
