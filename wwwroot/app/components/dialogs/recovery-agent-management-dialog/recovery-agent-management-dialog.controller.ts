import "./recovery-agent-management.styles.less";
import {IAgent, Suggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import NationwideService from "../../Nationwide/nationwide.service";
import ToastrService from "../../../services/toastr.service";
import {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel,
    RecoveryJobViewModel
} from "./recovery-agent-management-dialog.interfaces";

class RecoveryAgentManagementController extends BaseController {
    static $inject = [
        '$mdDialog',
        'NWData',
        'job',
    ];

    selectedAirport?: Suggestion;
    selectedAgent?: IAgent;
    showAssignForm: boolean = false;
    selectedRecoveryJob?: RecoveryJobViewModel;

    agentOptions?: Suggestion[];
    airportOptions?: Suggestion[];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private nationwideService: NationwideService,
        private toastrService: ToastrService,
        public job: RecoveryAgentJobViewModel,
    ) {
        super();
        console.log('RecoveryAgentManagementController: Controller instantiated');
        this.initAirports();
    }

    private initAirports() {
        this.nationwideService.getAllActiveAirports().then(airport => {
            this.airportOptions = airport;
        });
    }

    async getAgentOptionsForAirport(airport: Suggestion) {
        if (!airport) {
            this.agentOptions = [];
            return;
        }
        
        this.agentOptions = await this.nationwideService.getAgentOptionsByAirport(airport.id);
    }

    showAssignAgentForm(recoveryJob?: RecoveryJobViewModel): void {
        this.selectedRecoveryJob = recoveryJob || undefined;
        this.showAssignForm = true;
    }

    hideAssignAgentForm(): void {
        this.showAssignForm = false;
        this.selectedAirport = undefined;
        this.selectedAgent = undefined;
        this.selectedRecoveryJob = undefined;
        this.agentOptions = [];
    }

    async assignAgent(): Promise<void> {
        if (!this.selectedAirport || !this.selectedAgent) {
            this.toastrService.showWarningToast('Please select both airport and agent');
            return;
        }

        try {
            const addAgentRequest: AddAgentRecoveryRequest = {
                jobId: this.job.jobId,
                agentId: this.selectedAgent.agentId,
                airportId: this.selectedAirport.id,
                isPrimaryRecoveryAgent: false
            };

            await this.nationwideService.addAgentRecoveryJob(addAgentRequest);

            // Refresh the job data to get the updated assignments
            this.job = await this.nationwideService.getAgentRecoveryJobs(this.job.jobId);

            this.hideAssignAgentForm();
            this.toastrService.showSuccessToast(`${this.selectedAgent.agentName} has been assigned to search at ${this.selectedAirport.text}`);
        } catch (error) {
            console.error('Error assigning agent:', error);
            this.toastrService.showErrorToast('Failed to assign agent. Please try again.');
        }
    }

    // New method to handle agent removal
   /* async removeAgent(agent: any): Promise<void> {
        if (!confirm(`Are you sure you want to remove ${agent.agentName} from this assignment?`)) {
            return;
        }

        try {
            // Assuming you have a service method to remove agents
            // You'll need to implement this in your NationwideService
            await this.nationwideService.removeAgentRecoveryJob(agent.recoveryId);

            // Refresh the job data
            this.job = await this.nationwideService.getAgentRecoveryJobs(this.job.jobId);

            this.toastrService.showSuccessToast(`${agent.agentName} has been removed from the assignment`);
        } catch (error) {
            console.error('Error removing agent:', error);
            this.toastrService.showErrorToast('Failed to remove agent. Please try again.');
        }
    }*/

    getRankingArray(rating: number): number[] {
        if (!rating) return [];
        return new Array(Math.round(rating));
    }

    getStatusClass(status: string): string {
        const statusMap: { [key: string]: string } = {
            'assigned': 'status-assigned',
            'searching': 'status-searching',
            'pending': 'status-pending',
            'completed': 'status-completed'
        };
        return statusMap[status] || 'status-pending';
    }

    getStatusLabel(status: string): string {
        const labelMap: { [key: string]: string } = {
            'assigned': 'Currently Assigned',
            'searching': 'Currently Searching',
            'pending': 'Pending Assignment',
            'completed': 'Assignment Completed'
        };
        return labelMap[status] || 'Unknown Status';
    }

    getAgentTypeLabel(isPrimary: boolean): string {
        return isPrimary ? 'Primary Recovery Agent' : 'Additional Recovery Agent';
    }

    // Helper method to check if there are any recovery jobs
    hasRecoveryJobs(): boolean {
        return this.job && this.job.recoveryJobs && this.job.recoveryJobs.length > 0;
    }

    // Helper method to get total number of agents
    getTotalAgentsCount(): number {
        if (!this.job || !this.job.recoveryJobs) return 0;
        return this.job.recoveryJobs.reduce((total, job) => total + (job.recoveryAgents?.length || 0), 0);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    close(): void {
        this.$mdDialog.hide();
    }
}

export default RecoveryAgentManagementController;