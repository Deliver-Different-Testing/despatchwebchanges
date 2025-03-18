import "./map-dialog.styles.less"
import OverviewService from "../../overview/overview.service";
import ConfigService from "../../../services/config.service";
import app from "../../../app";
import {MapConfig, OverviewTableParentJob} from "../../overview/overview.interfaces";

export class MapDialogController implements angular.IController {
    static $inject = ["$mdDialog", "overviewService", "configService", "delivery"];

    title: string;
    loading: boolean;
    selectedJobIndex: number;
    hereCredentials: { apiKey: string | null };
    mapConfig: MapConfig;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private overviewService: OverviewService,
        private configService: ConfigService,
        private delivery: OverviewTableParentJob) {

        this.title = `${delivery.jobName} Map`;
        this.loading = true;
        this.selectedJobIndex = 0;

        this.hereCredentials = {
            apiKey: null
        };

        this.mapConfig = {
            center: {lat: 39.8097343, lng: -98.5556199},
            zoom: 5,
            job: null,
            selectedJobIndex: 0, // Default to parent job view
            courierLocation: null
        };

        this.loading = false;
    }

    $onInit(): void {
        this.configService.getHereMapsKey()
            .then((apiKey) => {
                this.hereCredentials.apiKey = apiKey;
                return this.getJob(this.delivery.jobId);
            })
            .then((mapConfig) => {
                this.mapConfig = mapConfig;
            })
            .catch((error) => {
                console.error("Error initializing map:", error);
            })
            .finally(() => {
                this.loading = false;
            });
    }

    async getJob(jobId: number): Promise<MapConfig> {
        return await this.overviewService.getParentJobMap(jobId);
    }

    switchMapJob(index: number): void {
        console.log(`Setting job on map to ${index === 0 ? "parent" : index}`);
        this.selectedJobIndex = index;
        this.mapConfig.selectedJobIndex = index;
        console.log(this.mapConfig);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
