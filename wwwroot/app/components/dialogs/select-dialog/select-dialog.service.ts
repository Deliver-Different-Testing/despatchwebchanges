import {ISuggestion} from "../../../interfaces/job.interface";
import {ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import angular from 'angular';

export class SelectDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('SelectDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    /**
     * Load the React select dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        if (window.ReactSelectDialog) {
            return;
        }

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the select dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.selectDialogReact',
                files: [getAssetPath('selectDialogReact.js')]
            });
        } catch (error) {
            console.error('[SelectDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showSelectDialog(
        _$event: MouseEvent,
        data: ISuggestion[],
        fieldName: string,
        title: string,
        initialValue: string | null | number = null,
        showCheckbox: boolean = false,
        checkboxLabel: string = ""
    ): Promise<ISelectDialogResult | undefined> {
        console.debug('SelectDialogService: showSelectDialog called');

        try {
            await this.loadReactDialog();

            if (!window.ReactSelectDialog) {
                throw new Error('React select dialog not loaded');
            }

            const result = await window.ReactSelectDialog.showSelectDialog({
                title,
                fieldName,
                items: data,
                initialValue,
                showCheckbox,
                checkboxLabel,
            });

            if (!result) {
                return undefined;
            }

            return {
                fieldName: result.fieldName,
                value: result.value,
                checkboxValue: result.checkboxValue,
            };
        } catch (error) {
            console.error('SelectDialogService: Error in showSelectDialog', error);
            throw error;
        }
    }
}
