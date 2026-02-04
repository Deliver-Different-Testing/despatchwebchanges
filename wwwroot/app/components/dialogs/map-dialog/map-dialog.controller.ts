import "./map-dialog.styles.less"
import OverviewService from "../../overview/overview.service";
import ConfigService from "../../../services/config.service";
import {MapConfig, OverviewTableParentJob} from "../../overview/overview.interfaces";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {HereMapCredentials} from "../../../interfaces/hereMapCredentials.interfaces";
import angular from 'angular';

export class MapDialogController implements angular.IController {
    static $inject = [
        "$mdDialog",
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
                console.error("Error initializing map:", error);
            });

        this.loading = false;
    }

    async getJob(jobId: number) {
        try {
            console.debug(`Getting job map for jobId: ${jobId}`);
            return await this.overviewService.getParentJobMap(jobId);
        } catch (error) {
            console.error("Error getting job map:", error);
        }
    }

    switchMapJob(index: number): void {
        console.debug(`Setting job on map to ${index === 0 ? "parent" : index}`);
        this.selectedJobIndex = index;
        this.mapConfig.selectedJobIndex = index;
        console.debug(this.mapConfig);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
