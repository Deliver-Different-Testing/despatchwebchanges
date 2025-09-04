import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {EditDateTimeDialogController} from "./edit-date-time-dialog.controller";
import {ISuggestion} from "../../../interfaces/job.interface";
import {JobProperty} from "../../../enums/job-property.enum";

export class EditDateTimeDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EditDateTimeDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    private _getBaseDialogConfig($event: MouseEvent,
                                 title: string,
                                 fieldName: JobProperty | string,
                                 dateTime?: Date,
                                 defaultTimeZone?: ISuggestion) {
        return {
            controller: EditDateTimeDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./edit-date-time-dialog.template.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            bindToController: true,
            locals: {
                title,
                fieldName,
                dateTime,
                defaultTimeZone,
            }
        };
    }

    async showEditTimeDialog($event: MouseEvent, title: string, fieldName: JobProperty | string, dateTime?: Date, defaultTimeZone?: ISuggestion) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone).locals,
                showDate: false,
                showTime: true
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }

    async showEditDateDialog($event: MouseEvent, title: string, fieldName: JobProperty | string, dateTime?: Date, defaultTimeZone?: ISuggestion) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone).locals,
                showDate: true,
                showTime: false
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }

    async showEditDateAndTimeDialog($event: MouseEvent, title: string, fieldName: JobProperty | string, dateTime?: Date, defaultTimeZone?: ISuggestion) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone).locals,
                showDate: true,
                showTime: true
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }
}
