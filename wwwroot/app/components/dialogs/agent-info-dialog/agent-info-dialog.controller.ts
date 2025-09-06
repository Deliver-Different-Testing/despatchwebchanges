import "./agent-info-dialog.styles.less";
import {IAgentInfoDialog} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";

class AgentInfoDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'agent'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        public agent: IAgentInfoDialog
    ) {
        super();
    }

    formatPhone(phone: string): string {
        if (!phone) return '';

        // Basic US format: (555) 555-5555
        // This could be enhanced with international formatting
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
        }
        return phone;
    }

    getRankingArray(ranking: string): number[] {
        if (!ranking) return [];
        const rankNum = parseFloat(ranking);
        if (isNaN(rankNum)) return [];
        return new Array(Math.round(rankNum));
    }

    formatCoordinates(lat: number, lng: number): string {
        if (lat === undefined || lng === undefined) return '';

        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';

        return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default AgentInfoDialogController;
