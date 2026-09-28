import { IDialogDateTimeResult } from "../../../interfaces/dialog-result.interfaces";
import { ISuggestion } from "../../../interfaces/job.interface";
import { JobProperty } from "../../../enums/job-property.enum";
import dayjs from "dayjs";
import angular from 'angular';

export class EditDateTimeDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('EditDateTimeDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React edit date time dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactEditDateTimeDialog) {
            return;
        }

        try {
            // Load the manifest to get hashed filenames
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the edit date time dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.editDateTimeDialogReact',
                files: [getAssetPath('editDateTimeDialogReact.js')]
            });
        } catch (error) {
            console.error('[EditDateTimeDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showEditTimeDialog(
        $event: MouseEvent,
        title: string,
        fieldName: JobProperty,
        dateTime?: dayjs.Dayjs,
        defaultTimeZone?: ISuggestion
    ): Promise<IDialogDateTimeResult | undefined> {
        console.debug('EditDateTimeDialogService: showEditTimeDialog called');

        await this.loadReactDialog();

        if (!window.ReactEditDateTimeDialog) {
            throw new Error('React edit date time dialog not loaded');
        }

        try {
            const result = await window.ReactEditDateTimeDialog.showEditTimeDialog({
                title,
                fieldName,
                dateTime,
                defaultTimeZone: defaultTimeZone?.text,
                showDate: false,
                showTime: true,
            });

            if (!result) {
                return undefined;
            }

            return {
                fieldName: result.fieldName as JobProperty,
                value: result.value,
                timezone: result.timezone,
            };
        } catch (error) {
            console.error('EditDateTimeDialogService: Error in showEditTimeDialog', error);
            throw error;
        }
    }

    async showEditDateDialog(
        $event: MouseEvent,
        title: string,
        fieldName: JobProperty,
        dateTime?: dayjs.Dayjs,
        defaultTimeZone?: ISuggestion
    ): Promise<IDialogDateTimeResult | undefined> {
        console.debug('EditDateTimeDialogService: showEditDateDialog called');

        await this.loadReactDialog();

        if (!window.ReactEditDateTimeDialog) {
            throw new Error('React edit date time dialog not loaded');
        }

        try {
            const result = await window.ReactEditDateTimeDialog.showEditDateDialog({
                title,
                fieldName,
                dateTime,
                defaultTimeZone: defaultTimeZone?.text,
                showDate: true,
                showTime: false,
            });

            if (!result) {
                return undefined;
            }

            return {
                fieldName: result.fieldName as JobProperty,
                value: result.value,
                timezone: result.timezone,
            };
        } catch (error) {
            console.error('EditDateTimeDialogService: Error in showEditDateDialog', error);
            throw error;
        }
    }

    async showEditDateAndTimeDialog(
        $event: MouseEvent,
        title: string,
        fieldName: JobProperty,
        dateTime?: dayjs.Dayjs,
        defaultTimeZone?: ISuggestion
    ): Promise<IDialogDateTimeResult | undefined> {
        console.debug('EditDateTimeDialogService: showEditDateAndTimeDialog called');

        await this.loadReactDialog();

        if (!window.ReactEditDateTimeDialog) {
            throw new Error('React edit date time dialog not loaded');
        }

        try {
            const result = await window.ReactEditDateTimeDialog.showEditDateAndTimeDialog({
                title,
                fieldName,
                dateTime,
                defaultTimeZone: defaultTimeZone?.text,
                showDate: true,
                showTime: true,
            });

            if (!result) {
                return undefined;
            }

            return {
                fieldName: result.fieldName as JobProperty,
                value: result.value,
                timezone: result.timezone,
            };
        } catch (error) {
            console.error('EditDateTimeDialogService: Error in showEditDateAndTimeDialog', error);
            throw error;
        }
    }
}
