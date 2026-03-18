import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {IDispatchJob, ISuggestion} from "../../../interfaces/job.interface";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import countSubJobs from "../../../functions/countSubJobs";
import {Dayjs} from "dayjs";
import angular from 'angular';

// Type for the flight data passed to React dialog (with Dayjs dates)
interface FlightViewModelForReact {
    flightNumber: string;
    departureTime?: Dayjs;
    arrivalTime?: Dayjs;
    departureTimeZone?: string;
    arrivalTimeZone?: string;
    flightSegments: Array<{
        segmentOrder: number;
        departureAirportFsCode: string;
        departureAirportName: string;
        departureAirportCity: string;
        departureAirportId?: number;
        departureAirportTimeZone: string;
        arrivalAirportFsCode: string;
        arrivalAirportName: string;
        arrivalAirportCity: string;
        arrivalAirportId?: number;
        arrivalAirportTimeZone: string;
        departureTime: Dayjs;
        arrivalTime: Dayjs;
        carrierFsCode: string;
        flightNumber: string;
        airlineName: string;
        departureTerminal?: string;
        arrivalTerminal?: string;
    }>;
}

class FlightAgentConfirmationDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.debug('FlightAgentConfirmationDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React flight agent confirmation dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactFlightAgentConfirmationDialog) {
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

            // Load the flight agent confirmation dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.flightAgentConfirmationDialogReact',
                files: [getAssetPath('flightAgentConfirmationDialogReact.js')]
            });
        } catch (error) {
            console.error('[FlightAgentConfirmationDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async flightConfirmationDialog(_$event: MouseEvent, job: IDispatchJob, flight: IFlightViewModel): Promise<FlightAgentConfirmationDialogResult> {
        console.debug('FlightAgentConfirmationDialogService: flightConfirmationDialog called');

        try {
            // Load the React dialog module on demand
            await this.loadReactDialog();

            if (!window.ReactFlightAgentConfirmationDialog) {
                throw new Error('React flight agent confirmation dialog not loaded');
            }

            // Open the React dialog
            const result = await window.ReactFlightAgentConfirmationDialog.openFlightDialog({
                jobId: job.id,
                jobNumber: job.jobNo,
                flight: flight as unknown as FlightViewModelForReact,
                existingAwb: job.conNote,
                dgClass: job.dgClass,
            });

            console.debug('FlightAgentConfirmationDialogService: Dialog closed with result:', result);

            // Convert result to expected format
            return {
                shouldAssign: result.shouldAssign,
                awb: result.awb,
                shouldAssignToStopJobs: result.shouldAssignToStopJobs,
                packageReadyTime: result.packageReadyTime,
                packageDeliverByTime: result.packageDeliverByTime,
                packageDeliveryNotes: result.packageDeliveryNotes,
            };
        } catch (error) {
            console.error('FlightAgentConfirmationDialogService: Error in flightConfirmationDialog', error);
            return {
                shouldAssign: false,
                awb: undefined,
            };
        }
    }

    async agentConfirmationDialog(_$event: MouseEvent, job: IDispatchJob, agent: ISuggestion): Promise<FlightAgentConfirmationDialogResult> {
        console.debug('FlightAgentConfirmationDialogService: agentConfirmationDialog called');
        const stopJobCount = job.relatedJobs ? countSubJobs(job.jobNo, job.relatedJobs) : 0;

        try {
            // Load the React dialog module on demand
            await this.loadReactDialog();

            if (!window.ReactFlightAgentConfirmationDialog) {
                throw new Error('React flight agent confirmation dialog not loaded');
            }

            // Open the React dialog
            const result = await window.ReactFlightAgentConfirmationDialog.openAgentDialog({
                jobId: job.id,
                jobNumber: job.jobNo,
                agent: agent,
                existingAwb: job.conNote,
                dgClass: job.dgClass,
                stopJobCount,
            });

            console.debug('FlightAgentConfirmationDialogService: Dialog closed with result:', result);

            // Convert result to expected format
            return {
                shouldAssign: result.shouldAssign,
                awb: result.awb,
                shouldAssignToStopJobs: result.shouldAssignToStopJobs,
                packageReadyTime: result.packageReadyTime,
                packageDeliverByTime: result.packageDeliverByTime,
                packageDeliveryNotes: result.packageDeliveryNotes,
            };
        } catch (error) {
            console.error('FlightAgentConfirmationDialogService: Error in agentConfirmationDialog', error);
            return {
                shouldAssign: false,
                awb: undefined,
            };
        }
    }
}

export default FlightAgentConfirmationDialogService;
