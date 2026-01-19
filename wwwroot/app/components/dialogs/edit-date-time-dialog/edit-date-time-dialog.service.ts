import { IDialogDateTimeResult } from "../../../interfaces/dialog-result.interfaces";
import { ISuggestion } from "../../../interfaces/job.interface";
import { JobProperty } from "../../../enums/job-property.enum";
import dayjs from "dayjs";

// Type for the result from React dialog
interface EditDateTimeDialogResultFromReact {
    fieldName: string;
    value: dayjs.Dayjs;
    timezone: string;
}

// Type for the options passed to React dialog
interface EditDateTimeDialogOptions {
    title: string;
    fieldName: string;
    dateTime?: dayjs.Dayjs;
    defaultTimeZone?: string;
    showDate: boolean;
    showTime: boolean;
}

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactEditDateTimeDialog?: {
            showEditTimeDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResultFromReact | null>;
            showEditDateDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResultFromReact | null>;
            showEditDateAndTimeDialog: (options: EditDateTimeDialogOptions) => Promise<EditDateTimeDialogResultFromReact | null>;
        };
    }
}

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

        try {
            await this.loadReactDialog();

            if (!window.ReactEditDateTimeDialog) {
                throw new Error('React edit date time dialog not loaded');
            }

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

        try {
            await this.loadReactDialog();

            if (!window.ReactEditDateTimeDialog) {
                throw new Error('React edit date time dialog not loaded');
            }

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

        try {
            await this.loadReactDialog();

            if (!window.ReactEditDateTimeDialog) {
                throw new Error('React edit date time dialog not loaded');
            }

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
