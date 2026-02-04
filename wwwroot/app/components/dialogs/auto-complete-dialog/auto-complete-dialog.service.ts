import {ISuggestion} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactAutoCompleteDialog?: {
            open: (
                title: string,
                placeholder: string,
                searchFn: (searchTerm: string) => Promise<ISuggestion[]>,
                existingItem?: ISuggestion,
                showRerateOption?: boolean,
                itemIcon?: string,
                minInputLength?: number
            ) => Promise<{ item: ISuggestion; shouldRerate: boolean } | null>;
        };
    }
}

class AutoCompleteDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
        'DispatchData',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        private dispatchData: DispatchCoreService,
    ) {
        console.debug('AutoCompleteDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React auto complete dialog module on demand
     */
    private async loadReactAutoCompleteDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactAutoCompleteDialog) {
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

            // Load the auto complete dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.autoCompleteDialogReact',
                files: [getAssetPath('autoCompleteDialogReact.js')]
            });
        } catch (error) {
            console.error('[AutoCompleteDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showAutocompleteDialog($event: MouseEvent,
                                 url: string,
                                 placeholder: string,
                                 fieldName: string,
                                 title: string,
                                 existingItem: ISuggestion | undefined,
                                 showRerateOption: boolean = false,
                                 itemIcon: string = "topic",
                                 minInputLength: number = 2): Promise<ISuggestion | undefined> {
        console.debug('AutoCompleteDialogService: showAutocompleteDialog called');

        try {
            // Load the React dialog module on demand
            await this.loadReactAutoCompleteDialog();

            if (!window.ReactAutoCompleteDialog) {
                throw new Error('React auto complete dialog not loaded');
            }

            // Create search function that uses the provided URL
            const searchFn = async (searchTerm: string): Promise<ISuggestion[]> => {
                return this.dispatchData.autocompleteSearch(searchTerm, url);
            };

            // Open the React dialog
            const result = await window.ReactAutoCompleteDialog.open(
                title,
                placeholder,
                searchFn,
                existingItem,
                showRerateOption,
                itemIcon,
                minInputLength
            );

            console.debug('AutoCompleteDialogService: Dialog closed!');

            if (!result) {
                return undefined;
            }

            // Return the selected item (shouldRerate can be accessed if needed)
            return result.item;
        } catch (error) {
            if (!error) {
                console.debug('User closed dialog');
                return undefined;
            }
            console.error('AutoCompleteDialogService: Error in showAutocompleteDialog', error);
            throw error;
        }
    }
}

export default AutoCompleteDialogService;
