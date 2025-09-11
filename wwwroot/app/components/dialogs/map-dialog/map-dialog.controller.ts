import "./map-dialog.styles.less"
import OverviewService from "../../overview/overview.service";
import ConfigService from "../../../services/config.service";
import {MapConfig, OverviewTableParentJob} from "../../overview/overview.interfaces";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {HereMapCredentials} from "../../../interfaces/hereMapCredentials.interfaces";

export class MapDialogController implements angular.IController {
    static $inject = [
        "$mdDialog",
        "$log",
        "overviewService",
        "configService",
        "APP_CONFIG",
        "delivery"
    ];

    title: string;
    loading: boolean;
    selectedJobIndex: number;
    hereCredentials?: HereMapCredentials;
    mapConfig: MapConfig;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private overviewService: OverviewService,
        private configService: ConfigService,
        private appConfig: IAppConfig,
        private delivery: OverviewTableParentJob) {

        this.title = `${delivery.jobName} Map`;
        this.loading = true;
        this.selectedJobIndex = 0;

        this.mapConfig = {
            center: this.appConfig.US_Customer
                ? this.appConfig.US_Coordinates_Center
                : this.appConfig.NZ_Coordinates_Center,
            zoom: 5,
            job: null,
            selectedJobIndex: 0, // Default to parent job view
            courierLocation: null
        };

        this.configService.getHereMapsKey()
            .then((apiKey) => {
                this.hereCredentials = {apiKey: apiKey};
                return this.getJob(this.delivery.jobId);
            })
            .then((mapConfig) => {
                if (!mapConfig) return;
                this.mapConfig = mapConfig;
            })
            .catch((error) => {
                this.$log.error("Error initializing map:", error);
            });

        this.loading = false;
    }

    async getJob(jobId: number) {
        try {
            this.$log.debug(`Getting job map for jobId: ${jobId}`);
            return await this.overviewService.getParentJobMap(jobId);
        } catch (error) {
            this.$log.error("Error getting job map:", error);
        }
    }

    switchMapJob(index: number): void {
        this.$log.debug(`Setting job on map to ${index === 0 ? "parent" : index}`);
        this.selectedJobIndex = index;
        this.mapConfig.selectedJobIndex = index;
        this.$log.debug(this.mapConfig);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
