import { IFlightViewModel } from "../../Nationwide/nationwide.interfaces";
import angular from 'angular';

class FlightDetailsDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.debug('FlightDetailsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React flight details dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactFlightDetailsDialog) {
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

            // Load the flight details dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.flightDetailsDialogReact',
                files: [getAssetPath('flightDetailsDialogReact.js')]
            });
        } catch (error) {
            console.error('[FlightDetailsDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async openFlightDetailsDialog($event: MouseEvent, flightData: IFlightViewModel): Promise<void> {
        console.debug('FlightDetailsDialogService: openFlightDetailsDialog called');

        try {
            // Load the React dialog module on demand
            await this.loadReactDialog();

            if (!window.ReactFlightDetailsDialog) {
                throw new Error('React flight details dialog not loaded');
            }

            // Open the React dialog
            await window.ReactFlightDetailsDialog.openFlightDetailsDialog(flightData);

            console.debug('FlightDetailsDialogService: Dialog closed');
        } catch (error) {
            console.error('FlightDetailsDialogService: Error in openFlightDetailsDialog', error);
            throw error;
        }
    }
}

export default FlightDetailsDialogService;
