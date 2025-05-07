import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {EditDateTimeDialogController} from "./edit-date-time-dialog.controller";
import {Suggestion} from "../../../interfaces/job.interface";

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

    private _getBaseDialogConfig($event: MouseEvent, title: string, fieldName: string, dateTime?: Date, defaultTimeZone?: Suggestion, showTimeZone: boolean = false) {
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
                showTimeZone
            }
        };
    }

    async showEditTimeDialog($event: MouseEvent, title: string, fieldName: string, dateTime?: Date, defaultTimeZone?: Suggestion, showTimeZone: boolean = false) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone).locals,
                showDate: false,
                showTime: true
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }

    async showEditDateDialog($event: MouseEvent, title: string, fieldName: string, dateTime?: Date, defaultTimeZone?: Suggestion, showTimeZone: boolean = false) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone).locals,
                showDate: true,
                showTime: false
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }

    async showEditDateAndTimeDialog($event: MouseEvent, title: string, fieldName: string, dateTime?: Date, defaultTimeZone?: Suggestion, showTimeZone: boolean = false) {
        const config = {
            ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone),
            locals: {
                ...this._getBaseDialogConfig($event, title, fieldName, dateTime, defaultTimeZone, showTimeZone).locals,
                showDate: true,
                showTime: true
            }
        };

        const result: IDialogDateTimeResult = await this.$mdDialog.show(config);
        return result;
    }
}
