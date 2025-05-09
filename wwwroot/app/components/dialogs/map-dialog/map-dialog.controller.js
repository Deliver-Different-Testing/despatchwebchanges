"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapDialogController = void 0;
require("./map-dialog.styles.less");
class MapDialogController {
    constructor($mdDialog, overviewService, configService, delivery) {
        this.$mdDialog = $mdDialog;
        this.overviewService = overviewService;
        this.configService = configService;
        this.delivery = delivery;
        this.title = `${delivery.jobName} Map`;
        this.loading = true;
        this.selectedJobIndex = 0;
        this.hereCredentials = {
            apiKey: null
        };
        this.mapConfig = {
            center: { lat: 39.8097343, lng: -98.5556199 },
            zoom: 5,
            job: null,
            selectedJobIndex: 0,
            courierLocation: null
        };
        this.loading = false;
    }
    $onInit() {
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
    getJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.overviewService.getParentJobMap(jobId);
        });
    }
    switchMapJob(index) {
        console.log(`Setting job on map to ${index === 0 ? "parent" : index}`);
        this.selectedJobIndex = index;
        this.mapConfig.selectedJobIndex = index;
        console.log(this.mapConfig);
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.MapDialogController = MapDialogController;
MapDialogController.$inject = ["$mdDialog", "overviewService", "configService", "delivery"];
